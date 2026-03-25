"use strict";
/**
 * collectors/github.ts
 *
 * GitHub PR notification collector.
 *
 * Strategy:
 *  - Calls `gh api /notifications` (uses gh CLI's stored credentials).
 *  - Filters to unread threads where subject.type === 'PullRequest'.
 *  - Deduplicates by thread id (same PR, multiple reasons = 1 count).
 *  - Respects X-Poll-Interval header stored in the cache metadata.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/github.json.
 *
 * TTL: 90 seconds (1.5 min, within the 1–2 min spec).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collect = collect;
const child_process_1 = require("child_process");
const coordinator_1 = require("../coordinator");
const SERVICE = 'github';
const TTL_MS = 90000; // 90 seconds
// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------
function classifyError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/gh CLI not installed/i.test(msg) ||
        /gh: command not found/i.test(msg) ||
        (/executable file not found/i.test(msg) && !/gh auth/i.test(msg))) {
        return { errorKind: 'dependency', detail: `gh CLI not found or not installed: ${msg}` };
    }
    if (/gh auth failed|invalid.*token|The token.*invalid|not.*authenticated|not.*logged in/i.test(msg)) {
        return { errorKind: 'auth', detail: `GitHub not authenticated: ${msg}` };
    }
    if (/401|403|authentication|credentials|token/i.test(msg)) {
        return { errorKind: 'auth', detail: `GitHub authentication failed: ${msg}` };
    }
    if (/429|rate.?limit/i.test(msg)) {
        return { errorKind: 'rate_limit', detail: `GitHub rate limit exceeded: ${msg}` };
    }
    if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network|socket/i.test(msg)) {
        return { errorKind: 'transient', detail: `Network error: ${msg}` };
    }
    return { errorKind: 'unknown', detail: msg };
}
// ---------------------------------------------------------------------------
// Check gh CLI availability and auth status
// ---------------------------------------------------------------------------
function checkGhAuth() {
    try {
        (0, child_process_1.execSync)('gh auth status', { stdio: 'pipe', timeout: 10000 });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Distinguish between CLI not installed vs not authenticated
        if (/executable file not found|command not found/i.test(msg) &&
            !/gh auth/i.test(msg)) {
            throw new Error('gh CLI not installed or not found in PATH');
        }
        // gh is installed but auth failed (invalid token, not logged in, etc.)
        throw new Error(`gh auth failed: ${msg}`);
    }
}
// ---------------------------------------------------------------------------
// Fetch notifications via gh CLI
// ---------------------------------------------------------------------------
function fetchNotifications() {
    // Fetch up to 100 unread notifications
    const raw = (0, child_process_1.execSync)('gh api /notifications -H "Accept: application/vnd.github+json"', { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
        throw new Error('Unexpected response format from GitHub Notifications API');
    }
    return data;
}
// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------
async function collect() {
    const now = new Date().toISOString();
    let result;
    try {
        // 1. Verify gh CLI is available and authenticated
        checkGhAuth();
        // 2. Fetch notifications
        const notifications = fetchNotifications();
        // 3. Filter: unread PR notifications only
        const unreadPrNotifications = notifications.filter((n) => n.unread && n.subject?.type === 'PullRequest');
        // 4. Deduplicate by thread id (each thread = 1 PR notification)
        const uniqueThreadIds = new Set(unreadPrNotifications.map((n) => n.id));
        const count = uniqueThreadIds.size;
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
        const { errorKind, detail } = classifyError(err);
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
//# sourceMappingURL=github.js.map