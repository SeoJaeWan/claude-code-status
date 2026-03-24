# Dev CLI Personal v1 Draft

## Background

현재 `frontend-dev`, `ui-publish`, `backend-dev` 스킬은 규칙 문서와 생성 스크립트가 있어도 에이전트가 이를 일관되게 지키지 않는 문제가 있다.

해결 방향은 스킬이 직접 파일을 만들게 두지 않고, 먼저 역할별 CLI를 통과시키는 것이다.

- `tcp`: publisher용 CLI
- `tcf`: frontend용 CLI
- `tcb`: backend용 CLI

CLI는 경로, 파일명, 템플릿, 금지 규칙을 강제하고, `--help`로 현재 profile/version 기준 규칙을 제공한다.

## Goals

- 에이전트가 scaffold를 수동 생성하지 않고 반드시 CLI를 먼저 사용하게 만든다.
- 경로 규칙, 이름 규칙, 파일 패턴을 CLI가 직접 강제한다.
- `personal/v1`을 먼저 고정하고 이후 `company/v1`, `company/v2`를 병렬로 추가할 수 있게 한다.
- `--help`는 사람이 아니라 에이전트가 읽기 쉬운 JSON을 기본 출력으로 사용한다.
- frontend와 publisher에서 공통인 규칙은 `shared/personal/v1`로 분리한다.
- backend는 Spring 기준 개인 규칙 초안을 함께 정의한다.

## Non-goals

- 이번 초안에서 `company/v1`, `company/v2` 세부 규칙까지 확정하지 않는다.
- 완전 원격 동적 fetch까지는 확정하지 않는다.
- 기존 파일 자동 마이그레이션은 v1 범위에 넣지 않는다.
- UI 품질 자체를 완전 자동으로 판정하지 않는다.

## Scope

이번 문서는 아래 범위를 다룬다.

- `shared/personal/v1`
- `publisher/personal/v1`
- `frontend/personal/v1`
- `backend/personal/v1`
- `tcp`, `tcf`, `tcb`의 생성/강제/안내 책임 구분
- `--help` JSON 구조 초안

## Constraints

- `mode`는 전역 기본값으로 둘 수 있다.
- 실제 파일 생성까지 CLI가 수행해야 한다.
- profile/version은 같은 repo 안에서 관리한다.
- profile/version에 따라 생성 결과는 달라질 수 있다.
- 다만 CLI 엔진 자체를 profile마다 다른 임의 코드로 교체하지는 않는다.
- profile은 template, recipe, path rule, validator를 바꾸는 수준으로 설계한다.

## Profile Layout

```text
profiles/
  shared/
    personal/v1/
  publisher/
    company/v1/
    company/v2/
    personal/v1/
  frontend/
    company/v1/
    personal/v1/
  backend/
    company/v1/
    personal/v1/
```

각 profile 디렉터리는 아래를 가진다.

- `profile.json`
- `templates/`
- `help/`
- `validators/`
- 필요 시 `recipes/`

## Shared Personal v1

공통 규칙은 `publisher`와 `frontend`가 함께 참조한다.

### Enforced

- 폴더 path segment는 `camelCase`
- 내부 함수와 생성 기본 함수 스타일은 화살표 함수 우선
- 내부 핸들러 이름은 `handle*`
- props callback 이름은 `on*`
- 배열 변수는 복수형
- `List`, `Array` suffix 금지
- 타입 이름은 PascalCase
- 전역 공유 타입 경로는 `types/common`, `types/{domain}`

### Guidance

- 한 파일이나 한 기능에서만 쓰는 타입은 로컬에 둔다.
- 2곳 이상 재사용되는 타입만 `types/common` 또는 `types/{domain}`로 승격한다.
- 프론트와 퍼블리싱은 동일한 핸들러 네이밍을 사용한다.

### Shared Type Command

`tcp type`, `tcf type`는 공통 규칙을 읽는다.

- 기본 목적: 공유 타입 생성
- 기본 출력 패턴: `{path}/{name}.ts`
- 기본 `kind`: `interface`
- 선택 `kind`: `interface`, `type`
- 허용 path:
  - `types/common`
  - `types/{domain}`

로컬 1회성 타입은 v1에서 CLI 강제 생성 대상이 아니라 코드를 작성하는 쪽에서 직접 둔다.

## Publisher Personal v1

publisher는 UI 전용이다. business logic는 가지지 않는다.

### Command Surface

- `tcp component <Name> --path <path>`
- `tcp type <Name> --path <path> [--kind interface|type]`
- `tcp validate <target>`
- `tcp --help`
- `tcp --help --text`

### Enforced

- `component` 생성 시 `--path` 필수
- 출력 파일 패턴은 `{path}/index.tsx`
- path segment는 `camelCase`
- 컴포넌트 이름은 PascalCase
- 컴포넌트는 화살표 함수
- `export default`
- props는 함수 인자에서 바로 구조분해하지 않고, 함수 본문 첫 줄에서 구조분해
- 내부 핸들러는 `handle*`
- props callback은 `on*`
- business logic 금지
- 금지 패턴:
  - `useEffect(`
  - `fetch(`
  - `axios.`
  - `useQuery(`
  - `useMutation(`

