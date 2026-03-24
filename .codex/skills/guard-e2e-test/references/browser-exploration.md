# Browser Exploration Reference

Use this reference to collect reliable evidence before writing a full-flow guard.

## Preferred exploration surface

- Prefer Playwright MCP browser tooling when it is available in the current Codex session.
- Fall back to `npx agent-browser` only when browser MCP is unavailable or the repo already standardizes on it.

## What to collect

- entry URL
- route transition triggers
- actual URL after each transition
- stable locators for the next action
- visible success or error signals
- auth, cookie, or storage checkpoints when the journey depends on persistence

## Efficient exploration pattern

1. open the start URL
2. inspect the current page structure
3. perform one transition
4. verify URL and visible state
5. inspect storage or cookies only at meaningful checkpoints
6. repeat until the journey finishes

Do not re-snapshot the full page after every click unless the structure materially changed.

## When to inspect storage directly

- after login or signup
- after reload-based persistence checks
- after logout or account teardown
- when route access depends on client-side session state

## Fallback CLI examples

```bash
npx agent-browser open http://localhost:3000
npx agent-browser snapshot
npx agent-browser get url
npx agent-browser storage local
npx agent-browser cookies
```

If you use the fallback CLI, still map the discovered evidence back to Playwright locators and assertions in the final test file.
