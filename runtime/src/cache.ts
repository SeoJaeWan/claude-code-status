/**
 * cache.ts
 *
 * Reads collector result cache files from ${CLAUDE_PLUGIN_DATA}/cache/.
 * The render path must never block on network I/O — this module only
 * reads already-written JSON cache files.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CollectorResult, ServiceName } from './types';

/**
 * Returns the cache directory path.
 * Throws if CLAUDE_PLUGIN_DATA is not set.
 */
/**
 * Returns the plugin data root directory.
 * Checks CLAUDE_PLUGIN_DATA env var first, then derives from __dirname
 * (dist/ lives inside the plugin data runtime directory).
 */
export function getPluginDataDir(): string {
  const fromEnv = process.env['CLAUDE_PLUGIN_DATA'];
  if (fromEnv) return fromEnv;

  // __dirname = <PLUGIN_DATA>/runtime/dist → go up 2 levels
  return path.resolve(__dirname, '..', '..');
}

export function getCacheDir(): string {
  return path.join(getPluginDataDir(), 'cache');
}

/**
 * Reads a collector result from the cache.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function readCache(service: ServiceName): CollectorResult | null {
  let cacheDir: string;
  try {
    cacheDir = getCacheDir();
  } catch {
    return null;
  }

  const filePath = path.join(cacheDir, `${service}.json`);

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as CollectorResult;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Checks whether a cache entry is still fresh (within its TTL).
 */
export function isFresh(result: CollectorResult): boolean {
  const fetchedAt = new Date(result.fetchedAt).getTime();
  const now = Date.now();
  return now - fetchedAt < result.ttlMs;
}
