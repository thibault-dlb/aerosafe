param(
    [int]$MaxThreads = 11,
    # Each config is "files:workers": that many daily files at the same time, each with that many insert workers.
    # PostgreSQL gets what is left of MaxThreads (files x workers + PostgreSQL CPU <= MaxThreads).
    [string[]]$Configs = @('1:5', '1:6', '1:8', '2:3', '2:4', '3:2', '3:3'),
    [string]$FirstDay = '2022-07-01',
    [int]$Days = 3,
    [string]$Container = 'aerosafe_postgres',
    [switch]$DryRun
)

# Finds the fastest split of the threads between the files imported at the same time, the insert workers of
# each file and PostgreSQL. For each config, PostgreSQL is limited (docker update --cpus), the database is
# emptied, then the same days are imported. DESTRUCTIVE: it empties AERONEF, VOL, OBSERVATION and ALERTE of the
# database of the container, before every run and at the end. Use it on the development database only.
# ASCII only on purpose.

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$api = Join-Path $repoRoot 'src\api'
$envFile = Join-Path $repoRoot '.env'

function Get-EnvValue([string]$name) {
    $m = Select-String -Path $envFile -Pattern "^$name=(.*)$" | Select-Object -First 1
    if (-not $m) { throw "$name is missing from $envFile" }
    return $m.Matches.Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Format-Time([double]$s) {
    $t = [TimeSpan]::FromSeconds([math]::Round($s))
    return ('{0}:{1:00}:{2:00}' -f [int][math]::Floor($t.TotalHours), $t.Minutes, $t.Seconds)
}

function Invoke-Sql([string]$sql) {
    $sql | docker exec -i $Container psql -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -At
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $sql" }
}

# The application user cannot TRUNCATE or CHECKPOINT: the administrator of the container does it.
$dbUser = Get-EnvValue 'POSTGRES_USER'
$dbName = Get-EnvValue 'DB_NAME'
$dbPass = Get-EnvValue 'DB_PASS'

$first = [datetime]::ParseExact($FirstDay, 'yyyy-MM-dd', $null)
$lastDay = $first.AddDays($Days - 1).ToString('yyyy-MM-dd')
foreach ($offset in 0..($Days - 1)) {
    $file = Join-Path $repoRoot ('data\prc2024\{0}.parquet' -f $first.AddDays($offset).ToString('yyyy-MM-dd'))
    if (-not (Test-Path $file)) { throw "File not found: $file" }
}

$plan = @($Configs | ForEach-Object {
    $files, $workers = $_ -split ':' | ForEach-Object { [int]$_ }
    [pscustomobject]@{ Files = $files; Workers = $workers; ClientThreads = $files * $workers; PostgresCpu = $MaxThreads - $files * $workers }
})
if ($plan | Where-Object { $_.Files -lt 1 -or $_.Workers -lt 1 -or $_.PostgresCpu -lt 1 }) { throw 'Every run needs at least one file, one worker and one CPU for PostgreSQL.' }
if ($plan | Where-Object { $_.Files -gt $Days }) { throw "More files at the same time than days ($Days): use -Days or fewer parallel files." }

Write-Host ('Days {0} to {1}, {2} threads at most (client + PostgreSQL CPU), database {3} in {4}' -f $FirstDay, $lastDay, $MaxThreads, $dbName, $Container) -ForegroundColor Cyan
$plan | Format-Table -AutoSize | Out-Host
if ($DryRun) { Write-Host 'Dry run: nothing was changed.' -ForegroundColor Yellow; return }

if ((docker inspect -f '{{.State.Running}}' $Container 2>$null) -ne 'true') { throw "The container $Container is not running." }
$busy = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*services.historical.cli*' }
if ($busy) { throw 'An import is running: wait for it to finish (or stop it) before the benchmark.' }

$env:DB_HOST = '127.0.0.1'
$env:DB_PASS = $dbPass
$results = New-Object System.Collections.Generic.List[object]
$overall = [System.Diagnostics.Stopwatch]::StartNew()
$i = 0

foreach ($run in $plan) {
    $i++
    Write-Host ("`n[{0}/{1}] {2} file(s) at a time x {3} workers, PostgreSQL limited to {4} CPU" -f $i, $plan.Count, $run.Files, $run.Workers, $run.PostgresCpu) -ForegroundColor Cyan
    docker update --cpus $run.PostgresCpu $Container | Out-Null
    Invoke-Sql 'TRUNCATE TABLE "OBSERVATION", "VOL", "AERONEF", "ALERTE" RESTART IDENTITY;' | Out-Null
    Invoke-Sql 'CHECKPOINT;' | Out-Null

    Push-Location $api
    $clock = [System.Diagnostics.Stopwatch]::StartNew()
    uv run python -m services.historical.cli ..\..\data\prc2024 --area france-100km --from $FirstDay --to $lastDay --workers $run.Workers --parallel-files $run.Files
    $code = $LASTEXITCODE
    $seconds = $clock.Elapsed.TotalSeconds
    Pop-Location
    if ($code -ne 0) { throw ("The import failed (exit code {0}) with {1} file(s) x {2} workers." -f $code, $run.Files, $run.Workers) }

    $points = [long](Invoke-Sql 'SELECT count(*) FROM "OBSERVATION";')
    $rate = $points / $seconds
    $results.Add([pscustomobject]@{ Files = $run.Files; Workers = $run.Workers; PostgresCpu = $run.PostgresCpu; Points = $points; Seconds = [math]::Round($seconds, 1); PointsPerSecond = [math]::Round($rate) })
    Write-Host ('    {0:N0} points in {1} s: {2:N0} points/s (whole command, reading and checks included)' -f $points, [math]::Round($seconds), $rate) -ForegroundColor Green
}

Invoke-Sql 'TRUNCATE TABLE "OBSERVATION", "VOL", "AERONEF", "ALERTE" RESTART IDENTITY;' | Out-Null
$best = $results | Sort-Object PointsPerSecond -Descending | Select-Object -First 1
docker update --cpus $best.PostgresCpu $Container | Out-Null

Write-Host "`nResults, fastest first (the database was emptied again):" -ForegroundColor Cyan
$results | Sort-Object PointsPerSecond -Descending | Format-Table -AutoSize | Out-Host
Write-Host ('Fastest: {0} file(s) at a time x {1} workers and {2} CPU for PostgreSQL ({3:N0} points/s). PostgreSQL stays limited to {2} CPU.' -f $best.Files, $best.Workers, $best.PostgresCpu, $best.PointsPerSecond) -ForegroundColor Green
Write-Host ('Total time: {0}' -f (Format-Time $overall.Elapsed.TotalSeconds))
