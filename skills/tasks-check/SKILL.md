---
name: tasks-check
description: Show cached Google Tasks incomplete count, diagnose errors, and optionally force a fresh fetch. Use when status line shows tasks count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show cached Google Tasks details and optionally force a fresh fetch.

## When to use

- When the status line shows a tasks count and you want to see the task list.
- When the status line shows `!` for tasks and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
cat "$CLAUDE_PLUGIN_DATA/cache/tasks.json"
```

Parse the JSON and inspect the fields:

| Field | Meaning |
|---|---|
| `status` | `ok` / `error` / `stale` / `pending` |
| `value` | Incomplete task count (null if unavailable) |
| `fetchedAt` | ISO 8601 timestamp of last successful fetch |
| `ttlMs` | Cache TTL in milliseconds (300000 = 5 min) |
| `errorKind` | `auth` / `dependency` / `rate_limit` / `transient` / `unknown` |
| `detail` | Human-readable error description |

### 2. If `status` is `ok` — show task details

The cache stores the count only.  To see the actual task list, run a force
refresh which calls the Google Tasks API and prints full details:

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service tasks --force
```

Then re-read the cache and display the incomplete tasks (`status = needsAction`):

- **Title** (`title`)
- **Due date** (`due`) — omit if not set
- **Task list name** (`taskListTitle`)
- **Link** (`https://tasks.google.com/`)

Present the results as a numbered list, sorted by due date (overdue first).

### 3. If `status` is `error` — show error cause

Read `errorKind` and `detail` from the cache and explain what went wrong:

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | gws not authenticated | Run `gws auth login` |
| `dependency` | Required dependency missing | Check Node.js and internet access |
| `rate_limit` | Tasks API quota exceeded | Wait a few minutes, then retry |
| `transient` | Temporary network error | Retry with `--force` |
| `unknown` | Unexpected error | See `detail` field for raw error message |

### 4. Force refresh

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service tasks --force
```

Wait for the command to complete, then re-read the cache.

## Example output (status ok)

```
Google Tasks incomplete: 3   (last updated: 2026-03-24T10:15:00Z)

 1. [Work] Finish Q1 report
    Due: 2026-03-25
    Link: https://tasks.google.com/

 2. [Personal] Buy groceries
    Due: (not set)
    Link: https://tasks.google.com/

 3. [Work] Review PR from Bob
    Due: 2026-03-26
    Link: https://tasks.google.com/
```

## Example output (status error — auth)

```
Tasks status: ERROR
Error kind:   auth
Detail:       Google Tasks auth error: Access denied. No credentials provided. Run `gws auth login`.

Fix: Run `gws auth login` to authenticate.
```

## Notes

- Only tasks with `status = needsAction` are counted.  Completed tasks are excluded.
- Marking a task complete in the Google Tasks web UI or app will reduce the
  count at the next scheduled refresh.
- Cache TTL for Tasks is **5 minutes**.
