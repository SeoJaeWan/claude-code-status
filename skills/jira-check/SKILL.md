---
name: jira-check
description: Show cached Jira open issue count, diagnose errors, guide authentication, and optionally force a fresh fetch. Use when status line shows jira count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show cached Jira issue details and optionally force a fresh fetch.

## When to use

- When the status line shows a Jira count and you want to see the issue list.
- When the status line shows `!` for Jira and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
cat "$CLAUDE_PLUGIN_DATA/cache/jira.json"
```

Parse the JSON and inspect the fields:

| Field | Meaning |
|---|---|
| `status` | `ok` / `error` / `stale` / `pending` |
| `value` | Open assigned issue count (null if unavailable) |
| `fetchedAt` | ISO 8601 timestamp of last successful fetch |
| `ttlMs` | Cache TTL in milliseconds (300000 = 5 min) |
| `errorKind` | `auth` / `dependency` / `rate_limit` / `transient` / `unknown` |
| `detail` | Human-readable error description |

### 2. If `status` is `ok` — show issue details

The cache stores the count only.  To see the actual issue list, run a force
refresh which queries Jira and prints full details:

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service jira --force
```

Then re-read the cache and display issues matching the JQL
`assignee = currentUser() AND statusCategory != Done`:

- **Issue key** (e.g. `PROJ-123`)
- **Summary**
- **Priority**
- **Status**
- **Updated** (ISO 8601 timestamp)
- **Link** (Jira web URL)

Present the results as a table or numbered list, sorted by updated date
(most recently updated first).

### 3. If `status` is `error` — show error cause

Read `errorKind` and `detail` from the cache and explain what went wrong:

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | Not logged in to Jira via `acli` | Run `acli jira auth login --web` |
| `dependency` | `acli` CLI not installed | Install from https://acli.atlassian.com |
| `rate_limit` | Jira API quota exceeded | Wait a few minutes, then retry |
| `transient` | Temporary network error | Retry with `--force` |
| `unknown` | Unexpected error | See `detail` field for raw error message |

### 4. Force refresh

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service jira --force
```

Wait for the command to complete, then re-read the cache.

### 5. If not authenticated

Check `acli` login status:

```bash
acli jira auth status
```

If not logged in:

```bash
acli jira auth login --web
```

This opens a browser window to complete the Atlassian OAuth flow.  After
completing the flow, run a force refresh to confirm the fix:

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service jira --force
```

## Example output (status ok)

```
Jira open issues: 5   (last updated: 2026-03-24T10:15:00Z)

 1. PROJ-101  Fix login timeout bug           Priority: High    Status: In Progress  Updated: 2026-03-24T09:00:00Z
    Link: https://yourorg.atlassian.net/browse/PROJ-101

 2. PROJ-98   Add dark mode support           Priority: Medium  Status: To Do        Updated: 2026-03-23T14:30:00Z
    Link: https://yourorg.atlassian.net/browse/PROJ-98

...
```

## Example output (status error — auth)

```
Jira status: ERROR
Error kind:   auth
Detail:       acli: not authenticated. Run `acli jira auth login --web` to log in.

Fix: Run `acli jira auth login --web` then retry with:
     node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service jira --force
```

## Notes

- The JQL query used is: `assignee = currentUser() AND statusCategory != Done`
- Issues move out of the count when they are marked Done or reassigned.
- Cache TTL for Jira is **5 minutes**.
