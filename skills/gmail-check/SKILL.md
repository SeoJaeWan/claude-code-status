---
name: gmail-check
description: Show cached Gmail unread details, diagnose errors, and optionally force a fresh fetch. Use when status line shows Gmail count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show Gmail unread message details from cache.

## When to use

- When the status line shows a Gmail count and you want to see the message list.
- When the status line shows `!` for Gmail and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
cat "$CLAUDE_PLUGIN_DATA/cache/gmail.json"
```

Parse the JSON. The `items` array contains the most recent unread messages (up to 10).

### 2. If `status` is `ok` — display the items

The `items` array contains objects with:

| Field | Example |
|---|---|
| `title` | `Meeting agenda for tomorrow` |
| `link` | `https://mail.google.com/mail/u/0/#inbox/18f3a2b1c4d5e6f7` |
| `meta.from` | `John Doe <john@example.com>` |
| `meta.date` | `Mon, 24 Mar 2026 10:15:00 +0900` |

Present as a numbered list. Include the `link` for each message.

Note: `value` shows the **total** unread count, while `items` shows up to 10 most recent.

### 3. If `status` is `error` — show error cause

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | Not logged in via `gws` | Run `gws auth login` |
| `dependency` | `gws` CLI not installed | Run `npm install -g @nicholasgasior/gws` |
| `rate_limit` | Gmail API quota exceeded | Wait a few minutes, then retry |
| `transient` | Temporary network error | Force refresh |

### 4. Force refresh (if user requests)

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
rm -f "$CLAUDE_PLUGIN_DATA/locks/gmail.lock"
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service gmail --force 2>&1
cat "$CLAUDE_PLUGIN_DATA/cache/gmail.json"
```

Then display the updated items.

## Example output

```
Gmail unread: 7   (last updated: 2026-03-24T10:15:00Z)
Showing 7 most recent:

 1. Meeting agenda for tomorrow
    From: John Doe <john@example.com>
    Date: Mon, 24 Mar 2026 10:15:00 +0900
    https://mail.google.com/mail/u/0/#inbox/18f3a2b1c4d5e6f7

 2. Deploy notification: production v2.3.1
    From: CI Bot <ci@example.com>
    Date: Mon, 24 Mar 2026 09:30:00 +0900
    https://mail.google.com/mail/u/0/#inbox/18f3a2b1c4d5e6f8
```

## Notes

- Data is pre-collected with details — no additional API calls needed.
- Up to 10 most recent unread messages are cached.
- Cache TTL: **1 minute**.
