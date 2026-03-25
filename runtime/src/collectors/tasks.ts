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
 * TTL: 5 minutes.
 */

import { exec } from 'child_process';
import type { CollectorResult, ErrorKind } from '../types';
import { writeCacheFile } from '../coordinator';

const SERVICE = 'tasks';
const TTL_MS = 5 * 60_000; // 5 minutes

// ---------------------------------------------------------------------------
// Types for Google Tasks API responses
// ---------------------------------------------------------------------------

interface TaskList {
  id: string;
  title: string;
  kind?: string;
}

interface TaskListsResponse {
  kind?: string;
  items?: TaskList[];
  nextPageToken?: string;
}

interface Task {
  id: string;
  title?: string;
  status?: string;
  kind?: string;
  due?: string;
  updated?: string;
}

interface TasksResponse {
  kind?: string;
  items?: Task[];
  nextPageToken?: string;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(err: unknown, exitCode?: number): { errorKind: ErrorKind; detail: string } {
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

function runGws(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const escaped = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
  return new Promise((resolve) => {
    exec(`gws ${escaped}`, { timeout: 15_000, windowsHide: true }, (err, stdout, stderr) => {
      const exitCode = err && 'code' in err ? (err as { code: number }).code : 0;
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode });
    });
  });
}

// ---------------------------------------------------------------------------
// Fetch all task lists
// ---------------------------------------------------------------------------

async function fetchTaskLists(): Promise<TaskList[]> {
  const { stdout, stderr, exitCode } = await runGws([
    'tasks', 'tasklists', 'list',
  ]);

  if (exitCode !== 0) {
    throw Object.assign(
      new Error(stderr.trim() || stdout.trim() || `gws exited with code ${exitCode}`),
      { exitCode },
    );
  }

  let parsed: TaskListsResponse;
  try {
    parsed = JSON.parse(stdout) as TaskListsResponse;
  } catch {
    throw new Error(`Failed to parse task lists response: ${stdout.slice(0, 200)}`);
  }

  return parsed.items ?? [];
}

// ---------------------------------------------------------------------------
// Fetch needsAction tasks for a single task list
// ---------------------------------------------------------------------------

async function fetchNeedsActionCount(taskListId: string): Promise<number> {
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
    throw Object.assign(
      new Error(stderr.trim() || stdout.trim() || `gws exited with code ${exitCode}`),
      { exitCode },
    );
  }

  let parsed: TasksResponse;
  try {
    parsed = JSON.parse(stdout) as TasksResponse;
  } catch {
    throw new Error(`Failed to parse tasks response for list ${taskListId}: ${stdout.slice(0, 200)}`);
  }

  const items = parsed.items ?? [];
  return items.filter((t) => t.status === 'needsAction').length;
}

// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------

export async function collect(): Promise<void> {
  const now = new Date().toISOString();

  let result: CollectorResult;

  try {
    const taskLists = await fetchTaskLists();

    let totalCount = 0;
    for (const list of taskLists) {
      const count = await fetchNeedsActionCount(list.id);
      totalCount += count;
    }

    result = {
      value: totalCount,
      status: 'ok',
      fetchedAt: now,
      ttlMs: TTL_MS,
      errorKind: null,
      detail: null,
      source: SERVICE,
    };
  } catch (err) {
    const exitCode = err && typeof err === 'object' && 'exitCode' in err
      ? (err as { exitCode: number }).exitCode
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

  writeCacheFile(SERVICE, result);
}
