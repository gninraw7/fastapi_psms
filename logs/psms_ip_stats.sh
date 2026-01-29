#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./psms_ip_stats.sh psms_app.log
#   ./psms_ip_stats.sh /var/log/psms/*.log
#   ./psms_ip_stats.sh /var/log/psms          # dir -> *.log
# Options:
#   -n : sort by COUNT desc
#   -h : help

sort_by_count=0

usage() {
  cat <<'EOF'
Usage:
  psms_ip_stats.sh [-n] <file|glob|dir> [more files/globs/dirs...]

Options:
  -n   sort by COUNT desc
  -h   help

Output columns:
  IP  MIN_TIME  MAX_TIME  COUNT
EOF
}

while getopts ":nh" opt; do
  case "$opt" in
    n) sort_by_count=1 ;;
    h) usage; exit 0 ;;
    \?) echo "Unknown option: -$OPTARG" >&2; usage; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

# Expand inputs: directory => *.log
inputs=()
for arg in "$@"; do
  if [[ -d "$arg" ]]; then
    shopt -s nullglob
    for f in "$arg"/*.log; do
      inputs+=("$f")
    done
    shopt -u nullglob
  else
    inputs+=("$arg")
  fi
done

if [[ ${#inputs[@]} -eq 0 ]]; then
  echo "No input files found." >&2
  exit 1
fi

# POSIX awk (works on mawk): avoid match(..., ..., array)
result=$(
  awk '
  {
    # timestamp is first 19 chars: "YYYY-MM-DD HH:MM:SS"
    ts = substr($0, 1, 19)

    # Find "IP: " + IPv4
    if (match($0, /IP:[[:space:]]*[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/)) {
      ip = substr($0, RSTART, RLENGTH)
      sub(/^IP:[[:space:]]*/, "", ip)
    } else next

    cnt[ip]++

    if (!(ip in min) || ts < min[ip]) min[ip] = ts
    if (!(ip in max) || ts > max[ip]) max[ip] = ts
  }
  END {
    for (ip in cnt) {
      printf "%s\t%s\t%s\t%d\n", ip, min[ip], max[ip], cnt[ip]
    }
  }' "${inputs[@]}"
)

# Print header + sorted output
printf "%-15s  %-19s  %-19s  %s\n" "IP" "MIN_TIME" "MAX_TIME" "COUNT"

if [[ $sort_by_count -eq 1 ]]; then
  printf "%s\n" "$result" \
    | sort -t $'\t' -k4,4nr \
    | awk -F'\t' '{ printf "%-15s  %-19s  %-19s  %d\n", $1, $2, $3, $4 }'
else
  printf "%s\n" "$result" \
    | sort -t $'\t' -k1,1 \
    | awk -F'\t' '{ printf "%-15s  %-19s  %-19s  %d\n", $1, $2, $3, $4 }'
fi
