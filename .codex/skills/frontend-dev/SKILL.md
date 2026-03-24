---
name: frontend-dev
description: React/Next.js/Expo development with UI components, custom hooks, and state management. Use for frontend UI, API integration, and mobile app development.
---

<Skill_Guide>
<Purpose>
React/Next.js/Expo development with UI components, custom hooks, and state management. Use for frontend UI, API integration, and mobile app development.
</Purpose>

<Instructions>
# frontend-dev

Expert frontend workflow — UI components, hooks, state management, and API integration.

---

## Never develop frontend files without frontend

All frontend conventions — component placement, hook structure, naming, import patterns, and test rules — are defined in the `frontend` CLI. Without `frontend` you are guessing at conventions, and guesses are wrong. Read `frontend help --text` first, scaffold with `frontend <command> --apply`, and always run `frontend validate-file` on every created/modified file when you are done. Fix any violations and re-validate until all pass.

---

## Core Principle

**Frontend-dev owns both UI structure and frontend logic.**

- Create or update component files when the task includes layout, styling, responsive UI, or UI interaction state
- Create custom hooks and API hooks when the task includes reusable business/data logic or server-state integration
- If a component has inline logic that should be reused or tested separately, extract it into hooks before expanding the UI further

---

## Implementation Steps

1. Read plan from `plans/{task-name}/plan.md`
2. Read `codemaps/frontend.md` (if present)
3. Read project theme/style when the task includes UI work: `tailwind.config.*`, `app/globals.css`, component library tokens
4. Implement the required UI and logic
5. If plan includes `tests/`: copy test files to source tree, run Red verification (`pnpm test`)
6. If plan includes `e2e/`: copy E2E test files (contract-first — do NOT modify)
7. Run tests: `pnpm test` — confirm ALL pass (Green)
8. If plan includes `e2e/`: `pnpm exec playwright test` — if E2E fails, fix implementation, NOT tests
9. **Run `frontend validate-file` on all created/modified files.** Fix any reported violations and re-validate until all pass. Do not skip this step.
10. Return results based on plan.md

---

## Stack

- React 18+: Hooks, Context, Server Components
- Next.js 15: App Router, Server Actions, Streaming
- React Native: Expo SDK 52+, Expo Router
- State: TanStack Query, Zustand, Jotai
  </Instructions>
  </Skill_Guide>
