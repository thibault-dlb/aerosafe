#!/usr/bin/env pwsh
# =============================================================================
# run_tests.ps1  —  AeroSafe test runner (full Python backend suite)
# =============================================================================
# Usage
#   ./run_tests.ps1              Full tests through Docker (recommended)
#   ./run_tests.ps1 -Local       Tests through local UV (no database needed yet)
#   ./run_tests.ps1 -Suite unit  Unit tests only
#   ./run_tests.ps1 -Suite api   HTTP API tests only
#   ./run_tests.ps1 -Verbose     Full tracebacks on failure (--tb=long)
# =============================================================================

param(
    [switch]$Local,
    [ValidateSet("all", "unit", "api")][string]$Suite = "all",
    [switch]$Verbose,
    [int]$Workers = 4
)

$ErrorActionPreference = "Continue"
$script:useDocker = $false
$SERVICE = "api"
$CONTAINER = "aerosafe_api"
$WORKDIR = "/app"

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║        AeroSafe — Python backend test suite (pytest)             ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host "  Timestamp : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
    Write-Host ""
}

function Write-Section([string]$title) {
    Write-Host ""
    Write-Host "  [$title]" -ForegroundColor Cyan
    Write-Host ("  " + "─" * 64) -ForegroundColor DarkCyan
}

function Write-Step([string]$msg) {
    Write-Host "  ▶  $msg" -ForegroundColor Yellow
}

function Write-Ok([string]$msg) {
    Write-Host "  ✓  $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "  ⚠  $msg" -ForegroundColor DarkYellow
}

function Write-Fail([string]$msg) {
    Write-Host "  ✗  $msg" -ForegroundColor Red
}

function Write-Info([string]$msg) {
    Write-Host "     $msg" -ForegroundColor DarkGray
}

# ── Environment detection ─────────────────────────────────────────────────────

Write-Banner

Write-Section "Environment check"

# Check Docker
if (-not $Local) {
    try {
        $null = docker --version 2>&1
        if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
        Write-Ok "Docker available."

        $running = docker ps --filter "name=$CONTAINER" --filter "status=running" -q 2>$null
        if ($running) {
            Write-Ok "Container '$CONTAINER' running — tests through docker compose exec."
            $script:useDocker = $true
        } else {
            Write-Warn "Container '$CONTAINER' not found or stopped."
            Write-Host ""
            $ans = Read-Host "  Start the stack (docker compose up -d)? [y/N]"
            if ($ans -match '^[yY]$') {
                Write-Step "Starting the Docker stack…"
                docker compose up -d
                Write-Step "Waiting for the API container (15 s)…"
                Start-Sleep -Seconds 15
                $running = docker ps --filter "name=$CONTAINER" --filter "status=running" -q 2>$null
                if ($running) {
                    Write-Ok "Container '$CONTAINER' ready."
                    $script:useDocker = $true
                } else {
                    Write-Warn "Container still unavailable — switching to local mode."
                }
            } else {
                Write-Warn "Switching to local mode (UV)."
            }
        }
    } catch {
        Write-Warn "Docker unreachable: $_"
    }
}

if (-not $script:useDocker) {
    Write-Step "Local mode: looking for UV…"
    try {
        $uvVer = uv --version 2>&1
        if ($LASTEXITCODE -ne 0) { throw "UV absent" }
        Write-Ok "UV available: $uvVer"
        Write-Info "Tests will run from src/api/ with 'uv run pytest'."
        Write-Info "No database is needed yet: the tests open no connection."
    } catch {
        Write-Fail "Neither Docker nor UV available — cannot run the tests."
        exit 1
    }
}

# ── Reminder about test architecture ─────────────────────────────────────────

Write-Section "Test architecture"

Write-Info "Root directory  : src/api/tests/"
Write-Info ""
Write-Info "conftest.py (root)    — client fixture for the HTTP tests"
Write-Info "   • Builds an httpx AsyncClient on the FastAPI application (no network)"
Write-Info "   • No database fixture yet: the application opens no connection at startup"
Write-Info ""
Write-Info "unit/                 — tests of settings, database wrapper and middleware"
Write-Info "api/                  — tests of the HTTP endpoints"
Write-Info ""

