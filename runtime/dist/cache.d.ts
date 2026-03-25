/**
 * cache.ts
 *
 * Reads collector result cache files from ${CLAUDE_PLUGIN_DATA}/cache/.
 * The render path must never block on network I/O — this module only
 * reads already-written JSON cache files.
 */
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
export declare function getPluginDataDir(): string;
export declare function getCacheDir(): string;
/**
 * Reads a collector result from the cache.
 * Returns null if the file does not exist or cannot be parsed.
 */
export declare function readCache(service: ServiceName): CollectorResult | null;
/**
 * Checks whether a cache entry is still fresh (within its TTL).
 */
export declare function isFresh(result: CollectorResult): boolean;
//# sourceMappingURL=cache.d.ts.map