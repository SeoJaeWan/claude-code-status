# /claude-status:doctor

Check all external dependencies and configuration required by the claude-status plugin.

## When to use

- After initial installation to confirm the environment is ready.
- When the status line shows `!` for one or more services.
- When troubleshooting authentication or missing CLI tools.

## What this skill checks

| Check | Tool / Path | Required for |
|---|---|---|
| Node.js | `node --version` | Runtime renderer, all collectors |
| npm | `npm --version` | Runtime build / install |
| GitHub CLI | `gh auth status` | github collector |
| Atlassian CLI | `acli jira auth status` | jira collector |
| Google OAuth client config | `$CLAUDE_PLUGIN_DATA/auth/google-client.json` | gmail, tasks collectors |
| Google token cache | `$CLAUDE_PLUGIN_DATA/auth/google-token.json` | gmail, tasks collectors |
| Launcher file | `$CLAUDE_PLUGIN_DATA/bin/status-line.ps1` | statusLine.command |
| Runtime dist | `$CLAUDE_PLUGIN_DATA/runtime/dist/render.js` | statusLine execution |
| settings.json pointer | `~/.claude/settings.json` → `statusLine.command` | status line rendering |

## Steps

### 1. Check Node.js

```bash
node --version
```

- PASS: prints `v18.x.x` or higher
- FAIL: Node.js is not installed. Install from https://nodejs.org (v18 LTS or later recommended)

### 2. Check npm

```bash
npm --version
```

- PASS: prints version number
- FAIL: npm is not available — usually comes with Node.js, reinstall Node

### 3. Check GitHub CLI (`gh`)

```bash
gh auth status
```

- PASS: prints authenticated user info
- FAIL: not logged in → run `gh auth login`
- FAIL: `gh` not found → install from https://cli.github.com

### 4. Check Atlassian CLI (`acli`)

```bash
acli jira auth status 2>&1 || acli --version 2>&1
```

- PASS: prints authenticated user or version
- FAIL: not logged in → run `acli jira auth login --web`
- FAIL: `acli` not found → install from https://acli.atlassian.com

### 5. Check Google OAuth client config

```
$CLAUDE_PLUGIN_DATA/auth/google-client.json
```

- PASS: file exists and contains `client_id`, `client_secret`
- FAIL: file missing → run `/claude-status:setup-google` (Phase 3) or create manually

### 6. Check Google token cache

```
$CLAUDE_PLUGIN_DATA/auth/google-token.json
```

- PASS: file exists (token may be expired — refresh is automatic)
- FAIL: file missing → run `/claude-status:setup-google` to complete OAuth flow

### 7. Check launcher

```
$CLAUDE_PLUGIN_DATA/bin/status-line.ps1
```

- PASS: file exists
- FAIL: run `/claude-status:install-global` or restart Claude Code to trigger SessionStart hook

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

## Expected output (all passing)

```
[claude-status doctor]

node            v20.11.0    OK
npm             10.2.4      OK
gh              logged in   OK
acli            logged in   OK
google-client   found       OK
google-token    found       OK
launcher        found       OK
runtime dist    found       OK
settings.json   correct     OK

All checks passed.
```

## Example output (some failures)

```
[claude-status doctor]

node            v20.11.0    OK
npm             10.2.4      OK
gh              NOT FOUND   FAIL  -> Install from https://cli.github.com
acli            NOT FOUND   FAIL  -> Install from https://acli.atlassian.com
google-client   missing     FAIL  -> Run /claude-status:setup-google
google-token    missing     FAIL  -> Run /claude-status:setup-google
launcher        found       OK
runtime dist    found       OK
settings.json   not set     FAIL  -> Run /claude-status:install-global

3 checks failed. See above for remediation steps.
```

## Notes

- This skill is read-only. It does not modify any files or settings.
- Re-run after fixing each issue to confirm resolution.
- Extended diagnostics (last collector errors, cache freshness) will be added in Phase 3.
