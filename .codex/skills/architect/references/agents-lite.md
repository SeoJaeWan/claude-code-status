# Execution Agents Catalog (Architect)

Minimal routing source for planning.
Use this file as the canonical `owner_agent` catalog.
For detailed planning rules, quality gates, and UI test-phase policy, read `planning-policy.md`.

## Canonical Execution Agents

| owner_agent          | Primary skill examples | CLI contract source | Role                                                      |
| -------------------- | ---------------------- | ------------------- | --------------------------------------------------------- |
| `frontend-developer` | `frontend-dev`         | `frontend`          | frontend UI, integration, hooks, state, and API work      |
| `backend-developer`  | `backend-dev`          | `backend`           | API, DB, auth, server logic                               |
| `playwright-guard`   | `guard-e2e-test`       | `N/A`               | post-implementation full-flow Playwright regression guard |

## Planning Skills (run by architect)

- `plan-unit-test`: generates unit/logic test files as plan artifacts (`plans/{task}/tests/`)
- `plan-e2e-test`: generates frozen feature-level E2E plan artifacts with the runner chosen from the environment (`plans/{task}/e2e/`)

## Post-implementation Test Agents

- `playwright-guard`: runs `guard-e2e-test` after implementation to add real full-flow/regression Playwright `.spec.ts` files in the project test tree

## Catalog Rule

- Only list execution agents or skills that actually exist in this repository.
- Do not document hypothetical utility skills here.
- Architect should inspect the corresponding CLI help before finalizing implementation routing for `frontend-developer` or `backend-developer`.
