---
name: slack-check
description: Show cached Slack unread details, diagnose errors, and optionally force a fresh fetch. Use when status line shows slack count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show Slack unread count breakdown from cache.

## When to use

- When the status line shows a Slack count and you want to see the breakdown.
- When the status line shows `!` for Slack and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
cat "$CLAUDE_PLUGIN_DATA/cache/slack.json"
```

Parse the JSON. The `items` array contains the per-channel/DM unread breakdown.

### 2. If `status` is `ok` — display the items

The `items` array contains objects with:

| Field | Example |
|---|---|
| `title` | `@john` (DM) or `#dev-team` (channel) |
| `meta.unread` | `3` |
| `meta.type` | `dm` or `channel` |

Present as two groups: DMs and Channels. Show each with its unread count.

### 3. If `status` is `error` — show error cause

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | Token revoked or invalid | Run `/claude-code-status:slack-setup` to re-configure |
| `dependency` | Token not configured | Run `/claude-code-status:slack-setup` |
| `rate_limit` | Slack API rate limit exceeded | Wait 2 minutes, then retry |
| `transient` | Temporary network error | Force refresh |

### 4. Force refresh (if user requests)

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
rm -f "$CLAUDE_PLUGIN_DATA/locks/slack.lock"
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service slack --force 2>&1
cat "$CLAUDE_PLUGIN_DATA/cache/slack.json"
```

Then display the updated items.

## Example output

```
Slack unread: 5   (last updated: 2026-03-25T10:15:00Z)

DMs:
  @john: 2
  @jane: 1

Channels:
  #dev-team: 1
  #alerts: 1
```

## Notes

- Data is pre-collected with details — no additional API calls needed.
- Unread count = DM unread + configured channel unread.
- To change monitored channels, run `/claude-code-status:slack-setup`.
- Cache TTL: **2 minutes**.
