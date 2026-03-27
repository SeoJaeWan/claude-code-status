"use strict";
/**
 * watcher.ts
 *
 * Background cache watcher — spawned once per session by session-start.sh.
 * Periodically invokes collect.js for each enabled service so the cache
 * stays fresh even when the user is not actively chatting.
 *
 * Duplicate prevention: uses a PID file at ${CLAUDE_PLUGIN_DATA}/watcher.pid.
 * If a living watcher already exists, this process exits immediately.
 *
 * Exit:
 *   - Naturally dies when the parent shell session ends (detached but
 *     orphaned processes are harmless — they just refresh cache files).
 *   - SIGTERM / SIGINT cause graceful shutdown + PID file cleanup.
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const cache_1 = require("./cache");
const config_1 = require("./config");
const SERVICES = ['gmail', 'tasks', 'jira', 'github', 'slack'];
const DEFAULT_INTERVAL_SEC = 60;
const MIN_INTERVAL_SEC = 10;
// ---------------------------------------------------------------------------
// PID file helpers
// ---------------------------------------------------------------------------
function getPidPath() {
    return path.join((0, cache_1.getPluginDataDir)(), 'watcher.pid');
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Returns true if another watcher is already running.
 */
function isAnotherWatcherRunning() {
    const pidPath = getPidPath();
    try {
        const raw = fs.readFileSync(pidPath, 'utf8').trim();
        const pid = parseInt(raw, 10);
        if (isNaN(pid))
            return false;
        if (pid === process.pid)
            return false;
        return isProcessAlive(pid);
    }
    catch {
        return false;
    }
}
function writePidFile() {
    fs.writeFileSync(getPidPath(), String(process.pid), 'utf8');
}
function removePidFile() {
    try {
        fs.unlinkSync(getPidPath());
    }
    catch {
        // ignore
    }
}
// ---------------------------------------------------------------------------
// Interval config
// ---------------------------------------------------------------------------
function getIntervalMs() {
    const config = (0, config_1.readConfig)();
    const sec = config.refreshIntervalSec;
    if (typeof sec === 'number' && sec >= MIN_INTERVAL_SEC)
        return sec * 1000;
    return DEFAULT_INTERVAL_SEC * 1000;
}
// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function refreshAll() {
    const collectScript = path.join(__dirname, 'collect.js');
    if (!fs.existsSync(collectScript))
        return;
    for (const svc of SERVICES) {
        if (!(0, config_1.isServiceEnabled)(svc))
            continue;
        try {
            const child = (0, child_process_1.spawn)(process.execPath, [collectScript, '--service', svc], {
                detached: true,
                stdio: 'ignore',
                env: { ...process.env, CLAUDE_PLUGIN_DATA: (0, cache_1.getPluginDataDir)() },
                windowsHide: true,
            });
            child.unref();
        }
        catch {
            // ignore individual service failures
        }
    }
}
function log(msg) {
    const ts = new Date().toISOString();
    process.stderr.write(`[${ts}] [watcher] ${msg}\n`);
}
async function main() {
    // Duplicate guard
    if (isAnotherWatcherRunning()) {
        log('Another watcher is already running. Exiting.');
        process.exit(0);
    }
    // Claim PID
    writePidFile();
    // Cleanup on exit
    const cleanup = () => removePidFile();
    process.on('exit', cleanup);
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    const intervalMs = getIntervalMs();
    log(`Started (pid=${process.pid}, interval=${intervalMs / 1000}s)`);
    // Initial refresh immediately
    refreshAll();
    // Loop
    while (true) {
        await sleep(intervalMs);
        refreshAll();
    }
}
main().catch((err) => {
    log(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
    removePidFile();
    process.exit(1);
});
//# sourceMappingURL=watcher.js.map