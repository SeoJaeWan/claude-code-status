**Branch:** {type}/{summary}

> Worktree dir: `worktrees/{type}-{summary}` (`Branch`의 `/`를 `-`로 치환)

# {작업명} 실행 계획

> 여러 executable plan이 필요한 경우 이 템플릿을 plan별로 반복 사용하고,
> 폴더는 `01-{plan-name}`, `02-{plan-name}` 순서로 나눈다.

## 단계별 실행

### Phase 1

- 목적:
- owner_agent: `{agent-name}`
- primary_skill: `{skill-name}` (선택)
- 선행조건: `none` (선택)
- 계약/제약:
  - `[C-...]` (해당 시)
  - UI scope인 경우 `route/user state/action/visible outcome/locator` 계약
- 작업:
- 테스트 산출물:
  - `plans/{task-name}/tests/{artifact}` (해당 시)
  - `plans/{task-name}/e2e/{artifact}` (해당 시)
- 테스트 이동:
  - `plans/{task-name}/tests/{artifact}` -> `{repo test target path}` (해당 시)
  - `plans/{task-name}/e2e/{artifact}` -> `{repo e2e target path}` (해당 시)
- 실행:
  - `{command}` (해당 시)
- 완료조건:
- 폴백: (선택)

### Phase 2

- 목적:
- owner_agent: `{agent-name}`
- primary_skill: `{skill-name}` (선택)
- 선행조건: (선택)
- 계약/제약:
- 작업:
- 테스트 산출물:
- 테스트 이동:
- 실행:
- 완료조건:
- 폴백: (선택)

### Phase 3

- 목적:
- owner_agent: `{agent-name}`
- primary_skill: `{skill-name}` (선택)
- 선행조건: (선택)
- 계약/제약:
- 작업:
- 테스트 산출물:
- 테스트 이동:
- 실행:
- 완료조건:
- 폴백: (선택)
