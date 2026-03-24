---
name: plan-unit-test
description: Codex skill for generating stack-aware, constraint-mapped unit/logic tests as plan artifacts. Called by architect after plan.md creation.
---

<Skill_Guide>
<Purpose>
Generate spec-oriented unit/logic test files as plan artifacts during the planning phase. These tests exist to turn plan constraints into executable logic contracts, including defensive and exceptional behavior, before implementation begins.
</Purpose>

<Instructions>
# plan-unit-test

Generate stack-aware unit/logic test files mapped to `plan.md` phase-local constraint IDs. These tests become flat plan artifacts that implementation agents later place into the source tree for Red-Green TDD using the owning phase's `테스트 이동`, coding rules, and local test conventions.

The goal is not to optimize for "easy passing." The goal is to make the required logic explicit enough that implementation can be judged against a concrete behavioral contract.

This skill covers **unit and logic tests only**. E2E tests are handled by the `plan-e2e-test` skill.

---

## Inputs to inspect

1. Current executable plan file:
   - `./plans/{task-name}/plan.md`
   - or `./plans/{task-name}/{nn}-{plan-name}/plan.md`
2. Plan-local `tests/manifest.md` (존재 시)
3. `./.codex/skills/plan-unit-test/references/testing-conventions.md` - test writing rules
4. `./.codex/skills/plan-unit-test/references/constraint-coverage.md` - coverage rules
5. Local test/build config near the target code - use this to detect stack and conventions before generating files

---

## Workflow

### Step 0. Detect stack and test conventions first

- Inspect the repository for the target area's existing test conventions before generating anything
- Common signals: `package.json`, `pnpm-lock.yaml`, `vitest.config.*`, `jest.config.*`, `pom.xml`, `build.gradle*`, `mvnw`, `gradlew`, existing `*.test.*` / `*.spec.*` files
- Mirror the project's current runner, assertion style, mocking approach, and file layout
- If the stack is unclear or multiple conventions are equally plausible, stop and ask the user before proceeding
- Do not default to Vitest, Jest, JUnit, Spring, Nest, or any other stack without local evidence

### Step 1. Extract test targets from `plan.md`

- Parse all constraint IDs (`[C-...]`) from relevant phase/task blocks in `plan.md`
- Identify testable logic boundaries: hooks, services, utilities, validators, mappers, use cases, state management, controller methods, domain policies
- Choose the narrowest boundary that can verify the required logic accurately
- Skip document-only or config-only changes with no testable logic
- Skip user-facing flows that are better covered by E2E tests (`plan-e2e-test`)
- Do not omit adjacent in-scope logic boundaries declared in plan scope (e.g., split sub-panels such as `leftPanel`)
- If the plan does not expose the relevant constraints inside phase/task blocks, stop and return the missing contract to `architect`

### Step 2. Read reference documents

- Read `./references/testing-conventions.md` (test writing rules)
- Read `./references/constraint-coverage.md` (coverage rules)

### Step 3. Expand constraints into behavioral scenarios

For each constraint, derive the scenarios needed to specify the logic clearly:

- **Expected behavior**: the primary success path the constraint promises
- **Defensive behavior**: validation failure, rejected precondition, unauthorized access, domain rule violation
- **Edge/boundary behavior**: null/empty input, length/range limits, duplicate input, ordering, idempotency, collection boundaries
- **Exception/recovery behavior**: dependency failure, parse/serialization failure, timeout, rollback, partial update prevention

Rules:

- Do not copy only what is stated literally in `plan.md`
- Infer the defensive and exceptional cases needed to make the planned logic safe and complete
- If a scenario is inferred rather than stated verbatim, still map it to the relevant constraint ID
- If a category truly does not apply, record that decision explicitly in `manifest.md`

### Step 4. Generate test files

For each testable unit, generate a test file following these rules:

