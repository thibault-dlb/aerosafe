<#
.SYNOPSIS
    Copies the data folder (the PRC 2024 files, their manifest and the resume prompt) elsewhere.

.DESCRIPTION
    Copies every file of the `data` folder of the repository to -Destination, keeping the
    folders, with a precise progress: a live bar and one line a file with the share done, the
    speed and the time left. A file already at the destination with the same size is skipped,
    so a copy that was stopped is resumed by running the command again. Nothing is ever deleted
    at the destination. At the end, every size is compared.

    Then run `uv run scripts/verify_prc2024.py check data/prc2024` on the copy: it reads every
    column of every row and compares them with MANIFEST.csv, which is copied with the data.

.PARAMETER Destination
    The folder that receives the copy, for example E:\aerosafe\data or \\other-pc\share\data.

.PARAMETER Source
    The folder to copy. Default: the `data` folder of the repository.

.PARAMETER DryRun
    Only prints what would be copied and checks the free space. Nothing is written.

.EXAMPLE
    .\scripts\copy-prc2024.ps1 -Destination E:\aerosafe\data
#>
param(
    [Parameter(Mandatory)] [string] $Destination,
    [string] $Source = (Join-Path (Split-Path $PSScriptRoot -Parent) 'data'),
    [switch] $DryRun
)

$ErrorActionPreference = 'Stop'

function Format-Duration([double] $Seconds) {
    $total = [int][math]::Round($Seconds)
    $hours = [math]::Floor($total / 3600)
    $minutes = [math]::Floor(($total % 3600) / 60)
    $left = $total % 60
    if ($hours -gt 0) { return '{0} h {1:00} min' -f $hours, $minutes }
    if ($minutes -gt 0) { return '{0} min {1:00} s' -f $minutes, $left }
    return '{0} s' -f $left
}

if (-not (Test-Path -LiteralPath $Source -PathType Container)) { throw "$Source is not a folder" }
$Source = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\')
$Destination = $Destination.TrimEnd('\')

# The small files first (the manifest, the prompt), then the data, oldest day first.
$files = Get-ChildItem -LiteralPath $Source -Recurse -File |
    Sort-Object @{ Expression = { $_.Length -gt 50MB } }, FullName
$totalBytes = ($files | Measure-Object Length -Sum).Sum
$plan = foreach ($file in $files) {
    $relative = $file.FullName.Substring($Source.Length).TrimStart('\')
    $target = Join-Path $Destination $relative
    [pscustomobject]@{
        File   = $file
        Target = $target
        Done   = (Test-Path -LiteralPath $target -PathType Leaf) -and ((Get-Item -LiteralPath $target).Length -eq $file.Length)
    }
}
$toCopy = @($plan | Where-Object { -not $_.Done })
$bytesToCopy = ($toCopy | ForEach-Object { $_.File.Length } | Measure-Object -Sum).Sum
if (-not $bytesToCopy) { $bytesToCopy = 0 }

'{0} files, {1:N1} GB in {2}' -f $files.Count, ($totalBytes / 1GB), $Source
'{0} to copy ({1:N1} GB), {2} already at the destination with the same size' -f $toCopy.Count, ($bytesToCopy / 1GB), ($files.Count - $toCopy.Count)

$root = [System.IO.Path]::GetPathRoot($Destination)
if ($root -and $root -notmatch '^\\\\') {
    $free = (Get-PSDrive -Name $root.Substring(0, 1) -ErrorAction SilentlyContinue).Free
    if ($null -ne $free) {
        '{0:N1} GB free on {1}' -f ($free / 1GB), $root
        if ($free -lt $bytesToCopy) { throw 'Not enough free space on the destination drive' }
    }
}
if ($DryRun) { 'Dry run: nothing was copied.'; return }

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$started = Get-Date
$copiedBytes = 0
$index = 0
foreach ($item in $plan) {
    $index++
    $file = $item.File
    $detail = ''
    if ($item.Done) {
        $detail = 'already there'
    }
    else {
        $folder = Split-Path $item.Target -Parent
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
        $lap = Get-Date
        # One file at a time, quiet: robocopy retries by itself. Exit codes 0 to 7 are a success.
        & robocopy (Split-Path $file.FullName -Parent) $folder $file.Name /J /R:3 /W:5 /NJH /NJS /NP /NFL /NDL | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy failed on $($file.Name) (code $LASTEXITCODE)" }
        $copiedBytes += $file.Length
        $seconds = ((Get-Date) - $lap).TotalSeconds
        $detail = '{0:N0} MB/s' -f ($file.Length / 1MB / [math]::Max($seconds, 0.001))
    }
    $doneBytes = ($totalBytes - $bytesToCopy) + $copiedBytes
    $elapsed = ((Get-Date) - $started).TotalSeconds
    $rate = if ($elapsed -gt 0) { $copiedBytes / $elapsed } else { 0 }
    # The time left means nothing before a few seconds of real copying: say so instead.
    $left = if ($copiedBytes -ge 1GB -and $elapsed -ge 5) { ($bytesToCopy - $copiedBytes) / $rate } else { $null }
    $leftText = if ($null -eq $left) { 'estimating' } else { Format-Duration $left }
    $percent = if ($totalBytes -gt 0) { 100 * $doneBytes / $totalBytes } else { 100 }
    Write-Progress -Activity 'Copying the data' -Status ('{0} of {1} files, {2:N1} of {3:N1} GB, time left {4}' -f $index, $files.Count, ($doneBytes / 1GB), ($totalBytes / 1GB), $leftText) -PercentComplete $percent
    '[{0}/{1}] {2,-24} {3,7:N0} MB  {4}  |  {5,5:N1} %  {6:N1} / {7:N1} GB  average {8:N0} MB/s  left: {9}' -f $index, $files.Count, $file.Name, ($file.Length / 1MB), $detail.PadRight(13), $percent, ($doneBytes / 1GB), ($totalBytes / 1GB), ($rate / 1MB), $leftText
}
Write-Progress -Activity 'Copying the data' -Completed

# Every file must be there with the size of the original.
$missing = @($plan | Where-Object {
        -not (Test-Path -LiteralPath $_.Target -PathType Leaf) -or ((Get-Item -LiteralPath $_.Target).Length -ne $_.File.Length)
    })
if ($missing.Count -gt 0) {
    $missing | ForEach-Object { 'PROBLEM: ' + $_.Target }
    throw ('{0} file(s) missing or with another size at the destination' -f $missing.Count)
}
'Copy complete: {0} files, {1:N1} GB, in {2}.' -f $files.Count, ($totalBytes / 1GB), (Format-Duration ((Get-Date) - $started).TotalSeconds)
'Next, on the copy: uv run scripts/verify_prc2024.py check data/prc2024'
# robocopy answers 1 when it copied something: that is not an error of this script.
$global:LASTEXITCODE = 0
