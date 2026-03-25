# claude-code-status

[한국어](README.ko.md)

A Claude Code plugin that adds a live status line to the bottom of your terminal.
See Claude usage (week/session) and external service notifications (Gmail, Tasks, Jira, GitHub) at a glance.

```
week 3% session 22% | gmail 7 | tasks 3 | jira 5 | github 4
```

- **week / session** — Claude Code plan usage (auto-collected from stdin JSON)
- **gmail** — Unread Gmail count ([Google Workspace CLI](https://github.com/nicholasgasior/gws))
- **tasks** — Incomplete Google Tasks count (Google Workspace CLI)
- **jira** — Open issues assigned to you ([Atlassian CLI](https://developer.atlassian.com/cloud/acli/))
- **github** — Unread PR notifications ([GitHub CLI](https://cli.github.com))

Services you haven't connected are automatically hidden — only set up what you need.

### Color rules

| Segment | Green | Cyan | Yellow | Red | Gray |
|---|---|---|---|---|---|
| week / session | 0–29% | 30–59% | 60–79% | 80%+ | — |
| gmail | 1–9 | — | 10–29 | 30+ | 0 |
| tasks | 1–5 | — | 6–10 | 11+ | 0 |
| jira | 1–5 | — | 6–10 | 11+ | 0 |
| github | 1–3 | — | 4–7 | 8+ | 0 |

---

## Tutorial

### Step 1. Install the plugin

```bash
claude plugin install claude-status
```

### Step 2. Wire the status line

Run this command inside a Claude Code conversation:

```
/claude-code-status:install-status
```

This sets `statusLine.command` in `~/.claude/settings.json`.
**Restart Claude Code** and the status line will appear at the bottom of your terminal.

### Step 3. Connect external services (optional)

Authenticate only the services you want. Unauthenticated services stay hidden.

#### Gmail & Google Tasks

```bash
npm install -g @nicholasgasior/gws   # Install Google Workspace CLI
gws auth setup                        # Create Cloud project & enable APIs
gws auth login                        # Browser-based OAuth consent
```

> For manual setup without `gcloud`, see the [gws README](https://github.com/nicholasgasior/gws#manual-oauth-setup).

#### Jira

```bash
# Install Atlassian CLI (Windows example)
Invoke-WebRequest -Uri https://acli.atlassian.com/windows/latest/acli_windows_amd64/acli.exe -OutFile acli.exe
# Add acli.exe to your PATH, then:
acli jira auth login --web
```

A browser window will open — select your Atlassian site and approve the permissions.

> The npm `acli` package is **not** the Atlassian CLI. Always use the official binary.

#### GitHub

```bash
gh auth login
```

### Step 4. Verify everything works

```
/claude-code-status:status-doctor
```

Checks all dependencies, auth status, launcher path, and cache state at once.
Each failed check includes the exact command to fix it.

---

## Available commands

| Command | Description |
|---|---|
| `/claude-code-status:install-status` | Wire the status line into `settings.json` |
| `/claude-code-status:status-doctor` | Full health check with fix suggestions |
| `/claude-code-status:gmail-check` | Gmail details / force refresh |
| `/claude-code-status:tasks-check` | Google Tasks details / force refresh |
| `/claude-code-status:jira-check` | Jira issue details / force refresh |
| `/claude-code-status:github-check` | GitHub PR notification details / force refresh |

---

## How it works

```
[SessionStart hook]
  - Copies status-line.sh to $CLAUDE_PLUGIN_DATA/bin/
  - Builds TypeScript runtime -> dist/

[Status line render cycle]
  Claude Code passes stdin JSON (rate_limits, model, session_id)
    -> $CLAUDE_PLUGIN_DATA/bin/status-line.sh (bash launcher)
    -> node render.js
       - Extracts week/session usage from stdin
       - Reads cache files for external services
       - Spawns background refresh if cache is stale (non-blocking)
       - Outputs one colored line

[Background collectors]
  node collect.js --service <name>
    - Calls the external CLI to fetch data
    - Writes result to $CLAUDE_PLUGIN_DATA/cache/<service>.json
    - Lock files prevent duplicate concurrent fetches
```

### Cache TTL

| Service | TTL |
|---|---|
| github | 90 seconds |
| gmail / tasks / jira | 5 minutes |

---

## Troubleshooting

**Status line not showing**
-> Run `/claude-code-status:install-status` then restart Claude Code.

**Service shows `!` (red)**
-> Authentication expired. Re-run the auth command from Step 3.

**`status: build missing` appears**
-> TypeScript hasn't been compiled. Restart Claude Code — the SessionStart hook builds it automatically.

**Force-refresh a specific service**
-> Use the `/claude-code-status:<service>-check` command and choose force refresh.

---

## File layout

```
$CLAUDE_PLUGIN_DATA/
  bin/
    status-line.sh          <- Bash launcher (copied by SessionStart)
  runtime/
    dist/
      render.js             <- Status line renderer
      collect.js            <- Collector CLI dispatcher
      collectors/
        gmail.js, tasks.js, jira.js, github.js
      coordinator.js        <- Lock / stale / background refresh logic
      cache.js              <- Cache read helpers
  cache/
    <service>.json          <- Cached data per service
  locks/
    <service>.lock          <- Prevents duplicate concurrent collectors
  logs/
    launcher.log, session-start.log
```
