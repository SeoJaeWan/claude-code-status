/**
 * collectors/jira.ts
 *
 * Jira issue collector.
 *
 * Strategy:
 *  - Uses `acli jira` CLI (Atlassian CLI) to execute a JQL query.
 *  - JQL: assignee = currentUser() AND statusCategory != Done
 *  - Extracts the total issue count from the CLI output.
 *  - Checks login status before fetching.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/jira.json.
 *
 * TTL: 1 minute.
 */

import { execSync } from 'child_process';
import type { CollectorResult, CollectorItem, ErrorKind } from '../types';
import { writeCacheFile } from '../coordinator';

const SERVICE = 'jira';
const TTL_MS = 60_000; // 1 minute

const JQL = 'assignee = currentUser() AND statusCategory != Done';

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(err: unknown): { errorKind: ErrorKind; detail: string } {
  const msg = err instanceof Error ? err.message : String(err);

  if (/acli.*not found|command not found|executable file not found/i.test(msg)) {
    return { errorKind: 'dependency', detail: `acli CLI not found or not installed: ${msg}` };
  }

  if (/not.*logged in|authentication|401|403|unauthorized|forbidden/i.test(msg)) {
    return { errorKind: 'auth', detail: `Jira authentication failed: ${msg}` };
  }

  if (/429|rate.?limit/i.test(msg)) {
    return { errorKind: 'rate_limit', detail: `Jira rate limit exceeded: ${msg}` };
  }

  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network|socket|timeout/i.test(msg)) {
    return { errorKind: 'transient', detail: `Network error: ${msg}` };
  }

  return { errorKind: 'unknown', detail: msg };
}

// ---------------------------------------------------------------------------
// Check acli availability and login status
// ---------------------------------------------------------------------------

function checkAcliAuth(): void {
  try {
    execSync('acli jira --help', { stdio: 'pipe', timeout: 10_000, windowsHide: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/command not found|executable file not found|ENOENT/i.test(msg)) {
      throw new Error('acli CLI not installed or not found in PATH');
    }
  }
}

// ---------------------------------------------------------------------------
// Jira API response types
// ---------------------------------------------------------------------------

interface JiraIssue {
  key: string;
  self: string;
  fields: {
    summary?: string;
    priority?: { name?: string };
    status?: { name?: string };
  };
}

// ---------------------------------------------------------------------------
// Fetch issues with details via workitem search --json
// ---------------------------------------------------------------------------

function fetchIssues(): JiraIssue[] {
  let raw: string;
  try {
    raw = execSync(
      `acli jira workitem search --jql "${JQL.replace(/"/g, '\\"')}" --fields "key,summary,priority,status" --json`,
      { encoding: 'utf8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Unexpected response format');
    }
    return parsed as JiraIssue[];
  } catch {
    throw new Error(`Could not parse acli JSON output: ${raw.slice(0, 200)}`);
  }
}

function issuesToItems(issues: JiraIssue[]): CollectorItem[] {
  return issues.map((issue) => {
    // Derive browse URL from self URL: https://<site>.atlassian.net/rest/api/3/issue/123 -> https://<site>.atlassian.net/browse/WEB-434
    const siteMatch = issue.self?.match(/^(https:\/\/[^/]+)/);
    const siteUrl = siteMatch ? siteMatch[1] : null;
    const link = siteUrl ? `${siteUrl}/browse/${issue.key}` : null;

    return {
      title: issue.fields?.summary ?? issue.key,
      link,
      meta: {
        key: issue.key,
        priority: issue.fields?.priority?.name ?? null,
        status: issue.fields?.status?.name ?? null,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------

export async function collect(): Promise<void> {
  const now = new Date().toISOString();

  let result: CollectorResult;

  try {
    // 1. Verify acli is available and authenticated
    checkAcliAuth();

    // 2. Execute JQL and get issues with details
    const issues = fetchIssues();
    const items = issuesToItems(issues);

    result = {
      value: issues.length,
      status: 'ok',
      fetchedAt: now,
      ttlMs: TTL_MS,
      errorKind: null,
      detail: null,
      source: SERVICE,
      items,
    };
  } catch (err) {
    const { errorKind, detail } = classifyError(err);
    result = {
      value: null,
      status: 'error',
      fetchedAt: now,
      ttlMs: TTL_MS,
      errorKind,
      detail,
      source: SERVICE,
    };
  }

  writeCacheFile(SERVICE, result);
}
