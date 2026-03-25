<div align="center">

# claude-code-status

**Claude Code 터미널에 나의 업무 대시보드를 추가하는 플러그인**

Claude 사용량, Gmail, Tasks, Jira, GitHub — 한 줄로 모두 확인.

<p>
  <a href="#튜토리얼">설치</a> &middot;
  <a href="#왜-필요한가">왜?</a> &middot;
  <a href="#표시-항목">기능</a> &middot;
  <a href="#사용-가능한-명령어">명령어</a> &middot;
  <a href="#동작-원리">동작 원리</a>
</p>

<p>
  <a href="https://github.com/SeoJaeWan/claude-code-status/stargazers"><img src="https://img.shields.io/github/stars/SeoJaeWan/claude-code-status?style=flat&color=f5a623" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/runtime-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey" alt="Platform">
</p>

<p><a href="README.md">English</a></p>

</div>

```
week 3% session 22% | gmail 7 | tasks 3 | jira 5 | github 4
```

---

## 왜 필요한가?

기본 Claude Code 상태 표시줄은 거의 아무것도 보여주지 않습니다. 다음을 알 수 없습니다:

- **요금 한도에 얼마나 가까운지** — 한도에 걸려야 알게 됩니다
- **읽지 않은 메일이 얼마나 쌓였는지** — 코딩에 몰입하는 동안 놓칩니다
- **Jira 티켓이 몇 개 대기 중인지** — 확인하려면 브라우저를 열어야 합니다
- **PR 리뷰가 들어왔는지** — GitHub에 들어가봐야 압니다

각 서비스를 확인하러 컨텍스트 스위칭하면 작업 흐름이 끊깁니다. 이 플러그인은 터미널 하단 한 줄에 모든 것을 표시합니다 — 항상 보이지만 방해되지 않습니다.

연동하지 않은 서비스는 **자동으로 숨겨집니다**. 사용률 퍼센트만으로 시작하고, 필요할 때 서비스를 추가하세요.

---

## 표시 항목

| 구간 | 소스 | 의미 |
|---|---|---|
| `week 3%` | Claude Code 요금 한도 | 주간 사용률 — 페이스 조절 |
| `session 22%` | Claude Code 요금 한도 | 현재 세션 사용률 — 컴팩션 주의 |
| `gmail 7` | Gmail API | 쌓이고 있는 읽지 않은 메일 |
| `tasks 3` | Google Tasks API | 미완료 할 일 |
| `jira 5` | Jira API | 본인에게 할당된 미완료 이슈 |
| `github 4` | GitHub API | 읽지 않은 PR 알림 |

### 색상 규칙

긴급도에 따라 색상이 바뀌어 한눈에 파악할 수 있습니다:

| 구간 | Green | Cyan | Yellow | Red | Gray |
|---|---|---|---|---|---|
| week / session | 0-29% | 30-59% | 60-79% | 80%+ | - |
| gmail | 1-9 | - | 10-29 | 30+ | 0 |
| tasks | 1-5 | - | 6-10 | 11+ | 0 |
| jira | 1-5 | - | 6-10 | 11+ | 0 |
| github | 1-3 | - | 4-7 | 8+ | 0 |

---

## 사전 요구사항

