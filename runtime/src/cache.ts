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
export function getCacheDir(): string {
  const pluginData = process.env['CLAUDE_PLUGIN_DATA'];
  if (!pluginData) {
    throw new Error('CLAUDE_PLUGIN_DATA environment variable is not set');
  }
  return path.join(pluginData, 'cache');
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
