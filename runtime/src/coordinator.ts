/**
 * coordinator.ts
 *
 * Lock / stale / background-refresh coordinator.
 *
 * Responsibilities:
 *  - Detect whether a cached result is stale (past its TTL).
 *  - Prevent duplicate concurrent refreshes using a lock file.
 *  - Spawn the collect CLI as a detached child process so the render path
 *    is never blocked.
 *
 * The render path calls `triggerRefreshIfStale(service)` once per render.
 * If the cache is stale and no lock exists, a detached `node collect.js`
 * process is spawned and the function returns immediately.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { readCache, getCacheDir, getPluginDataDir, isFresh } from './cache';
import type { ServiceName } from './types';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function getLockDir(): string {
  return path.join(getPluginDataDir(), 'locks');
}

function getLockPath(service: ServiceName): string {
  return path.join(getLockDir(), `${service}.lock`);
}

/** Path to the compiled collect.js entrypoint. */
function getCollectScriptPath(): string {
  // collect.js lives next to this file in dist/
  return path.join(__dirname, 'collect.js');
}

// ---------------------------------------------------------------------------
// Lock helpers
// ---------------------------------------------------------------------------

const LOCK_MAX_AGE_MS = 60_000; // locks older than 1 min are considered stale

/**
 * Returns true if a valid (non-expired) lock exists for the given service.
 */
export function isLocked(service: ServiceName): boolean {
  let lockPath: string;
  try {
    lockPath = getLockPath(service);
  } catch {
    return false;
  }

  try {
    const stat = fs.statSync(lockPath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > LOCK_MAX_AGE_MS) {
      // Stale lock — remove it so we can proceed
      fs.unlinkSync(lockPath);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquires a lock for the given service.
 * Returns true if the lock was successfully created, false if it already exists.
 */
export function acquireLock(service: ServiceName): boolean {
  let lockPath: string;
  try {
    const lockDir = getLockDir();
    fs.mkdirSync(lockDir, { recursive: true });
    lockPath = getLockPath(service);
  } catch {
    return false;
  }

  try {
    // wx flag = create exclusively; fails if file already exists
    fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    // Lock file exists — check if it's stale
    try {
      const stat = fs.statSync(lockPath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > LOCK_MAX_AGE_MS) {
        // Stale lock — remove and retry
        fs.unlinkSync(lockPath);
        fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
        return true;
      }
    } catch {
      // stat/unlink/write failed — another process may have raced us
    }
    return false;
  }
}

/**
 * Releases the lock for the given service.
 */
export function releaseLock(service: ServiceName): void {
  try {
    const lockPath = getLockPath(service);
    fs.unlinkSync(lockPath);
  } catch {
    // Ignore errors — lock may have already been removed
  }
}

// ---------------------------------------------------------------------------
// Stale detection
// ---------------------------------------------------------------------------

/**
 * Returns true if the cache for the given service is stale (or missing).
 */
export function isStale(service: ServiceName): boolean {
  const result = readCache(service);
  if (!result) return true;
  return !isFresh(result);
}

// ---------------------------------------------------------------------------
// Background refresh
// ---------------------------------------------------------------------------

/**
 * Checks if the cache for `service` is stale.
 * If stale and not already locked, spawns a detached `node collect.js`
 * process to refresh the cache in the background.
 *
 * This function NEVER awaits the child process — the render path remains
 * completely non-blocking.
 */
export function triggerRefreshIfStale(service: ServiceName): void {
  try {
    if (!isStale(service)) return;
    if (isLocked(service)) return;

    const collectScript = getCollectScriptPath();

    // Check that the collect script exists before spawning
    if (!fs.existsSync(collectScript)) return;

    const child = spawn(
      process.execPath, // node binary
      [collectScript, '--service', service],
      {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, CLAUDE_PLUGIN_DATA: getPluginDataDir() },
        windowsHide: true,
      },
    );

    // Detach so the parent (render) process can exit without waiting
    child.unref();
  } catch {
    // Never throw from the coordinator — stale data is acceptable
  }
}

/**
 * Force-triggers a refresh regardless of TTL / lock state.
 * Used by the collect CLI when `--force` is passed.
 */
export function triggerForceRefresh(service: ServiceName): void {
  try {
    // Remove any existing lock so the forced spawn can proceed
    releaseLock(service);

    const collectScript = getCollectScriptPath();
    if (!fs.existsSync(collectScript)) return;

    const child = spawn(
      process.execPath,
      [collectScript, '--service', service, '--force'],
      {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, CLAUDE_PLUGIN_DATA: getPluginDataDir() },
        windowsHide: true,
      },
    );

    child.unref();
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Cache write helper (used by all collectors)
// ---------------------------------------------------------------------------

/**
 * Atomically writes a CollectorResult to the cache directory.
 * Uses a temp-file + rename strategy to avoid partial reads.
 */
export function writeCacheFile(service: string, data: unknown): void {
  const cacheDir = path.join(getPluginDataDir(), 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });

  const finalPath = path.join(cacheDir, `${service}.json`);
  const tmpPath = finalPath + '.tmp';

  const serialized = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpPath, serialized, 'utf8');
  fs.renameSync(tmpPath, finalPath);
}
