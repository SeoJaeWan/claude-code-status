---
name: architect
description: Codex entry skill for rigorous implementation planning. Use when a request needs decision-complete sequential execution plans under ./plans after resolving blocking product policy, UX, contract, schema, validation, state, permission, and frontend UI-contract ambiguity.
---

<Skill_Guide>
<Purpose>
Create decision-complete implementation plans as one or more sequential plan files with explicit execution phases and execution handoff.
</Purpose>

<Instructions>
# architect

Use this as the preferred planning entrypoint for complex or high-impact requests, or after `brainstorm` confirms key decisions.
Direct agent execution is allowed for focused low-risk tasks when the user explicitly chooses it.

## Inputs to inspect

1. User request and latest conversation context
2. `./.codex/skills/architect/references/agents-lite.md` - execution agent catalog
3. `./.codex/skills/architect/references/planning-policy.md` - canonical planning rules and quality gates
4. `./.codex/skills/architect/references/git.md` - commit message, branch naming, and worktree naming rules
5. `./.codex/skills/architect/references/plan-template-sequential.md` - sequential plan template
6. Relevant active CLI help only when execution routing or mode-sensitive conventions matter:
   - prefer narrow command-scoped text help first
   - use top-level `frontend --help`, `backend --help` only for command discovery

## Workflow

### Step 0. Read routing references (required)

Before writing any plan artifact:

- Read `./.codex/skills/architect/references/agents-lite.md`
- Read `./.codex/skills/architect/references/planning-policy.md`

### Step 1. Analyze request

- Clarify goals, boundaries, constraints, acceptance criteria, and feature policy.
- Classify missing information as `blocking`, `derivable`, or `deferrable` using `planning-policy.md`.
- Derive what can be confirmed from local context before asking the user.

### Step 1.5. Resolve blocking decisions before planning (required)

- Do not write any plan artifact while `blocking` ambiguity remains.
- Route unresolved `blocking` ambiguity to `brainstorm` first.
- If direct clarification is necessary, ask only concise, actionable questions:
  - Batch at most 4 blocking questions at once
  - Prefer structured user-input tooling when available
  - Otherwise ask concise plain-text questions in chat
- For frontend/UI scope, UI contracts defined in `planning-policy.md` must be decision-complete before implementation planning or `plan-e2e-test`.
- Do not hide unresolved blocking decisions outside the relevant phase or plan file.
- Carry forward `deferrable` items only as inline phase defaults or short constraint notes when they matter to execution.

### Step 2. Gather high-level context (optional)

Use high-level inspection only:

- Existing related features
- Tech stack and major boundaries
- Expected integration points
- Existing policies, contracts, behaviors, and conventions that answer missing questions

Do not deep-dive into implementation details.

### Step 2.5. Resolve mode-sensitive CLI contracts before execution routing (required for implementation plans)

- Before assigning `owner_agent` or `primary_skill` to implementation phases, inspect the relevant CLI help for the work type.
- Start with top-level `frontend --help` or `backend --help` only when command discovery is needed.
- Then inspect only the minimum relevant command-scoped help for the chosen work.
- Treat the returned help as the active mode-specific contract for path policy, naming, validation, scaffold shape, and available command surface.
- Use those contracts to confirm execution routing, phase boundaries, and inline defaults/constraints inside the relevant phase blocks.
- If one request spans multiple concerns, inspect each relevant CLI instead of guessing from stale skill prose.
- Do not explain detailed task-by-task CLI situations in the plan prompt itself; route through CLI help at execution time.

### Step 3. Design plan structure

- Create plan artifacts in `./plans/{task-name}/`.
- Draft every executable plan from `plan-template-sequential.md`.
- Required branch headers, phase metadata, routing policy, browser-contract requirements, and UI test-phase split must follow `planning-policy.md`.
- Keep plan artifacts phase-first and terse.
- Make each phase/task the primary execution contract by recording purpose, work, completion signal, and test movement there instead of scattering those details across multiple summary sections.
- Branch names must follow `./.codex/skills/architect/references/git.md` when available; worktree directory names are derived from the branch by replacing `/` with `-`.

### Step 3.2. Decide single-plan vs multi-plan split (required)

- Default to a single sequential plan at `./plans/{task-name}/plan.md`.
- If the task is clearer as multiple executable slices, create multiple sequential plans instead of DAG/tracks.
- Use numbered subfolders for multi-plan tasks:
  - `./plans/{task-name}/01-{plan-name}/plan.md`
  - `./plans/{task-name}/02-{plan-name}/plan.md`
