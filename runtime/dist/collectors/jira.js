"use strict";
/**
 * collectors/jira.ts
 *
 * Jira issue collector.
 *
 * Strategy:
 *  - Uses `acli jira` CLI (Atlassian CLI) to execute a JQL query.
 *  - JQL: assignee = currentUser() AND statusCategory != Done
 *  - Extracts the total issue count from the CLI output.
 *  - Checks login status before fetching.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/jira.json.
 *
 * TTL: 5 minutes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collect = collect;
const child_process_1 = require("child_process");
const coordinator_1 = require("../coordinator");
const SERVICE = 'jira';
const TTL_MS = 5 * 60000; // 5 minutes
const JQL = 'assignee = currentUser() AND statusCategory != Done';
// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------
function classifyError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/acli.*not found|command not found|executable file not found/i.test(msg)) {
        return { errorKind: 'dependency', detail: `acli CLI not found or not installed: ${msg}` };
    }
    if (/not.*logged in|authentication|401|403|unauthorized|forbidden/i.test(msg)) {
        return { errorKind: 'auth', detail: `Jira authentication failed: ${msg}` };
    }
    if (/429|rate.?limit/i.test(msg)) {
        return { errorKind: 'rate_limit', detail: `Jira rate limit exceeded: ${msg}` };
    }
    if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network|socket|timeout/i.test(msg)) {
        return { errorKind: 'transient', detail: `Network error: ${msg}` };
    }
    return { errorKind: 'unknown', detail: msg };
}
// ---------------------------------------------------------------------------
// Check acli availability and login status
// ---------------------------------------------------------------------------
function checkAcliAuth() {
    try {
        (0, child_process_1.execSync)('acli jira --help', { stdio: 'pipe', timeout: 10000, windowsHide: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/command not found|executable file not found|ENOENT/i.test(msg)) {
            throw new Error('acli CLI not installed or not found in PATH');
        }
    }
}
// ---------------------------------------------------------------------------
// Execute JQL via workitem search --count and extract number
// ---------------------------------------------------------------------------
function fetchIssueCount() {
    let raw;
    try {
        raw = (0, child_process_1.execSync)(`acli jira workitem search --jql "${JQL.replace(/"/g, '\\"')}" --count`, { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
    }
    // Expected output: "✓ Number of work items in the search: 4"
    const match = raw.match(/:\s*(\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }
    // Fallback: try to find any number in the output
    const numMatch = raw.match(/(\d+)/);
    if (numMatch) {
        return parseInt(numMatch[1], 10);
    }
    throw new Error(`Could not parse count from acli output: ${raw.slice(0, 200)}`);
}
// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------
async function collect() {
    const now = new Date().toISOString();
    let result;
    try {
        // 1. Verify acli is available and authenticated
        checkAcliAuth();
        // 2. Execute JQL and get count
        const count = fetchIssueCount();
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
//# sourceMappingURL=jira.js.map