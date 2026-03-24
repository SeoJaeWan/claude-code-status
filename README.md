# claude-status

A Claude Code plugin that displays a live status line showing Claude usage and
external service activity at a glance.

```
week 42% session 18% | gmail 7 | tasks 3 | jira 5 | github 4
```

---

## What it shows

| Segment | Source | Details command |
|---|---|---|
| `week N%` | Claude Code rate limits (stdin) | `/usage` |
| `session N%` | Claude Code rate limits (stdin) | `/usage` |
| `gmail N` | Gmail unread count | `/claude-status:gmail-check` |
| `tasks N` | Google Tasks incomplete count | `/claude-status:tasks-check` |
| `jira N` | Jira issues assigned to you (not Done) | `/claude-status:jira-check` |
| `github N` | GitHub unread PR notifications | `/claude-status:github-check` |

### Status indicators

Each service shows one of:

| Symbol | Meaning |
|---|---|
| Number | Current count (colored by threshold — see Color thresholds) |
| `!` (red) | Collector error (auth failure, missing CLI, etc.) |
| `-` (gray) | No data available yet |

---

## Color thresholds

| Segment | Gray | Default | Yellow | Red |
|---|---|---|---|---|
| week / session | — | 0–59% | 60–79% | 80%+ |
| gmail | 0 | 1–9 | 10–29 | 30+ |
| tasks | 0 | 1–5 | 6–10 | 11+ |
| jira | 0 | 1–5 | 6–10 | 11+ |
| github | 0 | 1–3 | 4–7 | 8+ |

---

## Installation

### 1. Install the plugin

```bash
claude plugin install claude-status
```

### 2. Configure the global status line

After installation, run:

```
/claude-status:install-global
```

This sets `statusLine.command` in `~/.claude/settings.json` to point to the
stable launcher at `$CLAUDE_PLUGIN_DATA/bin/status-line.ps1`.

The launcher is copied to that stable path by the plugin's `SessionStart` hook
each time Claude Code starts, so it survives plugin updates.

### 3. Set up external services

Each external service requires a one-time authentication step:

#### GitHub

```bash
gh auth login
```

Requires the [GitHub CLI](https://cli.github.com) (v2.0+).

#### Jira

```bash
acli jira auth login --web
```

Requires the [Atlassian CLI](https://acli.atlassian.com).

#### Gmail and Google Tasks (Google OAuth)

Follow the guided setup:

```
/claude-status:setup-google
```

This walks you through creating a Google Cloud project, enabling the Gmail and
Tasks APIs, downloading Desktop OAuth credentials, and completing the browser-
based consent flow.

Quick summary:

1. Create a Google Cloud project at https://console.cloud.google.com/
2. Enable **Gmail API** and **Google Tasks API**.
3. Create a **Desktop app** OAuth client and download `client_secret.json`.
4. Save it to `$CLAUDE_PLUGIN_DATA/google/client_secret.json`.
5. Run the auth flow:
   ```bash
   node "$CLAUDE_PLUGIN_DATA/runtime/dist/google-auth-flow.js"
   ```

---

## Available commands

| Command | Description |
|---|---|
| `/claude-status:install-global` | Wire the status line launcher into `~/.claude/settings.json` |
| `/claude-status:setup-google` | Complete Google OAuth setup for Gmail and Tasks |
| `/claude-status:gmail-check` | Show Gmail unread details; diagnose errors; force refresh |
| `/claude-status:tasks-check` | Show Google Tasks details; diagnose errors; force refresh |
| `/claude-status:jira-check` | Show Jira issue details; diagnose errors; force refresh |
| `/claude-status:github-check` | Show GitHub PR notification details; diagnose errors; force refresh |
| `/claude-status:doctor` | Comprehensive health check with actionable fix suggestions |

---

## How it works

```
[SessionStart hook]
  - Copies status-line.ps1 to $CLAUDE_PLUGIN_DATA/bin/
  - Builds runtime TypeScript → dist/

[status line render cycle]
  Claude Code passes stdin JSON (rate_limits, model, session_id)
    -> $CLAUDE_PLUGIN_DATA/bin/status-line.ps1 (PowerShell launcher)
    -> node $CLAUDE_PLUGIN_DATA/runtime/dist/render.js
       - Reads stdin JSON for week/session percentages
       - Reads cache files for gmail/tasks/jira/github
       - If any cache is stale: spawns background refresh (non-blocking)
       - Outputs one-line colored status string

[background collectors]
  node $CLAUDE_PLUGIN_DATA/runtime/dist/collect.js --service <name>
    - Fetches data from the external API / CLI
    - Writes result to $CLAUDE_PLUGIN_DATA/cache/<service>.json
    - Uses lock files to prevent duplicate concurrent fetches
```

### Cache locations

All cache files are JSON at `$CLAUDE_PLUGIN_DATA/cache/<service>.json`.

Cache TTLs:

| Service | TTL |
|---|---|
| github | 90 seconds |
| gmail | 5 minutes |
| tasks | 5 minutes |
| jira | 5 minutes |

---

## Troubleshooting

### Run the doctor

```
/claude-status:doctor
```

This checks all dependencies, auth status, launcher path, runtime dist, cache
freshness, and last error per service.  Each failed check includes the exact
command to fix it.

### Common issues

**Status line shows `!` for GitHub**

```bash
gh auth status
# if not logged in:
gh auth login
```

**Status line shows `!` for Jira**

```bash
acli jira auth status
# if not logged in:
acli jira auth login --web
```

**Status line shows `!` for Gmail or Tasks**

```
/claude-status:setup-google
```

**Status line shows `status: build missing`**

The runtime TypeScript has not been compiled yet.  Check:

```bash
ls "$CLAUDE_PLUGIN_DATA/runtime/dist/"
cat "$CLAUDE_PLUGIN_DATA/logs/tsc-build.log"
```

Re-trigger the build by restarting Claude Code (SessionStart hook runs the
TypeScript compile step).

**Status line shows `-` (gray) for a service**

The cache file is missing — the collector has never run.  Force a refresh:

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service gmail --force
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service tasks --force
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service jira --force
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service github --force
```

**Force-refresh a specific service**

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service github --force
```

---

## File layout

```
$CLAUDE_PLUGIN_DATA/
  bin/
    status-line.ps1         <- stable launcher (copied by SessionStart)
  runtime/
    dist/
      render.js             <- status line renderer
      collect.js            <- collector CLI dispatcher
      collectors/
        github.js
        jira.js
        gmail.js
        tasks.js
      coordinator.js        <- lock / stale / background-refresh logic
      cache.js              <- cache read helpers
      google-auth.js        <- Google OAuth token management
      google-auth-flow.js   <- one-time OAuth setup script
  cache/
    github.json
    gmail.json
    tasks.json
    jira.json
  google/
    client_secret.json      <- Desktop OAuth credentials (user-provided)
    tokens.json             <- OAuth access + refresh tokens (auto-managed)
  locks/
    <service>.lock          <- prevents duplicate concurrent collectors
  logs/
    launcher.log
    tsc-build.log
```