| 항목 | 이유 |
|---|---|
| [Node.js](https://nodejs.org) v18+ | 상태 표시줄 렌더러 및 collector 실행 |
| [Claude Code](https://claude.ai/code) | 이 플러그인이 확장하는 CLI |

외부 서비스 CLI는 **선택사항**입니다 — 필요한 것만 설치하세요:

| 서비스 | CLI | 설치 |
|---|---|---|
| Gmail / Tasks | [Google Workspace CLI](https://github.com/nicholasgasior/gws) | `npm install -g @nicholasgasior/gws` |
| Jira | [Atlassian CLI](https://developer.atlassian.com/cloud/acli/) | [바이너리 다운로드](https://developer.atlassian.com/cloud/acli/guides/install-acli/) |
| GitHub | [GitHub CLI](https://cli.github.com) | `winget install GitHub.cli` / `brew install gh` |

---

## 튜토리얼

### Step 1. 플러그인 설치

```bash
claude plugin install claude-code-status
```

### Step 2. 초기화

Claude Code 대화창에서 아래 명령어를 실행합니다.

```
/claude-code-status:init-statusline
```

이 명령어 하나로 데이터 디렉토리 생성, settings.json 연결, 캐시 채우기를 모두 처리합니다. **재시작 불필요.** 몇 초 내로 상태 표시줄이 나타납니다.

### Step 3. 외부 서비스 연동 (선택)

사용할 서비스만 골라서 인증하세요. 인증하지 않은 서비스는 표시되지 않습니다.

<details>
<summary><b>Gmail & Google Tasks</b></summary>

```bash
npm install -g @nicholasgasior/gws   # Google Workspace CLI 설치
gws auth setup                        # Cloud 프로젝트 생성 및 API 활성화
gws auth login                        # 브라우저에서 OAuth 동의
```

수동 설정은 [gws README](https://github.com/nicholasgasior/gws#manual-oauth-setup)를 참고하세요.

</details>

<details>
<summary><b>Jira</b></summary>

```bash
# Atlassian CLI 설치 (Windows)
Invoke-WebRequest -Uri https://acli.atlassian.com/windows/latest/acli_windows_amd64/acli.exe -OutFile acli.exe
# acli.exe를 PATH에 추가한 뒤:
acli jira auth login --web
```

브라우저가 열리면 Atlassian 사이트를 선택하고 권한을 승인합니다.

> npm의 `acli` 패키지는 Atlassian CLI가 아닙니다. 반드시 [공식 바이너리](https://developer.atlassian.com/cloud/acli/guides/install-acli/)를 사용하세요.

</details>

<details>
<summary><b>GitHub</b></summary>

```bash
gh auth login
```

</details>

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
| `/claude-code-status:init-statusline` | **전체 초기화** — 부트스트랩, settings 연결, 캐시 채우기 (재시작 불필요) |
| `/claude-code-status:status-doctor` | 전체 상태 점검 및 수정 가이드 |
| `/claude-code-status:gmail-check` | Gmail 상세 확인 / 강제 새로고침 |
| `/claude-code-status:tasks-check` | Google Tasks 상세 확인 / 강제 새로고침 |
| `/claude-code-status:jira-check` | Jira 이슈 상세 확인 / 강제 새로고침 |
| `/claude-code-status:github-check` | GitHub PR 알림 상세 확인 / 강제 새로고침 |

---

## 동작 원리

```
[SessionStart 훅]
  status-line.sh + 빌드된 dist/를 $CLAUDE_PLUGIN_DATA에 복사
  npm production 의존성 설치

[상태 표시줄 렌더링 사이클]  (수 초마다)
  Claude Code stdin JSON ──> status-line.sh ──> node render.js ──> stdout
                                                    |
                                         cache/*.json 읽기
                                         만료 시 백그라운드 갱신

[백그라운드 collector]
  node collect.js --service <name>
    -> 외부 CLI 호출 (gws / acli / gh)
    -> $CLAUDE_PLUGIN_DATA/cache/<service>.json에 저장
    -> lock 파일로 중복 실행 방지
```

### 캐시 TTL

| 서비스 | TTL |
|---|---|
| github | 90초 |
| gmail / tasks / jira | 5분 |

---

## 트러블슈팅

| 문제 | 해결 |
|---|---|
| 상태 표시줄이 안 보여요 | `/claude-code-status:init-statusline` 실행 |
| 서비스에 `!` (빨강) 표시 | 인증 만료 — Step 3의 인증 명령어 재실행 |
| `status: build missing` 표시 | Claude Code 재시작 (SessionStart 훅이 dist/ 동기화) |
| 강제 새로고침 하고 싶어요 | `/claude-code-status:<service>-check` 사용 |

---

## 파일 구조

```
$CLAUDE_PLUGIN_DATA/
  bin/
    status-line.sh            <- bash 런처 (SessionStart가 복사)
  runtime/
    dist/
      render.js               <- 상태 표시줄 렌더러
      collect.js              <- collector CLI 디스패처
      collectors/
        gmail.js, tasks.js, jira.js, github.js
      coordinator.js          <- lock / stale / 백그라운드 갱신
      cache.js                <- 캐시 읽기 헬퍼
  cache/
    <service>.json            <- 각 서비스 캐시 데이터
  locks/
    <service>.lock            <- 중복 실행 방지 lock
  logs/
    launcher.log, session-start.log
```

---

## License

[MIT](LICENSE)
