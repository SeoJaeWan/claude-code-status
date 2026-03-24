# Development Guide

## Repository Layout

```
claude-code-status/
  plugin.json          # Plugin manifest
  hooks/               # Claude Code lifecycle hooks (JS)
  scripts/             # PowerShell launcher + Google auth setup
  runtime/             # Node.js + TypeScript renderer
    src/               # Source files
      __tests__/       # Vitest unit tests
      collectors/      # Per-service data collectors
    dist/              # Compiled output (git-ignored in dev, included in releases)
    package.json
    tsconfig.json
    vitest.config.ts
  skills/              # Claude Code skill definitions
  docs/                # Documentation
  README.md
```

---

## Local Development

### Install the plugin locally

```powershell
claude --plugin-dir "C:\path\to\claude-code-status"
```

This tells Claude Code to load the plugin from your local checkout. You can edit source files and test changes without publishing.

After editing TypeScript source, rebuild and restart Claude Code (or open a new session) to pick up changes.

---

## Building

All TypeScript in `runtime/src/` compiles to `runtime/dist/`.

```powershell
cd runtime
npm run build
```

For continuous rebuild during development:

```powershell
npm run build:watch
```

The `dist/` directory is produced by `tsc` with CommonJS output targeting ES2020. No bundler is used — the runtime relies only on Node.js built-in modules.

---

## Testing

Unit tests are in `runtime/src/__tests__/` and use [Vitest](https://vitest.dev/).

```powershell
cd runtime
npm test
```

Run tests in watch mode during development:

```powershell
npm run test:watch
```

### Test coverage

| Test file | What it covers |
|---|---|
| `render.test.ts` | Status line formatting, color thresholds, ANSI output, stdin parsing |
| `coordinator.test.ts` | Cache TTL/freshness, lock lifecycle, stale lock cleanup, atomic writes |
| `github.test.ts` | GitHub notification filtering, thread deduplication, error classification |
| `jira.test.ts` | Jira JQL result parsing (multiple shapes), error classification |
| `google-auth.test.ts` | Token expiry detection, credential loading, missing file errors |

Tests do not require network access, external CLIs (`gh`, `acli`), or real Google credentials. All I/O is either pure logic or backed by temporary directories on disk.

---

## Adding a New Collector

1. Create `runtime/src/collectors/<service>.ts` following the pattern of `github.ts` or `jira.ts`.
2. Export an `async function collect(): Promise<void>` that calls `writeCacheFile(SERVICE, result)`.
3. Register the service name in `runtime/src/collect.ts` (the CLI dispatcher).
4. Add the service to the `SERVICES` array in `runtime/src/render.ts`.
5. Add color threshold logic in `render.ts` (follow the `colorGithub` / `colorGmail` pattern).
6. Add a unit test file in `runtime/src/__tests__/<service>.test.ts`.
7. Add a skill in `skills/<service>-check/` for `/claude-status:<service>-check`.

---

## Marketplace / User-Scope Install

When published to the Claude Code plugin marketplace, users install with:

```
/install claude-status
```

Or via the Claude Code UI plugin browser.

After marketplace install, the plugin directory is placed at:
```
~/.claude/plugins/claude-status/
```

Users then run:
```
/claude-status:install-global
```

to patch `~/.claude/settings.json` with the `statusLine.command`.

### Manual user-scope install (without marketplace)

1. Clone or extract the plugin to a local directory.
2. Run `cd runtime && npm run build` to compile TypeScript.
3. In Claude Code: `claude --plugin-dir "C:\path\to\claude-status"`.
4. Run `/claude-status:install-global`.
5. Restart Claude Code.

---

## Release Checklist

Before tagging a release:

- [ ] `cd runtime && npm run build` — no TypeScript errors
- [ ] `cd runtime && npm test` — all tests green
- [ ] Version bumped in `runtime/package.json` and `plugin.json`
- [ ] `docs/PACKAGING.md` updated if schema or data layout changed
- [ ] `docs/SMOKE-TEST.md` steps verified on a clean Windows machine
- [ ] `git tag v<VERSION>` — tag the release commit
