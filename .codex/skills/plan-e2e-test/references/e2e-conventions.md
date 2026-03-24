# E2E Test Conventions Reference

Inline reference for `plan-e2e-test`.
Use this to turn plan constraints into executable, runner-appropriate E2E contracts.

---

## Runner Selection

- `Playwright`: browser/web surfaces
- `Maestro`: React Native / Expo mobile surfaces

Pick exactly one runner per bounded surface unless the plan explicitly requires both.

---

## Shared Rules

- Prefer explicit locator contracts over style/text selectors
- Keep tests deterministic and short
- Do not encode implementation internals
- Do not add waits unless the runner and plan require them
- Author only from resolved UI contracts

---

## Playwright Conventions

### Locator Priority

1. `data-testid`
2. role
3. label
4. placeholder
5. text (last resort)

### Assertions

- `await expect(locator).toBeVisible()`
- `await expect(locator).toHaveText(...)`
- `await expect(locator).toBeDisabled()`
- `await expect(page).toHaveURL(...)`

### Structure

- During planning, keep one flat spec per bounded surface: `e2e/{surface-id}.spec.ts`
- Use `test.describe`
- Put constraint IDs in test names
- Use Page Objects when interaction count is 3+

---

## Maestro Conventions

### Locator Priority

1. `id:` mapped from React Native `testID`
2. visible text only when it is the explicit product contract

### Commands

- `launchApp`
- `tapOn`
- `inputText`
- `assertVisible`
- `assertNotVisible`
- `runFlow`

### Structure

- During planning, keep one flat YAML flow per bounded surface or acceptance scenario
- Reuse with `runFlow` when a base flow exists
- Keep file names concise and surface-oriented

Final source-tree E2E placement is resolved during implementation using repo conventions, not frozen during planning.

---

## Deterministic Authoring

Since artifacts are written during planning without running the app:

1. Require resolved UI contracts first
2. Derive locators from the declared registry
3. Derive routes or app-shell entry points from `plan.md`
4. Derive visible assertions from explicit outcomes only
5. Stop on missing contracts instead of guessing

---

## Anti-patterns

- No CSS selectors for Playwright when `data-testid` exists
- No raw text locators for Maestro when `testID` exists
- No `page.waitForTimeout()` for Playwright
- No timing-based sleeps for Maestro unless the plan explicitly justifies them
- No cross-route browser regression journeys here
- No mutation of frozen tests after implementation starts
