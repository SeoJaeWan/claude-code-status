# Testing Conventions Reference

Inline reference for `plan-unit-test`. Use this to turn plan constraints into executable logic specifications.

Follow the current project's test stack and file conventions. If the repository does not make the stack clear, ask the user before generating files.

---

## Test Spec Rules

- `describe`: subject under test at the logic boundary (hook, validator, mapper, service, use case, controller method, domain policy)
- `it`: Korean behavioral spec + constraint ID when applicable (`[C-...]`)
- `AAA pattern`: Every test must include `// Arrange`, `// Act`, `// Assert`
- Write tests as contracts for required logic, not as the smallest assertions needed to get a green result
- If a defensive case is inferred from the constraint rather than written verbatim in `plan.md`, still map it to the same constraint and name the behavior explicitly

```typescript
describe('SignupPolicy', () => {
  it('[C-AUTH-001] 유효한 입력이면 회원 가입을 완료한다', async () => {
    // Arrange
    const request = { email: 'test@example.com', password: 'Password123!' };

    // Act
    const result = await subject.execute(request);

    // Assert
    expect(result.status).toBe('success');
  });

  it('[C-AUTH-001] 이미 사용 중인 이메일이면 중복 오류를 반환한다', async () => {
    // Arrange
    const request = { email: 'used@example.com', password: 'Password123!' };

    // Act
    const result = await subject.execute(request);

    // Assert
    expect(result.code).toBe('EMAIL_ALREADY_USED');
  });
});
```

---

## Scenario Categories

Every constraint should be expanded into scenario categories, not copied literally from `plan.md` only.

- **Expected behavior**: the primary success path the constraint promises
- **Defensive failure/validation**: invalid input, rejected preconditions, unauthorized access, domain rule violations
- **Edge/boundary**: null or empty values, min/max, duplicates, ordering, idempotency, collection size, format boundaries
- **Exception/recovery**: dependency failure, parse or serialization failure, timeout, rollback, partial update prevention

If a category truly does not apply, record that decision in `manifest.md` instead of silently omitting it.

---

## Choosing the Test Boundary

| Target                             | Recommended method                                   | Notes                                                                      |
| ---------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Utility / validator / mapper       | Direct call                                          | Prefer the narrowest pure logic boundary                                   |
| Service / use case / domain policy | Direct call with stubbed collaborators               | Verify business rules and state transitions                                |
| Hook / composable                  | Exercise the public API with the repo's hook harness | Validate exposed state and events, not internals                           |
| Component with meaningful logic    | Render through public props and events               | Use only when the logic cannot be verified at a lower boundary             |
| Controller / endpoint adapter      | Thin boundary test                                   | Use when request mapping, status mapping, or exception translation matters |

---

## Stack Detection and Conventions

- Inspect local test and build config before choosing a test framework
- Mirror the repo's current runner, assertion style, mocking style, and file layout
- Typical signals: `package.json`, `vitest.config.*`, `jest.config.*`, `pom.xml`, `build.gradle*`, `mvnw`, `gradlew`, existing test files
- If the stack or file convention is unclear, stop and ask the user before generating tests
- Do not default to Vitest, Jest, JUnit, Spring, Nest, or any other stack without local evidence

### Common stack examples (non-normative)

| Repo already indicates | Common choices in that ecosystem                |
| ---------------------- | ----------------------------------------------- |
| React / Next.js        | Vitest + Testing Library + happy-dom or jsdom   |
| NestJS                 | Jest + Nest testing utilities + Supertest       |
| Java / Spring          | JUnit 5 + Mockito + Spring Boot Test or MockMvc |

These are examples only. Use them only when the repository already points to that ecosystem.

---

## Mocking

- Mock external boundaries only
- Use the mocking tool already established by the repo
- Example tools by stack: `vi.fn()`, `jest.fn()`, Mockito, MSW, MockMvc, WireMock
- Do not mock implementation internals just to make tests easier to pass

---

## File Location Convention

- Determine the final destination layout from the project during implementation
- Keep planning artifacts flat under `plans/{task-name}/tests/`
- Record placement intent and implementation placement rules in `manifest.md`
- If the repo has no clear convention, ask the user instead of inventing one
- If the task is split into multiple sequential plan folders, generate files under the owning plan folder's `tests/`

Examples:

- Planning artifact names: `use-login.test.ts`, `auth-service.test.ts`
- Java / Spring planning artifact names: `AuthServiceTest.java`

### Hook-specific convention (default)

- Treat each hook as its own test boundary
- Use one flat planning artifact per hook boundary
- Use concise test filename derived from the hook name
- Do not group unrelated hooks into one planning artifact unless the repository already enforces that pattern

---

## Independence

- Each test must be runnable in isolation
- Sharing state between tests is prohibited
- Use setup hooks only for repeatable fixture preparation, not for hidden cross-test coupling
