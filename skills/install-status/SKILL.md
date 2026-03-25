---
name: install-status
description: Configure ~/.claude/settings.json to use the persistent statusLine launcher. Run after plugin install or OS reinstall.
user-invocable: true
allowed-tools: "Read, Write, Edit, Bash"
---

Configure `~/.claude/settings.json` to use the persistent statusLine launcher from `${CLAUDE_PLUGIN_DATA}`.

## When to use

Run this skill once after installing the plugin, or after any OS reinstall, to wire Claude Code's global status line to the stable launcher path.

## What this skill does

1. Reads `~/.claude/settings.json` (creates it if it doesn't exist).
2. Sets `statusLine.command` to `${CLAUDE_PLUGIN_DATA}/bin/status-line.sh` — a cross-platform bash launcher that works on both Windows (Git Bash) and macOS/Linux.
3. Merges the change into existing settings — does **not** overwrite unrelated fields.
4. Writes the updated JSON back to `~/.claude/settings.json`.

## Why the launcher lives in CLAUDE_PLUGIN_DATA

After marketplace install the plugin root is copied into a versioned cache directory. That cache path changes on every plugin update. The `statusLine.command` must point to a path that never changes across updates. The SessionStart hook always copies the launcher to `${CLAUDE_PLUGIN_DATA}/bin/status-line.sh`, which is stable for the lifetime of the plugin installation.

## Steps

### 1. Resolve paths

```bash
PLUGIN_DATA="$CLAUDE_PLUGIN_DATA"
LAUNCHER="$PLUGIN_DATA/bin/status-line.sh"
SETTINGS="$HOME/.claude/settings.json"
```

### 2. Read existing settings

```bash
settings=$([ -f "$SETTINGS" ] && cat "$SETTINGS" || echo '{}')
```

### 3. Patch statusLine.command

```bash
# Using jq — merge, do not overwrite
settings=$(echo "$settings" | jq --arg cmd "$LAUNCHER" '.statusLine.command = $cmd')
```

### 4. Write back

```bash
echo "$settings" > "$SETTINGS"
echo "statusLine.command set to: $LAUNCHER"
```

### 5. Verify

Read `~/.claude/settings.json` and confirm the `statusLine` section:

```json
{
  "statusLine": {
    "type": "command",
    "command": "<CLAUDE_PLUGIN_DATA>/bin/status-line.sh"
  }
}
```

## Error conditions

| Condition                             | Action                                                            |
| ------------------------------------- | ----------------------------------------------------------------- |
| `CLAUDE_PLUGIN_DATA` not set          | Print error and exit                                              |
| Launcher file not yet present         | Warn user to run SessionStart hook (or restart Claude Code) first |
| `~/.claude/` directory does not exist | Create it before writing settings                                 |
| JSON parse error in existing settings | Back up the file, then overwrite with minimal valid JSON          |

## Notes

- Re-running this skill is idempotent; it always sets the correct path.
- If you move your plugin data directory, run this skill again to update the path.
- The bash launcher works on Windows (Git Bash), macOS, and Linux — no PowerShell required.
