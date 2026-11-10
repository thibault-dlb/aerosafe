param(
    [switch]$DryRun
)

# Downloads the whole PRC Data Challenge 2024 trajectories (one parquet per day), the flight list and the README
# into data/prc2024 at the repository root (ignored by git, see .gitignore).
# Resumable: finished files are skipped, partial files are continued. ASCII only on purpose (Windows PowerShell 5.1).

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repoRoot = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $repoRoot 'data\prc2024'
New-Item -ItemType Directory -Force $dir | Out-Null
$api = 'https://data.4tu.nl/v2/articles/8cb8484b-dbe7-4750-8b87-a5b1dbc621b4'

function Format-Size([double]$b) {
    if ($b -ge 1GB) { return ('{0:N2} GB' -f ($b / 1GB)) }
    if ($b -ge 1MB) { return ('{0:N1} MB' -f ($b / 1MB)) }
    return ('{0:N0} KB' -f ($b / 1KB))
}

function Format-Time([double]$s) {
    if ($s -lt 0 -or [double]::IsInfinity($s) -or [double]::IsNaN($s)) { return '--:--:--' }
    $t = [TimeSpan]::FromSeconds([math]::Round($s))
    return ('{0}:{1:00}:{2:00}' -f [int][math]::Floor($t.TotalHours), $t.Minutes, $t.Seconds)
}

Write-Host 'Reading the file list from 4TU...' -ForegroundColor Cyan
$meta = Invoke-RestMethod -Uri $api
$wanted = @('flight_list.csv', 'README.txt')
$files = @($meta.files | Where-Object { $_.name -like '*.parquet' -or $wanted -contains $_.name } | Sort-Object name)
if ($files.Count -eq 0) { throw 'No file found in the 4TU response.' }

# Plan: what is already complete, what is partial, what remains.
$totalBytes = [long]0
$presentBytes = [long]0
$completeBytes = [long]0
$firstPartial = $null
$todo = New-Object System.Collections.Generic.List[object]
foreach ($f in $files) {
    $size = [long]$f.size
    $totalBytes += $size
    $path = Join-Path $dir $f.name
    $have = [long]0
    if (Test-Path $path) {
        $have = (Get-Item $path).Length
        if ($have -gt $size) { Remove-Item $path -Force; $have = 0 }
    }
    if ($have -eq $size) { $presentBytes += $size; $completeBytes += $size }
    else {
        $presentBytes += $have
        if ($null -eq $firstPartial) { $firstPartial = $have }
        $todo.Add($f)
    }
}
$remainingBytes = $totalBytes - $presentBytes
$free = (Get-PSDrive -Name ((Get-Item $dir).PSDrive.Name)).Free

Write-Host ('Files  : {0} in total, {1} already complete, {2} to download' -f $files.Count, ($files.Count - $todo.Count), $todo.Count)
Write-Host ('Size   : {0} in total, {1} already here, {2} remaining' -f (Format-Size $totalBytes), (Format-Size $presentBytes), (Format-Size $remainingBytes))
Write-Host ('Disk   : {0} free on the drive of {1}' -f (Format-Size $free), $dir)
if ($free -lt ($remainingBytes * 1.02)) { throw 'Not enough free disk space for the remaining download.' }
if ($DryRun) { Write-Host 'Dry run: nothing was downloaded.' -ForegroundColor Yellow; return }
if ($todo.Count -eq 0) { Write-Host 'Everything is already downloaded.' -ForegroundColor Green; return }

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromHours(6)
$buffer = New-Object byte[] (1MB)
$clock = [System.Diagnostics.Stopwatch]::StartNew()
$samples = New-Object System.Collections.Generic.Queue[object]
$script:finishedBytes = $completeBytes
$sessionStartBytes = $completeBytes + $firstPartial
$script:fileIndex = 0
$doneFiles = $files.Count - $todo.Count

