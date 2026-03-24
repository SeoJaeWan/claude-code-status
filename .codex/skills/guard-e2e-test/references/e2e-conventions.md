# Guard E2E Conventions

Authoring rules for `guard-e2e-test`.
These extend the repo's normal Playwright conventions with full-flow regression coverage.

## Locator priority

1. `data-testid`
2. role
3. label
4. placeholder
5. visible text as a last resort

Avoid CSS selectors and XPath unless the repo already depends on them and no stable alternative exists.

## Assertions

- Prefer retryable Playwright assertions.
- Verify route transitions with URL assertions.
- Verify persistence with visible state plus direct storage or cookie checks when the journey depends on auth/session state.
- A redirect alone is not enough to prove logout or teardown succeeded when stale client state could survive.

## Minimum journey coverage

- Happy flow: the intended journey succeeds end to end.
- Persistence or teardown: critical state survives when it should, and clears when it should not survive.
- Branch flow: add failure, redirect, or permission denial coverage when it protects a real regression risk.

## File placement

- Follow the repo's existing Playwright layout first.
- If no clear guard layout exists, prefer `guard/{domain}/{scenario}.spec.ts` inside the existing Playwright root.

## Naming

- Prefix `test.describe` with `[Guard]`.
- Include a journey identifier in test names when available.
- Keep descriptions user-visible and behavior-oriented.

## Anti-patterns

- `page.waitForTimeout()`
- selectors tied to styling or implementation internals
- inter-test dependencies
- broad fixture or helper rewrites for a single guard
- single-screen bounded tests that belong to `plan-e2e-test`
