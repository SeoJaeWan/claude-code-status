"use strict";
/**
 * render.ts
 *
 * Main entrypoint for the claude-status statusLine renderer.
 *
 * Called by: scripts/status-line.sh (bash launcher)
 * Reads: stdin JSON from Claude Code, cache files from ${CLAUDE_PLUGIN_DATA}/cache/
 * Outputs: one-line status string to stdout
 *
 * CALL CHAIN:
 *   ~/.claude/settings.json (statusLine.command)
 *     -> status-line.sh (bash launcher)
 *     -> node render.js  (this file, stdin piped through)
 *     -> stdout: "week 42% session 18% | gmail 7 | tasks 3 | jira 5 | github 4"
 *
 * EXIT CODES:
 *   0  - always (even on error — fallback text is written to stdout so Claude
 *         Code does not display a blank status line)
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
const cache_1 = require("./cache");
const coordinator_1 = require("./coordinator");
const config_1 = require("./config");
// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------
const ANSI_RESET = '\x1b[0m';
const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_GRAY = '\x1b[90m';
const ANSI_WHITE = '\x1b[97m';
function red(s) { return `${ANSI_RED}${s}${ANSI_RESET}`; }
function green(s) { return `${ANSI_GREEN}${s}${ANSI_RESET}`; }
function yellow(s) { return `${ANSI_YELLOW}${s}${ANSI_RESET}`; }
function cyan(s) { return `${ANSI_CYAN}${s}${ANSI_RESET}`; }
function gray(s) { return `${ANSI_GRAY}${s}${ANSI_RESET}`; }
function white(s) { return `${ANSI_WHITE}${s}${ANSI_RESET}`; }
// ---------------------------------------------------------------------------
// Color thresholds per domain.md
// ---------------------------------------------------------------------------
function colorWeekSession(pct, text) {
    if (pct >= 80)
        return red(text);
    if (pct >= 60)
        return yellow(text);
    if (pct >= 30)
        return cyan(text);
    return green(text);
}
function colorGmail(count, text) {
    if (count === 0)
        return gray(text);
    if (count >= 30)
        return red(text);
    if (count >= 10)
        return yellow(text);
    return white(text);
}
function colorTasks(count, text) {
    if (count === 0)
        return gray(text);
    if (count >= 11)
        return red(text);
    if (count >= 6)
        return yellow(text);
    return white(text);
}
function colorJira(count, text) {
    if (count === 0)
        return gray(text);
    if (count >= 11)
        return red(text);
    if (count >= 6)
        return yellow(text);
    return white(text);
}
function colorGithub(count, text) {
    if (count === 0)
        return gray(text);
    if (count >= 8)
        return red(text);
    if (count >= 4)
        return yellow(text);
    return white(text);
}
function colorSlack(count, text) {
    if (count === 0)
        return gray(text);
    if (count >= 30)
        return red(text);
    if (count >= 10)
        return yellow(text);
    return white(text);
}
function applyServiceColor(service, count, text) {
    switch (service) {
        case 'gmail': return colorGmail(count, text);
        case 'tasks': return colorTasks(count, text);
        case 'jira': return colorJira(count, text);
        case 'github': return colorGithub(count, text);
        case 'slack': return colorSlack(count, text);
    }
}
// ---------------------------------------------------------------------------
// Stdin parsing
// ---------------------------------------------------------------------------
async function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => {
            resolve(data);
        });
        // If stdin is not a pipe (e.g. running directly), resolve immediately
        if (process.stdin.isTTY) {
            resolve('');
        }
    });
}
function parseStdinInput(raw) {
    if (!raw.trim())
        return {};
    try {
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
// ---------------------------------------------------------------------------
// week / session — read from stdin, rendered with color
// ---------------------------------------------------------------------------
const RATE_LIMITS_CACHE = 'rate_limits.json';
function getRateLimitsCachePath() {
    return path.join((0, cache_1.getCacheDir)(), RATE_LIMITS_CACHE);
}
/** Persist rate_limits to cache so subsequent sessions can show last-known values. */
function saveRateLimits(rateLimits) {
    try {
        const cacheDir = (0, cache_1.getCacheDir)();
        fs.mkdirSync(cacheDir, { recursive: true });
        const data = { rateLimits, savedAt: new Date().toISOString() };
        const tmpPath = getRateLimitsCachePath() + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf8');
        fs.renameSync(tmpPath, getRateLimitsCachePath());
    }
    catch {
        // never block render
    }
}
/** Load last-known rate_limits from cache. */
function loadCachedRateLimits() {
    try {
        const raw = fs.readFileSync(getRateLimitsCachePath(), 'utf8');
        const parsed = JSON.parse(raw);
        return parsed.rateLimits ?? null;
    }
    catch {
        return null;
    }
}
function renderWeekSession(input) {
    let rateLimits = input.rate_limits;
    // Save fresh data when available; fallback to cached when not
    if (rateLimits) {
        saveRateLimits(rateLimits);
    }
    else {
        rateLimits = loadCachedRateLimits() ?? undefined;
    }
    const weekPct = rateLimits?.seven_day?.used_percentage;
    const sessionPct = rateLimits?.five_hour?.used_percentage;
    let weekStr = null;
    let sessionStr = null;
    if (weekPct != null) {
        const pctStr = colorWeekSession(weekPct, `${Math.round(weekPct)}%`);
        weekStr = `${gray('week')} ${pctStr}`;
    }
    if (sessionPct != null) {
        const pctStr = colorWeekSession(sessionPct, `${Math.round(sessionPct)}%`);
        sessionStr = `${gray('session')} ${pctStr}`;
    }
    const parts = [weekStr, sessionStr].filter((p) => p !== null);
    return parts.length > 0 ? parts.join(' ') : '';
}
// ---------------------------------------------------------------------------
// External service segment rendering
// ---------------------------------------------------------------------------
/**
 * Converts a collector result to a colored display token.
 *
 *   no cache / not configured -> null (service will be hidden)
 *   error status              -> red '!'
 *   numeric value 0           -> gray '0'
 *   numeric value > 0         -> colored number per threshold
 */
