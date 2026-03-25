"use strict";
/**
 * collectors/tasks.ts
 *
 * Google Tasks needsAction count collector.
 *
 * Strategy:
 *  - Uses the Google Workspace CLI (`gws`) to list task lists and tasks.
 *  - Lists all task lists via: gws tasks tasklists list
 *  - For each list, fetches tasks: gws tasks tasks list --params '{"tasklist":"<id>","showCompleted":false,"showHidden":false}'
 *  - Counts only tasks with status === 'needsAction'.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/tasks.json.
 *
 * TTL: 1 minute.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collect = collect;
const child_process_1 = require("child_process");
const coordinator_1 = require("../coordinator");
const SERVICE = 'tasks';
const TTL_MS = 60000; // 1 minute
// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------
function classifyError(err, exitCode) {
    const msg = err instanceof Error ? err.message : String(err);
    if (exitCode === 2 || /auth|credentials|login|401|403|unauthorized|forbidden/i.test(msg)) {
        return { errorKind: 'auth', detail: `Google Tasks auth error: ${msg}` };
    }
    if (/not found|ENOENT|gws/i.test(msg) && /command|spawn/i.test(msg)) {
        return { errorKind: 'dependency', detail: 'gws CLI not found. Install: npm install -g @googleworkspace/cli' };
    }
    if (/429|rateLimitExceeded|rate.?limit/i.test(msg)) {
        return { errorKind: 'rate_limit', detail: `Google Tasks rate limit exceeded: ${msg}` };
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
// Fetch all task lists
// ---------------------------------------------------------------------------
async function fetchTaskLists() {
    const { stdout, stderr, exitCode } = await runGws([
        'tasks', 'tasklists', 'list',
    ]);
    if (exitCode !== 0) {
        throw Object.assign(new Error(stderr.trim() || stdout.trim() || `gws exited with code ${exitCode}`), { exitCode });
    }
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        throw new Error(`Failed to parse task lists response: ${stdout.slice(0, 200)}`);
    }
    return parsed.items ?? [];
}
async function fetchNeedsActionTasks(taskListId) {
    const params = JSON.stringify({
        tasklist: taskListId,
        showCompleted: false,
        showHidden: false,
        maxResults: 100,
    });
    const { stdout, stderr, exitCode } = await runGws([
        'tasks', 'tasks', 'list',
        '--params', params,
    ]);
    if (exitCode !== 0) {
        throw Object.assign(new Error(stderr.trim() || stdout.trim() || `gws exited with code ${exitCode}`), { exitCode });
    }
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        throw new Error(`Failed to parse tasks response for list ${taskListId}: ${stdout.slice(0, 200)}`);
    }
    const items = parsed.items ?? [];
    return items.filter((t) => t.status === 'needsAction');
}
// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------
async function collect() {
    const now = new Date().toISOString();
    let result;
    try {
        const taskLists = await fetchTaskLists();
        const allTasks = [];
        for (const list of taskLists) {
            const tasks = await fetchNeedsActionTasks(list.id);
            for (const task of tasks) {
                allTasks.push({ task, listTitle: list.title });
            }
        }
        const items = allTasks.map(({ task, listTitle }) => ({
            title: task.title ?? '(untitled)',
            link: 'https://tasks.google.com',
            meta: {
                list: listTitle,
                due: task.due ?? null,
            },
        }));
        result = {
            value: allTasks.length,
            status: 'ok',
            fetchedAt: now,
            ttlMs: TTL_MS,
            errorKind: null,
            detail: null,
            source: SERVICE,
            items,
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
//# sourceMappingURL=tasks.js.map