# Claude Code Statusline 최종 설계안

## 목표
Claude Code의 statusline에 아래 항목을 간결하게 표시한다.

- week
- session
- gmail
- tasks
- jira
- github
- slack

예시:

```text
week 42% session 18% | gmail 7 | tasks 3 | jira 5 | github 4 | slack 6
```

핵심 원칙은 다음과 같다.

- statusline에는 **숫자만** 표시한다.
- 상세는 각 서비스별 **`/xxx-check` 명령**으로 확인한다.
- 무거운 API 호출은 statusline에서 직접 하지 않고 **collector + cache** 구조로 분리한다.
- `week/session`은 별도 스킬 없이 **`/usage`** 로 상세를 확인한다.

---

## 전체 구조

```text
[collector/cache layer]
- usage
- gmail
- tasks
- jira
- github
- slack
      ↓
  JSON 캐시 파일 저장
      ↓
[statusline.sh]
캐시 읽기 + 색상 적용 + 한 줄 출력
      ↓
Claude Code statusline
```

### 역할 분리

#### 1. collector
각 서비스에서 데이터를 수집해서 캐시 파일로 저장한다.

#### 2. statusline
캐시 파일만 읽어서 빠르게 문자열을 렌더링한다.

#### 3. detail command
필요할 때 상세 목록을 보여준다.

- `/mail-check`
- `/tasks-check`
- `/jira-check`
- `/github-check`
- `/slack-check`

---

## 1. week / session

### 표시 목적
Claude 사용량의 주간 한도 퍼센트와 세션 한도 퍼센트를 표시한다.

예시:

```text
week 42% session 18%
```

### 상세 확인
별도 스킬 없이 **`/usage`** 사용.

### 구현 방식
- statusline 입력 JSON에서 관련 값을 읽을 수 있으면 우선 사용
- 없다면 별도 usage collector에서 값을 가져와 캐시에 저장
- statusline은 캐시 또는 입력값을 그대로 렌더링

### 캐시 정책
- 1분 내외

### 색상 기준 예시
- 0~59%: 기본색
- 60~79%: 노란색
- 80% 이상: 빨간색

---

## 2. gmail

### 표시 목적
읽지 않은 메일 수를 표시한다.

예시:

```text
gmail 7
```

### 기준 정의
- Gmail의 unread count 기준
- 보통 `UNREAD` 시스템 라벨 기준으로 집계

### 구현 방식
- Gmail API로 unread count 조회
- 메일 목록 전체를 읽어서 직접 세지 말고, unread 관련 카운트 필드를 이용

### 상세 확인
`/mail-check`

표시 예시:
- 보낸 사람
- 제목
- 받은 시간
- 원본 링크

### 캐시 정책
- **5분**

### 읽음 반영
- Gmail 웹/앱에서 읽으면 unread 수가 감소
- 다음 갱신 때 statusline에 자동 반영

### 색상 기준 예시
- 0: 회색
- 1~9: 기본색
- 10~29: 노란색
- 30 이상: 빨간색

---

## 3. tasks

### 표시 목적
Google Tasks의 미완료 항목 수를 표시한다.

예시:

```text
tasks 3
```

### 기준 정의
- `status = needsAction` 인 task만 카운트
- `completed`는 제외

### 구현 방식
- Google Tasks API로 task list 조회
- 미완료 task만 합산

### 상세 확인
`/tasks-check`

표시 예시:
- task 제목
- due date
- task list 이름
- 원본 링크

### 캐시 정책
- **5분**

### 완료 반영
- Tasks에서 완료 처리하면 count에서 빠짐
- 다음 갱신 때 statusline에 자동 반영

### 색상 기준 예시
- 0: 회색
- 1~5: 기본색
- 6~10: 노란색
- 11 이상: 빨간색

---

## 4. jira

### 표시 목적
나에게 할당된 미완료 Jira 이슈 수를 표시한다.

예시:

```text
jira 5
```

### 기준 정의
추천 JQL:

```text
assignee = currentUser() AND statusCategory != Done
```

즉,
- 현재 사용자에게 할당되어 있고
- 완료 상태가 아닌 이슈만 카운트

### 구현 방식
- Jira REST API 또는 CLI로 JQL 실행
- 결과 개수만 캐시

### 상세 확인
`/jira-check`

표시 예시:
- issue key
- summary
- priority
- status
- updated
- 원본 링크

### 캐시 정책
- **5분**

### 처리 반영
- Done 처리되거나 assignee가 바뀌면 count에서 빠짐
- 다음 갱신 때 자동 반영

### 색상 기준 예시
- 0: 회색
- 1~5: 기본색
- 6~10: 노란색
- 11 이상: 빨간색

---

## 5. github

### 표시 목적
PR 관련 unread GitHub 알림 수를 표시한다.

예시:

```text
github 4
```

### 기준 정의
`subject.type = PullRequest` 인 notification thread 중 아래 reason 계열을 포함한다.

- `review_requested`
- `mention`
- `team_mention`
- `author`
- 필요하면 `subscribed` 선택적 포함

### 중요한 카운트 규칙
- **PR thread 기준 1건 카운트**
- 같은 PR에서 reason이 여러 개여도 숫자는 1만 증가

예를 들어,
- review requested
- mention
- author