function resultToColoredDisplay(service, result) {
    // No cache file at all — service not configured, hide it
    if (!result) {
        return null;
    }
    // Collector reported an error
    if (result.status === 'error') {
        return red('!');
    }
    // Value unavailable (pending / unknown) — service not yet fetched, hide it
    if (result.value === null) {
        return null;
    }
    const numStr = String(result.value);
    return applyServiceColor(service, result.value, numStr);
}
function renderService(service) {
    // Skip services the user has disabled in config.json
    if (!(0, config_1.isServiceEnabled)(service))
        return null;
    const result = (0, cache_1.readCache)(service);
    // Trigger a background refresh if the cache is stale.
    // triggerRefreshIfStale is non-blocking — it spawns a detached child process
    // and returns immediately.  The current (possibly stale) value is shown now.
    if (!result || (result.status !== 'error' && !(0, cache_1.isFresh)(result))) {
        (0, coordinator_1.triggerRefreshIfStale)(service);
    }
    const display = resultToColoredDisplay(service, result);
    // If display is null, the service is not configured — hide it entirely
    if (display === null) {
        return null;
    }
    return `${gray(service)} ${display}`;
}
// ---------------------------------------------------------------------------
// Format the final status line
// ---------------------------------------------------------------------------
function formatStatusLine(weekSession, serviceSegments) {
    const sep = gray('|');
    const serviceStr = serviceSegments.join(` ${sep} `);
    if (weekSession && serviceStr) {
        return `${weekSession} ${sep} ${serviceStr}`;
    }
    if (weekSession) {
        return weekSession;
    }
    if (serviceStr) {
        return serviceStr;
    }
    return '';
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const SERVICES = ['gmail', 'tasks', 'jira', 'github', 'slack'];
async function main() {
    try {
        const rawStdin = await readStdin();
        const input = parseStdinInput(rawStdin);
        const weekSession = renderWeekSession(input);
        const segments = SERVICES.map(renderService).filter((s) => s !== null);
        const output = formatStatusLine(weekSession, segments);
        // Write output without trailing newline issues — process.stdout.write
        // ensures exactly what we output; PowerShell launcher trims trailing whitespace.
        process.stdout.write(output + '\n');
        process.exit(0);
    }
    catch (err) {
        // On any uncaught error: write a fallback line to stdout so Claude Code
        // always gets a valid single-line response, and log details to stderr.
        process.stderr.write(`[render] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
        process.stdout.write('status: render error\n');
        process.exit(0);
    }
}
main();
//# sourceMappingURL=render.js.map