# ── Core runner function ──────────────────────────────────────────────────────

function Invoke-PytestSuite {
    param(
        [string]   $Name,
        [string]   $Description,
        [string[]] $Coverage,
        [string[]] $Paths,
        [string]   $TbMode = "short",
        [string[]] $ExtraPytestArgs = @()
    )

    Write-Host ""
    Write-Host ("  ╔══ " + $Name + " " + ("═" * [Math]::Max(0, 58 - $Name.Length))) -ForegroundColor Cyan
    Write-Host "  ║" -ForegroundColor DarkCyan
    Write-Host "  ║  $Description" -ForegroundColor White
    Write-Host "  ║" -ForegroundColor DarkCyan
    Write-Host "  ║  Coverage :" -ForegroundColor DarkGray
    foreach ($c in $Coverage) {
        Write-Host "  ║    • $c" -ForegroundColor DarkGray
    }
    Write-Host "  ║" -ForegroundColor DarkCyan
    Write-Host "  ║  Files : $($Paths -join ', ')" -ForegroundColor DarkGray
    Write-Host ("  ╚" + ("═" * 64)) -ForegroundColor DarkCyan
    Write-Host ""

    $pytestArgs = @("-m", "pytest") + $Paths + @("-v", "--tb=$TbMode", "--color=yes", "--no-header")

    $captured = [System.Collections.Generic.List[string]]::new()
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $exitCode = 0

    if ($script:useDocker) {
        $xdistStr = if ($Workers -gt 1) { "-n $Workers" } else { "" }
        $innerCmd = "cd $WORKDIR && UV_CACHE_DIR=/tmp/uv-cache uv run --group dev pytest $($Paths -join ' ') $xdistStr -v --tb=$TbMode --color=yes --no-header $($ExtraPytestArgs -join ' ')"
        & docker compose exec -u root -T $SERVICE sh -c $innerCmd 2>&1 | ForEach-Object {
            Write-Host "    $_"
            $captured.Add($_)
        }
        $exitCode = $LASTEXITCODE
    } else {
        Push-Location "src/api"
        try {
            $extraArgs = @()
            if ($Workers -gt 1) {
                $extraArgs += "-n"
                $extraArgs += "$Workers"
            }
            & uv run --group dev pytest $Paths $extraArgs $ExtraPytestArgs -v --tb=$TbMode --color=yes --no-header 2>&1 | ForEach-Object {
                Write-Host "    $_"
                $captured.Add($_)
            }
            $exitCode = $LASTEXITCODE
        } finally {
            Pop-Location
        }
    }

    $sw.Stop()
    $elapsed = [Math]::Round($sw.Elapsed.TotalSeconds, 1)

    # Extract pytest summary line (last line matching "N passed/failed/...")
    $summaryLine = ($captured | Where-Object { $_ -match '\d+ (passed|failed|error|skipped)' } | Select-Object -Last 1)

    Write-Host ""
    $status = switch ($exitCode) {
        0 { "PASSED" }
        5 { "NO TEST COLLECTED" }
        default { "FAILED (code $exitCode)" }
    }
    $color = switch ($exitCode) {
        0 { "Green" }
        5 { "DarkYellow" }
        default { "Red" }
    }

    Write-Host "  $('─' * 64)" -ForegroundColor DarkGray
    Write-Host "  $([char]0x2503) $Name" -ForegroundColor $color -NoNewline
    Write-Host "  →  $status  ($elapsed s)" -ForegroundColor $color
    if ($summaryLine) {
        Write-Host "  $([char]0x2503) $($summaryLine.Trim())" -ForegroundColor DarkGray
    }

    return [PSCustomObject]@{
        Name      = $Name
        ExitCode  = $exitCode
        Elapsed   = $elapsed
        Summary   = if ($summaryLine) { $summaryLine.Trim() } else { "" }
    }
}

# ── Define suites ─────────────────────────────────────────────────────────────

$tbFlag = if ($Verbose) { "long" } else { "short" }
$allResults = @()

