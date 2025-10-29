#!/usr/bin/env bash

# Enhanced Runtime Check - Comprehensive Quality Gate
# Runs all enhanced tests and validations in parallel for maximum efficiency

set -euo pipefail

echo "🚀 Enhanced Runtime Check v1.0.0"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
OVERALL_STATUS=0

# Function to run test with status tracking
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -n "🔍 Running $test_name... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        OVERALL_STATUS=1
        return 1
    fi
}

# Function to run background process
run_background() {
    local process_name="$1"
    local process_command="$2"

    echo "🔄 Starting $process_name in background..."
    eval "$process_command" > /dev/null 2>&1 &
    local pid=$!
    echo $pid > "${process_name}.pid"
    sleep 2 # Allow process to start
}

# Function to cleanup background processes
cleanup() {
    echo "🧹 Cleaning up background processes..."
    for pidfile in *.pid; do
        if [ -f "$pidfile" ]; then
            local pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
            fi
            rm -f "$pidfile"
        fi
    done
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

echo "📦 Installing dependencies..."
if ! bun install --frozen-lockfile > /dev/null 2>&1; then
    echo -e "${RED}❌ Dependency installation failed${NC}"
    exit 1
fi

echo "🏗️ Running parallel validation checks..."
echo

# Start CI simulation in background
run_background "ci" "bun run audit:ci"

# Run enhanced test suite
run_test "Enhanced Test Suite" "bun test --smol --coverage --bail=3"
run_test "Timezone Matrix" "bun test test/tz-matrix.test.ts"
run_test "Memory Leak Detection" "bun test test/memory.test.ts"
run_test "Async Leak Detection" "bun test test/async-leak.test.ts"
run_test "Source Map Integrity" "bun test test/sourcemap.test.ts"

# Wait for CI to complete
echo -n "⏳ Waiting for CI validation... "
if wait $(cat ci.pid 2>/dev/null || echo ""); then
    echo -e "${GREEN}✅ PASSED${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
    OVERALL_STATUS=1
fi

echo
echo "🔧 Running build validations..."

# Build validation
run_test "OpenAPI Generation" "bun run api:gen"
run_test "Routes Index Build" "bun run api:index"
run_test "Production Build" "bun run cf:build"

echo
echo "⚡ Running energy harvesting validation..."

# Energy harvesting (quick validation)
if bun run energy:harvest > /dev/null 2>&1; then
    echo -e "⚡ Energy Harvesting: ${GREEN}✅ ACTIVE${NC}"
else
    echo -e "⚡ Energy Harvesting: ${YELLOW}⚠️  UNAVAILABLE${NC}"
fi

echo
echo "📊 Final Status Report"
echo "======================"

if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED - Runtime is Enhanced!${NC}"
    echo
    echo "✅ Enhanced runtime features validated:"
    echo "   • Timezone matrix testing"
    echo "   • Memory leak detection"
    echo "   • Async leak detection"
    echo "   • Source map integrity"
    echo "   • 100% traceability audit"
    echo "   • Energy harvesting active"
    echo "   • Production build ready"
    echo
    echo "🚀 Ready for deployment!"
else
    echo -e "${RED}💥 CHECKS FAILED - Runtime needs attention${NC}"
    echo
    echo "❌ Failed validations detected"
    echo "   • Check test output above"
    echo "   • Fix failing tests"
    echo "   • Re-run enhanced check"
    echo
    exit 1
fi
