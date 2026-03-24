---
name: backend-dev
description: Backend API development, database integration, and authentication. Auto-detects framework and language from project files. Use for API endpoints, DB operations, server logic, and backend testing.
---

<Skill_Guide>
<Purpose>
Backend API development, database integration, and authentication. Auto-detects framework and language from project files. Use for API endpoints, DB operations, server logic, and backend testing.
</Purpose>

<Instructions>
# backend-dev

Expert backend development workflow.

---

## Never develop backend modules without backend

All module, entity, and DTO conventions — directory structure, naming, decorator patterns, dependency injection rules — are defined in the `backend` CLI. Without `backend` you are guessing at conventions, and guesses are wrong. Read `backend help --text` first, scaffold with `backend <command> --apply`, and always run `backend validate-file` on every created/modified file when you are done. Fix any violations and re-validate until all pass.

---

## HTTP Error Response Handling

Every API endpoint must include proper error responses.

| Status | When to use | Example |
|---|---|---|
| `400 Bad Request` | Invalid input, validation failure | DTO validation fails |
| `401 Unauthorized` | Missing or invalid authentication | No/expired JWT token |
| `403 Forbidden` | Insufficient permissions | User accessing admin route |
| `404 Not Found` | Resource does not exist | `GET /products/:id` with non-existent ID |
| `409 Conflict` | Duplicate resource or state conflict | Creating user with existing email |

---

## Implementation Steps

1. Read plan from `plans/{task-name}/plan.md`
2. Read `codemaps/backend.md`, `codemaps/database.md` (if present)
3. Implement logic inside the generated files
4. If plan includes `tests/`: copy test files to source tree, run Red verification
5. If plan includes `e2e/`: copy E2E test files (contract-first — do NOT modify)
6. Run tests — confirm ALL pass (Green)
7. If plan includes `e2e/`: if E2E fails, fix implementation, NOT tests
8. **Run `backend validate-file` on all created/modified files.** Fix any reported violations and re-validate until all pass. Do not skip this step.
9. Return results based on plan.md
  </Instructions>
  </Skill_Guide>