### Allowed UI State

- toggle
- sidebar
- accordion
- modal open/close
- tab/panel selection

### Guidance

- `components/common`은 2개 이상 page/domain에서 재사용될 때 사용
- 특정 domain 전용은 `components/{domain}`
- 하위 UI 컴포넌트는 부모 폴더 아래에 둘 수 있음
- 예:
  - `components/common/table/index.tsx`
  - `components/common/table/th/index.tsx`
  - `page/homePage/index.tsx`

### Template Shape

```tsx
interface HomePageProps {}

const HomePage = (props: HomePageProps) => {
  const {} = props;

  return <div />;
};

export default HomePage;
```

빈 props라도 v1 기본 템플릿에는 `Props` 인터페이스를 함께 둔다.

## Frontend Personal v1

frontend는 hooks와 API integration, business logic를 담당한다.

### Command Surface

- `tcf hook <Name> --path <path>`
- `tcf apiHook <Name> --path <path> --kind query|mutation`
- `tcf type <Name> --path <path> [--kind interface|type]`
- `tcf validate <target>`
- `tcf --help`
- `tcf --help --text`

### Enforced

- `hook` 생성 시 `--path` 필수
- hook 이름은 반드시 `use*`
- 출력 파일 패턴은 `{path}/{name}/index.ts`
- path segment는 `camelCase`
- hook은 화살표 함수
- `export default`
- API hook은 TanStack Query 기반

### Placement Rules

- API hook:
  - `hooks/apis/{domain}/queries/{hookName}/index.ts`
  - `hooks/apis/{domain}/mutations/{hookName}/index.ts`
- API 외 재사용 business hook:
  - `hooks/utils/{hookName}/index.ts`
- page 전용 hook:
  - `{pagePath}/hooks/{hookName}/index.ts`
- component 전용 hook:
  - `components/{path}/hooks/{hookName}/index.ts`

예:

- `hooks/apis/product/queries/useGetProduct/index.ts`
- `hooks/apis/product/mutations/useCreateProduct/index.ts`
- `hooks/utils/useScroll/index.ts`
- `components/common/toggle/hooks/useToggle/index.ts`
- `app/profilePage/hooks/useProfileForm/index.ts`

### Guidance

- component/page 전용 hook이 재사용되기 시작하면 `hooks/utils`로 이동
- API hook naming 예:
  - `useGetProduct`
  - `useGetProducts`
  - `useCreateProduct`
  - `useUpdateProduct`
  - `useDeleteProduct`
- API endpoint constants는 `VERB_RESOURCE`

### Template Shape

```ts
const useScroll = () => {
  return {};
};

export default useScroll;
```

`apiHook`은 query와 mutation 각각 TanStack Query 템플릿을 가진다.

## Backend Personal v1

backend는 `tcb`로 다룬다. 여기서는 Spring Boot + Spring MVC 기준 개인 초안을 정의한다.

### Source-backed defaults

아래 항목은 Spring 공식 문서에서 직접 확인한 내용이다.

- Spring Boot는 특정 코드 레이아웃을 강제하지 않지만 best practice를 제안한다.
- default package는 피해야 한다.
- 메인 application class는 다른 클래스보다 위의 root package에 두는 것을 권장한다.
- domain 기반 구조를 강제하고 싶다면 Spring Modulith를 볼 수 있다고 안내한다.
- Spring MVC는 `@Valid`, `@Validated`를 통한 built-in validation을 제공한다.
- validation 오류는 `MethodArgumentNotValidException`, `HandlerMethodValidationException`을 모두 고려해야 한다.
- REST error response는 `ProblemDetail`, `ErrorResponse`, `ResponseEntityExceptionHandler`, `@ControllerAdvice`를 중심으로 구성할 수 있다.

### Inferred v1 choices

아래는 위 공식 문서와 일반적인 Spring 실무 관례를 바탕으로 한 v1 제안이다.

- package-by-feature를 기본으로 둔다.
- Java package 경로는 frontend/publisher와 달리 lower-case를 사용한다.
- feature 내부에서 `controller`, `service`, `dto`, `entity`, `repository`를 나눈다.
- request DTO와 response DTO를 분리한다.
- controller에서는 `@Valid`를 우선 사용한다.
- validation과 exception handling은 `@ControllerAdvice`를 중심으로 통합한다.
- RFC 9457 형태의 에러 응답을 기본 방향으로 둔다.

### Command Surface

- `tcb module <Name> --path <path>`
- `tcb requestDto <Name> --path <path>`
- `tcb responseDto <Name> --path <path>`
- `tcb entity <Name> --path <path>`
- `tcb validate <target>`
- `tcb --help`
- `tcb --help --text`

