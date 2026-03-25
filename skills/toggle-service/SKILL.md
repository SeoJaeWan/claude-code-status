---
name: toggle-service
description: Toggle status line service visibility on/off. Use when user wants to show or hide gmail, tasks, jira, or github from the status line.
user-invocable: true
allowed-tools: "Read, Bash"
---

Toggle a service's visibility in the status line.

## When to use

- When the user wants to hide a connected service from the status line
- When the user wants to show a previously hidden service
- When the user wants to see which services are currently visible

## Arguments

The user may provide:
- `<service> on` or `<service> off` — toggle a specific service
- `list` or no arguments — show current visibility settings

Valid services: `gmail`, `tasks`, `jira`, `github`

## Steps

### 1. Parse arguments

Determine the service and desired state from the user's input.
If no arguments or `list`, skip to step 3.

### 2. Update config.json

Read `$CLAUDE_PLUGIN_DATA/config.json`, update the `services.<name>` field, and write back.

```bash
CLAUDE_PLUGIN_DATA="$CLAUDE_PLUGIN_DATA"
CONFIG="$CLAUDE_PLUGIN_DATA/config.json"
```

If the file doesn't exist, create it with:
```json
{
  "services": {}
}
```

Use `node -e` to read, merge, and write the config:

```bash
node -e "
const fs = require('fs');
const p = '$CONFIG';
let c = {};
try { c = JSON.parse(fs.readFileSync(p,'utf8')); } catch {}
if (!c.services) c.services = {};
c.services['<SERVICE>'] = <true|false>;
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('Updated:', JSON.stringify(c.services, null, 2));
"
```

### 3. Show current settings

Read and display the current config:

```bash
cat "$CLAUDE_PLUGIN_DATA/config.json" 2>/dev/null || echo '{"services":{}}'
```

Report which services are visible (default: all visible if not in config).

### 4. Report

Tell the user:
- Which service was toggled and to what state
- That the change takes effect on the next status line refresh (next assistant message)

## Notes

- Services not listed in config.json default to **visible**
- This only controls display — collectors still run for disabled services (they just aren't shown)
- The config file is at `$CLAUDE_PLUGIN_DATA/config.json`

## Deriving CLAUDE_PLUGIN_DATA

`$CLAUDE_PLUGIN_DATA` is only available inside hook/skill runtime contexts — it is NOT set when Claude executes Bash tool commands. Always resolve it explicitly:

```bash
CLAUDE_PLUGIN_DATA="$HOME/.claude/plugins/data/claude-code-status-claude-code-status"
```

IMPORTANT: When using this path in `node -e` commands, pass it as a command-line argument (`process.argv[1]`) rather than embedding via shell variable interpolation (`'$CONFIG'`), to avoid path issues on Windows where `$HOME` may resolve differently.
