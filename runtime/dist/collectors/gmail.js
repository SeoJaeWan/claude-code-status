"use strict";
/**
 * collectors/gmail.ts
 *
 * Gmail unread count collector.
 *
 * Strategy:
 *  - Uses the Google Workspace CLI (`gws`) to fetch the UNREAD label info.
 *  - Command: gws gmail users labels get --params '{"userId":"me","id":"UNREAD"}'
 *  - The `messagesUnread` field gives the total unread message count.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/gmail.json.
 *
 * TTL: 1 minute.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collect = collect;
const child_process_1 = require("child_process");
const coordinator_1 = require("../coordinator");
const SERVICE = 'gmail';
const TTL_MS = 60000; // 1 minute
// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------
function classifyError(err, exitCode) {
    const msg = err instanceof Error ? err.message : String(err);
    // gws exit code 2 = auth error
    if (exitCode === 2 || /auth|credentials|login|401|403|unauthorized|forbidden/i.test(msg)) {
        return { errorKind: 'auth', detail: `Gmail auth error: ${msg}` };
    }
    if (/not found|ENOENT|gws/i.test(msg) && /command|spawn/i.test(msg)) {
        return { errorKind: 'dependency', detail: 'gws CLI not found. Install: npm install -g @googleworkspace/cli' };
    }
    if (/429|rateLimitExceeded|rate.?limit/i.test(msg)) {
        return { errorKind: 'rate_limit', detail: `Gmail rate limit exceeded: ${msg}` };
    }
    if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network|socket|timeout/i.test(msg)) {
        return { errorKind: 'transient', detail: `Network error: ${msg}` };
    }
    return { errorKind: 'unknown', detail: msg };
}
// ---------------------------------------------------------------------------
// Run gws command
// ---------------------------------------------------------------------------
function runGws(args) {
    const escaped = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
    return new Promise((resolve) => {
        (0, child_process_1.exec)(`gws ${escaped}`, { timeout: 15000, windowsHide: true }, (err, stdout, stderr) => {
            const exitCode = err && 'code' in err ? err.code : 0;
            resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode });
        });
    });
}
// ---------------------------------------------------------------------------
// Fetch UNREAD label info via gws
// ---------------------------------------------------------------------------
async function fetchUnreadCount() {
    const { stdout, stderr, exitCode } = await runGws([
        'gmail', 'users', 'labels', 'get',
        '--params', '{"userId":"me","id":"UNREAD"}',
    ]);
    if (exitCode !== 0) {
        throw Object.assign(new Error(stderr.trim() || stdout.trim() || `gws exited with code ${exitCode}`), { exitCode });
    }
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        throw new Error(`Failed to parse gws output: ${stdout.slice(0, 200)}`);
    }
    if (parsed.messagesUnread === undefined) {
        throw new Error(`Gmail API response missing messagesUnread field: ${stdout.slice(0, 200)}`);
    }
    return parsed.messagesUnread;
}
// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------
async function collect() {
    const now = new Date().toISOString();
    let result;
    try {
        const count = await fetchUnreadCount();
        result = {
            value: count,
            status: 'ok',
            fetchedAt: now,
            ttlMs: TTL_MS,
            errorKind: null,
            detail: null,
            source: SERVICE,
        };
    }
    catch (err) {
        const exitCode = err && typeof err === 'object' && 'exitCode' in err
            ? err.exitCode
            : undefined;
        const { errorKind, detail } = classifyError(err, exitCode);
        result = {
            value: null,
            status: 'error',
            fetchedAt: now,
            ttlMs: TTL_MS,
            errorKind,
            detail,
            source: SERVICE,
        };
    }
    (0, coordinator_1.writeCacheFile)(SERVICE, result);
}
//# sourceMappingURL=gmail.js.map