- **Korean spec descriptions** in `describe` / `it` blocks
- **AAA pattern** with explicit `// Arrange`, `// Act`, `// Assert` comments
- **Constraint ID** in the test name: `it('[C-AUTH-001] ...', ...)`
- **Expected behavior** >= 1 per constraint
- **Defensive behavior** >= 1 per constraint
- **Edge/exception cases** whenever the logic can reasonably fail at boundaries or dependencies
- **Stack-aware output**: use the framework and conventions already present in the target project
- **Boundary-first testing**: prefer direct logic verification over broader UI or end-to-end coverage
- **Mocking**: mock only external boundaries, using the tools already established in the repo
- **Hook naming**: hook tests must target `useXxx` boundaries and keep `use` prefix
- **Planning artifact naming**: use concise flat boundary-oriented file names such as `use-login.test.ts` or `auth-service.test.ts`
- **Final placement**: do not encode the eventual source-tree destination in the plan artifact path
- **File naming**: keep contract detail in `describe` / `it` text, not in long artifact file names

These tests may be unit-style, slice-style, or lightweight boundary tests depending on the narrowest layer that can specify the logic correctly.

### Step 5. Save test files as plan artifacts

Save generated tests as flat plan artifacts next to the owning `plan.md`:

- single-plan task: `./plans/{task-name}/tests/`
- multi-plan task: `./plans/{task-name}/{nn}-{plan-name}/tests/`

```text
plans/{task-name}/tests/
|- manifest.md
|- use-login.test.ts
|- auth-service.test.ts
`- auth-service.test.java
```

Plan artifacts under `tests/` do not mirror the final source-tree destination.
Implementation agents resolve the final destination later using the owning phase's `테스트 이동`, coding rules, local test conventions, and the placement intent recorded in `manifest.md`.
Keep one manifest per executable plan file.

### Step 6. Write `manifest.md`

Create `tests/manifest.md` with:

```markdown
# Test Manifest

## Files

| Artifact File | Boundary Type | Boundary Name | Placement Intent | Constraints | Scenario Types |
| --- | --- | --- | --- | --- | --- |
| `auth-service.test.ts` | `service` | `AuthService` | `shared` | [C-AUTH-001], [C-AUTH-002] | expected, defensive, exception |
| ... | ... | ... | ... | ... | ... |

## Implementation Placement

- Resolve final destination during implementation using phase `테스트 이동`, coding rules, and local test layout
- Keep assertions and scenarios unchanged when relocating plan artifacts
- If destination is still unclear after reading phase instructions and local conventions, stop and ask the user

## Coverage

- Total constraints: N
- Constraints with expected coverage: N
- Constraints with defensive coverage: N
- Constraints with explicit edge/exception review: N
- Coverage: 100%
```

If a category is intentionally omitted for a constraint, note the reason in the manifest instead of leaving it implicit.

### Step 7. Verify constraint coverage

- Every constraint ID in `plan.md` must map to >= 1 generated test case
- Every constraint must include both expected and defensive coverage
- Edge and exception applicability must be reviewed explicitly for every constraint
- If the stack is unclear, stop and ask the user before completion
- If coverage < 100%, add missing tests before completing
- Do not mark complete until coverage is 100%

---

## Output contract

- Single-plan task:
  - `./plans/{task-name}/tests/manifest.md`
  - `./plans/{task-name}/tests/{flat-artifact-files}`
- Multi-plan task:
  - `./plans/{task-name}/{nn}-{plan-name}/tests/manifest.md`
  - `./plans/{task-name}/{nn}-{plan-name}/tests/{flat-artifact-files}`
- Output language: Korean (test specs)

## Guardrails

- **Test files only**: Do not write implementation or production code
- **No E2E tests**: E2E is handled by `plan-e2e-test` skill
- **Plan artifacts only**: Tests are stored in `plans/`, not in the source tree
- **Deferred placement**: final source-tree destination is resolved during implementation, not planning
- **No default stack assumptions**: Detect local conventions first, ask the user if unclear
- **Constraint coverage 100%**: Mandatory before completion
- **Spec-first mindset**: Tests are planning contracts for required logic, not a checklist written only to pass
- **No mixed hook bundles by default**: one hook boundary per folder/file path unless repo conventions require otherwise
  </Instructions>
  </Skill_Guide>
