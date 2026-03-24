# Constraint Coverage Rules

Mandatory coverage requirements for `plan-unit-test`.

---

## Core Rules

1. **Every constraint ID** in `plan.md` must map to **at least one test case**.
2. Each constraint must include **both**:
   - Expected behavior >= 1
   - Defensive coverage >= 1
3. Defensive coverage may be satisfied by **validation failure, edge case, or exception path**, but at least one non-happy-path scenario is mandatory for every constraint.
4. **Exception or recovery scenarios are mandatory** when the logic can fail through dependencies, parsing, persistence, authorization, or state transitions.
5. Every mapped test name must **include its constraint ID token** (`[C-...]`).
6. If coverage is incomplete, **do not mark test generation complete** even if existing tests pass.
7. If multiple sequential plan files exist, compute coverage per plan file and do not omit in-scope split boundaries.

---

## Coverage Verification

Before completing the `plan-unit-test` workflow:

1. List all constraint IDs from `plan.md`
2. For each ID, verify at least one expected-behavior test exists
3. For each ID, verify at least one defensive test exists
4. For each ID, explicitly review whether edge and exception categories apply
5. Calculate coverage: `covered / total * 100`
6. **100% required** - no exceptions
7. Verify each executable plan file has its own `tests/manifest.md` (or explicit `N/A`)

---

## Manifest Format

The `manifest.md` must include a coverage summary:

```markdown
## Coverage

- Total constraints: {N}
- Constraints with expected coverage: {N}
- Constraints with defensive coverage: {N}
- Constraints with explicit edge/exception review: {N}
- Coverage: 100%
```

For multi-plan tasks, keep this format inside each plan folder's `tests/manifest.md`.

If coverage or review is incomplete, list missing items explicitly:

```markdown
## Missing Coverage

- [ ] [C-XXX-001] - no expected-behavior test found
- [ ] [C-XXX-002] - no defensive test found
- [ ] [C-XXX-003] - exception applicability not reviewed
```

---

## Traceability

- Constraint IDs in test names enable grep-based traceability
- In most cases, `grep -r "C-AUTH-001" tests/` should return at least two scenario entries: expected + defensive
- If a single parameterized block covers multiple scenario categories, `manifest.md` must still record those categories explicitly
- If hook-based boundaries are in scope, verify traceability at each hook file path (`useXxx/test/useXxx.test.ts`)
