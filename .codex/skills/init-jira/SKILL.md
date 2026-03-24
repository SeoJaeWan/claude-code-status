---
name: init-jira
description: Install and verify Atlassian Jira MCP for Codex CLI. Use when a user wants to add Jira or Atlassian MCP to Codex, migrate an existing Jira MCP setup from Claude project config, register the `atlassian-rovo` server, complete OAuth login, or troubleshoot why Jira MCP is missing in Codex.
---

# Init Jira

## Overview

Register Atlassian's Jira MCP endpoint with Codex, complete OAuth login, and verify that Codex can use the server.
Prefer Codex's MCP registry over project `.mcp.json` when the goal is to make Jira available inside Codex CLI.

## Workflow

1. Check the current Codex MCP state before changing anything.
2. Reuse an existing Atlassian MCP URL if the user already has one in a Claude project config.
3. Add or repair the Codex MCP entry.
4. Run OAuth login.
5. Verify the result and explain any session restart requirement.

## Step 1. Inspect Existing State

Start by checking whether Jira MCP is already registered:

```bash
codex mcp list
codex mcp get atlassian-rovo
```

If the user is migrating from a Claude-based setup, inspect the repository for an existing `.mcp.json` and look for an Atlassian or Jira MCP URL there.
Treat that file as a source of truth for the endpoint only. Do not assume Codex reads it automatically.

## Step 2. Add Jira MCP to Codex

Use the Atlassian MCP endpoint:

```bash
codex mcp add atlassian-rovo --url https://mcp.atlassian.com/v1/mcp
```

Rules:

- Use `atlassian-rovo` as the default server name unless the user already has a team-standard name.
- If `atlassian-rovo` already exists and the URL is correct, do not remove and recreate it.
- If the existing entry is wrong and the user wants it fixed, replace it with:

```bash
codex mcp remove atlassian-rovo
codex mcp add atlassian-rovo --url https://mcp.atlassian.com/v1/mcp
```

- Prefer the HTTP URL form for Jira MCP. This avoids OS-specific `cmd /c` launcher issues that apply to stdio servers.

## Step 3. Complete OAuth Login

Run:

```bash
codex mcp login atlassian-rovo
```

Expect a browser-based OAuth flow. If the command opens a browser or waits for user authorization, explain that this is expected and wait for the user to complete it.

## Step 4. Verify Registration

After login, verify the server:

```bash
codex mcp list
codex mcp get atlassian-rovo
```

Confirm:

- the server is `enabled`
- the URL is `https://mcp.atlassian.com/v1/mcp`
- the auth state is no longer `Not logged in`

## Step 5. Explain Where Codex Stored the Config

Tell the user that Codex stores this registration in:

```text
~/.codex/config.toml
```

If the user asks why their Claude repo setup does not automatically carry over, explain:

- Claude workflows often use project `.mcp.json`
- Codex MCP registration is managed through `codex mcp ...`
- adding the server updates Codex's own config rather than the repository config

## Troubleshooting

### Server added but Jira tools do not appear

Explain that the current Codex session may need to restart or reload after MCP changes.

### `Not logged in` remains after add

Run the login step again:

```bash
codex mcp login atlassian-rovo
```

### The user wants the same endpoint copied from a Claude project

Read the repo `.mcp.json`, extract the Atlassian URL, then register that URL with `codex mcp add`.

### The user wants project-local files edited too

Only edit `.mcp.json` or onboarding docs when the user explicitly asks for repository documentation or team-sharing changes.

## Output Expectations

- Report the exact commands that were run.
- State whether registration succeeded, whether login is still required, and whether the current session needs a restart.
- If nothing was changed because the server already existed, say so explicitly.

Keep the skill lean. No extra resource directories are required unless future Jira setup needs reusable scripts or reference docs.
