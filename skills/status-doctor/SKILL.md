---
name: status-doctor
description: Check all external dependencies, authentication status, cache freshness, and configuration required by the claude-status plugin. Use when status line shows errors or after installation.
user-invocable: true
allowed-tools: "Read, Bash"
---

Check all external dependencies and configuration required by the claude-status plugin.

## When to use

- After initial installation to confirm the environment is ready.
- When the status line shows `!` for one or more services.
- When troubleshooting authentication or missing CLI tools.
- After any update to confirm the setup is still correct.

## What this skill checks

| Check                          | Tool / Path                                      | Required for                     |
| ------------------------------ | ------------------------------------------------ | -------------------------------- |
| Node.js                        | `node --version`                                 | Runtime renderer, all collectors |
| npm                            | `npm --version`                                  | Runtime build / install          |
| GitHub CLI auth                | `gh auth status`                                 | github collector                 |
| Atlassian CLI auth             | `acli jira auth status`                          | jira collector                   |
| Google OAuth client config     | `$CLAUDE_PLUGIN_DATA/google/client_secret.json`  | gmail, tasks collectors          |
| Google token cache             | `$CLAUDE_PLUGIN_DATA/google/tokens.json`         | gmail, tasks collectors          |
| Launcher file                  | `$CLAUDE_PLUGIN_DATA/bin/status-line.ps1`        | statusLine.command               |
| Runtime dist                   | `$CLAUDE_PLUGIN_DATA/runtime/dist/render.js`     | statusLine execution             |
| settings.json pointer          | `~/.claude/settings.json` → `statusLine.command` | status line rendering            |
| Cache freshness (each service) | `$CLAUDE_PLUGIN_DATA/cache/<service>.json`       | accurate status line             |
| Last error per service         | `errorKind` + `detail` in each cache file        | diagnosing `!` entries           |

---

## Steps

### 1. Check Node.js

```bash
node --version
```

- PASS: prints `v18.x.x` or higher
- FAIL: Node.js is not installed. Install from https://nodejs.org (v18 LTS or later)

### 2. Check npm

```bash
npm --version
```

- PASS: prints version number
- FAIL: npm is not available — usually comes with Node.js; reinstall Node

### 3. Check GitHub CLI (`gh`)

```bash
gh auth status
```

- PASS: prints authenticated user info
- FAIL (not logged in): run `gh auth login`
- FAIL (`gh` not found): install from https://cli.github.com

### 4. Check Atlassian CLI (`acli`)

```bash
acli jira auth status 2>&1 || acli --version 2>&1
```

- PASS: prints authenticated user or version
- FAIL (not logged in): run `acli jira auth login --web`
- FAIL (`acli` not found): install from https://acli.atlassian.com

### 5. Check Google OAuth client config

```
$CLAUDE_PLUGIN_DATA/google/client_secret.json
```

- PASS: file exists and contains `client_id`, `client_secret`
- FAIL (file missing): run `/claude-status:setup-google`

### 6. Check Google token cache

```
$CLAUDE_PLUGIN_DATA/google/tokens.json
```

- PASS: file exists with a `refresh_token` field
- FAIL (file missing): run `/claude-status:setup-google` to complete the OAuth flow
- FAIL (missing `refresh_token`): delete the file and re-run `/claude-status:setup-google`

### 7. Check launcher

```
$CLAUDE_PLUGIN_DATA/bin/status-line.ps1
```

- PASS: file exists
- FAIL: run `/claude-status:install-global` or restart Claude Code to trigger the SessionStart hook

### 8. Check runtime dist

```
$CLAUDE_PLUGIN_DATA/runtime/dist/render.js
```

- PASS: file exists
- FAIL: TypeScript build failed — check `$CLAUDE_PLUGIN_DATA/logs/tsc-build.log`

### 9. Check settings.json pointer

Read `~/.claude/settings.json` and confirm `statusLine.command` equals the expected launcher path.

- PASS: value matches `$CLAUDE_PLUGIN_DATA/bin/status-line.ps1`
- FAIL: not set or points elsewhere → run `/claude-status:install-global`

### 10. Check cache freshness for each service

For each service (`gmail`, `tasks`, `jira`, `github`), read:

```bash
cat "$CLAUDE_PLUGIN_DATA/cache/<service>.json"
```

Inspect the `fetchedAt` and `ttlMs` fields:

```
age = now - fetchedAt  (milliseconds)
fresh = age < ttlMs
```

- PASS: `fresh = true`
- WARN: `fresh = false` — cache is stale; a background refresh will fire on the next render
- FAIL (file missing): collector has never run; trigger manually:
    ```bash
    node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service <service> --force
    ```

### 11. Check last error per service

For each service cache file where `status = "error"`, display:

```
<service>  ERROR  errorKind: <kind>
  detail: <detail>
  fix: <actionable suggestion>
```

Fix suggestions by `errorKind`:

| `errorKind`  | Service       | Fix                                                                              |
| ------------ | ------------- | -------------------------------------------------------------------------------- |
| `auth`       | github        | `gh auth login`                                                                  |
| `auth`       | jira          | `acli jira auth login --web`                                                     |
| `auth`       | gmail / tasks | Run `/claude-status:setup-google`                                                |
| `dependency` | github        | Install `gh` from https://cli.github.com                                         |
| `dependency` | jira          | Install `acli` from https://acli.atlassian.com                                   |
| `rate_limit` | any           | Wait a few minutes, then retry                                                   |
| `transient`  | any           | `node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service <service> --force` |
| `unknown`    | any           | See `detail` field for raw error; check internet connectivity                    |

---

## Expected output (all passing)

```
[claude-status doctor]

node              v20.11.0    OK
npm               10.2.4      OK
gh                logged in   OK
acli              logged in   OK
google-client     found       OK
google-token      found       OK
launcher          found       OK
runtime dist      found       OK
settings.json     correct     OK

Cache freshness:
  gmail    fresh   (fetched 2m ago, TTL 5m)   OK
  tasks    fresh   (fetched 1m ago, TTL 5m)   OK
  jira     fresh   (fetched 3m ago, TTL 5m)   OK
  github   fresh   (fetched 30s ago, TTL 90s) OK

Last errors: none

All checks passed.
```

## Example output (some failures)

```
[claude-status doctor]

node              v20.11.0    OK
npm               10.2.4      OK
gh                NOT FOUND   FAIL  -> Install from https://cli.github.com
acli              NOT LOGGED  FAIL  -> Run: acli jira auth login --web
google-client     missing     FAIL  -> Run /claude-status:setup-google
google-token      missing     FAIL  -> Run /claude-status:setup-google
launcher          found       OK
runtime dist      found       OK
settings.json     not set     FAIL  -> Run /claude-status:install-global

Cache freshness:
  gmail    ERROR  (auth: Google tokens not found)
           -> Run /claude-status:setup-google
  tasks    ERROR  (auth: Google tokens not found)
           -> Run /claude-status:setup-google
  jira     stale  (fetched 12m ago, TTL 5m)
           -> node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service jira --force
  github   ERROR  (dependency: gh CLI not found)
           -> Install gh from https://cli.github.com

5 checks failed. See above for remediation steps.
```

---

## Notes

- This skill is read-only. It does not modify any files or settings.
- Re-run after fixing each issue to confirm resolution.
- For Google OAuth problems, see `/claude-status:setup-google` for the full
  step-by-step setup guide.
