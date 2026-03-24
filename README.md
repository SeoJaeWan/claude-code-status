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

## Prerequisites

The following CLIs are required for the corresponding services:

| Service | CLI | Install |
|---|---|---|
| GitHub | [GitHub CLI](https://cli.github.com) v2.0+ | `winget install GitHub.cli` or [download](https://cli.github.com) |
| Jira | [Atlassian CLI](https://developer.atlassian.com/cloud/acli/guides/install-acli/) | See below |
| Gmail / Tasks | [Google Workspace CLI](https://github.com/googleworkspace/cli) | `npm install -g @googleworkspace/cli` |

#### Atlassian CLI (acli) installation

Download the binary for your platform:

**Windows (PowerShell):**

```powershell
# x86-64
Invoke-WebRequest -Uri https://acli.atlassian.com/windows/latest/acli_windows_amd64/acli.exe -OutFile acli.exe

# ARM64
Invoke-WebRequest -Uri https://acli.atlassian.com/windows/latest/acli_windows_arm64/acli.exe -OutFile acli.exe
```

After downloading, move `acli.exe` to a directory in your `PATH` and verify:

```bash
acli --help
```

> **Note:** npm의 `acli` 패키지는 Atlassian CLI가 아닙니다. 반드시 위 공식
> 바이너리를 사용하세요.

---

## Installation

### 1. Install the plugin

```bash
claude plugin install claude-status
```

### 2. Configure the global status line

After installation, run:

```
/claude-status:install-status
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

#### Jira

```bash
acli jira auth login --web
```

브라우저가 열리면 Atlassian 사이트를 선택하고 권한을 승인합니다.

#### Gmail and Google Tasks

```bash
npm install -g @googleworkspace/cli
gws auth setup    # creates Cloud project & enables APIs (needs gcloud CLI)
gws auth login    # browser-based OAuth consent
```

For manual setup without `gcloud`, see the [gws README](https://github.com/googleworkspace/cli#manual-oauth-setup).

---

## Available commands

| Command | Description |
|---|---|
| `/claude-status:install-status` | Wire the status line launcher into `~/.claude/settings.json` |
| `/claude-status:gmail-check` | Show Gmail unread details; diagnose errors; force refresh |
| `/claude-status:tasks-check` | Show Google Tasks details; diagnose errors; force refresh |
| `/claude-status:jira-check` | Show Jira issue details; diagnose errors; force refresh |
| `/claude-status:github-check` | Show GitHub PR notification details; diagnose errors; force refresh |
| `/claude-status:status-doctor` | Comprehensive health check with actionable fix suggestions |

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
/claude-status:status-doctor
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

```bash
gws auth status   # check if authenticated
gws auth login    # if not, log in
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
  cache/
    github.json
    gmail.json
    tasks.json
    jira.json
  locks/
    <service>.lock          <- prevents duplicate concurrent collectors
  logs/
    launcher.log
    tsc-build.log
```