### Enforced

- `module` 생성 시 `--path` 필수
- path는 root package 아래 상대 package path로 해석
- backend package path segment는 lower-case
- 클래스 이름은 PascalCase
- 메인 application class는 root package 상단에 위치해야 함
- feature 구조 기본 패턴:
  - `{basePackage}/{feature}/controller`
  - `{basePackage}/{feature}/service`
  - `{basePackage}/{feature}/dto`
  - `{basePackage}/{feature}/entity`
  - `{basePackage}/{feature}/repository`
- request DTO는 `@Valid` 기반 validation 대상
- exception advice 템플릿은 `@ControllerAdvice` + `ResponseEntityExceptionHandler` 기준

### Guidance

- domain 별 package-by-feature를 기본으로 둔다.
- 너무 초기에는 feature 내부 계층을 얕게 유지할 수 있다.
- 메서드 파라미터 validation과 `@RequestBody` validation은 둘 다 고려한다.
- `MethodArgumentNotValidException`와 `HandlerMethodValidationException`를 함께 처리한다.

### Example Layout

```text
src/main/java/com/example/app/
  AppApplication.java
  product/
    controller/
      ProductController.java
    service/
      ProductService.java
    dto/
      CreateProductRequest.java
      ProductResponse.java
    entity/
      Product.java
    repository/
      ProductRepository.java
  global/
    exception/
      GlobalExceptionHandler.java
```

## Help Contract

`--help` 기본 출력은 JSON이다.

- `tcp --help`
- `tcf --help`
- `tcb --help`

사람용은 `--text`로 렌더링한다.

- `tcp --help --text`
- `tcf --help --text`
- `tcb --help --text`

### JSON Shape Draft

```json
{
  "id": "publisher/personal/v1",
  "alias": "tcp",
  "version": "v1",
  "extends": ["shared/personal/v1"],
  "commands": [
    {
      "name": "component",
      "description": "Generate a UI component",
      "requiredArgs": ["name", "path"],
      "outputPattern": "{path}/index.tsx",
      "enforcedRules": [
        "path.segmentCase=camelCase",
        "component.name=PascalCase",
        "functionStyle=arrow",
        "exportStyle=default",
        "propsDestructure=insideBody"
      ],
      "forbiddenPatterns": [
        "useEffect(",
        "fetch(",
        "axios.",
        "useQuery(",
        "useMutation("
      ],
      "examples": [
        "tcp component HomePage --path page/homePage",
        "tcp component Table --path components/common/table"
      ]
    }
  ]
}
```

이 JSON이 source of truth가 되고, `--help --text`는 이 JSON을 사람이 읽기 좋은 형태로 렌더링한다.

## Generate vs Validate Responsibilities

### Generate

- 폴더 생성
- 파일 생성
- 규칙에 맞는 기본 템플릿 생성
- 이름과 path 검증
- 금지 규칙 위반 시 생성 실패

### Validate

- 현재 파일/폴더가 active profile 규칙을 따르는지 검사
- path 규칙 위반 탐지
- 이름 규칙 위반 탐지
- publisher business logic 금지 패턴 탐지
- frontend API hook path 규칙 위반 탐지
- backend package path 및 feature layout 위반 탐지

## Acceptance Criteria

- `shared/personal/v1`가 공통 네이밍과 type placement 규칙을 가진다.
- `publisher/personal/v1`는 `component`, `type` 생성 규칙을 가진다.
- `frontend/personal/v1`는 `hook`, `apiHook`, `type` 생성 규칙을 가진다.
- `backend/personal/v1`는 Spring 기준 `module`, `requestDto`, `responseDto`, `entity` 초안을 가진다.
- `--help` 기본 출력은 JSON이다.
- `--help --text`가 가능하다.
- `publisher`는 `useEffect` 포함 business logic를 금지한다.
- `frontend`는 hook을 화살표 함수 + `export default`로 생성한다.
- frontend/publisher path segment는 `camelCase`다.
- backend package path segment는 lower-case다.

## Open Questions

- `tcb`의 `service`, `controller`, `repository`, `exceptionAdvice`를 개별 명령으로도 노출할지 아직 미정이다.
- `type` 명령의 로컬 타입 생성까지 CLI에 포함할지는 보류한다.
- barrel export 자동 생성은 v1에 넣지 않았다.
- 기존 파일을 새 version 규칙으로 옮기는 `migrate` 명령은 별도 후속 범위다.

## References

Local references:

- `plugin/skills/ui-publish/references/coding-rules.md`
- `plugin/skills/frontend-dev/references/coding-rules.md`
- `plugin/references/design/components.md`
- `plugin/references/design/pages.md`

Official Spring references:

- Spring Boot, Structuring Your Code: https://docs.spring.io/spring-boot/reference/using/structuring-your-code.html
- Spring Framework, Validation: https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html
- Spring Framework, Error Responses: https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html

