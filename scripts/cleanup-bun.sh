#!/usr/bin/env bash

# Bun Process & Socket Cleanup Script
# Comprehensive cleanup utility for Bun development environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Bun Environment Cleanup Utility${NC}"
echo "=================================="

# Function to safely kill processes
safe_kill() {
    local pattern="$1"
    local description="$2"

    echo -n "🔍 Checking for $description... "

    if pgrep -f "$pattern" > /dev/null 2>&1; then
        echo -e "${YELLOW}found${NC}"

        # Count processes before killing
        local count=$(pgrep -f "$pattern" | wc -l)
        echo "   📊 Found $count process(es)"

        # Kill processes gracefully first
        pkill -TERM -f "$pattern" 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if pgrep -f "$pattern" > /dev/null 2>&1; then
            echo "   ⚠️  Force killing remaining processes..."
            pkill -KILL -f "$pattern" 2>/dev/null || true
        fi

        echo -e "   ✅ $description cleaned up"
    else
        echo -e "${GREEN}none found${NC}"
    fi
}

# Function to clean socket files
clean_sockets() {
    echo -e "\n🔌 ${BLUE}Cleaning Socket Files${NC}"
    echo "========================"

    local socket_count=0

    # Common Bun socket locations
    local socket_dirs=(
        "/tmp"
        "/var/tmp"
        "$HOME/.bun"
        "/var/folders"
    )

    for dir in "${socket_dirs[@]}"; do
        if [ -d "$dir" ]; then
            # Find and remove stale socket files (older than 1 hour)
            local stale_sockets=$(find "$dir" -name "*.sock" -type s -mmin +60 2>/dev/null || true)

            if [ -n "$stale_sockets" ]; then
                echo "   🧼 Cleaning stale sockets in $dir:"
                echo "$stale_sockets" | while read -r socket; do
                    if [ -n "$socket" ] && [ -S "$socket" ]; then
                        echo "      🗑️  $(basename "$socket")"
                        rm -f "$socket" 2>/dev/null || true
                        ((socket_count++))
                    fi
                done
            fi
        fi
    done

    if [ $socket_count -gt 0 ]; then
        echo -e "   ✅ Cleaned up $socket_count stale socket(s)"
    else
        echo -e "   ✅ No stale sockets found"
    fi
}

# Function to clean temporary files
clean_temp_files() {
    echo -e "\n🗂️  ${BLUE}Cleaning Temporary Files${NC}"
    echo "==========================="

    local temp_patterns=(
        "*.tmp"
        "*.temp"
        "*.log"
        "*.pid"
        ".bun-cache-*"
    )

    local cleaned_count=0

    for pattern in "${temp_patterns[@]}"; do
        local files=$(find . -name "$pattern" -type f 2>/dev/null || true)

        if [ -n "$files" ]; then
            echo "   🗑️  Removing $pattern files:"
            echo "$files" | while read -r file; do
                if [ -n "$file" ]; then
                    echo "      $(basename "$file")"
                    rm -f "$file" 2>/dev/null || true
                    ((cleaned_count++))
                fi
            done
        fi
    done

    if [ $cleaned_count -gt 0 ]; then
        echo -e "   ✅ Cleaned up $cleaned_count temporary file(s)"
    else
        echo -e "   ✅ No temporary files to clean"
    fi
}

# Function to show current status
show_status() {
    echo -e "\n📊 ${BLUE}Current Status${NC}"
    echo "==============="

    # Count remaining Bun processes
    local bun_processes=$(ps aux | grep bun | grep -v grep | wc -l 2>/dev/null || echo "0")
    echo "   🔍 Bun processes: $bun_processes"

    # Check for socket files
    local socket_files=$(find /tmp /var/tmp "$HOME/.bun" -name "*.sock" -type s 2>/dev/null | wc -l 2>/dev/null || echo "0")
    echo "   🔌 Socket files: $socket_files"

    # Check memory usage (rough estimate)
    local mem_usage=$(ps aux | grep bun | grep -v grep | awk '{sum+=$6} END {print sum/1024 " MB"}' 2>/dev/null || echo "0 MB")
    echo "   🧠 Memory usage: $mem_usage"
}

# Main cleanup process
echo "🚀 Starting cleanup process..."

# Clean up specific problematic processes
safe_kill "bun src/demo" "demo processes"
safe_kill "source-map-discovery" "source map watchers"
safe_kill "bun run scripts" "script runners"
safe_kill "bun.*--hot" "hot reload servers"

# Clean socket files
clean_sockets

# Clean temporary files
clean_temp_files

# Show final status
show_status

echo -e "\n${GREEN}🎉 Cleanup Complete!${NC}"
echo ""
echo "💡 Preventive measures:"
echo "   • Use 'bun run clean' before starting new sessions"
echo "   • Use 'bun run dev:clean' for clean development starts"
echo "   • Use 'bun run test:clean' for clean test runs"
echo "   • Check socket usage with: lsof /path/to/socket.sock"
echo ""
echo "🛡️ Emergency cleanup:"
echo "   • 'bun run clean:all' - Kill ALL Bun processes (use carefully!)"
echo "   • Manual socket cleanup: rm -f /path/to/problematic.sock"
echo ""
echo "🚀 Ready for fresh Bun development session!"
