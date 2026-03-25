"use strict";
/**
 * cache.ts
 *
 * Reads collector result cache files from ${CLAUDE_PLUGIN_DATA}/cache/.
 * The render path must never block on network I/O — this module only
 * reads already-written JSON cache files.
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
exports.getCacheDir = getCacheDir;
exports.readCache = readCache;
exports.isFresh = isFresh;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Returns the cache directory path.
 * Throws if CLAUDE_PLUGIN_DATA is not set.
 */
function getCacheDir() {
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
function readCache(service) {
    let cacheDir;
    try {
        cacheDir = getCacheDir();
    }
    catch {
        return null;
    }
    const filePath = path.join(cacheDir, `${service}.json`);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed;
    }
    catch {
        return null;
    }
}
/**
 * Checks whether a cache entry is still fresh (within its TTL).
 */
function isFresh(result) {
    const fetchedAt = new Date(result.fetchedAt).getTime();
    const now = Date.now();
    return now - fetchedAt < result.ttlMs;
}
//# sourceMappingURL=cache.js.map