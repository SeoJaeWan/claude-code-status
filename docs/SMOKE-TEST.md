# Smoke Test Procedure

Manual step-by-step checklist for verifying a fresh install of the `claude-status` plugin on Windows.

## Prerequisites

- Claude Code installed and on PATH
- Node.js >= 18 installed
- PowerShell available (Windows default)

---

## Step 1 — Install plugin locally

```powershell
claude --plugin-dir "C:\path\to\claude-code-status"
```

Verify: Claude Code starts without errors and the plugin directory is recognised.

---

## Step 2 — Run install-status skill

Inside Claude Code:

```
/claude-status:install-status
```

Expected outcome:
- The skill outputs a success message confirming that `statusLine.command` was patched in `~/.claude/settings.json`.
- No error about missing Node.js or missing `dist/render.js`.

Manual check — open `~/.claude/settings.json` and confirm a `statusLine` entry like:

```json
"statusLine": {
  "type": "command",
  "command": "<CLAUDE_PLUGIN_DATA>/bin/status-line.sh"
}
```

---

## Step 3 — Verify status line appears

Restart Claude Code (or open a new session) so the new `statusLine.command` takes effect.

Expected: the status bar at the bottom of the Claude Code window shows text similar to:

```
week 42% session 18% | gmail - | tasks - | jira - | github -
```

- `week` and `session` percentages are read from stdin (real Claude Code data).
- Service fields show `-` until collectors have run at least once.

If the status bar is blank or shows `status: render error`, check:
- `CLAUDE_PLUGIN_DATA` environment variable is set (Claude Code sets this automatically).
- `runtime/dist/render.js` exists (run `npm run build` in `runtime/` if missing).

---

## Step 4 — Run doctor skill

```
/claude-status:doctor
```

Expected output checklist:
- [ ] Node.js version check passes (>= 18)
- [ ] `render.js` found in `dist/`
- [ ] `CLAUDE_PLUGIN_DATA` is set and writable
- [ ] `statusLine.command` present in `~/.claude/settings.json`
- [ ] For each configured service (github, jira, gmail, tasks): dependency availability reported (OK or missing with instructions)

---

## Step 5 — Test each service

### GitHub

```
/claude-status:github-check
```

- If `gh` CLI is installed and authenticated: shows PR notification count.
- If `gh` not installed: shows dependency error with install instructions.
- If not authenticated: shows auth error with `gh auth login` instructions.

Force a cache refresh and verify new data appears in the status bar within ~5 seconds:

```powershell
Remove-Item "$env:CLAUDE_PLUGIN_DATA\cache\github.json" -ErrorAction SilentlyContinue
```

Then wait for the next status-line render cycle.

### Jira

```
/claude-status:jira-check
```

- If `acli` is installed and logged in: shows open issue count.
- If `acli` not installed: shows dependency error.

### Gmail and Tasks

```
/claude-status:gmail-check
/claude-status:tasks-check
```

- If Google credentials are set up: shows unread count / task count.
- If not set up: shows instructions to run `gws auth login`.

---

## Step 6 — Error scenarios

### Missing gh CLI

Temporarily rename or remove `gh` from PATH, then trigger a GitHub cache refresh:

```powershell
Remove-Item "$env:CLAUDE_PLUGIN_DATA\cache\github.json"
```

Wait for render. Status bar should show `github !` (red `!`).
Doctor should report: `gh: dependency error — not installed`.

Restore `gh` to PATH and verify recovery on next render cycle.

### Google auth failure

Temporarily revoke gws credentials (or rename the credential file):

```powershell
# On Windows, encrypted creds are in keyring; simulate by revoking:
gws auth logout
```

Trigger a Gmail cache refresh:

```powershell
Remove-Item "$env:CLAUDE_PLUGIN_DATA\cache\gmail.json"
```

Status bar should show `gmail !` (red `!`).
Doctor should report auth error for Gmail.

Run `gws auth login` to re-authorise and verify recovery.

### Missing CLAUDE_PLUGIN_DATA

This variable is set automatically by Claude Code. To simulate its absence, run `render.js` directly:

```powershell
node runtime/dist/render.js
```

Expected stdout: `status: render error` (the fallback line — never blank).

---

## Completion Checklist

- [ ] Plugin loads without errors
- [ ] `install-status` patches settings correctly
- [ ] Status bar shows week/session percentages
- [ ] Doctor reports all checks
- [ ] Each service shows correct data or a meaningful error indicator
- [ ] Error states display `!` in status bar
- [ ] Recovery from errors works on next render cycle
