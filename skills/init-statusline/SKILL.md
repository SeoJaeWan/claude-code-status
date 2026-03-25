---
name: init-statusline
description: One-command full setup — bootstrap data directory, wire settings.json, and populate cache. No restart required.
user-invocable: true
allowed-tools: "Read, Write, Edit, Bash"
---

Full initialization of claude-code-status in a single command.
Run this after `plugin install` + `/reload-plugins` — no Claude Code restart needed.

## When to use

- **First install**: right after `claude plugin install claude-code-status` and `/reload-plugins`
- **Plugin update**: after updating and reloading
- **Troubleshooting**: when status line is empty or shows errors

This skill replaces the need to restart Claude Code for the SessionStart hook.

## What this skill does

1. **Bootstrap** — runs the SessionStart hook to create the data directory, sync runtime, install npm deps, and copy the launcher
2. **Wire settings.json** — sets `statusLine.command` to the stable launcher path
3. **Populate cache** — runs all collectors (gmail, tasks, jira, github) so data appears immediately
4. **Verify** — tests the status line end-to-end and reports the result

## Steps

### 1. Bootstrap data directory

Run the SessionStart hook manually. This creates the full directory structure under `$CLAUDE_PLUGIN_DATA`.

```bash
CLAUDE_PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT"
CLAUDE_PLUGIN_DATA="$CLAUDE_PLUGIN_DATA"
bash "$CLAUDE_PLUGIN_ROOT/hooks/session-start.sh"
```

After this step, verify these files exist:
- `$CLAUDE_PLUGIN_DATA/bin/status-line.sh`
- `$CLAUDE_PLUGIN_DATA/runtime/dist/render.js`

If either is missing, print the session-start log and stop:
```bash
cat "$CLAUDE_PLUGIN_DATA/logs/session-start.log"
```

### 2. Wire settings.json

Read `~/.claude/settings.json`, set `statusLine.command` to `$CLAUDE_PLUGIN_DATA/bin/status-line.sh`, and write back.
Do NOT overwrite unrelated fields — merge only the `statusLine` key.

The `statusLine` object must have:
```json
{
  "type": "command",
  "command": "<CLAUDE_PLUGIN_DATA>/bin/status-line.sh"
}
```

### 3. Populate cache by running collectors

For each service (gmail, tasks, jira, github), attempt to run the collector.
Collector failures are non-fatal — unconfigured services simply won't appear.

```bash
CLAUDE_PLUGIN_DATA="$CLAUDE_PLUGIN_DATA"
COLLECT="$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js"

for svc in gmail tasks jira github; do
  node "$COLLECT" --service "$svc" 2>&1 || true
done
```

### 4. End-to-end verification

Pipe sample JSON through the launcher and confirm output is not empty:

```bash
echo '{"rate_limits":{"five_hour":{"used_percentage":1},"seven_day":{"used_percentage":1}}}' \
  | bash "$CLAUDE_PLUGIN_DATA/bin/status-line.sh"
```

### 5. Report results

Print a summary:
- Which services have cached data (read each `$CLAUDE_PLUGIN_DATA/cache/<service>.json`)
- Whether `settings.json` is correctly patched
- Remind the user that unconfigured services are hidden (not an error)
- Tell the user the status line is now active — it may take a few seconds to appear

## Error conditions

| Condition | Action |
|---|---|
| `CLAUDE_PLUGIN_ROOT` not set | Print error: plugin may not be installed. Run `claude plugin install claude-code-status` first |
| `CLAUDE_PLUGIN_DATA` not set | Print error: plugin environment not available |
| session-start.sh fails | Print the log file contents and stop |
| Launcher file missing after bootstrap | Print error and session-start log |
| Collector fails for a service | Non-fatal — print warning, continue to next service |
| settings.json parse error | Back up the file, then overwrite with minimal valid JSON |

## Notes

- This skill is idempotent — safe to run multiple times.
- It replaces the SessionStart hook for first-time setup.
- After running this skill, the status line works immediately without restarting Claude Code.