- Split plans when execution can be coordinated at plan granularity:
  - low file overlap between plan slices
  - clear predecessor/successor relationship between plan slices
  - easier review or approval boundaries by slice
- Do not generate DAG graphs or track plans.

### Step 3.5. Generate unit test plan (conditional)

If a plan file includes testable logic boundaries and constraint IDs (`[C-...]`):

1. Read `./.codex/skills/plan-unit-test/SKILL.md`
2. Execute the `plan-unit-test` workflow using the same directory as the owning `plan.md`:
   - single-plan task: `./plans/{task-name}/tests/`
   - multi-plan task: `./plans/{task-name}/{nn}-{plan-name}/tests/`
3. Wire generated test artifacts back into the relevant phase blocks using `테스트 산출물`, `테스트 이동`, `실행`, and `완료조건`
4. Verify the test manifest meets the coverage and implementation-handoff requirements defined by that skill

Skip for documentation-only, configuration-only, or structural-only scope with no testable code units.

### Step 3.6. Generate UI E2E test plan (conditional)

If a plan file changes feature-level user-facing behavior within a bounded UI surface:

1. Confirm frontend UI contracts are fully resolved
2. Read `./.codex/skills/plan-e2e-test/SKILL.md`
3. Execute `plan-e2e-test` using the same directory as the owning `plan.md`:
   - single-plan task: `./plans/{task-name}/e2e/`
   - multi-plan task: `./plans/{task-name}/{nn}-{plan-name}/e2e/`
4. Wire generated E2E artifacts back into the relevant phase blocks using `테스트 산출물`, `테스트 이동`, `실행`, and `완료조건`
5. Verify the manifest matches the E2E policy and implementation-handoff requirements in `planning-policy.md`

`plan-e2e-test` covers frozen feature/screen E2E artifacts only, using the runner selected from the environment. Browser full-flow regression coverage still belongs to a later `playwright-guard` phase.

### Step 3.7. Plan full-flow Playwright guard phase (conditional)

If a plan file changes cross-route journeys, auth/session transitions, redirect chains, persisted browser state, or any release-critical flow that needs regression hardening:

- Add a later phase with `owner_agent: playwright-guard`
- Set `primary_skill: guard-e2e-test`
- Define trigger, scope, and expected outputs using `planning-policy.md`

### Step 4. Quality gates (required)

- Run the quality-gate checklist in `planning-policy.md` before finalizing.

### Step 5. Self-review gate (required)

- Re-run the same checklist in `planning-policy.md`.
- Incorporate critical findings before handoff.

### Step 6. Compatibility policy (required)

- Plan Artifact Interface v4 applies to newly created plans.
- Existing plans are not automatically migrated.
- If a legacy plan format is detected during update:
  - keep user-requested scope
  - add a warning note near the top of the plan
  - avoid broad migration unless explicitly requested

### Step 7. Execution handoff

Architect does not execute implementation directly.
Provide a concise execution handoff summary using the handoff requirements in `planning-policy.md`.

## Output contract

- Single-plan task:
  - `./plans/{task-name}/plan.md`
- Multi-plan task:
  - `./plans/{task-name}/01-{plan-name}/plan.md` (2+)
- Unit test artifacts when Step 3.5 applies:
  - single-plan task: `./plans/{task-name}/tests/manifest.md`, `./plans/{task-name}/tests/{flat-artifact-files}`
  - multi-plan task: `./plans/{task-name}/{nn}-{plan-name}/tests/manifest.md`, `./plans/{task-name}/{nn}-{plan-name}/tests/{flat-artifact-files}`
- E2E test artifacts when Step 3.6 applies:
  - single-plan task: `./plans/{task-name}/e2e/manifest.md`, plus flat runner-appropriate artifacts such as `./plans/{task-name}/e2e/{surface-id}.spec.ts` or `./plans/{task-name}/e2e/{flow-id}.yaml`
  - multi-plan task: `./plans/{task-name}/{nn}-{plan-name}/e2e/manifest.md`, plus plan-local runner-appropriate artifacts
- Output language: Korean

## Guardrails

- Planning only: do not write implementation code.
- Every executable plan file is sequential-only.
- Test files generated by `plan-unit-test` and `plan-e2e-test` are plan artifacts, not implementation code.
- Do not freeze final source-tree test placement in planning artifacts; implementation agents resolve it later from phase `테스트 이동`, coding rules, and local conventions.
- `playwright-guard` execution happens later; architect only plans that phase.
- Do not produce a plan with unresolved blocking ambiguity.
- Do not generate DAG, track plans, or root graph metadata.
- If the user explicitly requests direct agent execution for a low-risk focused task, do not force planning.
  </Instructions>
  </Skill_Guide>
