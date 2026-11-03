#!/usr/bin/env bash
# =============================================================================
# run_tests.sh  —  AeroSafe test runner (full Python backend suite)
# =============================================================================
# Usage
#   ./run_tests.sh                 Full tests through Docker (recommended)
#   ./run_tests.sh --local         Tests through local UV (no database needed yet)
#   ./run_tests.sh --suite unit    Unit tests only
#   ./run_tests.sh --suite api     HTTP API tests only
#   ./run_tests.sh --verbose       Full tracebacks on failure (--tb=long)
#   ./run_tests.sh --workers 4     Number of pytest-xdist workers (default: 4)
# =============================================================================

set -uo pipefail

LOCAL=false
SUITE="all"
VERBOSE=false
WORKERS=4

SERVICE="api"
CONTAINER="aerosafe_api"
WORKDIR="/app"
USE_DOCKER=false

# ── Parse arguments ───────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
    case "$1" in
        --local) LOCAL=true; shift ;;
        --suite)
            SUITE="$2"
            if [[ "$SUITE" != "all" && "$SUITE" != "unit" && "$SUITE" != "api" ]]; then
                echo "Invalid suite: $SUITE (expected: all|unit|api)" >&2
                exit 1
            fi
            shift 2
            ;;
        --verbose) VERBOSE=true; shift ;;
        --workers) WORKERS="$2"; shift 2 ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

# ── Colors ────────────────────────────────────────────────────────────────────

C_CYAN='\033[0;36m'
C_DARKCYAN='\033[0;36m'
C_YELLOW='\033[1;33m'
C_GREEN='\033[0;32m'
C_DARKYELLOW='\033[0;33m'
C_RED='\033[0;31m'
C_DARKGRAY='\033[0;90m'
C_WHITE='\033[1;37m'
C_RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────

write_banner() {
    echo ""
    echo -e "${C_CYAN}╔══════════════════════════════════════════════════════════════════╗${C_RESET}"
    echo -e "${C_CYAN}║        AeroSafe — Python backend test suite (pytest)             ║${C_RESET}"
    echo -e "${C_CYAN}╚══════════════════════════════════════════════════════════════════╝${C_RESET}"
    echo -e "${C_DARKGRAY}  Timestamp : $(date '+%Y-%m-%d %H:%M:%S')${C_RESET}"
    echo ""
}

write_section() {
    echo ""
    echo -e "${C_CYAN}  [$1]${C_RESET}"
    echo -e "${C_DARKCYAN}  $(printf -- '─%.0s' $(seq 1 64))${C_RESET}"
}

write_step()  { echo -e "${C_YELLOW}  ▶  $1${C_RESET}"; }
write_ok()    { echo -e "${C_GREEN}  ✓  $1${C_RESET}"; }
write_warn()  { echo -e "${C_DARKYELLOW}  ⚠  $1${C_RESET}"; }
write_fail()  { echo -e "${C_RED}  ✗  $1${C_RESET}"; }
write_info()  { echo -e "${C_DARKGRAY}     $1${C_RESET}"; }

# ── Environment detection ─────────────────────────────────────────────────────

write_banner
write_section "Environment check"

if [[ "$LOCAL" != true ]]; then
    if docker --version >/dev/null 2>&1; then
        write_ok "Docker available."

        running=$(docker ps --filter "name=$CONTAINER" --filter "status=running" -q 2>/dev/null)
        if [[ -n "$running" ]]; then
            write_ok "Container '$CONTAINER' running — tests through docker compose exec."
            USE_DOCKER=true
        else
            write_warn "Container '$CONTAINER' not found or stopped."
            echo ""
            read -r -p "  Start the stack (docker compose up -d)? [y/N] " ans
            if [[ "$ans" =~ ^[yY]$ ]]; then
                write_step "Starting the Docker stack…"
                docker compose up -d
                write_step "Waiting for the API container (15 s)…"
                sleep 15
                running=$(docker ps --filter "name=$CONTAINER" --filter "status=running" -q 2>/dev/null)
                if [[ -n "$running" ]]; then
                    write_ok "Container '$CONTAINER' ready."
                    USE_DOCKER=true
                else
                    write_warn "Container still unavailable — switching to local mode."
                fi
            else
                write_warn "Switching to local mode (UV)."
            fi
        fi
    else
        write_warn "Docker unreachable."
    fi
fi

