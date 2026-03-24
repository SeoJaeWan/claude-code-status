# Parallel Execution Safety

Reference for architect Step 4 (parallelization decision).

---

## Conflict Risk Classification Table

| Risk Level   | Condition                                           | Example                              | Judgment                              |
| ------------ | --------------------------------------------------- | ------------------------------------ | ------------------------------------- |
| **Critical** | Same file modified directly                         | Two agents modify `layout.tsx`       | **Sequential required**               |
| **High**     | Shared component/type/state modified simultaneously | A modifies `Button`, B uses `Button` | **Sequential recommended**            |
| **Medium**   | DB schema, routing, config files                    | Adding migration + modifying entity  | **Shared files first, then parallel** |
| **Low**      | Import chain (indirect dependency)                  | A modifies util, B uses that util    | **Parallel possible (with caution)**  |
| **None**     | Completely independent files                        | Implementing separate API endpoints  | **Parallel safe**                     |

---

## Parallel Safety Checklist

All 5 must be Yes for parallel to be safe:

1. No overlap in files to be modified
2. Shared types/interfaces not modified simultaneously
3. Shared state (Store) not modified simultaneously
4. Config files not modified simultaneously
5. API contract (interface) pre-defined or not modified

If any is No: proceed sequentially, or handle shared files first (partial-parallel).

---

## Parallel Execution Summary (plan.md format)

Include in plan.md when execution mode is `partial-parallel` or `parallel`:

```markdown
## Parallel Execution Summary

**Pattern:** [describe parallel structure]

| Session    | Branch          | Plan File        | Skill(s)                 | File Scope        |
| ---------- | --------------- | ---------------- | ------------------------ | ----------------- |
| Current    | feat/x-frontend | plan-frontend.md | frontend-dev             | app/, components/ |
| Additional | feat/x-backend  | plan-backend.md  | backend-dev              | server/, api/     |

**Conflict risk:** [None/Low/Medium]
**Checklist:** [n/5 passed]
**Reasoning:** [brief justification]
```

## Merge Coordination Rule

When `planner-lite` sessions merge in parallel mode:

1. Never hardcode `main`; merge only to each file's `Branch`
2. Planners with different `Branch` values may run concurrently
3. Planners with the same `Branch` must be orchestrated sequentially
