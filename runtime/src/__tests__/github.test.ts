/**
 * github.test.ts
 *
 * Unit tests for GitHub adapter parsing logic:
 * - Thread deduplication
 * - PullRequest type filtering
 * - Error classification
 */

import { describe, it, expect } from 'vitest';
import type { ErrorKind } from '../types';

// ---------------------------------------------------------------------------
// Inline the parsing logic from collectors/github.ts for pure unit testing
// (avoids execSync side effects in tests)
// ---------------------------------------------------------------------------

interface GitHubNotificationSubject {
  type: string;
  title: string;
  url: string | null;
  latest_comment_url: string | null;
}

interface GitHubNotification {
  id: string;
  unread: boolean;
  subject: GitHubNotificationSubject;
  reason: string;
  updated_at: string;
}

function filterAndDedup(notifications: GitHubNotification[]): number {
  const unreadPrNotifications = notifications.filter(
    (n) => n.unread && n.subject?.type === 'PullRequest',
  );
  const uniqueThreadIds = new Set<string>(unreadPrNotifications.map((n) => n.id));
  return uniqueThreadIds.size;
}

function classifyError(err: unknown): { errorKind: ErrorKind; detail: string } {
  const msg = err instanceof Error ? err.message : String(err);

  if (/gh CLI not installed/i.test(msg) ||
      /gh: command not found/i.test(msg) ||
      (/executable file not found/i.test(msg) && !/gh auth/i.test(msg))) {
    return { errorKind: 'dependency', detail: `gh CLI not found or not installed: ${msg}` };
  }

  if (/gh auth failed|invalid.*token|The token.*invalid|not.*authenticated|not.*logged in/i.test(msg)) {
    return { errorKind: 'auth', detail: `GitHub not authenticated: ${msg}` };
  }

  if (/401|403|authentication|credentials|token/i.test(msg)) {
    return { errorKind: 'auth', detail: `GitHub authentication failed: ${msg}` };
  }

  if (/429|rate.?limit/i.test(msg)) {
    return { errorKind: 'rate_limit', detail: `GitHub rate limit exceeded: ${msg}` };
  }

  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network|socket/i.test(msg)) {
    return { errorKind: 'transient', detail: `Network error: ${msg}` };
  }

  return { errorKind: 'unknown', detail: msg };
}

// ---------------------------------------------------------------------------
// Mock notification factory
// ---------------------------------------------------------------------------

function makeNotification(
  overrides: Partial<GitHubNotification> & { id: string },
): GitHubNotification {
  return {
    id: overrides.id,
    unread: overrides.unread ?? true,
    subject: overrides.subject ?? { type: 'PullRequest', title: 'PR title', url: null, latest_comment_url: null },
    reason: overrides.reason ?? 'review_requested',
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests: filterAndDedup
// ---------------------------------------------------------------------------

describe('filterAndDedup', () => {
  it('returns 0 for an empty notifications array', () => {
    expect(filterAndDedup([])).toBe(0);
  });

  it('counts a single unread PR notification', () => {
    const notifications = [makeNotification({ id: '1' })];
    expect(filterAndDedup(notifications)).toBe(1);
  });

  it('deduplicates multiple entries with the same thread id', () => {
    // Same thread id but different reason (e.g. review_requested + mention)
    const notifications = [
      makeNotification({ id: '42' }),
      makeNotification({ id: '42' }),
    ];
    expect(filterAndDedup(notifications)).toBe(1);
  });

  it('counts multiple distinct PR threads', () => {
    const notifications = [
      makeNotification({ id: '1' }),
      makeNotification({ id: '2' }),
      makeNotification({ id: '3' }),
    ];
    expect(filterAndDedup(notifications)).toBe(3);
  });

  it('excludes read notifications (unread: false)', () => {
    const notifications = [
      makeNotification({ id: '1', unread: false }),
      makeNotification({ id: '2', unread: true }),
    ];
    expect(filterAndDedup(notifications)).toBe(1);
  });

  it('excludes non-PullRequest subject types', () => {
    const notifications = [
      makeNotification({
        id: '1',
        subject: { type: 'Issue', title: 'Bug', url: null, latest_comment_url: null },
      }),
      makeNotification({
        id: '2',
        subject: { type: 'Commit', title: 'Fix', url: null, latest_comment_url: null },
      }),
      makeNotification({ id: '3' }), // PullRequest
    ];
    expect(filterAndDedup(notifications)).toBe(1);
  });

  it('handles a mix of read, non-PR, and duplicate PR notifications', () => {
    const notifications = [
      makeNotification({ id: '10' }),                          // unread PR — counts
      makeNotification({ id: '10' }),                          // duplicate — deduped
      makeNotification({ id: '11', unread: false }),           // read — excluded
      makeNotification({                                        // Issue — excluded
        id: '12',
        subject: { type: 'Issue', title: 'Bug', url: null, latest_comment_url: null },
      }),
      makeNotification({ id: '13' }),                          // unread PR — counts
    ];
    expect(filterAndDedup(notifications)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: classifyError
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  it('classifies gh CLI not installed as dependency error', () => {
    const { errorKind } = classifyError(new Error('gh CLI not installed'));
    expect(errorKind).toBe('dependency');
  });

  it('classifies command not found as dependency error', () => {
    const { errorKind } = classifyError(new Error('executable file not found in PATH'));
    expect(errorKind).toBe('dependency');
  });

  it('classifies auth failed message as auth error', () => {
    const { errorKind } = classifyError(new Error('gh auth failed: credentials invalid'));
    expect(errorKind).toBe('auth');
  });

  it('classifies HTTP 401 as auth error', () => {
    const { errorKind } = classifyError(new Error('Request failed with status 401'));
    expect(errorKind).toBe('auth');
  });

  it('classifies HTTP 403 as auth error', () => {
    const { errorKind } = classifyError(new Error('403 Forbidden'));
    expect(errorKind).toBe('auth');
  });

  it('classifies "not authenticated" as auth error', () => {
    const { errorKind } = classifyError(new Error('You are not authenticated'));
    expect(errorKind).toBe('auth');
  });

  it('classifies 429 as rate_limit', () => {
    const { errorKind } = classifyError(new Error('429 Too Many Requests'));
    expect(errorKind).toBe('rate_limit');
  });

  it('classifies rate limit message as rate_limit', () => {
    const { errorKind } = classifyError(new Error('API rate limit exceeded'));
    expect(errorKind).toBe('rate_limit');
  });

  it('classifies ENOTFOUND as transient', () => {
    const { errorKind } = classifyError(new Error('ENOTFOUND api.github.com'));
    expect(errorKind).toBe('transient');
  });

  it('classifies ETIMEDOUT as transient', () => {
    const { errorKind } = classifyError(new Error('ETIMEDOUT'));
    expect(errorKind).toBe('transient');
  });

  it('classifies unknown errors as unknown', () => {
    const { errorKind } = classifyError(new Error('Some unexpected error XYZ'));
    expect(errorKind).toBe('unknown');
  });

  it('handles string errors (non-Error objects)', () => {
    const { errorKind } = classifyError('ENOTFOUND something');
    expect(errorKind).toBe('transient');
  });
});
