---
name: brainstorm
description: Codex entry skill for decision-focused clarification and option exploration. Use when unresolved product policy, UX, contract, schema, validation, state, accessibility, or permission ambiguity must be resolved before planning.
---

<Skill_Guide>
<Purpose>
Clarify ambiguous requests with focused brainstorming, tradeoff comparison, and confirmation questions so blocking product and implementation policy is resolved before planning.
</Purpose>

<Instructions>
# brainstorm

Use this as the entrypoint when ambiguity can change architecture, scope, tooling, API contracts, product policy, UX, or delivery strategy.

## When to use

- Request is ambiguous: "add login", "make dashboard", "improve UX".
- Multiple approaches are plausible and tradeoffs matter.
- Library/framework/pattern choices need to be made.
- Business-rule, UX, validation, permission, or state behavior policy is missing.
- Acceptance criteria are missing or vague.
- The user wants clarification questions before committing to a plan.

## When not to use

- Request is already decision-complete with clear scope and acceptance criteria.
- Task is straightforward with no meaningful tradeoff.

## Workflow

### 1. Analyze request

Identify what is clear vs unclear:

- Required outcomes and constraints
- Missing decisions
- Plausible architecture/library branches
- Missing product-policy decisions across data model, business rules, UX behavior, permissions, validation, state/error handling, and accessibility expectations

### 2. Gather local context

Read only what is needed:

- Relevant folders and files inferred from the request
- Repository folder structure to locate current boundaries and ownership
- Existing code, tests, docs, and UI behavior that can answer questions without user input
- `./.codex/` references only when they directly constrain this workflow

Do not assume or depend on `./.ai/` or any other external AI metadata directory.

### 3. Research latest information when needed

If technical choices depend on external facts (library/API/pattern changes), gather current information before asking for decisions.
If reliable research tooling is unavailable, state that clearly and ask the user to confirm assumptions.

### 4. Compare approaches (required)

Always present 2-3 options with tradeoffs when multiple viable policy or implementation directions exist.
For each option include:

- Pros
- Cons
- Risks
- Implementation cost

Then recommend one option with concise rationale (YAGNI, maintainability, delivery risk).

### 5. Ask confirmation-focused questions

Ask only unresolved high-impact questions.
Rules:

- Max 4 questions at once
- Questions must be actionable
- Do not ask what can be derived from local context
- Questions should help the user confirm scope and direction quickly
- Prioritize blocking policy ambiguity that would change the implementation plan, tests, or user-visible behavior
- If more than 4 blocking questions exist, ask them in rounds
- Prefer structured user-input tooling when available; otherwise ask concise plain-text questions

### 6. Produce decision snapshot (default)

Return a concise decision snapshot in the response:

- Confirmed choices
- Resolved blocking policies
- Deferred low-risk choices
- Key assumptions
- Recommended next step (`architect` or direct execution)

Do not create a requirements artifact by default.

### 7. Optional artifact export (only on explicit user request)

If and only if the user explicitly asks for a written artifact, export to:

- `./.codex/artifacts/brainstorm/{feature-name}.md`

Include:

- Background
- Goals
- Non-goals
- Scope
- Constraints
- Functional requirements
- Non-functional requirements
- Acceptance criteria
- Open questions and assumptions

### 8. Quality gate before handoff

Before handoff, confirm:

- No hidden assumptions remain
- No blocking policy ambiguity remains for the chosen planning scope
- Blocking questions are explicit when another clarification round is still needed
- Recommended next step is clear

### 9. Handoff to architect (when needed)

When planning is needed, provide:

1. Summary of confirmed decisions
2. Explicit defaults or deferred low-risk choices
3. Suggested planning scope boundaries

Do not hand off to `architect` while blocking policy ambiguity remains.

## Guardrails

- Do not write implementation plans or code.
- Do not skip approach comparison when meaningful tradeoffs exist.
- Do not hand off to `architect` with unresolved blocking policy ambiguity.
- Do not depend on `./.ai/` or other external AI metadata directories.
- Keep brainstorm-owned artifacts under `./.codex/`.
- If requirements are already clear, explicitly state skip reason and route to `architect` directly.
  </Instructions>
  </Skill_Guide>
