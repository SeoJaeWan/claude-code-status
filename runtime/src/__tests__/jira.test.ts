/**
 * jira.test.ts
 *
 * Unit tests for Jira adapter parsing logic:
 * - JQL result parsing (multiple response shapes)
 * - Error classification
 */

import { describe, it, expect } from 'vitest';
import type { ErrorKind } from '../types';

// ---------------------------------------------------------------------------
// Inline the parsing logic from collectors/jira.ts for pure unit testing
// ---------------------------------------------------------------------------

function parseIssueCount(raw: string): number {
  const parsed = JSON.parse(raw) as unknown;

  if (typeof parsed === 'object' && parsed !== null && 'total' in parsed) {
    const total = (parsed as { total: unknown }).total;
    if (typeof total === 'number') return total;
  }

  if (typeof parsed === 'object' && parsed !== null && 'issues' in parsed) {
    const issues = (parsed as { issues: unknown }).issues;
    if (Array.isArray(issues)) return issues.length;
  }

  if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
    const data = (parsed as { data: unknown }).data;
    if (typeof data === 'object' && data !== null && 'total' in data) {
      const total = (data as { total: unknown }).total;
      if (typeof total === 'number') return total;
    }
  }

  throw new Error(`Unrecognized acli output format: ${raw.slice(0, 200)}`);
}

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
// Tests: JQL result parsing
// ---------------------------------------------------------------------------

describe('parseIssueCount', () => {
  it('parses { total: N } shape', () => {
    const raw = JSON.stringify({ total: 5, issues: [] });
    expect(parseIssueCount(raw)).toBe(5);
  });

  it('prefers total over issues array length when both present', () => {
    const raw = JSON.stringify({ total: 10, issues: [{}] });
    expect(parseIssueCount(raw)).toBe(10);
  });

  it('falls back to issues array length when total is missing', () => {
    const raw = JSON.stringify({ issues: [{}, {}, {}] });
    expect(parseIssueCount(raw)).toBe(3);
  });

  it('parses { data: { total: N } } nested shape', () => {
    const raw = JSON.stringify({ data: { total: 7 } });
    expect(parseIssueCount(raw)).toBe(7);
  });

  it('handles total === 0', () => {
    const raw = JSON.stringify({ total: 0 });
    expect(parseIssueCount(raw)).toBe(0);
  });

  it('handles empty issues array', () => {
    const raw = JSON.stringify({ issues: [] });
    expect(parseIssueCount(raw)).toBe(0);
  });

  it('throws for unrecognized shape', () => {
    const raw = JSON.stringify({ something_else: true });
    expect(() => parseIssueCount(raw)).toThrow('Unrecognized acli output format');
  });

  it('throws for invalid JSON', () => {
    expect(() => parseIssueCount('not json')).toThrow();
  });

  it('handles total as large number', () => {
    const raw = JSON.stringify({ total: 1234 });
    expect(parseIssueCount(raw)).toBe(1234);
  });
});

// ---------------------------------------------------------------------------
// Tests: error classification
// ---------------------------------------------------------------------------

describe('classifyError (jira)', () => {
  it('classifies acli not found as dependency', () => {
    const { errorKind } = classifyError(new Error('acli: command not found'));
    expect(errorKind).toBe('dependency');
  });

  it('classifies executable file not found as dependency', () => {
    const { errorKind } = classifyError(new Error('executable file not found in PATH'));
    expect(errorKind).toBe('dependency');
  });

  it('classifies "not logged in" as auth', () => {
    const { errorKind } = classifyError(new Error('You are not logged in'));
    expect(errorKind).toBe('auth');
  });

  it('classifies 401 as auth', () => {
    const { errorKind } = classifyError(new Error('401 Unauthorized'));
    expect(errorKind).toBe('auth');
  });

  it('classifies 403 as auth', () => {
    const { errorKind } = classifyError(new Error('403 Forbidden'));
    expect(errorKind).toBe('auth');
  });

  it('classifies "authentication" keyword as auth', () => {
    const { errorKind } = classifyError(new Error('Authentication token expired'));
    expect(errorKind).toBe('auth');
  });

  it('classifies 429 as rate_limit', () => {
    const { errorKind } = classifyError(new Error('429 Too Many Requests'));
    expect(errorKind).toBe('rate_limit');
  });

  it('classifies ENOTFOUND as transient', () => {
    const { errorKind } = classifyError(new Error('ENOTFOUND your.jira.host'));
    expect(errorKind).toBe('transient');
  });

  it('classifies timeout as transient', () => {
    const { errorKind } = classifyError(new Error('Request timeout after 30s'));
    expect(errorKind).toBe('transient');
  });

  it('classifies unknown as unknown', () => {
    const { errorKind } = classifyError(new Error('Some weird error 0xdeadbeef'));
    expect(errorKind).toBe('unknown');
  });

  it('handles non-Error string argument', () => {
    const { errorKind } = classifyError('401');
    expect(errorKind).toBe('auth');
  });
});
