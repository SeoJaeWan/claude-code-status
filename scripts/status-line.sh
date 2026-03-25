#!/usr/bin/env bash
# scripts/status-line.sh
#
# Stable bash launcher for the claude-status statusLine command.
#
# CALL CHAIN CONTRACT
# ===================
# Claude Code calls this script as the statusLine.command. The call chain is:
#
#   ~/.claude/settings.json
#     statusLine.command = <CLAUDE_PLUGIN_DATA>/bin/status-line.sh
#         |
#         v
#   status-line.sh  (this file, copied to CLAUDE_PLUGIN_DATA/bin/ by SessionStart hook)
#         |
#         v  stdin piped through
#   node <CLAUDE_PLUGIN_DATA>/runtime/dist/render.js
#         |
#         v
#   stdout: one-line status string
#
# STDIN CONTRACT
# ==============
# Claude Code passes a JSON object via stdin. Known fields:
#   rate_limits.five_hour.used_percentage   (week usage %)
#   rate_limits.seven_day.used_percentage   (session usage %)
#   model                                   (current model name)
#   session_id                              (current session id)
#
# STDOUT CONTRACT
# ===============
# Output must be a single line of text. Example:
#   week 42% session 18% | gmail 7 | tasks 3 | jira 5 | github 4
#
# EXIT CODES
# ==========
#   0  - ALWAYS. On any error a fallback string is written to stdout so that
#        Claude Code never receives an empty status line.  render.js mirrors
#        this contract: it catches all exceptions and exits 0.
#
# FALLBACK BEHAVIOR
# =================
# On any error (node not found, render.js missing, runtime exception),
# this script outputs a minimal fallback string and exits 0 so Claude Code
# does not log spurious errors.

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-}"
if [[ -z "$PLUGIN_DATA" ]]; then
  # Derive from this script's location: CLAUDE_PLUGIN_DATA/bin/status-line.sh
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PLUGIN_DATA="$(dirname "$SCRIPT_DIR")"
fi

RENDER_SCRIPT="$PLUGIN_DATA/runtime/dist/render.js"
LOG_FILE="$PLUGIN_DATA/logs/launcher.log"

write_log() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")
  local log_dir
  log_dir=$(dirname "$LOG_FILE")
  mkdir -p "$log_dir" 2>/dev/null || true
  echo "[$ts] [launcher] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Read stdin (Claude Code passes JSON via stdin)
# ---------------------------------------------------------------------------
STDIN_DATA=""
if [[ ! -t 0 ]]; then
  STDIN_DATA=$(cat)
fi

# ---------------------------------------------------------------------------
# Validate prerequisites
# ---------------------------------------------------------------------------
NODE_PATH=""
if command -v node &>/dev/null; then
  NODE_PATH=$(command -v node)
fi

if [[ -z "$NODE_PATH" ]]; then
  write_log "ERROR: node not found in PATH"
  echo "status: node missing"
  exit 0
fi

if [[ ! -f "$RENDER_SCRIPT" ]]; then
  write_log "ERROR: render.js not found at $RENDER_SCRIPT"
  echo "status: build missing"
  exit 0
fi

# ---------------------------------------------------------------------------
# Export PLUGIN_DATA so node render.js can find cache/locks directories
# ---------------------------------------------------------------------------
export CLAUDE_PLUGIN_DATA="$PLUGIN_DATA"

# ---------------------------------------------------------------------------
# Invoke node render.js, piping stdin through
# ---------------------------------------------------------------------------
OUTPUT=""
STDERR_OUT=""
EXIT_CODE=0

if [[ -n "$STDIN_DATA" ]]; then
  OUTPUT=$(echo "$STDIN_DATA" | "$NODE_PATH" "$RENDER_SCRIPT" 2>"$PLUGIN_DATA/logs/.stderr.tmp") || EXIT_CODE=$?
else
  OUTPUT=$("$NODE_PATH" "$RENDER_SCRIPT" 2>"$PLUGIN_DATA/logs/.stderr.tmp") || EXIT_CODE=$?
fi

STDERR_OUT=$(cat "$PLUGIN_DATA/logs/.stderr.tmp" 2>/dev/null || echo "")
rm -f "$PLUGIN_DATA/logs/.stderr.tmp" 2>/dev/null || true

if [[ $EXIT_CODE -ne 0 ]]; then
  write_log "render.js exited $EXIT_CODE: $STDERR_OUT"
  echo "status: render error"
  exit 0
fi

if [[ -n "$STDERR_OUT" ]]; then
  write_log "render.js stderr: $STDERR_OUT"
fi

# Output the status line (trim trailing whitespace)
echo "${OUTPUT%"${OUTPUT##*[![:space:]]}"}"
exit 0
