---
name: plan-e2e-test
description: Codex skill for generating contract-first feature-level E2E plan artifacts for the target UI environment after frontend UI contracts are fully resolved in plan.md. Use Playwright for web/browser surfaces and Maestro for React Native/Expo mobile surfaces. Called by architect after plan.md creation for bounded UI feature or screen scope.
---

<Skill_Guide>
<Purpose>
Generate deterministic, environment-appropriate E2E plan artifacts during planning. Choose the runner from local context: Playwright for browser/web surfaces, Maestro for mobile React Native/Expo surfaces. The generated tests are frozen behavioral contracts that implementation must satisfy.
</Purpose>

<Instructions>
# plan-e2e-test

Generate runner-appropriate E2E artifacts mapped to `plan.md` phase-local constraint IDs.

- Web/browser surface: Playwright `.spec.ts`
- React Native / Expo mobile surface: Maestro `.yaml`

These tests are planning artifacts, not implementation code.

**Strict AI TDD**: E2E artifacts are frozen at planning time. If tests fail later, fix the implementation, not the tests.

**Precondition**: Do not generate E2E artifacts unless `plan.md` already resolves all frontend UI contracts inside the relevant phase/task blocks:

- `route or navigation/surface contract`
- `user state contract`
- `action contract`
- `visible outcome contract`
- `locator/testability contract`

---

## Inputs to inspect

1. Current executable plan file:
   - `./plans/{task-name}/plan.md`
   - or `./plans/{task-name}/{nn}-{plan-name}/plan.md`
2. Plan-local `e2e/manifest.md` (존재 시)
3. `./.codex/skills/plan-e2e-test/references/e2e-conventions.md`
4. `./.codex/skills/plan-e2e-test/references/constraint-coverage.md`
5. Local E2E config and existing tests:
   - Playwright signals: `playwright.config.*`, `*.spec.ts`, web app routes
   - Maestro signals: `.maestro/`, Expo/React Native config, existing `.yaml` flows

---

## Workflow

### Step 0. Verify UI contracts first

Read `plan.md` and confirm all five UI contracts are explicitly resolved in the scoped phase/task blocks.

Rules:

- If any contract is missing, ambiguous, or deferred, stop immediately.
- Do not infer missing contracts from guesswork.
- Return missing contracts as blocking issues to `architect`.

### Step 0.5. Detect the target environment and runner

Inspect local signals and choose exactly one runner for the scoped surface.

- Choose `Playwright` when the target is a browser/web surface and local context points to a web app.
- Choose `Maestro` when the target is a React Native / Expo mobile surface and local context points to mobile flows.
- If both are plausible for the same scope, use the plan's declared target platform.
- If the runner is still unclear, stop and return a blocking issue.

Do not generate both runners for one bounded surface unless the plan explicitly requires dual-platform artifacts.

### Step 1. Extract E2E targets from `plan.md`

- Parse all `[C-...]` constraints related to user-visible behavior from relevant phase/task blocks.
- Identify bounded E2E targets:
  - screen-local CRUD
  - form validation and submit gating
  - loading/success/error states visible to the user
  - bottom sheet / modal / tab / drawer interactions inside one feature shell
  - mobile acceptance flows inside the app shell
- Map each target to the constraints it verifies.
- Skip internal-only constraints handled by `plan-unit-test`.
- Defer release-critical cross-route browser regression journeys to `playwright-guard`.

### Step 2. Read reference documents

- Read `./references/e2e-conventions.md`
- Read `./references/constraint-coverage.md`

### Step 3. Design scenarios per target

For each target, derive:

- **Interaction path**: intended interaction succeeds inside the bounded surface
- **Validation/error path**: invalid input or failed operation shows visible feedback
- **Edge state path**: empty state, disabled state, boundary input, no-data state
- **Feature-local navigation path**: tabs, modals, sheets, drawers, sub-routes, or app-shell screen moves that stay in scope

Rules:

