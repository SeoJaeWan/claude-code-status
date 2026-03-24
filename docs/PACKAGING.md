# Packaging, Versioning, and Distribution

## Plugin Packaging Rules

The `claude-status` plugin is distributed as a directory (or zip archive) with the following required structure:

```
claude-status/
  plugin.json            # Plugin manifest
  hooks/                 # Claude Code lifecycle hooks
  scripts/               # PowerShell launcher + Google auth flow
  runtime/
    dist/                # Compiled JS (must be pre-built before packaging)
    package.json
    package-lock.json
  skills/                # Skill definitions
  docs/
  README.md
```

Rules:
- `runtime/dist/` **must** be included in the distributed package. End users do not run `npm run build`.
- `runtime/node_modules/` is **excluded** — end users do not run `npm install` either; all runtime dependencies must be bundled via `esbuild` or similar, or the runtime must use only Node.js built-in modules (which is the current approach — no external runtime dependencies).
- `runtime/src/` may be excluded from production distributions but should be included for transparency/auditability.
- Test files (`src/__tests__/`) and `vitest.config.ts` may be excluded from production distributions.

### Pre-packaging checklist

1. `cd runtime && npm run build` — ensure `dist/` is current.
2. `cd runtime && npm test` — ensure all tests pass.
3. Bump version in `runtime/package.json` and `plugin.json`.
4. Tag the commit: `git tag v<VERSION>`.

---

## Version Bumping Procedure

The plugin follows [Semantic Versioning](https://semver.org/):

| Change type | Version component | Example |
|---|---|---|
| Bug fix, minor doc update | PATCH | `0.1.0` → `0.1.1` |
| New feature, new service collector | MINOR | `0.1.0` → `0.2.0` |
| Breaking change (e.g. cache schema change, settings key rename) | MAJOR | `0.1.0` → `1.0.0` |

Files to update on every version bump:
- `runtime/package.json` — `"version"` field
- `plugin.json` — `"version"` field (if present)

---

## Update Behavior

When a user updates the plugin (replaces the plugin directory with a newer version):

1. **Plugin code** (hooks, skills, scripts, runtime/dist/) is replaced.
2. **`${CLAUDE_PLUGIN_DATA}`** is **not touched** — it lives in a separate user-data directory and persists across plugin updates.

Contents of `${CLAUDE_PLUGIN_DATA}` that survive an update:
- `cache/*.json` — service cache files (reused by new version if schema is compatible)
- `google/client_secret.json` — user's OAuth client credentials
- `google/tokens.json` — user's OAuth tokens
- `locks/*.lock` — transient lock files (cleaned up automatically)

### Schema migrations

If a new version changes the `CollectorResult` schema in a breaking way:
- The renderer must handle missing/extra fields gracefully (already done via optional fields).
- On the first render after update, stale/missing fields will cause a `null` value display (`-`), which triggers a background refresh that writes a fresh cache file in the new schema.
- No explicit migration script is required for PATCH or MINOR schema additions.
- For MAJOR schema changes, document a one-time cleanup step in the release notes.

---

## Uninstall

To completely remove the plugin:

1. **Remove the plugin directory** from the Claude Code plugins location.

2. **Remove the statusLine entry** from `~/.claude/settings.json`:
   - Open `~/.claude/settings.json`
   - Delete or clear the `"statusLine"` key.

3. **Optionally remove user data** — only if you want to wipe cached data, Google tokens, and settings:

```powershell
Remove-Item -Recurse -Force "$env:CLAUDE_PLUGIN_DATA"
```

   `${CLAUDE_PLUGIN_DATA}` is typically:
   ```
   %APPDATA%\Claude\plugin-data\claude-status\
   ```
   or the path Claude Code sets at runtime.

---

## `${CLAUDE_PLUGIN_DATA}` Retention and Deletion Rules

| Scenario | `${CLAUDE_PLUGIN_DATA}` action |
|---|---|
| Plugin update (same major version) | Retain — data is forward-compatible |
| Plugin update (major version bump) | Retain — renderer handles missing fields gracefully; stale cache triggers refresh |
| Plugin uninstall | **User choice** — not deleted automatically |
| Re-install (fresh) | Retain if present — avoids requiring re-auth for Google services |
| Complete clean slate | Delete manually using the PowerShell command above |

Contents breakdown:

```
${CLAUDE_PLUGIN_DATA}/
  cache/
    github.json     # GitHub PR count cache (TTL: 90s)
    jira.json       # Jira open issue count cache (TTL: 5m)
    gmail.json      # Gmail unread count cache (TTL: 3m)
    tasks.json      # Google Tasks count cache (TTL: 10m)
  google/
    client_secret.json   # User's Google OAuth2 Desktop client credentials
    tokens.json          # Access + refresh tokens (sensitive — do not share)
  locks/
    *.lock               # Transient refresh lock files (auto-cleaned)
```

The `google/` directory contains sensitive credential data. Users should be advised not to include this directory in backups uploaded to cloud storage unless encrypted.
