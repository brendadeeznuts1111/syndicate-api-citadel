#!/usr/bin/env bash

# Bun Resource Monitor - Real-time monitoring of Bun processes and system resources

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
MONITOR_INTERVAL=5  # seconds between updates
MAX_SAMPLES=12      # number of samples to keep for trending
ALERT_THRESHOLD=80  # percentage threshold for alerts

# Global variables
declare -a memory_history
declare -a cpu_history
declare -a process_count_history

# Function to get system info
get_system_info() {
    echo -e "${BLUE}📊 System Resource Monitor${NC}"
    echo "========================"

    # CPU usage
    local cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%')
    echo -e "🖥️  CPU Usage: ${CYAN}${cpu_usage}%${NC}"

    # Memory usage
    local mem_info=$(vm_stat | grep "Pages active" | awk '{print $3}' | tr -d '.')
    local mem_mb=$((mem_info * 4096 / 1024 / 1024))
    echo -e "🧠 Memory Used: ${CYAN}${mem_mb}MB${NC}"

    # Disk usage for project directory
    local disk_usage=$(du -sh . 2>/dev/null | awk '{print $1}' || echo "N/A")
    echo -e "💾 Project Size: ${CYAN}${disk_usage}${NC}"

    echo ""
}

# Function to get Bun process information
get_bun_processes() {
    echo -e "${BLUE}🔍 Bun Process Analysis${NC}"
    echo "======================"

    # Get all Bun processes
    local bun_processes=$(ps aux | grep bun | grep -v grep | grep -v monitor-resources)

    if [ -z "$bun_processes" ]; then
        echo -e "${YELLOW}⚠️  No Bun processes currently running${NC}"
        echo ""
        return
    fi

    # Count processes
    local process_count=$(echo "$bun_processes" | wc -l)
    echo -e "📈 Process Count: ${CYAN}$process_count${NC}"

    # Memory analysis
    local total_memory_kb=$(echo "$bun_processes" | awk '{sum+=$6} END {print sum}')
    local total_memory_mb=$((total_memory_kb / 1024))

    # CPU analysis
    local total_cpu=$(echo "$bun_processes" | awk '{sum+=$3} END {printf "%.1f", sum}')

    echo -e "🧠 Total Memory: ${CYAN}${total_memory_mb}MB${NC}"
    echo -e "⚡ Total CPU: ${CYAN}${total_cpu}%${NC}"

    # Memory per process
    echo ""
    echo -e "${PURPLE}📋 Process Details:${NC}"
    echo "$bun_processes" | while read -r line; do
        local pid=$(echo "$line" | awk '{print $2}')
        local cpu=$(echo "$line" | awk '{print $3}')
        local mem_kb=$(echo "$line" | awk '{print $6}')
        local mem_mb=$((mem_kb / 1024))
        local command=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}' | cut -c1-60)

        # Color coding based on resource usage
        local mem_color=$NC
        if (( mem_mb > 100 )); then mem_color=$RED; fi

        local cpu_color=$NC
        if (( $(echo "$cpu > 50" | bc -l 2>/dev/null || echo "0") )); then cpu_color=$RED; fi

        echo -e "  ${YELLOW}PID $pid${NC}: CPU ${cpu_color}${cpu}%${NC}, Mem ${mem_color}${mem_mb}MB${NC} - ${command}"
    done

    echo ""

    # Update history for trending
    memory_history+=("$total_memory_mb")
    cpu_history+=("$total_cpu")
    process_count_history+=("$process_count")

    # Keep only last MAX_SAMPLES
    if [ ${#memory_history[@]} -gt $MAX_SAMPLES ]; then
        memory_history=("${memory_history[@]:1}")
        cpu_history=("${cpu_history[@]:1}")
        process_count_history=("${process_count_history[@]:1}")
    fi
}

# Function to check for socket conflicts
check_socket_health() {
    echo -e "${BLUE}🔌 Socket Health Check${NC}"
    echo "====================="

    local socket_count=0
    local stale_sockets=0

    # Check common socket locations
    for dir in /tmp /var/tmp "$HOME/.bun"; do
        if [ -d "$dir" ]; then
            local sockets=$(find "$dir" -name "*.sock" -type s 2>/dev/null || true)
            if [ -n "$sockets" ]; then
                socket_count=$((socket_count + $(echo "$sockets" | wc -l)))

                # Check for stale sockets (no process using them)
                echo "$sockets" | while read -r socket; do
                    if [ -n "$socket" ] && ! lsof "$socket" >/dev/null 2>&1; then
                        stale_sockets=$((stale_sockets + 1))
                    fi
                done
            fi
        fi
    done

    echo -e "🔗 Active Sockets: ${CYAN}$socket_count${NC}"

    if [ $stale_sockets -gt 0 ]; then
        echo -e "⚠️  Stale Sockets: ${RED}$stale_sockets${NC} (recommend cleanup)"
    else
        echo -e "✅ Socket Health: ${GREEN}Good${NC}"
    fi

    echo ""
}

# Function to show trends
show_trends() {
    if [ ${#memory_history[@]} -lt 2 ]; then
        return
    fi

    echo -e "${BLUE}📈 Resource Trends (Last ${#memory_history[@]} samples)${NC}"
    echo "==============================================="

    # Memory trend
    local mem_len=${#memory_history[@]}
    local mem_current=${memory_history[$((mem_len - 1))]}
    local mem_previous=${memory_history[$((mem_len - 2))]}
    local mem_trend=$((mem_current - mem_previous))

    local trend_color=$NC
    local trend_symbol="→"
    if [ $mem_trend -gt 10 ]; then
        trend_color=$RED
        trend_symbol="↗️"
    elif [ $mem_trend -lt -10 ]; then
        trend_color=$GREEN
        trend_symbol="↘️"
    fi

    echo -e "🧠 Memory: ${mem_previous}MB → ${mem_current}MB ${trend_color}${trend_symbol} ${mem_trend}MB${NC}"

    # CPU trend
    local cpu_len=${#cpu_history[@]}
    local cpu_current=${cpu_history[$((cpu_len - 1))]}
    local cpu_previous=${cpu_history[$((cpu_len - 2))]}
    local cpu_trend=$(echo "scale=1; $cpu_current - $cpu_previous" | bc 2>/dev/null || echo "0")

    trend_color=$NC
    trend_symbol="→"
    if (( $(echo "$cpu_trend > 10" | bc -l 2>/dev/null || echo "0") )); then
        trend_color=$RED
        trend_symbol="↗️"
    elif (( $(echo "$cpu_trend < -10" | bc -l 2>/dev/null || echo "0") )); then
        trend_color=$GREEN
        trend_symbol="↘️"
    fi

    echo -e "⚡ CPU: ${cpu_previous}% → ${cpu_current}% ${trend_color}${trend_symbol} ${cpu_trend}%${NC}"

    # Process count trend
    local proc_len=${#process_count_history[@]}
    local proc_current=${process_count_history[$((proc_len - 1))]}
    local proc_previous=${process_count_history[$((proc_len - 2))]}
    local proc_trend=$((proc_current - proc_previous))

    trend_color=$NC
    trend_symbol="→"
    if [ $proc_trend -gt 2 ]; then
        trend_color=$RED
        trend_symbol="↗️"
    elif [ $proc_trend -lt -2 ]; then
        trend_color=$GREEN
        trend_symbol="↘️"
    fi

    echo -e "📊 Processes: ${proc_previous} → ${proc_current} ${trend_color}${trend_symbol} ${proc_trend}${NC}"

    echo ""
}

# Function to check alerts
check_alerts() {
    local alerts=()

    # High memory usage alert
    if [ ${#memory_history[@]} -gt 0 ]; then
        local mem_len=${#memory_history[@]}
        local current_mem=${memory_history[$((mem_len - 1))]}
        if [ $current_mem -gt 1000 ]; then  # Simple 1GB threshold for demo
            alerts+=("High memory usage: ${current_mem}MB")
        fi
    fi

    # High CPU usage alert
    if [ ${#cpu_history[@]} -gt 0 ]; then
        local cpu_len=${#cpu_history[@]}
        local current_cpu=${cpu_history[$((cpu_len - 1))]}
        if (( $(echo "$current_cpu > $ALERT_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
            alerts+=("High CPU usage: ${current_cpu}%")
        fi
    fi

    # Too many processes alert
    if [ ${#process_count_history[@]} -gt 0 ]; then
        local proc_len=${#process_count_history[@]}
        local current_proc=${process_count_history[$((proc_len - 1))]}
        if [ $current_proc -gt 15 ]; then
            alerts+=("Many processes running: ${current_proc}")
        fi
    fi

    if [ ${#alerts[@]} -gt 0 ]; then
        echo -e "${RED}🚨 ALERTS DETECTED${NC}"
        echo "=================="
        for alert in "${alerts[@]}"; do
            echo -e "${RED}⚠️  $alert${NC}"
        done
        echo ""
        echo -e "${YELLOW}💡 Recommended actions:${NC}"
        echo "   • Run 'bun run cleanup' to clean up processes"
        echo "   • Check for runaway processes with 'ps aux | grep bun'"
        echo "   • Monitor socket usage with 'lsof /tmp/*.sock'"
        echo ""
    fi
}

# Function to show help
show_help() {
    echo -e "${BLUE}🖥️  Bun Resource Monitor${NC}"
    echo "======================"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -i, --interval SEC    Set monitoring interval (default: 5s)"
    echo "  -m, --max-samples N   Maximum trend samples (default: 12)"
    echo "  -t, --threshold PCT   Alert threshold percentage (default: 80%)"
    echo "  -s, --single          Single run instead of continuous monitoring"
    echo "  -h, --help           Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                    # Continuous monitoring every 5 seconds"
    echo "  $0 -i 2 -s           # Single run with 2-second interval"
    echo "  $0 --threshold 90    # Set alert threshold to 90%"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--interval)
            MONITOR_INTERVAL="$2"
            shift 2
            ;;
        -m|--max-samples)
            MAX_SAMPLES="$2"
            shift 2
            ;;
        -t|--threshold)
            ALERT_THRESHOLD="$2"
            shift 2
            ;;
        -s|--single)
            SINGLE_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Main monitoring loop
SINGLE_RUN=${SINGLE_RUN:-false}

if [ "$SINGLE_RUN" = true ]; then
    # Single run mode
    get_system_info
    get_bun_processes
    check_socket_health
    show_trends
    check_alerts

    echo -e "${GREEN}✅ Monitoring complete${NC}"
else
    # Continuous monitoring mode
    echo -e "${CYAN}🔄 Starting continuous monitoring (Ctrl+C to stop)...${NC}"
    echo -e "${YELLOW}Interval: ${MONITOR_INTERVAL}s | Samples: ${MAX_SAMPLES} | Alert threshold: ${ALERT_THRESHOLD}%${NC}"
    echo ""

    while true; do
        clear
        echo -e "${CYAN}$(date)${NC}"
        echo ""

        get_system_info
        get_bun_processes
        check_socket_health
        show_trends
        check_alerts

        echo -e "${YELLOW}Next update in ${MONITOR_INTERVAL} seconds...${NC}"
        sleep $MONITOR_INTERVAL
    done
fi
