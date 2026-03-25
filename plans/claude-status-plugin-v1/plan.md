**Branch:** feat/claude-status-plugin-v1

> Worktree dir: `worktrees/feat-claude-status-plugin-v1` (`Branch`의 `/`를 `-`로 치환)

# Claude Code Statusline Plugin V1 실행 계획

> 이 저장소는 greenfield이므로 plan-time `tests/` 산출물은 만들지 않고, Phase 4에서 Node/TypeScript test runner를 먼저 도입한 뒤 source tree에 직접 테스트를 작성한다.

## 단계별 실행

### Phase 1

- 목적: 순수 plugin 골격과 전역 설치 경로를 고정하고, 업데이트에 안전한 runtime/bootstrap 구조를 만든다.
- owner_agent: `backend-developer`
- primary_skill: `backend-dev`
- 계약/제약:
    - v1 범위는 `week/session`, `gmail`, `tasks`, `jira`, `github`.
    - plugin은 user scope 설치를 기준으로 하며 전역 설정 파일은 `~/.claude/settings.json`이다.
    - plugin 명령은 순수 plugin 정책에 따라 `/plugin-id:*` 네임스페이스를 사용한다.
    - 상태, 캐시, 런타임 의존성, 생성된 launcher는 `${CLAUDE_PLUGIN_DATA}` 아래에만 저장한다.
    - 구현 기본 런타임은 `Node.js + TypeScript`로 두고, Windows status line bridge는 PowerShell launcher로 제공한다.
    - marketplace 설치 후 plugin root는 cache로 복사되므로 `statusLine.command`는 plugin root가 아니라 persistent data 경로를 가리켜야 한다.
- 작업:
    - `.claude-plugin/plugin.json`, `skills/`, `hooks/`, `scripts/`, `runtime/` 중심의 plugin 디렉터리 구조를 설계한다.
    - `SessionStart` hook으로 `${CLAUDE_PLUGIN_DATA}`의 의존성/런처 bootstrap과 버전 변경 감지를 구현한다.
    - `/plugin-id:init-statusline` skill을 만들어 `~/.claude/settings.json`의 `statusLine.command`를 안정 경로 launcher로 설정한다.
    - `/plugin-id:doctor` skill 초안을 만들어 `node`, `gh`, `acli`, Google OAuth 설정 파일 존재 여부를 점검하게 한다.
    - PowerShell statusline launcher와 Node runtime entrypoint 사이의 호출 계약을 문서화한다.
- 실행:
    - `claude plugin install <plugin> --scope user`
    - `/plugin-id:init-statusline`
    - `/plugin-id:doctor`
- 완료조건:
    - plugin이 user scope로 설치되고, `init-statusline` 실행 후 전역 status line이 persistent launcher를 가리킨다.
    - plugin update 이후에도 `${CLAUDE_PLUGIN_DATA}` 기반 launcher와 런타임 의존성이 유지되는 구조가 확인된다.
    - `doctor`가 필수 외부 의존성과 누락된 설정을 명확히 구분해 출력한다.
- 폴백:
    - launcher 경로 안정화가 어려우면 `${CLAUDE_PLUGIN_DATA}/bin/*`을 install 단계에서 재생성하는 방식으로 고정한다.

### Phase 2

- 목적: 인증/수집/캐시 공통 계층을 구현해 네트워크 호출을 render path 밖으로 밀어내고 서비스별 count 계약을 고정한다.
- owner_agent: `backend-developer`
- primary_skill: `backend-dev`
- 선행조건: `Phase 1 완료`
- 계약/제약:
    - `week/session`은 Claude Code statusline stdin의 `rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage`를 우선 사용하고 값이 없으면 `-`로 처리한다.
    - `gmail` count는 Gmail `UNREAD` 라벨 unread count를 사용한다.
    - `tasks` count는 모든 task list의 `status = needsAction` 합계로 계산한다.
    - `jira` count는 `assignee = currentUser() AND statusCategory != Done` JQL 결과 개수로 계산한다.
    - `github` count는 unread notification 중 `subject.type = PullRequest`만 포함하고 thread 기준으로 dedupe한다.
    - `github` 인증은 `gh` 로그인 상태를 재사용하고, `jira` 인증은 `acli jira auth login --web` 상태를 재사용한다.
    - Google은 v1에서 공개 배포용 공용 OAuth client를 만들지 않고, 사용자 로컬에 연결된 Desktop OAuth client와 token 저장소를 사용한다.
    - 인증 실패, CLI 미설치, collector 오류는 각 서비스 상태를 `!`로 승격할 수 있도록 공통 오류 분류를 가진다.
    - TTL은 `gmail/tasks/jira = 5분`, `github = 1~2분`, `week/session = 1분`으로 둔다.
    - status line render path에서는 외부 API나 CLI를 동기 호출하지 않는다.
- 작업:
    - `collector result` 스키마를 정의한다. 필수 필드는 `value`, `status`, `fetchedAt`, `ttlMs`, `errorKind`, `detail`, `source`로 둔다.
    - 공통 lock/stale/background refresh coordinator를 구현한다.
    - `gh` adapter를 추가해 notifications polling, thread dedupe, reason filtering, poll interval 반영을 수행한다.
    - `acli` adapter를 추가해 JQL count/detail 조회와 로그인 상태 검사를 수행한다.
    - Google auth/token store를 구현하고 Gmail unread count 및 Tasks count collector를 추가한다.
    - collector 오류를 `auth`, `dependency`, `rate_limit`, `transient`, `unknown` 등으로 분류해 renderer와 detail skill이 공통 처리하게 한다.