# ─── Suite 1 : tests unitaires ORM ───────────────────────────────────────────

if ($Suite -eq "all" -or $Suite -eq "unit") {

    Write-Section "Suite 1 / 2 — Unit tests (configuration and core)"
    Write-Info "These tests check settings, the database wrapper and the middleware without"
Write-Info "going through the HTTP API. They do not need a running database."

    $res = Invoke-PytestSuite `
        -Name        "Unit tests — configuration and core" `
        -Description "Checks the building blocks of the application (settings, database wrapper, middleware)." `
        -Coverage    @(
            "unit/test_app_settings.py : application name and version given to FastAPI",
            "unit/test_database.py     : database URL built from settings, session lifecycle",
            "unit/test_middleware.py   : unhandled errors are logged and re-raised"
        ) `
        -Paths       @("tests/unit/") `
        -TbMode      $tbFlag `
        -ExtraPytestArgs @("--cov-fail-under=0")

    $allResults += $res
}

# ─── Suite 2 : tests API HTTP ────────────────────────────────────────────────

if ($Suite -eq "all" -or $Suite -eq "api") {

    Write-Section "Suite 2 / 2 — API tests (HTTP via AsyncClient)"
    Write-Info "These tests run the complete FastAPI application with an asynchronous HTTP client."
    Write-Info ""
    Write-Info "Tested modules:"
    $apiModules = @(
        "test_health.py            (2 tests) : liveness probe 200, X-Request-ID header on every response"
    )
    foreach ($m in $apiModules) { Write-Info $m }

    $res = Invoke-PytestSuite `
        -Name        "API tests — HTTP endpoints" `
        -Description "End-to-end validation of the FastAPI routes through AsyncClient." `
        -Coverage    @(
            "Health       : liveness probe without authentication, request id header"
        ) `
        -Paths       @("tests/api/") `
        -TbMode      $tbFlag

    $allResults += $res
}

# ── Final summary ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host ""
Write-Host "  ══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  FINAL SUMMARY" -ForegroundColor White
Write-Host "  ══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$totalElapsed = ($allResults | Measure-Object -Property Elapsed -Sum).Sum
$hasFailure   = $allResults | Where-Object { $_.ExitCode -ne 0 -and $_.ExitCode -ne 5 }
$hasSkip      = $allResults | Where-Object { $_.ExitCode -eq 5 }

foreach ($r in $allResults) {
    $icon  = switch ($r.ExitCode) { 0 { "✓" } 5 { "⚠" } default { "✗" } }
    $color = switch ($r.ExitCode) { 0 { "Green" } 5 { "DarkYellow" } default { "Red" } }
    Write-Host "  $icon  " -ForegroundColor $color -NoNewline
    Write-Host $r.Name -ForegroundColor $color -NoNewline
    Write-Host "  ($($r.Elapsed) s)" -ForegroundColor DarkGray
    if ($r.Summary) {
        Write-Host "     $($r.Summary)" -ForegroundColor DarkGray
    }
    Write-Host ""
}

Write-Host "  Total duration : $([Math]::Round($totalElapsed, 1)) s" -ForegroundColor DarkGray
Write-Host ""

if ($hasFailure) {
    Write-Host "  ✗  RESULT: some tests failed." -ForegroundColor Red
    Write-Host "     → Rerun with  ./run_tests.ps1 -Verbose  for full tracebacks." -ForegroundColor DarkGray
    Write-Host "     → Rerun with  ./run_tests.ps1 -Suite api  to target the API only." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  ══════════════════════════════════════════════════════════════════" -ForegroundColor Red
    exit 1
} elseif ($hasSkip) {
    Write-Host "  ⚠  RESULT: no test collected in at least one suite." -ForegroundColor DarkYellow
    Write-Host "     → Check that the test paths exist and that the files are named test_*.py." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  ══════════════════════════════════════════════════════════════════" -ForegroundColor DarkYellow
    exit 5
} else {
    Write-Host "  ✓  RESULT: all tests are green." -ForegroundColor Green
    Write-Host ""
    Write-Host "  ══════════════════════════════════════════════════════════════════" -ForegroundColor Green
    exit 0
}
