# E2E Constraint Coverage Rules

Mandatory coverage requirements for `plan-e2e-test`.

---

## Core Rules

1. Every in-scope user-visible E2E constraint ID in `plan.md` must map to at least one generated artifact.
2. Each in-scope E2E constraint must include:
   - interaction-path coverage >= 1
3. Constraints involving user input must include:
   - validation/error coverage >= 1
4. Constraints involving local navigation or sheet transitions must include:
   - navigation/state-transition assertion >= 1
5. Every mapped test or flow name must include its constraint ID token when the runner supports inline names.
   - Playwright: include `[C-...]` in `test(...)`
   - Maestro: keep the constraint mapping in `manifest.md`
6. Deferred flows must be listed explicitly in `manifest.md`.
7. Coverage must be 100% for all in-scope E2E constraints.

---

## Scope Boundary: E2E vs Unit

| Constraint type | `plan-e2e-test` coverage? | Reason |
| --- | --- | --- |
| User-visible behavior on one screen/surface | Yes | Bounded E2E contract |
| Form validation and save/error feedback | Yes | User-visible |
| Bottom sheet / modal / tab interaction | Yes | Surface-local interaction |
| Mobile app-shell flow inside bounded scope | Yes | Mobile acceptance contract |
| Internal business logic | No | `plan-unit-test` |
| Data transformation | No | `plan-unit-test` |
| Browser full-flow regression | No | `playwright-guard` |

When a constraint spans both internal logic and visible behavior, cover it in both unit and E2E artifacts at their respective boundaries.

---

## Coverage Verification

Before completing `plan-e2e-test`:

1. List all `[C-...]` IDs from `plan.md`
2. Classify each as `e2e`, `deferred`, or `internal-only`
3. Verify every `e2e` constraint has interaction-path coverage
4. Verify input-related constraints have validation/error coverage
5. Verify deferred flows are listed in `manifest.md`
6. Calculate coverage: `covered e2e constraints / total e2e constraints * 100`
7. Do not complete below 100%

---

## Manifest Format

`e2e/manifest.md` must include:

```markdown
## Coverage

- Total in-scope E2E constraints: {N}
- Constraints with interaction-path coverage: {N}
- Constraints with validation/error coverage: {N}
- Deferred out-of-scope journeys: {N}
- E2E coverage: 100%
```

If coverage is incomplete:

```markdown
## Missing Coverage

- [ ] [C-XXX-001] - no interaction-path artifact found
- [ ] [C-XXX-002] - no validation/error artifact found
```

---

## Locator Traceability

- Every locator used in artifacts must be registered in `manifest.md`
- Web: `data-testid Registry`
- Mobile: `testID Registry`
- The registry is a contract, not documentation only
