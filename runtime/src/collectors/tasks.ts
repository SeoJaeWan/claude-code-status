/**
 * collectors/tasks.ts
 *
 * Google Tasks needsAction count collector.
 *
 * Strategy:
 *  - Lists all task lists via GET /tasks/v1/users/@me/lists.
 *  - For each task list, fetches tasks with showCompleted=false.
 *  - Counts only tasks with status === 'needsAction'.
 *  - Uses the Google OAuth2 token from google-auth.ts.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/tasks.json.
 *
 * TTL: 5 minutes.
 */

import * as https from 'https';
import type { CollectorResult, ErrorKind } from '../types';
import { writeCacheFile } from '../coordinator';
import { getValidAccessToken } from '../google-auth';

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

function classifyError(err: unknown): { errorKind: ErrorKind; detail: string } {
  const msg = err instanceof Error ? err.message : String(err);

  if (/client_secret|tokens|OAuth|refresh_token|token.*not found/i.test(msg)) {
    return { errorKind: 'auth', detail: `Google auth not configured: ${msg}` };
  }

  if (/401|403|invalid_grant|invalid_token|unauthorized|forbidden/i.test(msg)) {
    return { errorKind: 'auth', detail: `Google Tasks authentication failed: ${msg}` };
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
// HTTP helper
// ---------------------------------------------------------------------------

function httpsGet(url: string, accessToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new Error(`HTTP ${res.statusCode}: unauthorized or forbidden`));
        } else if (res.statusCode === 429) {
          reject(new Error(`HTTP 429: rate limit exceeded`));
        } else if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('Request timeout'));
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// Fetch all task lists
// ---------------------------------------------------------------------------

async function fetchTaskLists(accessToken: string): Promise<TaskList[]> {
  const url = 'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100';
  const raw = await httpsGet(url, accessToken);

  let parsed: TaskListsResponse;
  try {
    parsed = JSON.parse(raw) as TaskListsResponse;
  } catch {
    throw new Error(`Failed to parse task lists response: ${raw.slice(0, 200)}`);
  }

  return parsed.items ?? [];
}

// ---------------------------------------------------------------------------
// Fetch needsAction tasks for a single task list
// ---------------------------------------------------------------------------

async function fetchNeedsActionCount(accessToken: string, taskListId: string): Promise<number> {
  // showCompleted=false excludes completed tasks from the response
  // showHidden=false excludes hidden/deleted tasks
  const url =
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks` +
    `?showCompleted=false&showHidden=false&maxResults=100`;

  const raw = await httpsGet(url, accessToken);

  let parsed: TasksResponse;
  try {
    parsed = JSON.parse(raw) as TasksResponse;
  } catch {
    throw new Error(`Failed to parse tasks response for list ${taskListId}: ${raw.slice(0, 200)}`);
  }

  const items = parsed.items ?? [];
  // Double-check status field (API may still return completed items on some lists)
  return items.filter((t) => t.status === 'needsAction').length;
}

// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------

export async function collect(): Promise<void> {
  const now = new Date().toISOString();

  let result: CollectorResult;

  try {
    // 1. Get a valid access token
    const accessToken = await getValidAccessToken();

    // 2. Fetch all task lists
    const taskLists = await fetchTaskLists(accessToken);

    // 3. Fetch needsAction count for each list and sum them up
    let totalCount = 0;
    for (const list of taskLists) {
      const count = await fetchNeedsActionCount(accessToken, list.id);
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

  writeCacheFile(SERVICE, result);
}
