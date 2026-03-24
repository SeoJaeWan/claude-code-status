---
name: gmail-check
description: Show cached Gmail unread details, diagnose errors, and optionally force a fresh fetch. Use when status line shows Gmail count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show cached Gmail unread details and optionally force a fresh fetch.

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
| `ttlMs` | Cache TTL in milliseconds (300000 = 5 min) |
| `errorKind` | `auth` / `dependency` / `rate_limit` / `transient` / `unknown` |
| `detail` | Human-readable error description |

### 2. If `status` is `ok` — show unread details

The cache file stores the count only.  To see the actual message list, run a
force refresh which calls the Gmail API and prints full details:

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service gmail --force
```

Then re-read the cache and display:

- **Sender** (`from`)
- **Subject** (`subject`)
- **Received time** (`receivedAt`)
- **Link** (`https://mail.google.com/mail/u/0/#inbox/<messageId>`)

Present the results as a table or numbered list, most recent first.

### 3. If `status` is `error` — show error cause

Read `errorKind` and `detail` from the cache and explain what went wrong:

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | gws not authenticated | Run `gws auth login` |
| `dependency` | Required dependency missing | Check that Node.js and internet access are available |
| `rate_limit` | Gmail API quota exceeded | Wait a few minutes, then retry |
| `transient` | Temporary network error | Retry with `--force` |
| `unknown` | Unexpected error | See `detail` field for raw error message |

### 4. Force refresh

To fetch fresh data immediately (bypasses TTL):

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service gmail --force
```

Wait for the command to complete, then re-read the cache file to see updated
results.

## Example output (status ok)

```
Gmail unread: 7   (last updated: 2026-03-24T10:15:00Z)

 1. Alice Smith <alice@example.com>
    Subject: Q1 Budget Review
    Received: 2026-03-24T10:12:00Z
    Link: https://mail.google.com/mail/u/0/#inbox/18e2f3a4b5c6d7e8

 2. GitHub <noreply@github.com>
    Subject: [myorg/myrepo] PR #42 approved
    Received: 2026-03-24T09:55:00Z
    Link: https://mail.google.com/mail/u/0/#inbox/18e2f3a4b5c6d001
...
```

## Example output (status error — auth)

```
Gmail status: ERROR
Error kind:   auth
Detail:       Gmail auth error: Access denied. No credentials provided. Run `gws auth login`.

Fix: Run `gws auth login` to authenticate.
```

## Notes

- The cache holds only the unread count.  Individual message details require a
  live API call via `--force`.
- Gmail marks messages as read when you open them in the Gmail web UI or app.
  The next scheduled refresh will pick up the updated count automatically.
- Cache TTL for Gmail is **5 minutes**.
