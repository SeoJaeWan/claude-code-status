---
name: tasks-check
description: Show cached Google Tasks incomplete count, diagnose errors, and optionally force a fresh fetch. Use when status line shows tasks count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show Google Tasks incomplete count and individual task details.

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
| `errorKind` | `auth` / `dependency` / `rate_limit` / `transient` / `unknown` |
| `detail` | Human-readable error description |

### 2. If `status` is `ok` — fetch and show task details

Use `gws` CLI directly to fetch incomplete tasks from all task lists.

**Step 2a.** Get all task lists:

```bash
gws tasks tasklists list --params '{"maxResults":100}'
```

Parse the `items` array — each item has `id` and `title`.

**Step 2b.** For each task list, fetch incomplete tasks:

```bash
gws tasks tasks list --params '{"tasklist":"<TASKLIST_ID>","showCompleted":false,"maxResults":20}'
```

From each task in the `items` array, extract:
- **Title** — `title` field
- **Due** — `due` field (ISO date, may be absent)
- **Notes** — `notes` field (may be absent)
- **Status** — `status` field (`needsAction` or `completed`)
- **Task list name** — from the parent task list's `title`

Only include tasks where `status` is `needsAction`.

**Step 2c.** Present results as a numbered list, sorted by due date (overdue first, then no-due-date last):

```
Google Tasks incomplete: 3   (last updated: 2026-03-24T10:15:00Z)

 1. [내 할 일 목록] Finish Q1 report
    Due: 2026-03-25
    Notes: Include budget projections

 2. [내 할 일 목록] Review PR from Bob
    Due: 2026-03-26

 3. [내 할 일 목록] Buy groceries
    Due: (not set)
```

### 3. If `status` is `error` — show error cause

Read `errorKind` and `detail` from the cache and explain what went wrong:

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | gws not authenticated | Run `gws auth login` |
| `dependency` | gws CLI not installed | Run `npm install -g @nicholasgasior/gws` |
| `rate_limit` | Tasks API quota exceeded | Wait a few minutes, then retry |
| `transient` | Temporary network error | Retry later |
| `unknown` | Unexpected error | See `detail` field for raw error message |

### 4. Force refresh (count only)

To refresh the incomplete task count in the status line cache:

```bash
CLAUDE_PLUGIN_DATA="$CLAUDE_PLUGIN_DATA" node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service tasks --force
```

## Notes

- The status line cache stores only the incomplete count. Individual tasks are fetched live via gws when this skill runs.
- Only tasks with `status = needsAction` are included. Completed tasks are excluded.
- Cache TTL for Tasks is **5 minutes**.
