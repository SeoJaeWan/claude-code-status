<div align="center">

# claude-code-status

**A Claude Code plugin that brings your work dashboard into the terminal.**

Claude usage, Gmail, Tasks, Jira, GitHub, Slack — all in one status line.

<p>
  <a href="#tutorial">Install</a> &middot;
  <a href="#why">Why?</a> &middot;
  <a href="#what-it-shows">Features</a> &middot;
  <a href="#available-commands">Commands</a> &middot;
  <a href="#how-it-works">How it works</a>
</p>

<p>
  <a href="https://github.com/SeoJaeWan/claude-code-status/stargazers"><img src="https://img.shields.io/github/stars/SeoJaeWan/claude-code-status?style=flat&color=f5a623" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/runtime-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey" alt="Platform">
</p>

<p><a href="README.ko.md">한국어</a></p>

<img width="874" height="285" alt="image" src="https://github.com/user-attachments/assets/bb017850-975e-4882-b9b4-23ce9c657f9f" />


</div>

```
week 3% session 22% | gmail 7 | tasks 3 | jira 5 | github 4 | slack 5
```

---

## Why?

The default Claude Code status line shows almost nothing. You don't know:

- **How close you are to rate limits** until you hit them
- **How many unread emails** are piling up while you're deep in a coding session
- **How many Jira tickets** are waiting for you
- **Whether a PR review** just came in on GitHub
- **How many Slack messages** are waiting for you

Context switching to check each service breaks your flow. This plugin puts everything in one line at the bottom of your terminal — always visible, never in the way.

Services you haven't connected are **automatically hidden**. You can also **toggle visibility** of connected services with `/claude-code-status:toggle-service`. Start with just the usage percentages, add services when you need them.

---

## What it shows

| Segment       | Source                  | What it tells you                            |
| ------------- | ----------------------- | -------------------------------------------- |
| `week 3%`     | Claude Code rate limits | Weekly plan usage — pace yourself            |
| `session 22%` | Claude Code rate limits | Current session usage — watch for compaction |
| `gmail 7`     | Gmail API               | Unread emails accumulating                   |
| `tasks 3`     | Google Tasks API        | Incomplete to-dos                            |
| `jira 5`      | Jira API                | Open issues assigned to you                  |
| `github 4`    | GitHub API              | Unread PR notifications                      |
| `slack 5`     | Slack API               | Unread DMs + monitored channel messages      |

### Color coding

Colors change based on urgency so you can scan at a glance:

| Segment        | Green | Cyan   | Yellow | Red  | Gray |
| -------------- | ----- | ------ | ------ | ---- | ---- |
| week / session | 0-29% | 30-59% | 60-79% | 80%+ | -    |
| gmail          | 1-9   | -      | 10-29  | 30+  | 0    |
| tasks          | 1-5   | -      | 6-10   | 11+  | 0    |
| jira           | 1-5   | -      | 6-10   | 11+  | 0    |
| github         | 1-3   | -      | 4-7    | 8+   | 0    |
| slack          | 1-9   | -      | 10-29  | 30+  | 0    |

---

## Prerequisites