function Show-Progress($f, [long]$fileBytes, [long]$fileSize) {
    $now = $clock.Elapsed.TotalSeconds
    $global = $script:finishedBytes + $fileBytes
    $samples.Enqueue(@($now, $global))
    while ($samples.Count -gt 2 -and ($now - $samples.Peek()[0]) -gt 5) { [void]$samples.Dequeue() }
    $first = $samples.Peek()
    $dt = $now - $first[0]
    $speed = 0.0
    if ($dt -gt 0) { $speed = ($global - $first[1]) / $dt }
    $avg = 0.0
    if ($now -gt 0) { $avg = ($global - $sessionStartBytes) / $now }
    $eta = -1
    if ($avg -gt 0) { $eta = ($totalBytes - $global) / $avg }
    $pctAll = [int][math]::Min(100, [math]::Floor(100.0 * $global / $totalBytes))
    $pctFile = [int][math]::Min(100, [math]::Floor(100.0 * $fileBytes / $fileSize))
    $n = $doneFiles + $script:fileIndex
    Write-Progress -Id 1 -Activity ('TOTAL: file {0} of {1}' -f $n, $files.Count) `
        -Status ('{0} / {1} ({2} %) | {3}/s | elapsed {4} | REMAINING {5}' -f (Format-Size $global), (Format-Size $totalBytes), $pctAll, (Format-Size $speed), (Format-Time $now), (Format-Time $eta)) `
        -PercentComplete $pctAll
    Write-Progress -Id 2 -ParentId 1 -Activity ('CURRENT: {0}' -f $f.name) `
        -Status ('{0} / {1} ({2} %) | {3}/s' -f (Format-Size $fileBytes), (Format-Size $fileSize), $pctFile, (Format-Size $speed)) `
        -PercentComplete $pctFile
}

function Get-OneFile($f) {
    $path = Join-Path $dir $f.name
    $size = [long]$f.size
    $offset = [long]0
    if (Test-Path $path) { $offset = (Get-Item $path).Length }
    $req = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::Get), $f.download_url
    if ($offset -gt 0) { [void]$req.Headers.TryAddWithoutValidation('Range', "bytes=$offset-") }
    $resp = $client.SendAsync($req, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    $in = $null; $out = $null
    try {
        [void]$resp.EnsureSuccessStatusCode()
        $mode = [System.IO.FileMode]::Append
        if ($offset -gt 0 -and [int]$resp.StatusCode -ne 206) { $mode = [System.IO.FileMode]::Create; $offset = 0 }
        if ($offset -eq 0) { $mode = [System.IO.FileMode]::Create }
        $in = $resp.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $out = New-Object System.IO.FileStream $path, $mode, ([System.IO.FileAccess]::Write), ([System.IO.FileShare]::Read), 1MB
        $fileBytes = $offset
        $lastShow = -1.0
        while (($n = $in.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $out.Write($buffer, 0, $n)
            $fileBytes += $n
            if (($clock.Elapsed.TotalSeconds - $lastShow) -ge 0.5) {
                Show-Progress $f $fileBytes $size
                $lastShow = $clock.Elapsed.TotalSeconds
            }
        }
        Show-Progress $f $fileBytes $size
    }
    finally {
        if ($out) { $out.Dispose() }
        if ($in) { $in.Dispose() }
        $resp.Dispose()
        $req.Dispose()
    }
    if ((Get-Item $path).Length -ne $size) { throw ('Wrong size for {0}: {1} instead of {2}' -f $f.name, (Get-Item $path).Length, $size) }
}

try {
    foreach ($f in $todo) {
        $script:fileIndex++
        $fileStart = $clock.Elapsed.TotalSeconds
        $ok = $false
        for ($attempt = 1; $attempt -le 30 -and -not $ok; $attempt++) {
            try {
                Get-OneFile $f
                $ok = $true
            }
            catch {
                Write-Host ('[!] {0}: {1} (attempt {2}/30)' -f $f.name, $_.Exception.Message, $attempt) -ForegroundColor Yellow
                Start-Sleep -Seconds ([math]::Min(60, 5 * $attempt))
            }
        }
        if (-not $ok) { throw ('Giving up on {0} after 30 attempts. Run the command again to resume.' -f $f.name) }
        $script:finishedBytes += [long]$f.size
        $took = $clock.Elapsed.TotalSeconds - $fileStart
        Write-Host ('[{0}/{1}] {2} OK ({3} en {4})' -f ($doneFiles + $script:fileIndex), $files.Count, $f.name, (Format-Size $f.size), (Format-Time $took)) -ForegroundColor DarkGray
    }
}
finally {
    Write-Progress -Id 2 -Activity 'x' -Completed
    Write-Progress -Id 1 -Activity 'x' -Completed
    $client.Dispose()
}

Write-Host ('Done: {0} files in {1} (took {2})' -f $files.Count, $dir, (Format-Time $clock.Elapsed.TotalSeconds)) -ForegroundColor Green
