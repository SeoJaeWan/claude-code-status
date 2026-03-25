"use strict";
/**
 * collect.ts
 *
 * CLI entrypoint for the collector dispatcher.
 *
 * Usage:
 *   node collect.js --service <name> [--force]
 *
 * Services: github | jira | gmail | tasks | slack
 *
 * Flags:
 *   --service <name>  Required. The service to collect data for.
 *   --force           Optional. Bypass TTL check and always fetch fresh data.
 *
 * Exit codes:
 *   0  - success (cache written)
 *   1  - error (cache written with error status; also logged to stderr)
 *   2  - usage error (unknown service, missing flag)
 *
 * This script is spawned by the coordinator as a detached background process
 * during render, and can also be run manually for testing.
 *
 * Example:
 *   node collect.js --service github --force
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
const coordinator_1 = require("./coordinator");
const SUPPORTED_SERVICES = ['github', 'jira', 'gmail', 'tasks', 'slack'];
function isSupportedService(name) {
    return SUPPORTED_SERVICES.includes(name);
}
// ---------------------------------------------------------------------------
// Lazy collector imports (avoids loading all modules on every invocation)
// ---------------------------------------------------------------------------
async function loadCollector(service) {
    switch (service) {
        case 'github':
            return Promise.resolve().then(() => __importStar(require('./collectors/github')));
        case 'jira':
            return Promise.resolve().then(() => __importStar(require('./collectors/jira')));
        case 'gmail':
            return Promise.resolve().then(() => __importStar(require('./collectors/gmail')));
        case 'tasks':
            return Promise.resolve().then(() => __importStar(require('./collectors/tasks')));
        case 'slack':
            return Promise.resolve().then(() => __importStar(require('./collectors/slack')));
        default: {
            // TypeScript exhaustiveness guard
            const _exhaustive = service;
            throw new Error(`Unknown service: ${String(_exhaustive)}`);
        }
    }
}
function parseArgs(argv) {
    const args = argv.slice(2); // strip 'node' and script path
    let service = null;
    let force = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--service' && i + 1 < args.length) {
            service = args[++i] ?? null;
        }
        else if (arg === '--force') {
            force = true;
        }
    }
    if (!service) {
        process.stderr.write('Usage: node collect.js --service <name> [--force]\n');
        process.stderr.write(`Supported services: ${SUPPORTED_SERVICES.join(', ')}\n`);
        process.exit(2);
    }
    if (!isSupportedService(service)) {
        process.stderr.write(`Unknown service: "${service}"\n`);
        process.stderr.write(`Supported services: ${SUPPORTED_SERVICES.join(', ')}\n`);
        process.exit(2);
    }
    return { service, force };
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const { service, force } = parseArgs(process.argv);
    // Skip if cache is still fresh (unless --force)
    if (!force && !(0, coordinator_1.isStale)(service)) {
        process.stderr.write(`[collect] ${service}: cache is still fresh, skipping\n`);
        process.exit(0);
    }
    // Acquire lock to prevent concurrent collectors for the same service
    const locked = (0, coordinator_1.acquireLock)(service);
    if (!locked) {
        process.stderr.write(`[collect] ${service}: another collector is already running, skipping\n`);
        process.exit(0);
    }
    try {
        process.stderr.write(`[collect] ${service}: starting collection (force=${force})\n`);
        const collector = await loadCollector(service);
        await collector.collect();
        process.stderr.write(`[collect] ${service}: collection complete\n`);
        process.exit(0);
    }
    catch (err) {
        process.stderr.write(`[collect] ${service}: unhandled error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
    }
    finally {
        (0, coordinator_1.releaseLock)(service);
    }
}
main();
//# sourceMappingURL=collect.js.map