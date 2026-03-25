---
name: tasks-check
description: Show cached Google Tasks incomplete count, diagnose errors, and optionally force a fresh fetch. Use when status line shows tasks count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show Google Tasks incomplete task details from cache.

## When to use

- When the status line shows a Tasks count and you want to see the task list.
- When the status line shows `!` for Tasks and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
cat "$CLAUDE_PLUGIN_DATA/cache/tasks.json"
```

Parse the JSON. The `items` array contains the detailed task list.

### 2. If `status` is `ok` — display the items

The `items` array contains objects with:

| Field | Example |
|---|---|
| `title` | `Review Q1 report` |
| `link` | `https://tasks.google.com` |
| `meta.list` | `Work` |
| `meta.due` | `2026-03-25T00:00:00.000Z` |

Present as a numbered list grouped by list name. Include the `link`.

Note: Google Tasks does not support per-task deep links; the link opens the Tasks overview page.

### 3. If `status` is `error` — show error cause

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | Not logged in via `gws` | Run `gws auth login` |
| `dependency` | `gws` CLI not installed | Run `npm install -g @nicholasgasior/gws` |
| `rate_limit` | Google Tasks API quota exceeded | Wait a few minutes, then retry |
| `transient` | Temporary network error | Force refresh |

### 4. Force refresh (if user requests)

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
rm -f "$CLAUDE_PLUGIN_DATA/locks/tasks.lock"
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service tasks --force 2>&1
cat "$CLAUDE_PLUGIN_DATA/cache/tasks.json"
```

Then display the updated items.

## Example output

```
Google Tasks 미완료: 3건   (last updated: 2026-03-24T10:15:00Z)

 1. Review Q1 report
    List: Work  Due: 2026-03-25
    https://tasks.google.com

 2. Buy groceries
    List: Personal  Due: -
    https://tasks.google.com
```

## Notes

- Data is pre-collected with details — no additional API calls needed.
- Only tasks with status `needsAction` are included.
- Cache TTL: **1 minute**.