가 같은 PR에서 동시에 발생해도 statusline 숫자는 `1`만 증가한다.

### 구현 방식
- GitHub Notifications API 사용
- unread 상태인 PR 관련 thread만 조회
- thread 기준 dedupe 후 개수 계산

### 상세 확인
`/github-check`

표시 예시:
- repository
- PR title
- reason
- updated time
- 원본 GitHub 링크

### 캐시 정책
- **1~2분**

### 읽음 반영
이 항목은 **원본 GitHub 상태를 따른다.**

원하는 플로우:
1. `/github-check`에서 목록 확인
2. 링크를 눌러 GitHub 웹에서 PR 또는 알림을 확인
3. GitHub notification unread 상태가 해제됨
4. 다음 polling 때 statusline count 감소

즉, GitHub는 **원본 unread notification 상태와 연동**하는 방식으로 설계한다.

### 색상 기준 예시
- 0: 회색
- 1~3: 기본색
- 4~7: 노란색
- 8 이상: 빨간색

---

## 6. slack

### 표시 목적
Slack에서 내게 관련된 unread 멘션 수를 표시한다.

예시:

```text
slack 6
```

### 기준 정의
다음을 모두 포함한다.

#### direct mention
- `<@내유저ID>`

#### broad mention
- `<!channel>`
- `<!here>`
- `<!everyone>`

### 선택한 방식
**방법 A**

즉, Slack의 **원본 읽음 상태(read cursor)** 를 최대한 따라가는 방식으로 구현한다.

### 구현 방식
1. Slack 이벤트에서 mention 메시지를 수집한다.
2. 각 메시지가 direct mention인지 broad mention인지 구분한다.
3. 해당 메시지가 속한 conversation의 read cursor 이후에 있으면 unread로 본다.
4. unread 범위 안에 있는 mention만 카운트한다.

즉, statusline 숫자는 다음 의미를 가진다.

- 내 direct mention
- `@channel/@here/@everyone`
- 이 중 현재 unread conversation 범위 안에 있는 것들의 합

### 상세 확인
`/slack-check`

표시 예시:
- 채널명
- 작성자
- 시각
- direct / broadcast 구분
- 본문 일부
- Slack 원본 링크

### 캐시 정책
- **1~2분**
- 또는 이벤트 기반 저장 + 짧은 재계산

### 읽음 반영
Slack은 GitHub처럼 “알림 항목 단위 inbox”라기보다, **conversation 단위 read cursor 모델**에 가깝다.

원하는 플로우:
1. `/slack-check`에서 목록 확인
2. 링크를 눌러 Slack 웹/앱에서 해당 채널 또는 스레드 열기
3. Slack의 read cursor가 이동
4. 다음 갱신 때 unread 범위 밖으로 밀려난 mention이 count에서 빠짐

즉, Slack은 **원본 Slack에서 실제로 읽으면 다음 갱신에서 줄어드는 방향**으로 구현하되,
GitHub처럼 항목 단위 unread inbox와 100% 동일한 모델은 아니라는 점을 감안한다.

### 색상 기준 예시
- 0: 회색
- 1~3: 기본색
- 4~7: 노란색
- 8 이상: 빨간색

---

## CLI 가능 여부 정리

### week / session
- statusline 입력값 또는 usage collector 사용
- 상세는 `/usage`

### gmail
- Gmail API 기반 커스텀 스크립트 가능

### tasks
- Google Tasks API 기반 커스텀 스크립트 가능

### jira
- Jira REST API 또는 CLI 기반 가능

### github
- GitHub CLI(`gh api`) 또는 REST API 기반 가능

### slack
- Slack Web API + Events API + 자체 스크립트 조합 추천

---

## 캐시 정책 최종안

### 5분 캐시
- gmail
- tasks
- jira

### 1~2분 캐시
- week
- session
- github
- slack

이유:
- Gmail / Tasks / Jira는 상태 변화가 비교적 느림
- GitHub / Slack은 링크를 눌러 원본 서비스에서 확인한 뒤 빠르게 반영되길 원함
- week / session도 비교적 자주 변할 수 있음

---

## 상세 확인 명령 최종안

- `week / session` → `/usage`
- `gmail` → `/mail-check`
- `tasks` → `/tasks-check`
- `jira` → `/jira-check`
- `github` → `/github-check`
- `slack` → `/slack-check`

---

## 최종 원칙 요약

### 1. statusline은 숫자만
상세 목록, 제목, 긴 설명은 넣지 않는다.

### 2. 상세는 `/xxx-check`
필요할 때만 본다.

### 3. 외부 서비스는 collector + cache
statusline은 항상 가볍게 유지한다.

### 4. GitHub는 원본 unread 상태 연동
GitHub 웹에서 읽으면 다음 갱신에 count 감소.

### 5. Slack은 방법 A
Slack 원본 read cursor를 최대한 따라 unread mention을 계산한다.

### 6. week / session은 `/usage`
별도 check 스킬은 만들지 않는다.

---

## 최종 한 줄 요약

이 설계는 **`week/session`은 `/usage`, `gmail/tasks/jira`는 5분 갱신형 상태 조회, `github`는 원본 GitHub unread notification 연동, `slack`은 방법 A로 Slack read cursor를 최대한 따라 unread mention을 계산하는 구조**이다.