if [[ "$USE_DOCKER" != true ]]; then
    write_step "Local mode: looking for UV…"
    if uvVer=$(uv --version 2>&1); then
        write_ok "UV available: $uvVer"
        write_info "Tests will run from src/api/ with 'uv run pytest'."
        write_info "No database is needed yet: the tests open no connection."
    else
        write_fail "Neither Docker nor UV available — cannot run the tests."
        exit 1
    fi
fi

# ── Reminder about test architecture ─────────────────────────────────────────

write_section "Test architecture"

write_info "Root directory  : src/api/tests/"
write_info ""
write_info "conftest.py (root)    — client fixture for the HTTP tests"
write_info "   • Builds an httpx AsyncClient on the FastAPI application (no network)"
write_info "   • No database fixture yet: the application opens no connection at startup"
write_info ""
write_info "unit/                 — tests of settings, database wrapper and middleware"
write_info "api/                  — tests of the HTTP endpoints"
write_info ""

# ── Core runner function ──────────────────────────────────────────────────────
# Results are accumulated in parallel arrays (bash 3 compatible)
RESULT_NAMES=()
RESULT_EXITCODES=()
RESULT_ELAPSED=()
RESULT_SUMMARY=()

TB_MODE="short"
if [[ "$VERBOSE" == true ]]; then TB_MODE="long"; fi

invoke_pytest_suite() {
    local name="$1"
    local description="$2"
    local paths="$3"           # space-separated
    local extra_args="${4:-}"

    echo ""
    local pad=$(( 58 - ${#name} ))
    (( pad < 0 )) && pad=0
    echo -e "${C_CYAN}  ╔══ ${name} $(printf '═%.0s' $(seq 1 $pad))${C_RESET}"
    echo -e "${C_DARKCYAN}  ║${C_RESET}"
    echo -e "${C_WHITE}  ║  ${description}${C_RESET}"
    echo -e "${C_DARKCYAN}  ║${C_RESET}"
    echo -e "${C_DARKGRAY}  ║  Files : ${paths}${C_RESET}"
    echo -e "${C_DARKCYAN}  ╚$(printf '═%.0s' $(seq 1 64))${C_RESET}"
    echo ""

    local tmp_log
    tmp_log=$(mktemp)
    local start_ts=$(date +%s.%N)
    local exit_code=0

    if [[ "$USE_DOCKER" == true ]]; then
        local xdist_str=""
        if [[ "$WORKERS" -gt 1 ]]; then xdist_str="-n $WORKERS"; fi
        local inner_cmd="cd $WORKDIR && UV_CACHE_DIR=/tmp/uv-cache uv run --group dev pytest $paths $xdist_str -v --tb=$TB_MODE --color=yes --no-header $extra_args"
        docker compose exec -u root -T "$SERVICE" sh -c "$inner_cmd" 2>&1 | tee "$tmp_log" | sed 's/^/    /'
        exit_code=${PIPESTATUS[0]}
    else
        pushd src/api >/dev/null
        local extra_workers=""
        if [[ "$WORKERS" -gt 1 ]]; then extra_workers="-n $WORKERS"; fi
        uv run --group dev pytest $paths $extra_workers $extra_args -v --tb="$TB_MODE" --color=yes --no-header 2>&1 | tee "$tmp_log" | sed 's/^/    /'
        exit_code=${PIPESTATUS[0]}
        popd >/dev/null
    fi

    local end_ts=$(date +%s.%N)
    local elapsed
    elapsed=$(awk -v s="$start_ts" -v e="$end_ts" 'BEGIN { printf "%.1f", e - s }')

    local summary_line
    summary_line=$(grep -E '[0-9]+ (passed|failed|error|skipped)' "$tmp_log" | tail -n 1)
    rm -f "$tmp_log"

    echo ""
    local status color
    case "$exit_code" in
        0) status="PASSED"; color="$C_GREEN" ;;
        5) status="NO TEST COLLECTED"; color="$C_DARKYELLOW" ;;
        *) status="FAILED (code $exit_code)"; color="$C_RED" ;;
    esac

    echo -e "${C_DARKGRAY}  $(printf -- '─%.0s' $(seq 1 64))${C_RESET}"
    echo -e "${color}  ┃ ${name}  →  ${status}  (${elapsed} s)${C_RESET}"
    if [[ -n "$summary_line" ]]; then
        echo -e "${C_DARKGRAY}  ┃ ${summary_line}${C_RESET}"
    fi

    RESULT_NAMES+=("$name")
    RESULT_EXITCODES+=("$exit_code")
    RESULT_ELAPSED+=("$elapsed")
    RESULT_SUMMARY+=("$summary_line")
}

