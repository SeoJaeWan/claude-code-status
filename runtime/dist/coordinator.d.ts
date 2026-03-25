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
import type { ServiceName } from './types';
/**
 * Returns true if a valid (non-expired) lock exists for the given service.
 */
export declare function isLocked(service: ServiceName): boolean;
/**
 * Acquires a lock for the given service.
 * Returns true if the lock was successfully created, false if it already exists.
 */
export declare function acquireLock(service: ServiceName): boolean;
/**
 * Releases the lock for the given service.
 */
export declare function releaseLock(service: ServiceName): void;
/**
 * Returns true if the cache for the given service is stale (or missing).
 */
export declare function isStale(service: ServiceName): boolean;
/**
 * Checks if the cache for `service` is stale.
 * If stale and not already locked, spawns a detached `node collect.js`
 * process to refresh the cache in the background.
 *
 * This function NEVER awaits the child process — the render path remains
 * completely non-blocking.
 */
export declare function triggerRefreshIfStale(service: ServiceName): void;
/**
 * Force-triggers a refresh regardless of TTL / lock state.
 * Used by the collect CLI when `--force` is passed.
 */
export declare function triggerForceRefresh(service: ServiceName): void;
/**
 * Atomically writes a CollectorResult to the cache directory.
 * Uses a temp-file + rename strategy to avoid partial reads.
 */
export declare function writeCacheFile(service: string, data: unknown): void;
//# sourceMappingURL=coordinator.d.ts.map