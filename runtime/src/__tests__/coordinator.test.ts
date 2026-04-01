/**
 * coordinator.test.ts
 *
 * Tests for cache TTL/stale detection, lock acquisition/release,
 * expired lock cleanup, and atomic cache writes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CollectorResult } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-test-'));
}

function rmRf(dir: string): void {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function makeResult(overrides: Partial<CollectorResult> = {}): CollectorResult {
  return {
    value: 5,
    status: 'ok',
    fetchedAt: new Date().toISOString(),
    ttlMs: 300_000,
    errorKind: null,
    detail: null,
    source: 'github',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isFresh — imported from cache.ts
// ---------------------------------------------------------------------------

import { isFresh } from '../cache';

describe('isFresh', () => {
  it('returns true when fetched recently within TTL', () => {
    const result = makeResult({ fetchedAt: new Date().toISOString(), ttlMs: 300_000 });
    expect(isFresh(result)).toBe(true);
  });

  it('returns false when fetchedAt is older than ttlMs', () => {
    const oldDate = new Date(Date.now() - 400_000).toISOString();
    const result = makeResult({ fetchedAt: oldDate, ttlMs: 300_000 });
    expect(isFresh(result)).toBe(false);
  });

  it('returns false when fetchedAt equals exactly ttlMs ago (boundary)', () => {
    const ttlMs = 90_000;
    const fetchedAt = new Date(Date.now() - ttlMs).toISOString();
    const result = makeResult({ fetchedAt, ttlMs });
    // now - fetchedAt === ttlMs → not strictly less → stale
    expect(isFresh(result)).toBe(false);
  });

  it('returns true when one ms before expiry', () => {
    const ttlMs = 90_000;
    const fetchedAt = new Date(Date.now() - ttlMs + 100).toISOString();
    const result = makeResult({ fetchedAt, ttlMs });
    expect(isFresh(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// readCache — integrated with temp filesystem
// ---------------------------------------------------------------------------

import { readCache, getCacheDir } from '../cache';

describe('readCache', () => {
  let tmpDir: string;
  const origEnv = process.env['CLAUDE_PLUGIN_DATA'];

  beforeEach(() => {
    tmpDir = makeTmpDir();
    process.env['CLAUDE_PLUGIN_DATA'] = tmpDir;
    fs.mkdirSync(path.join(tmpDir, 'cache'), { recursive: true });
  });

  afterEach(() => {
    rmRf(tmpDir);
    if (origEnv === undefined) {
      delete process.env['CLAUDE_PLUGIN_DATA'];
    } else {
      process.env['CLAUDE_PLUGIN_DATA'] = origEnv;
    }
  });

  it('returns null when cache file does not exist', () => {
    expect(readCache('github')).toBeNull();
  });

  it('returns null when CLAUDE_PLUGIN_DATA is unset', () => {
    delete process.env['CLAUDE_PLUGIN_DATA'];
    expect(readCache('github')).toBeNull();
  });

  it('parses a valid cache file', () => {
    const result = makeResult({ source: 'github', value: 4 });
    fs.writeFileSync(
      path.join(tmpDir, 'cache', 'github.json'),
      JSON.stringify(result),
      'utf8',
    );
    const cached = readCache('github');
    expect(cached).not.toBeNull();
    expect(cached?.value).toBe(4);
  });

  it('returns null for malformed JSON', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'cache', 'github.json'),
      'not valid json',
      'utf8',
    );
    expect(readCache('github')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// writeCacheFile + atomic rename
// ---------------------------------------------------------------------------

import { writeCacheFile } from '../coordinator';

describe('writeCacheFile', () => {
  let tmpDir: string;
  const origEnv = process.env['CLAUDE_PLUGIN_DATA'];

  beforeEach(() => {
    tmpDir = makeTmpDir();
    process.env['CLAUDE_PLUGIN_DATA'] = tmpDir;
  });

  afterEach(() => {
    rmRf(tmpDir);
    if (origEnv === undefined) {
      delete process.env['CLAUDE_PLUGIN_DATA'];
    } else {
      process.env['CLAUDE_PLUGIN_DATA'] = origEnv;
    }
  });

  it('creates cache directory if missing and writes file', () => {
    const result = makeResult({ value: 7, source: 'jira' });
    writeCacheFile('jira', result);

    const filePath = path.join(tmpDir, 'cache', 'jira.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CollectorResult;
    expect(parsed.value).toBe(7);
  });

  it('does not leave a .tmp file behind (atomic rename succeeded)', () => {
    writeCacheFile('jira', makeResult());
    const tmpPath = path.join(tmpDir, 'cache', 'jira.json.tmp');
    expect(fs.existsSync(tmpPath)).toBe(false);
  });

  it('overwrites an existing cache file', () => {
    writeCacheFile('jira', makeResult({ value: 1 }));
    writeCacheFile('jira', makeResult({ value: 99 }));
    const filePath = path.join(tmpDir, 'cache', 'jira.json');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CollectorResult;
    expect(parsed.value).toBe(99);
  });

  it('throws when CLAUDE_PLUGIN_DATA is not set', () => {
    delete process.env['CLAUDE_PLUGIN_DATA'];
    expect(() => writeCacheFile('jira', makeResult())).toThrow('CLAUDE_PLUGIN_DATA');
  });
});

// ---------------------------------------------------------------------------
// Lock acquisition and release
// ---------------------------------------------------------------------------

import { acquireLock, releaseLock, isLocked } from '../coordinator';

describe('lock lifecycle', () => {
  let tmpDir: string;
  const origEnv = process.env['CLAUDE_PLUGIN_DATA'];

  beforeEach(() => {
    tmpDir = makeTmpDir();
    process.env['CLAUDE_PLUGIN_DATA'] = tmpDir;
  });

  afterEach(() => {
    rmRf(tmpDir);
    if (origEnv === undefined) {
      delete process.env['CLAUDE_PLUGIN_DATA'];
    } else {
      process.env['CLAUDE_PLUGIN_DATA'] = origEnv;
    }
  });

  it('acquireLock returns true on first acquisition', () => {
    expect(acquireLock('github')).toBe(true);
  });

  it('isLocked returns true after acquireLock', () => {
    acquireLock('github');
    expect(isLocked('github')).toBe(true);
  });

  it('acquireLock returns false if lock already held', () => {
    acquireLock('github');
    expect(acquireLock('github')).toBe(false);
  });

  it('releaseLock removes the lock file', () => {
    acquireLock('github');
    releaseLock('github');
    expect(isLocked('github')).toBe(false);
  });

  it('releaseLock is idempotent (no throw when lock does not exist)', () => {
    expect(() => releaseLock('github')).not.toThrow();
  });

  it('isLocked returns false when CLAUDE_PLUGIN_DATA is unset', () => {
    delete process.env['CLAUDE_PLUGIN_DATA'];
    expect(isLocked('github')).toBe(false);
  });
});

describe('expired lock cleanup', () => {
  let tmpDir: string;
  const origEnv = process.env['CLAUDE_PLUGIN_DATA'];

  beforeEach(() => {
    tmpDir = makeTmpDir();
    process.env['CLAUDE_PLUGIN_DATA'] = tmpDir;
  });

  afterEach(() => {
    rmRf(tmpDir);
    if (origEnv === undefined) {
      delete process.env['CLAUDE_PLUGIN_DATA'];
    } else {
      process.env['CLAUDE_PLUGIN_DATA'] = origEnv;
    }
  });

  it('treats a lock older than LOCK_MAX_AGE_MS (60s) as expired and removes it', () => {
    // Acquire a lock, then manually backdate its mtime
    acquireLock('github');

    const lockDir = path.join(tmpDir, 'locks');
    const lockPath = path.join(lockDir, 'github.lock');

    // Set mtime to 2 minutes ago
    const twoMinutesAgo = new Date(Date.now() - 120_000);
    fs.utimesSync(lockPath, twoMinutesAgo, twoMinutesAgo);

    // isLocked should detect the stale lock, remove it, and return false
    expect(isLocked('github')).toBe(false);

    // Lock file should have been deleted
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('can re-acquire lock after stale lock was cleaned up', () => {
    acquireLock('github');
    const lockDir = path.join(tmpDir, 'locks');
    const lockPath = path.join(lockDir, 'github.lock');
    const past = new Date(Date.now() - 120_000);
    fs.utimesSync(lockPath, past, past);

    // Clean up via isLocked
    isLocked('github');

    // Should be able to acquire again
    expect(acquireLock('github')).toBe(true);
  });

  it('acquireLock succeeds when existing lock is stale (bypasses isLocked)', () => {
    acquireLock('github');
    const lockPath = path.join(tmpDir, 'locks', 'github.lock');
    const past = new Date(Date.now() - 120_000);
    fs.utimesSync(lockPath, past, past);

    // acquireLock should detect stale lock internally and succeed
    expect(acquireLock('github')).toBe(true);

    // New lock should contain current process PID
    const content = fs.readFileSync(lockPath, 'utf8');
    expect(content).toBe(String(process.pid));
  });

  it('acquireLock fails when existing lock is fresh (not stale)', () => {
    acquireLock('github');
    // Lock was just created — should not be overridable
    expect(acquireLock('github')).toBe(false);
  });
});