| Requirement                           | Why                                          |
| ------------------------------------- | -------------------------------------------- |
| [Node.js](https://nodejs.org) v18+    | Runs the status line renderer and collectors |
| [Claude Code](https://claude.ai/code) | The CLI this plugin extends                  |

External service CLIs are **optional** — install only what you need:

| Service       | CLI / API                                                     | Install                                                                            |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Gmail / Tasks | [Google Workspace CLI](https://github.com/nicholasgasior/gws) | `npm install -g @googleworkspace/cli`                                               |
| Jira          | [Atlassian CLI](https://developer.atlassian.com/cloud/acli/)  | [Download binary](https://developer.atlassian.com/cloud/acli/guides/install-acli/) |
| GitHub        | [GitHub CLI](https://cli.github.com)                          | `winget install GitHub.cli` / `brew install gh`                                    |
| Slack         | [Slack API](https://api.slack.com/apps) (User OAuth Token)    | Run `/claude-code-status:slack-setup`                                              |

---

## Tutorial

### Step 1. Install the plugin

```bash
claude plugin marketplace add SeoJaeWan/claude-code-status
claude plugin install claude-code-status@claude-code-status
```

### Step 2. Initialize everything

Run this command inside a Claude Code conversation:

```
/claude-code-status:init-statusline
```

This single command does everything — bootstraps the data directory, wires `settings.json`, and populates the cache. **No restart required.** The status line will appear within a few seconds.

### Step 3. Connect external services (optional)

Authenticate only the services you want. Unauthenticated services stay hidden.

<details>
<summary><b>Gmail & Google Tasks</b></summary>

```bash
npm install -g @googleworkspace/cli   # Install Google Workspace CLI
gws auth setup                        # Create Cloud project & enable APIs
gws auth login                        # Browser-based OAuth consent
```

For manual setup without `gcloud`, see the [gws README](https://github.com/nicholasgasior/gws#manual-oauth-setup).

</details>

<details>
<summary><b>Jira</b></summary>

```bash
# Install Atlassian CLI (Windows example)
Invoke-WebRequest -Uri https://acli.atlassian.com/windows/latest/acli_windows_amd64/acli.exe -OutFile acli.exe
# Add acli.exe to your PATH, then:
acli jira auth login --web
```

A browser window will open — select your Atlassian site and approve the permissions.

> The npm `acli` package is **not** the Atlassian CLI. Always use the [official binary](https://developer.atlassian.com/cloud/acli/guides/install-acli/).

</details>

<details>
<summary><b>GitHub</b></summary>

```bash
gh auth login
```

</details>

<details>
<summary><b>Slack</b></summary>

Run the setup skill inside a Claude Code conversation:

```
/claude-code-status:slack-setup
```

This will guide you through:
1. Creating a Slack App and getting a User OAuth Token (`xoxp-...`)
2. Selecting which channels to monitor

Required User Token Scopes: `channels:read`, `groups:read`, `im:read`, `mpim:read`

</details>

### Step 4. Verify everything works

```
/claude-code-status:status-doctor
```

Checks all dependencies, auth status, launcher path, and cache state at once.
Each failed check includes the exact command to fix it.

---

## Available commands

| Command                               | Description                                                            |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `/claude-code-status:init-statusline` | **Full setup** — bootstrap, wire settings, populate cache (no restart) |
| `/claude-code-status:status-doctor`   | Full health check with fix suggestions                                 |
| `/claude-code-status:gmail-check`     | Gmail details / force refresh                                          |
| `/claude-code-status:tasks-check`     | Google Tasks details / force refresh                                   |
| `/claude-code-status:jira-check`      | Jira issue details / force refresh                                     |
| `/claude-code-status:github-check`    | GitHub PR notification details / force refresh                         |
| `/claude-code-status:slack-setup`     | Slack integration setup — token + channel selection                    |
| `/claude-code-status:slack-check`     | Slack unread details / force refresh                                   |
| `/claude-code-status:toggle-service`  | Show/hide a service from the status line (e.g. `gmail off`)            |

---

## How it works

```
[SessionStart hook]
  Copies status-line.sh + pre-built dist/ to $CLAUDE_PLUGIN_DATA
  Installs npm production dependencies

[Status line render cycle]  (every few seconds)
  Claude Code stdin JSON ──> status-line.sh ──> node render.js ──> stdout
                                                    |
                                         reads cache/*.json
                                         spawns background refresh if stale

[Background collectors]
  node collect.js --service <name>
    -> calls external CLI (gws / acli / gh) or Slack API directly
    -> writes $CLAUDE_PLUGIN_DATA/cache/<service>.json
    -> lock files prevent duplicate fetches
```

### Cache TTL

| Service                        | TTL       |
| ------------------------------ | --------- |
| gmail / tasks / jira / github  | 1 minute  |
| slack                          | 2 minutes |

---

## Troubleshooting

| Problem                 | Solution                                            |
| ----------------------- | --------------------------------------------------- |
| Status line not showing | Run `/claude-code-status:init-statusline`           |
| Service shows `!` (red) | Auth expired — re-run the auth command from Step 3  |
| `status: build missing` | Restart Claude Code (SessionStart hook syncs dist/) |
| Want to force-refresh   | Use `/claude-code-status:<service>-check`           |

---

## File layout

```
$CLAUDE_PLUGIN_DATA/
  bin/
    status-line.sh            <- Bash launcher (copied by SessionStart)
  runtime/
    dist/
      render.js               <- Status line renderer
      collect.js              <- Collector CLI dispatcher
      collectors/
        gmail.js, tasks.js, jira.js, github.js, slack.js
      coordinator.js          <- Lock / stale / background refresh
      cache.js                <- Cache read helpers
  config.json                 <- Service visibility + Slack token/channels
  cache/
    <service>.json            <- Cached data per service
  locks/
    <service>.lock            <- Prevents duplicate concurrent collectors
  logs/
    launcher.log, session-start.log
```

---

## License

[MIT](LICENSE)
