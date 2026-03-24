# Git Commit Conventions

> This document covers only judgment-required rules that ESLint and Prettier cannot enforce automatically.
> Mechanical rules are handled separately by coding-rules setup and review flow.

---

## Commit Message Guidelines

### Subject Line

- Use English only
- Keep the subject within 50 characters
- Use the imperative mood such as `add`, `fix`, `update`
- Keep one commit focused on one purpose

### Body

- Leave one blank line between subject and body
- Describe changes specifically
- Use bullet points with `-`
- The body may be written in any language

Example:

```text
feat: add goal archive functionality

- Create archive page component
- Add archive API hook (useGetArchivedGoals)
- Update navigation with archive link
```

### Footer

- Use `BREAKING CHANGE:` for compatibility-breaking changes
- Use issue references like `Closes #123` or `Refs #456`

Example:

```text
BREAKING CHANGE: Legacy token authentication is no longer supported

Closes #123
```

---

## Branch Naming

### Format

```text
Single-track: {type}/{feature-summary}
Parallel-track: {type}/{feature-summary}-{track}
```

### Type Examples

```text
feat/{feature-summary}
refactor/{work-summary}
fix/{bug-summary}
style/{work-summary}
chore/{work-summary}
docs/{work-summary}
test/{work-summary}
```

### Rules

- A type prefix is required
- Use kebab-case only
- Use exactly one slash (`/`) in the branch name

Examples:

```text
O  feat/add-archive-page
X  add-archive-page
X  feat/add_archive_page
X  feat/AddArchivePage
```

---

## Worktree Naming

### Format

```text
{branch-name with "/" replaced by "-"}
```

### Rules

- Derive the worktree directory name from the branch name
- Replace every `/` in the branch name with `-`
- Do not invent a second summary; keep branch and worktree names mechanically linked

Examples:

```text
Branch:   feat/add-archive-page
Worktree: feat-add-archive-page

Branch:   refactor/dev-cli-contract-core
Worktree: refactor-dev-cli-contract-core
```
