# Planning Policy

Canonical detailed rules for `architect`.

Use this file for:

- blocking vs derivable vs deferrable decision policy
- sequential-only plan artifact contract
- plan split rules for multiple sequential plan files
- UI contract and E2E test planning rules
- quality gates
- execution handoff requirements

`SKILL.md` should stay flow-oriented. Keep detailed planning policy here.

---

## Blocking Decision Policy

Classify missing information as:

- `blocking`: changes architecture, contracts, test scope, or user-visible behavior
- `derivable`: can be confirmed from local repo context without user input
- `deferrable`: low-risk default that does not materially change implementation or validation

Treat ambiguity as `blocking` when it can change:

- architecture or major boundaries
- API/data contracts
- schema or business rules
- UX behavior, permissions, validation, or state transitions
- navigation, error handling, accessibility expectations, or acceptance tests

### Frontend UI Contracts

For frontend/UI scope, these are always `blocking`:

- `route or navigation/surface contract`
- `user state contract`
- `action contract`
- `visible outcome contract`
- `locator/testability contract`

Do not create implementation plans or `plan-e2e-test` artifacts until these contracts are resolved in decision-complete form.
Do not hide unresolved blockers outside the relevant phase/task.

---

## Plan Artifact Requirements

Every executable `plan.md` must include:

1. `**Branch:** {type}/{summary}`
2. Phase breakdown with machine-readable `owner_agent`
3. For each phase/task:
   - `목적`
   - `작업`
   - `완료조건`
4. Optional per-phase fields when needed:
   - `primary_skill`
   - `선행조건`
   - `계약/제약`
   - `테스트 산출물`
   - `테스트 이동`
   - `실행`
   - `폴백`

Every executable plan file must include a `Branch` header:

- `**Branch:** {type}/{summary}`

Worktree directory naming is derived from the `Branch` value by replacing `/` with `-`.
Example: `feat/add-login` -> `worktrees/feat-add-login`

For frontend/UI scope, the five UI contracts must be recorded inside the relevant phase/task `계약/제약` bullets.
Constraint IDs (`[C-...]`) that drive `plan-unit-test` or `plan-e2e-test` must live inside the relevant phase/task block, not in a separate summary section.

### Multi-Plan Split Policy

If one request needs multiple executable plans:

- use multiple sequential plan files instead of DAG/tracks
- place them under numbered folders for stable order and review boundaries
- format:
  - `plans/{task-name}/01-{plan-name}/plan.md`
  - `plans/{task-name}/02-{plan-name}/plan.md`
- keep test artifacts local to the owning plan directory:
  - `plans/{task-name}/{nn}-{plan-name}/tests/`
  - `plans/{task-name}/{nn}-{plan-name}/e2e/`
- express inter-plan dependency in the relevant phase `선행조건`
- do not generate root graph/index files unless the user explicitly requests them

### Planning-time Test Artifact Layout

When unit/E2E plan artifacts are generated:

- keep planning artifacts flat and intent-oriented inside `tests/` or `e2e/`
- do not mirror or freeze the final source-tree placement inside `plans/`
- unit test manifests must record:
  - `boundary_type`
  - `boundary_name`
  - `placement_intent`
  - `implementation_placement_rule`
- E2E manifests must record:
  - `runner`
  - `surface_id` or `flow_id`
  - `placement_intent`
  - `implementation_placement_rule`
  - `locator_contract`

### Phase Metadata Rules

- Every execution block (`Phase n`) must include `owner_agent`
- Every execution block (`Phase n`) must include `목적`
- Every execution block (`Phase n`) must include `작업`
- Every execution block (`Phase n`) must include `완료조건`
- `목적` should stay to one or two sentences; phase blocks are the primary execution contract, not long prose summaries
- `owner_agent` must exist in `references/agents-lite.md`
- use exactly one execution agent per block
- add `primary_skill` only when the phase must pin a specific skill
- do not rely on heading text like `(Owner: ...)`
- if tests are generated or consumed in a phase, include `테스트 산출물`, `테스트 이동`, and `실행`
- if UI contracts or constraint IDs matter, include them inline under `계약/제약`

---

## Execution Routing Policy

Assign work by concern:

- `frontend-developer`: frontend UI, responsive polish, state transitions, event handling, API integration, and validation logic
- `backend-developer`: API, DB, auth, server logic
- `playwright-guard`: post-implementation full-flow/regression Playwright guard tests

Do not split a phase only because UI and logic are both present. Split only when file overlap, dependency order, or validation boundaries require it.

Resolve routing and mode-sensitive conventions from active CLI help before locking implementation phases:

