---
name: gmail-check
description: Show cached Gmail unread details, diagnose errors, and optionally force a fresh fetch. Use when status line shows Gmail count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show Gmail unread count and individual message details.

## When to use

- When the status line shows a Gmail count and you want to see the message list.
- When the status line shows `!` for Gmail and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
cat "$CLAUDE_PLUGIN_DATA/cache/gmail.json"
```

Parse the JSON and inspect the fields:

| Field | Meaning |
|---|---|
| `status` | `ok` / `error` / `stale` / `pending` |
| `value` | Unread message count (null if unavailable) |
| `fetchedAt` | ISO 8601 timestamp of last successful fetch |
| `errorKind` | `auth` / `dependency` / `rate_limit` / `transient` / `unknown` |
| `detail` | Human-readable error description |

### 2. If `status` is `ok` — fetch and show unread message details

Use `gws` CLI directly to fetch the most recent unread messages (up to 10).

**Step 2a.** Get unread message IDs:

```bash
gws gmail users messages list --params '{"userId":"me","q":"is:unread","maxResults":10}'
```

Parse the `messages` array from the JSON output to get message IDs.

**Step 2b.** For each message ID, fetch metadata:

```bash
gws gmail users messages get --params '{"userId":"me","id":"<MESSAGE_ID>","format":"metadata","metadataHeaders":["From","Subject","Date"]}'
```

From each response, extract:
- **From** — `payload.headers` where `name` is `"From"`
- **Subject** — `payload.headers` where `name` is `"Subject"`
- **Date** — `payload.headers` where `name` is `"Date"`
- **Snippet** — `snippet` field (short preview text)
- **Link** — `https://mail.google.com/mail/u/0/#inbox/<id>`

**Step 2c.** Present results as a numbered list, most recent first:

```
Gmail unread: 7   (last updated: 2026-03-24T10:15:00Z)

 1. LinkedIn Premium <linkedin@em.linkedin.com>
    Subject: 서재완님의 프로필 조회수가 늘고 있습니다.
    Date: Tue, 24 Mar 2026 17:26:30 -0700
    Link: https://mail.google.com/mail/u/0/#inbox/19d2262caca83b98

 2. GitHub <noreply@github.com>
    Subject: [myorg/myrepo] PR #42 approved
    Date: Tue, 24 Mar 2026 09:55:00 -0700
    Link: https://mail.google.com/mail/u/0/#inbox/19d22559c585d41e
...
```

### 3. If `status` is `error` — show error cause

Read `errorKind` and `detail` from the cache and explain what went wrong:

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | gws not authenticated | Run `gws auth login` |
| `dependency` | gws CLI not installed | Run `npm install -g @nicholasgasior/gws` |
| `rate_limit` | Gmail API quota exceeded | Wait a few minutes, then retry |
| `transient` | Temporary network error | Retry later |
| `unknown` | Unexpected error | See `detail` field for raw error message |

### 4. Force refresh (count only)

To refresh the unread count in the status line cache:

```bash
CLAUDE_PLUGIN_DATA="$CLAUDE_PLUGIN_DATA" node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service gmail --force
```

## Notes

- The status line cache stores only the unread count. Individual messages are fetched live via gws when this skill runs.
- Cache TTL for Gmail is **5 minutes**.
- Only the 10 most recent unread messages are shown to keep output concise.
