---
name: slack-check
description: Show cached Slack unread details, diagnose errors, and optionally force a fresh fetch. Use when status line shows slack count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show Slack unread count breakdown and optionally force a fresh fetch.

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

Parse the JSON and inspect the fields:

| Field | Meaning |
|---|---|
| `status` | `ok` / `error` / `stale` / `pending` |
| `value` | Total unread count (DMs + configured channels), null if unavailable |
| `fetchedAt` | ISO 8601 timestamp of last successful fetch |
| `ttlMs` | Cache TTL in milliseconds (120000 = 2 min) |
| `errorKind` | `auth` / `dependency` / `rate_limit` / `transient` / `unknown` |
| `detail` | Human-readable error description |

### 2. If `status` is `ok` — show unread breakdown

Read the config to get the token and channel list:

```bash
cat "$CLAUDE_PLUGIN_DATA/config.json"
```

Then fetch a live breakdown using the Slack API:

**DM unread counts:**

```bash
TOKEN="<from config.json slack.token>"
curl -s -H "Authorization: Bearer $TOKEN" "https://slack.com/api/conversations.list?types=im,mpim&exclude_archived=true&limit=200" | node -e "
const chunks = []; process.stdin.on('data', c => chunks.push(c)); process.stdin.on('end', () => {
  const r = JSON.parse(Buffer.concat(chunks).toString());
  if (!r.ok) { console.log('ERROR: ' + r.error); return; }
  let total = 0;
  const unread = (r.channels || []).filter(c => (c.unread_count || 0) > 0);
  unread.forEach(ch => {
    total += ch.unread_count;
    console.log('  DM ' + ch.id + ': ' + ch.unread_count + ' unread');
  });
  console.log('DM total: ' + total);
});
"
```

**Channel unread counts (for each configured channel):**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "https://slack.com/api/conversations.info?channel=<CHANNEL_ID>" | node -e "
const chunks = []; process.stdin.on('data', c => chunks.push(c)); process.stdin.on('end', () => {
  const r = JSON.parse(Buffer.concat(chunks).toString());
  if (!r.ok) { console.log('ERROR: ' + r.error); return; }
  console.log('  #' + r.channel.name + ': ' + (r.channel.unread_count || 0) + ' unread');
});
"
```

Present results as:

```
Slack unread: 5   (last updated: 2026-03-25T10:15:00Z)

DMs:
  @john: 2
  @jane: 1

Channels:
  #dev-team: 1
  #alerts: 1
```

### 3. If `status` is `error` — show error cause

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | Token revoked or invalid | Run `/claude-code-status:slack-setup` to re-configure |
| `dependency` | Token not configured | Run `/claude-code-status:slack-setup` |
| `rate_limit` | Slack API rate limit exceeded | Wait 2 minutes, then retry |
| `transient` | Temporary network error | Retry with force refresh |

### 4. Force refresh

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service slack --force 2>&1
```

Wait for the command to complete, then re-read the cache.

### 5. If not configured

If no cache file exists or `errorKind` is `dependency`:

```
Slack is not configured yet.
Run /claude-code-status:slack-setup to connect your Slack workspace.
```

## Notes

- Cache TTL for Slack is **2 minutes**.
- Unread count = DM unread + configured channel unread.
- To change monitored channels, run `/claude-code-status:slack-setup` again.

## Deriving CLAUDE_PLUGIN_DATA

If `$CLAUDE_PLUGIN_DATA` is not set, derive it:
```bash
CLAUDE_PLUGIN_DATA="$HOME/.claude/plugins/data/claude-code-status-claude-code-status"
```
