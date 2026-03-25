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

import { exec } from 'child_process';
import type { CollectorResult, CollectorItem, ErrorKind } from '../types';
import { writeCacheFile } from '../coordinator';

const SERVICE = 'gmail';
const TTL_MS = 60_000; // 1 minute

// ---------------------------------------------------------------------------
// Types for Gmail API response
// ---------------------------------------------------------------------------

interface GmailLabelResponse {
  id?: string;
  name?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

interface GmailMessage {
  id: string;
  threadId?: string;
}

interface GmailMessagesListResponse {
  messages?: GmailMessage[];
  resultSizeEstimate?: number;
}

interface GmailMessageDetail {
  id: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(err: unknown, exitCode?: number): { errorKind: ErrorKind; detail: string } {
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
// Fetch UNREAD label info via gws
// ---------------------------------------------------------------------------

async function fetchUnreadCount(): Promise<number> {
  const { stdout, stderr, exitCode } = await runGws([
    'gmail', 'users', 'labels', 'get',
    '--params', '{"userId":"me","id":"UNREAD"}',
  ]);

  if (exitCode !== 0) {
    throw Object.assign(
      new Error(stderr.trim() || stdout.trim() || `gws exited with code ${exitCode}`),
      { exitCode },
    );
  }

  let parsed: GmailLabelResponse;
  try {
    parsed = JSON.parse(stdout) as GmailLabelResponse;
  } catch {
    throw new Error(`Failed to parse gws output: ${stdout.slice(0, 200)}`);
  }

  if (parsed.messagesUnread === undefined) {
    throw new Error(`Gmail API response missing messagesUnread field: ${stdout.slice(0, 200)}`);
  }

  return parsed.messagesUnread;
}

// ---------------------------------------------------------------------------
// Fetch unread message details (up to 10 most recent)
// ---------------------------------------------------------------------------

async function fetchUnreadItems(): Promise<CollectorItem[]> {
  // List unread messages (max 10)
  const listResult = await runGws([
    'gmail', 'users', 'messages', 'list',
    '--params', '{"userId":"me","q":"is:unread","maxResults":10}',
  ]);

  if (listResult.exitCode !== 0) return [];

  let listParsed: GmailMessagesListResponse;
  try {
    listParsed = JSON.parse(listResult.stdout) as GmailMessagesListResponse;
  } catch {
    return [];
  }

  const messages = listParsed.messages ?? [];
  const items: CollectorItem[] = [];

  for (const msg of messages) {
    try {
      const detailResult = await runGws([
        'gmail', 'users', 'messages', 'get',
        '--params', JSON.stringify({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] }),
      ]);

      if (detailResult.exitCode !== 0) continue;

      const detail = JSON.parse(detailResult.stdout) as GmailMessageDetail;
      const headers = detail.payload?.headers ?? [];
      const from = headers.find(h => h.name === 'From')?.value ?? 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value ?? '(no subject)';
      const date = headers.find(h => h.name === 'Date')?.value ?? null;

      items.push({
        title: subject,
        link: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
        meta: { from, date },
      });
    } catch {
      // Skip individual message errors
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------

export async function collect(): Promise<void> {
  const now = new Date().toISOString();

  let result: CollectorResult;

  try {
    const count = await fetchUnreadCount();

    // Fetch detailed items (best-effort, don't fail on this)
    let items: CollectorItem[] | null = null;
    try {
      items = await fetchUnreadItems();
    } catch {
      // Items are optional — count is the primary data
    }

    result = {
      value: count,
      status: 'ok',
      fetchedAt: now,
      ttlMs: TTL_MS,
      errorKind: null,
      detail: null,
      source: SERVICE,
      items,
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
