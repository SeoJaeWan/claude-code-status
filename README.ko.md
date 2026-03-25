# claude-code-status

[English](README.md)

Claude Code 터미널 하단에 실시간 상태 표시줄을 추가하는 플러그인입니다.
Claude 사용량(week/session)과 외부 서비스(Gmail, Tasks, Jira, GitHub) 알림을
한눈에 확인할 수 있습니다.

```
week 3% session 22% | gmail 7 | tasks 3 | jira 5 | github 4
```

- **week / session** — Claude Code 요금제 사용률 (stdin JSON에서 자동 수집)
- **gmail** — Gmail 읽지 않은 메일 수 ([Google Workspace CLI](https://github.com/nicholasgasior/gws))
- **tasks** — Google Tasks 미완료 항목 수 (Google Workspace CLI)
- **jira** — 본인에게 할당된 미완료 이슈 수 ([Atlassian CLI](https://developer.atlassian.com/cloud/acli/))
- **github** — 읽지 않은 PR 알림 수 ([GitHub CLI](https://cli.github.com))

연동하지 않은 서비스는 자동으로 숨겨지므로, 필요한 서비스만 설정하면 됩니다.

### 색상 규칙

| 구간 | Green | Cyan | Yellow | Red | Gray |
|---|---|---|---|---|---|
| week / session | 0–29% | 30–59% | 60–79% | 80%+ | — |
| gmail | 1–9 | — | 10–29 | 30+ | 0 |
| tasks | 1–5 | — | 6–10 | 11+ | 0 |
| jira | 1–5 | — | 6–10 | 11+ | 0 |
| github | 1–3 | — | 4–7 | 8+ | 0 |

---

## 튜토리얼

### Step 1. 플러그인 설치

```bash
claude plugin install claude-status
```

### Step 2. 상태 표시줄 연결

Claude Code 대화창에서 아래 명령어를 실행합니다.

```
/claude-code-status:install-status
```

`~/.claude/settings.json`에 `statusLine.command`가 설정됩니다.
설정 후 **Claude Code를 재시작**하면 터미널 하단에 상태 표시줄이 나타납니다.

### Step 3. 외부 서비스 연동 (선택)

사용할 서비스만 골라서 인증하세요. 인증하지 않은 서비스는 표시되지 않습니다.

#### Gmail & Google Tasks

```bash
npm install -g @nicholasgasior/gws   # Google Workspace CLI 설치
gws auth setup                        # Cloud 프로젝트 생성 및 API 활성화
gws auth login                        # 브라우저에서 OAuth 동의
```

> 수동 설정은 [gws README](https://github.com/nicholasgasior/gws#manual-oauth-setup)를 참고하세요.

#### Jira

```bash
# Atlassian CLI 설치 (Windows)
Invoke-WebRequest -Uri https://acli.atlassian.com/windows/latest/acli_windows_amd64/acli.exe -OutFile acli.exe
# acli.exe를 PATH에 추가한 뒤:
acli jira auth login --web
```

브라우저가 열리면 Atlassian 사이트를 선택하고 권한을 승인합니다.

> npm의 `acli` 패키지는 Atlassian CLI가 아닙니다. 반드시 공식 바이너리를 사용하세요.

#### GitHub

```bash
gh auth login
```

### Step 4. 동작 확인

```
/claude-code-status:status-doctor
```

모든 의존성, 인증 상태, 런처 경로, 캐시 상태를 한번에 점검합니다.
실패한 항목마다 수정 명령어가 안내됩니다.

---

## 사용 가능한 명령어

| 명령어 | 설명 |
|---|---|
| `/claude-code-status:install-status` | 상태 표시줄을 `settings.json`에 연결 |
| `/claude-code-status:status-doctor` | 전체 상태 점검 및 수정 가이드 |
| `/claude-code-status:gmail-check` | Gmail 상세 확인 / 강제 새로고침 |
| `/claude-code-status:tasks-check` | Google Tasks 상세 확인 / 강제 새로고침 |
| `/claude-code-status:jira-check` | Jira 이슈 상세 확인 / 강제 새로고침 |
| `/claude-code-status:github-check` | GitHub PR 알림 상세 확인 / 강제 새로고침 |

---

## 동작 원리

```
[SessionStart 훅]
  - status-line.sh를 $CLAUDE_PLUGIN_DATA/bin/에 복사
  - TypeScript 런타임 빌드 (dist/)

[상태 표시줄 렌더링 사이클]
  Claude Code가 stdin으로 JSON 전달 (rate_limits, model, session_id)
    -> $CLAUDE_PLUGIN_DATA/bin/status-line.sh (bash 런처)
    -> node render.js
       - stdin에서 week/session 사용률 추출
       - cache 파일에서 외부 서비스 데이터 읽기
       - 캐시 만료 시 백그라운드 갱신 (논블로킹)
       - 색상이 적용된 한 줄 출력

[백그라운드 collector]
  node collect.js --service <name>
    - 외부 CLI를 호출하여 데이터 수집
    - $CLAUDE_PLUGIN_DATA/cache/<service>.json에 결과 저장
    - lock 파일로 중복 실행 방지
```

### 캐시 TTL

| 서비스 | TTL |
|---|---|
| github | 90초 |
| gmail / tasks / jira | 5분 |

---

## 트러블슈팅

**상태 표시줄이 안 보여요**
-> `/claude-code-status:install-status` 실행 후 Claude Code 재시작

**서비스에 `!` (빨강)이 표시돼요**
-> 해당 서비스의 인증이 만료되었습니다. Step 3의 인증 명령어를 다시 실행하세요.

**`status: build missing`이 표시돼요**
-> TypeScript 빌드가 안 됐습니다. Claude Code를 재시작하면 SessionStart 훅이 자동 빌드합니다.

**특정 서비스를 강제 새로고침하고 싶어요**
-> `/claude-code-status:<service>-check` 명령어에서 강제 새로고침을 선택하세요.

---

## 파일 구조

```
$CLAUDE_PLUGIN_DATA/
  bin/
    status-line.sh          <- bash 런처 (SessionStart가 복사)
  runtime/
    dist/
      render.js             <- 상태 표시줄 렌더러
      collect.js            <- collector CLI 디스패처
      collectors/
        gmail.js, tasks.js, jira.js, github.js
      coordinator.js        <- lock / stale / 백그라운드 갱신
      cache.js              <- 캐시 읽기 헬퍼
  cache/
    <service>.json          <- 각 서비스 캐시 데이터
  locks/
    <service>.lock          <- 중복 실행 방지 lock
  logs/
    launcher.log, session-start.log
```