# ── Define suites ─────────────────────────────────────────────────────────────

# ─── Suite 1 : tests unitaires ORM ───────────────────────────────────────────

if [[ "$SUITE" == "all" || "$SUITE" == "unit" ]]; then
    write_section "Suite 1 / 2 — Unit tests (configuration and core)"
    write_info "These tests check settings, the database wrapper and the middleware without"
write_info "going through the HTTP API. They do not need a running database."

    invoke_pytest_suite \
        "Unit tests — configuration and core" \
        "Checks the building blocks of the application (settings, database wrapper, middleware)." \
        "tests/unit/" \
        "--cov-fail-under=0"
fi

# ─── Suite 2 : tests API HTTP ────────────────────────────────────────────────

if [[ "$SUITE" == "all" || "$SUITE" == "api" ]]; then
    write_section "Suite 2 / 2 — API tests (HTTP via AsyncClient)"
    write_info "These tests run the complete FastAPI application with an asynchronous HTTP client."
write_info ""
write_info "Tested modules:"
write_info "test_health.py            (2 tests) : liveness probe 200, X-Request-ID header on every response"

    invoke_pytest_suite \
        "API tests — HTTP endpoints" \
        "End-to-end validation of the FastAPI routes through AsyncClient." \
        "tests/api/" \
        ""
fi

# ── Final summary ─────────────────────────────────────────────────────────────

echo ""
echo ""
echo -e "${C_CYAN}  ══════════════════════════════════════════════════════════════════${C_RESET}"
echo -e "${C_WHITE}  FINAL SUMMARY${C_RESET}"
echo -e "${C_CYAN}  ══════════════════════════════════════════════════════════════════${C_RESET}"
echo ""

total_elapsed=0
has_failure=false
has_skip=false

for i in "${!RESULT_NAMES[@]}"; do
    name="${RESULT_NAMES[$i]}"
    ec="${RESULT_EXITCODES[$i]}"
    elapsed="${RESULT_ELAPSED[$i]}"
    summary="${RESULT_SUMMARY[$i]}"

    total_elapsed=$(awk -v t="$total_elapsed" -v e="$elapsed" 'BEGIN { printf "%.1f", t + e }')

    if [[ "$ec" -ne 0 && "$ec" -ne 5 ]]; then has_failure=true; fi
    if [[ "$ec" -eq 5 ]]; then has_skip=true; fi

    icon="✓"; color="$C_GREEN"
    if [[ "$ec" -eq 5 ]]; then icon="⚠"; color="$C_DARKYELLOW"
    elif [[ "$ec" -ne 0 ]]; then icon="✗"; color="$C_RED"; fi

    echo -e "${color}  ${icon}  ${name}${C_RESET}  ${C_DARKGRAY}(${elapsed} s)${C_RESET}"
    if [[ -n "$summary" ]]; then
        echo -e "${C_DARKGRAY}     ${summary}${C_RESET}"
    fi
    echo ""
done

echo -e "${C_DARKGRAY}  Total duration : ${total_elapsed} s${C_RESET}"
echo ""

if [[ "$has_failure" == true ]]; then
    echo -e "${C_RED}  ✗  RESULT: some tests failed.${C_RESET}"
    echo -e "${C_DARKGRAY}     → Rerun with  ./run_tests.sh --verbose  for full tracebacks.${C_RESET}"
    echo -e "${C_DARKGRAY}     → Rerun with  ./run_tests.sh --suite api  to target the API only.${C_RESET}"
    echo ""
    echo -e "${C_RED}  ══════════════════════════════════════════════════════════════════${C_RESET}"
    exit 1
elif [[ "$has_skip" == true ]]; then
    echo -e "${C_DARKYELLOW}  ⚠  RESULT: no test collected in at least one suite.${C_RESET}"
    echo -e "${C_DARKGRAY}     → Check that the test paths exist and that the files are named test_*.py.${C_RESET}"
    echo ""
    echo -e "${C_DARKYELLOW}  ══════════════════════════════════════════════════════════════════${C_RESET}"
    exit 5
else
    echo -e "${C_GREEN}  ✓  RESULT: all tests are green.${C_RESET}"
    echo ""
    echo -e "${C_GREEN}  ══════════════════════════════════════════════════════════════════${C_RESET}"
    exit 0
fi
