---
name: jira-check
description: Show cached Jira open issue details, diagnose errors, guide authentication, and optionally force a fresh fetch. Use when status line shows jira count or error.
user-invocable: true
allowed-tools: "Read, Bash"
---

Show Jira open issue details from cache.

## When to use

- When the status line shows a Jira count and you want to see the issue list.
- When the status line shows `!` for Jira and you want to diagnose the error.
- When you want to force an immediate refresh instead of waiting for the TTL.

## Steps

### 1. Read the cache file

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
cat "$CLAUDE_PLUGIN_DATA/cache/jira.json"
```

Parse the JSON. The `items` array contains the detailed issue list.

### 2. If `status` is `ok` — display the items

The `items` array contains objects with:

| Field | Example |
|---|---|
| `title` | `시스템 알림과 SMS 알림 통합` |
| `link` | `https://yourorg.atlassian.net/browse/WEB-434` |
| `meta.key` | `WEB-434` |
| `meta.priority` | `Medium` |
| `meta.status` | `진행 중` |

Present as a numbered list or table. Include the `link` for each issue.

### 3. If `status` is `error` — show error cause

| `errorKind` | Likely cause | Recommended fix |
|---|---|---|
| `auth` | Not logged in to Jira | Run `acli jira auth login --web` |
| `dependency` | `acli` CLI not installed | Install from https://acli.atlassian.com |
| `rate_limit` | Jira API quota exceeded | Wait a few minutes, then retry |
| `transient` | Temporary network error | Force refresh |

### 4. Force refresh (if user requests)

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
rm -f "$CLAUDE_PLUGIN_DATA/locks/jira.lock"
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service jira --force 2>&1
cat "$CLAUDE_PLUGIN_DATA/cache/jira.json"
```

Then display the updated items.

## Example output

```
Jira 미완료 이슈: 4건   (last updated: 2026-03-25T04:26:46Z)

 1. WEB-434  시스템 알림과 SMS 알림 통합     Priority: Medium  Status: 진행 중
    https://yourorg.atlassian.net/browse/WEB-434

 2. WEB-287  기기 복귀 시 알림               Priority: Medium  Status: 해야 할 일
    https://yourorg.atlassian.net/browse/WEB-287
```

## Notes

- Data is pre-collected with details — no additional API calls needed.
- JQL: `assignee = currentUser() AND statusCategory != Done`
- Cache TTL: **1 minute**.
