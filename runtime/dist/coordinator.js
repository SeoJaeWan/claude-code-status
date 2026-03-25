"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocked = isLocked;
exports.acquireLock = acquireLock;
exports.releaseLock = releaseLock;
exports.isStale = isStale;
exports.triggerRefreshIfStale = triggerRefreshIfStale;
exports.triggerForceRefresh = triggerForceRefresh;
exports.writeCacheFile = writeCacheFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const cache_1 = require("./cache");
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
function getLockDir() {
    const pluginData = process.env['CLAUDE_PLUGIN_DATA'];
    if (!pluginData) {
        throw new Error('CLAUDE_PLUGIN_DATA environment variable is not set');
    }
    return path.join(pluginData, 'locks');
}
function getLockPath(service) {
    return path.join(getLockDir(), `${service}.lock`);
}
/** Path to the compiled collect.js entrypoint. */
function getCollectScriptPath() {
    // collect.js lives next to this file in dist/
    return path.join(__dirname, 'collect.js');
}
// ---------------------------------------------------------------------------
// Lock helpers
// ---------------------------------------------------------------------------
const LOCK_MAX_AGE_MS = 60000; // locks older than 1 min are considered stale
/**
 * Returns true if a valid (non-expired) lock exists for the given service.
 */
function isLocked(service) {
    let lockPath;
    try {
        lockPath = getLockPath(service);
    }
    catch {
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
    }
    catch {
        return false;
    }
}
/**
 * Acquires a lock for the given service.
 * Returns true if the lock was successfully created, false if it already exists.
 */
function acquireLock(service) {
    let lockPath;
    try {
        const lockDir = getLockDir();
        fs.mkdirSync(lockDir, { recursive: true });
        lockPath = getLockPath(service);
    }
    catch {
        return false;
    }
    try {
        // wx flag = create exclusively; fails if file already exists
        fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Releases the lock for the given service.
 */
function releaseLock(service) {
    try {
        const lockPath = getLockPath(service);
        fs.unlinkSync(lockPath);
    }
    catch {
        // Ignore errors — lock may have already been removed
    }
}
// ---------------------------------------------------------------------------
// Stale detection
// ---------------------------------------------------------------------------
/**
 * Returns true if the cache for the given service is stale (or missing).
 */
function isStale(service) {
    const result = (0, cache_1.readCache)(service);
    if (!result)
        return true;
    return !(0, cache_1.isFresh)(result);
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
function triggerRefreshIfStale(service) {
    try {
        if (!isStale(service))
            return;
        if (isLocked(service))
            return;
        const collectScript = getCollectScriptPath();
        // Check that the collect script exists before spawning
        if (!fs.existsSync(collectScript))
            return;
        const child = (0, child_process_1.spawn)(process.execPath, // node binary
        [collectScript, '--service', service], {
            detached: true,
            stdio: 'ignore',
            env: { ...process.env },
        });
        // Detach so the parent (render) process can exit without waiting
        child.unref();
    }
    catch {
        // Never throw from the coordinator — stale data is acceptable
    }
}
/**
 * Force-triggers a refresh regardless of TTL / lock state.
 * Used by the collect CLI when `--force` is passed.
 */
function triggerForceRefresh(service) {
    try {
        // Remove any existing lock so the forced spawn can proceed
        releaseLock(service);
        const collectScript = getCollectScriptPath();
        if (!fs.existsSync(collectScript))
            return;
        const child = (0, child_process_1.spawn)(process.execPath, [collectScript, '--service', service, '--force'], {
            detached: true,
            stdio: 'ignore',
            env: { ...process.env },
        });
        child.unref();
    }
    catch {
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
function writeCacheFile(service, data) {
    const pluginData = process.env['CLAUDE_PLUGIN_DATA'];
    if (!pluginData) {
        throw new Error('CLAUDE_PLUGIN_DATA environment variable is not set');
    }
    const cacheDir = path.join(pluginData, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const finalPath = path.join(cacheDir, `${service}.json`);
    const tmpPath = finalPath + '.tmp';
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, finalPath);
}
//# sourceMappingURL=coordinator.js.map