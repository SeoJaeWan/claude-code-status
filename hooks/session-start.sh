#!/usr/bin/env bash
# hooks/session-start.sh
#
# SessionStart hook: bootstraps ${CLAUDE_PLUGIN_DATA} directory structure,
# syncs runtime files, runs npm install if package.json changed, and
# makes the launcher script available at a stable path.
#
# Environment variables provided by Claude Code plugin runtime:
#   CLAUDE_PLUGIN_DATA  - persistent data dir for this plugin
#   CLAUDE_PLUGIN_ROOT  - plugin root dir (may change after updates)

set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-}"

if [[ -z "$PLUGIN_DATA" ]]; then
  echo "[claude-status] ERROR: CLAUDE_PLUGIN_DATA is not set. Cannot bootstrap." >&2
  exit 1
fi

LOG_DIR="$PLUGIN_DATA/logs"
BIN_DIR="$PLUGIN_DATA/bin"
CACHE_DIR="$PLUGIN_DATA/cache"
RUNTIME_DIR="$PLUGIN_DATA/runtime"
VERSION_FILE="$PLUGIN_DATA/.plugin-version"
LAUNCHER_DST="$BIN_DIR/status-line.sh"

log() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")
  echo "[$ts] [claude-status] $*" >> "$LOG_DIR/session-start.log" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 1. Bootstrap directory structure
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR" "$BIN_DIR" "$CACHE_DIR" "$RUNTIME_DIR"

log "SessionStart hook running. PLUGIN_ROOT=$PLUGIN_ROOT PLUGIN_DATA=$PLUGIN_DATA"

# ---------------------------------------------------------------------------
# 2. Detect version change
# ---------------------------------------------------------------------------
PLUGIN_VERSION="0.1.0"
if [[ -f "$PLUGIN_ROOT/.claude-plugin/plugin.json" ]]; then
  # Extract version with basic parsing (no jq dependency at hook time)
  PLUGIN_VERSION=$(grep '"version"' "$PLUGIN_ROOT/.claude-plugin/plugin.json" \
    | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
fi

STORED_VERSION=""
if [[ -f "$VERSION_FILE" ]]; then
  STORED_VERSION=$(cat "$VERSION_FILE")
fi

VERSION_CHANGED=false
if [[ "$PLUGIN_VERSION" != "$STORED_VERSION" ]]; then
  VERSION_CHANGED=true
  log "Version change detected: $STORED_VERSION -> $PLUGIN_VERSION"
fi

# ---------------------------------------------------------------------------
# 3. Sync runtime files from plugin root to persistent data dir
# ---------------------------------------------------------------------------
SRC_RUNTIME="$PLUGIN_ROOT/runtime"

if [[ -d "$SRC_RUNTIME" ]]; then
  # Sync only if version changed or runtime dir is missing key files
  RUNTIME_PKG="$RUNTIME_DIR/package.json"
  NEEDS_SYNC=false

  if [[ "$VERSION_CHANGED" == "true" ]]; then
    NEEDS_SYNC=true
  elif [[ ! -f "$RUNTIME_PKG" ]]; then
    NEEDS_SYNC=true
  fi

  if [[ "$NEEDS_SYNC" == "true" ]]; then
    log "Syncing runtime files from $SRC_RUNTIME to $RUNTIME_DIR"
    if command -v rsync &>/dev/null; then
      rsync -a --delete \
        --exclude 'node_modules' \
        --exclude 'dist' \
        "$SRC_RUNTIME/" "$RUNTIME_DIR/"
    else
      # Fallback: cp -r (less precise but widely available)
      cp -rf "$SRC_RUNTIME/." "$RUNTIME_DIR/"
    fi
    log "Runtime sync complete"
  fi
else
  log "WARNING: No runtime directory found at $SRC_RUNTIME"
fi

# ---------------------------------------------------------------------------
# 4. Install npm dependencies if package.json changed
# ---------------------------------------------------------------------------
RUNTIME_PKG="$RUNTIME_DIR/package.json"
PKG_HASH_FILE="$RUNTIME_DIR/.pkg-hash"

if [[ -f "$RUNTIME_PKG" ]]; then
  if command -v sha256sum &>/dev/null; then
    CURRENT_HASH=$(sha256sum "$RUNTIME_PKG" | awk '{print $1}')
  elif command -v shasum &>/dev/null; then
    CURRENT_HASH=$(shasum -a 256 "$RUNTIME_PKG" | awk '{print $1}')
  else
    # Fallback: use file size+mtime as a rough change indicator
    CURRENT_HASH=$(stat -c '%s-%Y' "$RUNTIME_PKG" 2>/dev/null \
      || stat -f '%z-%m' "$RUNTIME_PKG" 2>/dev/null \
      || echo "unknown")
  fi

  STORED_HASH=""
  if [[ -f "$PKG_HASH_FILE" ]]; then
    STORED_HASH=$(cat "$PKG_HASH_FILE")
  fi

  if [[ "$CURRENT_HASH" != "$STORED_HASH" ]] || [[ ! -d "$RUNTIME_DIR/node_modules" ]]; then
    log "package.json changed or node_modules missing. Running npm install --production"
    if command -v node &>/dev/null && command -v npm &>/dev/null; then
      (cd "$RUNTIME_DIR" && npm install --production --silent 2>>"$LOG_DIR/npm-install.log") && \
        echo "$CURRENT_HASH" > "$PKG_HASH_FILE" && \
        log "npm install complete" || \
        log "WARNING: npm install failed. See $LOG_DIR/npm-install.log"
    else
      log "WARNING: node/npm not found. Skipping npm install."
    fi
  fi

  # Build TypeScript if dist is missing or version changed
  DIST_DIR="$RUNTIME_DIR/dist"
  if [[ ! -d "$DIST_DIR" ]] || [[ "$VERSION_CHANGED" == "true" ]]; then
    log "Building TypeScript runtime"
    if [[ -d "$RUNTIME_DIR/node_modules" ]]; then
      (cd "$RUNTIME_DIR" && npm run build --silent 2>>"$LOG_DIR/tsc-build.log") && \
        log "TypeScript build complete" || \
        log "WARNING: TypeScript build failed. See $LOG_DIR/tsc-build.log"
    else
      log "WARNING: node_modules not present. Skipping TypeScript build."
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 5. Install stable launcher to BIN_DIR
# ---------------------------------------------------------------------------
SRC_LAUNCHER="$PLUGIN_ROOT/scripts/status-line.sh"

if [[ -f "$SRC_LAUNCHER" ]]; then
  if [[ "$VERSION_CHANGED" == "true" ]] || [[ ! -f "$LAUNCHER_DST" ]]; then
    log "Installing launcher to $LAUNCHER_DST"
    cp -f "$SRC_LAUNCHER" "$LAUNCHER_DST"
    log "Launcher installed"
  fi
else
  log "WARNING: Launcher script not found at $SRC_LAUNCHER"
fi

# ---------------------------------------------------------------------------
# 6. Write version stamp
# ---------------------------------------------------------------------------
echo "$PLUGIN_VERSION" > "$VERSION_FILE"
log "Bootstrap complete. version=$PLUGIN_VERSION"