- 실행:
    - `node <runtime>/collect.js --service github --force`
    - `node <runtime>/collect.js --service jira --force`
    - `node <runtime>/collect.js --service gmail --force`
    - `node <runtime>/collect.js --service tasks --force`
- 완료조건:
    - 각 collector가 독립적으로 캐시 파일을 갱신하고 오류 분류를 남긴다.
    - stale 판단과 lock이 동작해 중복 refresh나 장시간 block 없이 재수집이 트리거된다.
    - `gh`, `acli`, Google OAuth 세 축이 plugin 내부 secret 하드코딩 없이 동작한다.
- 폴백:
    - Google OAuth 공용 배포가 막히면 v1 설치 문서에 사용자별 OAuth client 생성 절차를 명시하고, plugin은 그 로컬 설정만 소비한다.

### Phase 3

- 목적: status line renderer와 상세/설정 skill을 완성해 사용자 표면을 고정한다.
- owner_agent: `backend-developer`
- primary_skill: `backend-dev`
- 선행조건: `Phase 2 완료`
- 계약/제약:
    - status line은 한 줄 출력만 사용하고 각 서비스는 숫자, `!`, `-` 중 하나로만 표시한다.
    - `week/session` 상세는 built-in `/usage`를 사용하고 plugin 전용 detail skill을 만들지 않는다.
    - detail skill은 `/plugin-id:gmail-check`, `/plugin-id:tasks-check`, `/plugin-id:jira-check`, `/plugin-id:github-check`, `/plugin-id:doctor`, `/plugin-id:setup-google`을 제공한다.
    - GitHub/Jira setup은 외부 CLI 로그인 상태를 점검하고 필요한 터미널 명령을 안내하는 방식으로 구현한다.
    - stale 캐시를 본 renderer는 background refresh만 발사하고 현재 turn의 status line 출력을 지연시키지 않는다.
    - 색상은 기존 domain 기준을 따르되 `!`는 빨간색, `-`는 회색으로 고정한다.
- 작업:
    - stdin JSON 파서와 cache reader를 결합한 renderer를 구현한다.
    - `statusLine.command`가 호출하는 PowerShell launcher와 Node renderer 사이의 인자/exit code 계약을 고정한다.
    - 서비스별 detail skill을 구현해 cached detail 출력, 강제 refresh 옵션, 링크/원인 안내를 제공한다.
    - `/plugin-id:setup-google`에서 Desktop OAuth 브라우저 플로우를 시작하고 token 저장 위치를 초기화한다.
    - `/plugin-id:doctor`를 확장해 로그인 상태, launcher 경로, 캐시 신선도, 마지막 오류 원인을 함께 보여준다.
    - README와 설치 문서에 user-scope 설치, global statusLine 연결, service별 login 절차를 정리한다.
- 실행:
    - `/plugin-id:setup-google`
    - `/plugin-id:gmail-check`
    - `/plugin-id:tasks-check`
    - `/plugin-id:jira-check`
    - `/plugin-id:github-check`
- 완료조건:
    - 상태줄이 `week/session | gmail | tasks | jira | github` 형식으로 숫자/`!`/`-`만 렌더링한다.
    - detail skill이 cache 기반 상세와 실패 원인을 일관되게 보여준다.
    - 전역 설정, 외부 CLI 로그인, Google OAuth까지 포함한 사용자 설정 플로우가 문서와 skill로 재현 가능하다.

### Phase 4

- 목적: 구현 검증, 테스트 러너 도입, 배포/업데이트 절차를 마감해 v1 릴리즈 가능 상태로 만든다.
- owner_agent: `backend-developer`
- primary_skill: `backend-dev`
- 선행조건: `Phase 3 완료`
- 계약/제약:
    - 이 저장소는 greenfield이므로 test runner와 lint 규칙도 이번 작업에서 함께 도입한다.
    - v1 테스트 범위는 renderer formatting, cache TTL/lock coordinator, settings patcher, `gh`/`acli` adapter parsing, Google token refresh 경계에 집중한다.
    - final test source-tree 위치는 구현 중 선택하되 plugin runtime과 동일한 Node/TypeScript toolchain을 사용한다.
    - UI surface가 아닌 CLI/plugin 작업이므로 `plan-e2e-test`와 `playwright-guard`는 이번 계획 범위에 포함하지 않는다.
- 작업:
    - Node/TypeScript 빌드 스크립트와 test runner를 도입하고 최소 smoke/unit coverage를 작성한다.
    - Windows manual smoke 절차를 만들어 실제 Claude Code status line에서 설치, refresh, 오류 표기를 검증한다.
    - plugin packaging, versioning, update, uninstall 시 `${CLAUDE_PLUGIN_DATA}` 유지/삭제 규칙을 문서화한다.
    - 로컬 개발(`claude --plugin-dir .`)과 marketplace/user-scope 설치 절차를 모두 문서화한다.
- 테스트 산출물:
    - `none (greenfield 기본값으로 source tree 테스트를 직접 작성)`
- 테스트 이동:
    - `none`
- 실행:
    - `npm test`
    - `npm run build`
    - `claude --plugin-dir .`
    - `claude plugin install <plugin> --scope user`
- 완료조건:
    - 핵심 런타임 경계에 대한 자동화 테스트가 green이다.
    - Windows 수동 smoke에서 전역 status line 설치, service별 login, 숫자/`!`/`-` 출력이 검증된다.
    - 설치/업데이트/삭제 문서만으로 신규 사용자가 plugin을 설정할 수 있다.