- Focus on visible behavior only.
- Every scenario must trace to at least one constraint.
- Use deterministic assertions only.
- Do not author flows whose contracts are not fully resolved.

### Step 4. Generate runner-specific artifacts

#### When runner is `Playwright`

Generate `.spec.ts` files with these rules:

- Korean `test.describe` / `test` descriptions
- Constraint ID in every test name
- `data-testid` locators preferred
- Page Object pattern when a page has 3+ interactions
- No hardcoded waits
- AAA-style structure with clear arrange/act/assert sections
- Planning artifact structure: one flat spec per bounded surface

#### When runner is `Maestro`

Generate `.yaml` flows with these rules:

- One flow per bounded surface or acceptance scenario
- Prefer `id:` selectors bound to `testID`
- Use deterministic commands only: `launchApp`, `tapOn`, `inputText`, `assertVisible`, `assertNotVisible`, `runFlow`
- No timing-based sleeps unless the runner absolutely requires them and the plan justifies it
- Keep flows short and composable; use `runFlow` for reuse
- Keep file names concise and surface-oriented in a flat planning-artifact layout

### Step 5. Save artifacts as plan files

- Single-plan task: `./plans/{task-name}/e2e/`
- Multi-plan task: `./plans/{task-name}/{nn}-{plan-name}/e2e/`

Default output layout:

- Playwright: `e2e/{surface-id}.spec.ts`
- Maestro: `e2e/{flow-id}.yaml`

Do not freeze the final source-tree E2E placement here.
Implementation agents resolve the final destination later using phase `테스트 이동`, repo E2E conventions, coding rules, and the placement handoff recorded in `manifest.md`.

### Step 6. Write `manifest.md`

Create `manifest.md` with:

```markdown
# E2E Test Manifest

## Strategy

- Runner: `Playwright` | `Maestro`
- Target surface: ...

## Files

| Artifact File | Runner | Surface / Flow | Placement Intent | Constraints | Scenario Types |
| --- | --- | --- | --- | --- | --- |

## Implementation Placement

- Resolve final destination during implementation using phase `테스트 이동`, repo E2E layout, and naming conventions
- Keep assertions, locators, and scenario scope unchanged when relocating plan artifacts
- If destination is still unclear after reading phase instructions and local conventions, stop and ask the user

## Locator Registry

| Locator | Element | Screen/Surface |
| --- | --- | --- |

## Deferred

| Journey / Flow | Reason |
| --- | --- |

## Coverage

- Total in-scope E2E constraints: N
- Constraints with interaction-path coverage: N
- Constraints with validation/error coverage: N
- Deferred out-of-scope journeys: N
- E2E coverage: 100%
```

Use a runner-appropriate locator label:

- Playwright: `data-testid Registry`
- Maestro / mobile: `testID Registry`

### Step 7. Verify coverage

- Every in-scope user-visible constraint must map to at least one generated artifact.
- Input-related constraints need validation/error coverage.
- Deferred flows must be listed explicitly in `manifest.md`.
- Coverage must be 100% for in-scope E2E constraints.

---

## Output contract

- Single-plan task:
  - `./plans/{task-name}/e2e/manifest.md`
  - Playwright: `./plans/{task-name}/e2e/{surface-id}.spec.ts`
  - Maestro: `./plans/{task-name}/e2e/{flow-id}.yaml`
- Multi-plan task:
  - `./plans/{task-name}/{nn}-{plan-name}/e2e/manifest.md`
  - Plan-local runner-specific artifacts
- Output language: Korean

## Guardrails

- Test artifacts only: no production code
- No unit tests here: use `plan-unit-test`
- No live browser/device exploration required
- Frozen at planning time
- Deferred placement: final source-tree destination is resolved during implementation, not planning
- Constraint coverage 100% required for in-scope E2E constraints
- Prefer `data-testid` / `testID` locators over brittle selectors
- No speculative contract authoring
- Cross-route browser regression coverage still belongs to `playwright-guard`

</Instructions>
</Skill_Guide>
