# /claude-status:github-check

Show cached GitHub PR notification details and optionally force a fresh fetch.

## When to use

- When the status line shows a GitHub count and you want to see the PR list.
- When the status line shows `!` for GitHub and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
cat "$CLAUDE_PLUGIN_DATA/cache/github.json"
```

Parse the JSON and inspect the fields:

| Field | Meaning |
|---|---|
| `status` | `ok` / `error` / `stale` / `pending` |
| `value` | Unread PR notification count (null if unavailable) |
| `fetchedAt` | ISO 8601 timestamp of last successful fetch |
| `ttlMs` | Cache TTL in milliseconds (90000 = 90 s) |
| `errorKind` | `auth` / `dependency` / `rate_limit` / `transient` / `unknown` |
| `detail` | Human-readable error description |

### 2. If `status` is `ok` — show PR notification details

The cache stores the count only.  To see the actual notification list, run a
force refresh which calls the GitHub API and prints full details:

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service github --force
```

Then display unread PR notification threads (deduplicated by thread id):

- **Repository** (`owner/repo`)
- **PR title**
- **Reason** (`review_requested` / `mention` / `team_mention` / `author` / etc.)
- **Updated** (ISO 8601 timestamp)
- **Link** (GitHub web URL to the PR)

Present the results as a numbered list, most recently updated first.

### 3. If `status` is `error` — show error cause

Read `errorKind` and `detail` from the cache and explain what went wrong:

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | Not logged in to GitHub via `gh` | Run `gh auth login` |
| `dependency` | `gh` CLI not installed | Install from https://cli.github.com |
| `rate_limit` | GitHub API rate limit exceeded | Wait a minute, then retry |
| `transient` | Temporary network error | Retry with `--force` |
| `unknown` | Unexpected error | See `detail` field for raw error message |

### 4. Force refresh

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service github --force
```

Wait for the command to complete, then re-read the cache.

### 5. If not authenticated

Check `gh` login status:

```bash
gh auth status
```

If not logged in:

```bash
gh auth login
```

Follow the interactive prompts (browser or token).  After completing auth, run
a force refresh to confirm:

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service github --force
```

## Example output (status ok)

```
GitHub unread PR notifications: 4   (last updated: 2026-03-24T10:15:00Z)

 1. myorg/backend  Optimize database queries (#312)
    Reason: review_requested
    Updated: 2026-03-24T10:10:00Z
    Link: https://github.com/myorg/backend/pull/312

 2. myorg/frontend  Add dark mode toggle (#298)
    Reason: mention
    Updated: 2026-03-24T09:45:00Z
    Link: https://github.com/myorg/frontend/pull/298

...
```

## Example output (status error — dependency)

```
GitHub status: ERROR
Error kind:   dependency
Detail:       gh CLI not installed or not found in PATH.

Fix: Install the GitHub CLI from https://cli.github.com, then run:
     gh auth login
```

## Notes

- The count uses thread-level deduplication: multiple reasons on the same PR
  thread still count as 1.
- Opening the PR link in a browser marks the GitHub notification thread as
  read.  The count will drop at the next scheduled refresh.
- Cache TTL for GitHub is **90 seconds**.
