---
name: github-check
description: Show cached GitHub PR notification details, diagnose errors, guide authentication, and optionally force a fresh fetch. Use when status line shows github count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show GitHub PR notification details from cache.

## When to use

- When the status line shows a GitHub count and you want to see the PR list.
- When the status line shows `!` for GitHub and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
cat "$CLAUDE_PLUGIN_DATA/cache/github.json"
```

Parse the JSON. The `items` array contains the detailed PR notification list.

### 2. If `status` is `ok` — display the items

The `items` array contains objects with:

| Field | Example |
|---|---|
| `title` | `Optimize database queries (#312)` |
| `link` | `https://github.com/myorg/backend/pull/312` |
| `meta.repo` | `myorg/backend` |
| `meta.reason` | `review_requested` |
| `meta.updated` | `2026-03-24T10:10:00Z` |

Present as a numbered list, most recently updated first. Include the `link` for each PR.

### 3. If `status` is `error` — show error cause

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | Not logged in via `gh` | Run `gh auth login` |
| `dependency` | `gh` CLI not installed | Install from https://cli.github.com |
| `rate_limit` | GitHub API rate limit exceeded | Wait a minute, then retry |
| `transient` | Temporary network error | Force refresh |

### 4. Force refresh (if user requests)

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
rm -f "$CLAUDE_PLUGIN_DATA/locks/github.lock"
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service github --force 2>&1
cat "$CLAUDE_PLUGIN_DATA/cache/github.json"
```

Then display the updated items.

## Example output

```
GitHub unread PR notifications: 4   (last updated: 2026-03-24T10:15:00Z)

 1. myorg/backend  Optimize database queries (#312)
    Reason: review_requested  Updated: 2026-03-24T10:10:00Z
    https://github.com/myorg/backend/pull/312

 2. myorg/frontend  Add dark mode toggle (#298)
    Reason: mention  Updated: 2026-03-24T09:45:00Z
    https://github.com/myorg/frontend/pull/298
```

## Notes

- Data is pre-collected with details — no additional API calls needed.
- The count uses thread-level deduplication.
- Cache TTL: **1 minute**.
