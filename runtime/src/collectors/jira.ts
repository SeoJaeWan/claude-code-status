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
 * TTL: 5 minutes.
 */

import { execSync } from 'child_process';
import type { CollectorResult, ErrorKind } from '../types';
import { writeCacheFile } from '../coordinator';

const SERVICE = 'jira';
const TTL_MS = 5 * 60_000; // 5 minutes

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
  // Verify acli is installed by running a lightweight command
  try {
    execSync('acli jira --version', { stdio: 'pipe', timeout: 10_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/command not found|executable file not found/i.test(msg)) {
      throw new Error('acli CLI not installed or not found in PATH');
    }
    // acli --version may exit non-zero on some versions but still works;
    // proceed and let the actual query surface auth errors.
  }
}

// ---------------------------------------------------------------------------
// Execute JQL and extract count
// ---------------------------------------------------------------------------

function fetchIssueCount(): number {
  // acli jira issue list outputs JSON with --outputFormat json
  // We use --jql to pass the query and --maxResults 0 to get just the total
  let raw: string;
  try {
    raw = execSync(
      `acli jira issue list --jql "${JQL.replace(/"/g, '\\"')}" --outputFormat json --maxResults 1`,
      { encoding: 'utf8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (err) {
    // acli may exit non-zero on auth failure; capture and rethrow with message
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg);
  }

  // Parse response — acli returns an object with a `total` field
  // Expected shape: { total: number, issues: [...] }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'total' in parsed) {
      const total = (parsed as { total: unknown }).total;
      if (typeof total === 'number') return total;
    }

    // Fallback: count the issues array length if total is missing
    if (typeof parsed === 'object' && parsed !== null && 'issues' in parsed) {
      const issues = (parsed as { issues: unknown }).issues;
      if (Array.isArray(issues)) return issues.length;
    }

    // Some acli versions wrap in a "data" key
    if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
      const data = (parsed as { data: unknown }).data;
      if (typeof data === 'object' && data !== null && 'total' in data) {
        const total = (data as { total: unknown }).total;
        if (typeof total === 'number') return total;
      }
    }

    throw new Error(`Unrecognized acli output format: ${raw.slice(0, 200)}`);
  } catch (parseErr) {
    if (parseErr instanceof SyntaxError) {
      // acli may not have returned JSON — check for auth error text
      if (/not.*logged in|authentication|unauthorized/i.test(raw)) {
        throw new Error(`Jira authentication failed (acli): ${raw.slice(0, 200)}`);
      }
      throw new Error(`Failed to parse acli output: ${raw.slice(0, 200)}`);
    }
    throw parseErr;
  }
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

    // 2. Execute JQL and get count
    const count = fetchIssueCount();

    result = {
      value: count,
      status: 'ok',
      fetchedAt: now,
      ttlMs: TTL_MS,
      errorKind: null,
      detail: null,
      source: SERVICE,
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