- Use top-level `frontend --help` or `backend --help` only when command discovery is necessary
- Then inspect only the minimum relevant command-scoped help for the chosen work
- Treat CLI help as the source of truth for the current active mode/profile contract, not stale examples embedded in older skill text
- If exact mode/version matters to the plan, inspect `mode show` and record it inline in the relevant phase/task
- Do not hardcode detailed CLI task situations into the planning prompt; defer command selection details to CLI help at execution time

See `agents-lite.md` for the canonical execution agent catalog and skill mapping.

---

## UI E2E Planning Policy

### `plan-unit-test`

Run when the plan includes testable logic boundaries and `[C-...]` constraints.

Examples:

- hooks
- services
- utilities
- validators
- mappers
- use cases
- state-management logic
- controller methods

### `plan-e2e-test`

Run when the plan changes feature-level user-facing behavior within a bounded UI surface such as:

- a screen
- a form
- a modal
- a drawer
- a settings panel
- feature-local tabs or sub-routes

Use it for:

- same-surface validation and error display
- submit gating, loading, success, disabled, and API error states
- user-visible integration across components/modules within one bounded feature surface

Do not use it for:

- multi-route full journeys
- auth/session handoffs across pages
- reload persistence across the application shell
- post-implementation regression hardening

These tests are frozen at planning time. Implementation must satisfy them.

Default organization for planning-time E2E artifacts:

- Playwright: `e2e/{surface-id}.spec.ts`
- Maestro: `e2e/{flow-id}.yaml`
- split only when setup or fixtures diverge materially or file size becomes unmanageable

### `playwright-guard`

Add a later `playwright-guard` phase when the plan changes:

- a cross-route user journey
- auth/session transitions
- redirect chains
- persisted browser state
- a release-critical flow that needs regression hardening

When this phase exists:

- set `owner_agent: playwright-guard`
- set `primary_skill: guard-e2e-test`
- schedule it after implementation reaches green on core validation
- define trigger and scope explicitly:
  - changed journey or affected routes
  - expected final user-visible outcome
  - known fragile behavior, failed verification signal, or regression concern
  - target app URL or start route
- expected output is real Playwright guard specs in the project test tree, not in `plans/`
- `playwright-guard` must not edit frozen `plan-e2e-test` artifacts

---

## Quality Gate Checklist

Before finalizing, and again during self-review:

1. Every executable plan file includes a valid `Branch` header and its worktree name can be derived by `/ -> -`
2. Every phase/task has a concrete `owner_agent` listed in `references/agents-lite.md`
3. Every phase/task has `목적`, `작업`, and `완료조건`
4. No unresolved blocking policy/contract/schema/UX ambiguity remains
5. Frontend work is assigned to `frontend-developer` unless a non-frontend agent boundary is required
6. For UI scope, the five UI contracts are explicitly recorded in the relevant phase/task before `plan-e2e-test`
7. Constraint IDs used by tests live in the relevant phase/task blocks
8. If a phase generates or consumes tests, it includes artifact path, move target, and run command
9. For UI feature scope, `plan-e2e-test` artifacts exist with runner-appropriate frozen E2E files and placement handoff
10. For UI/user-journey or regression-hardening scope, a later `playwright-guard` phase exists with explicit trigger, scope, and exit criteria
11. Multi-plan tasks use numbered plan folders and keep tests/e2e local to the owning plan
12. Planning-time test artifacts remain flat; final source-tree placement is deferred to implementation via phase instructions and manifests

Do not request execution before this checklist passes.

---

## Execution Handoff Requirements

Provide a concise handoff summary with:

1. Ordered plan file path(s)
2. Task branch name and derived worktree directory name (`/` -> `-`) for each executable plan file
3. First executable phase and its `owner_agent` for each plan file
4. Execution invocation commands:
   - launch the named custom agent `planner` against each plan file
   - if plans are independent, separate planner sessions may run in parallel
   - if plans depend on earlier plans, execute them in folder order
5. Merge rule:
   - `planner` owns the task worktree and phase-worker dispatch while following the `planner-lite` workflow
   - phase workers run inside the assigned task worktree without creating nested worktrees
   - successful phases are committed inside the task branch; final merge goes into each file's `Branch` with `--no-ff`
6. For UI/user-flow scope, state whether `plan-e2e-test` artifacts are included and whether a later `playwright-guard` phase is scheduled
7. Note which phase owns test movement from `plans/` into the source tree
8. Implementation agents must resolve final test placement from phase `테스트 이동`, coding rules, and local conventions before copying flat plan artifacts into the source tree
