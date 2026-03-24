/**
 * collectors/gmail.ts
 *
 * Gmail unread count collector.
 *
 * Strategy:
 *  - Fetches the UNREAD system label info from the Gmail API.
 *  - Endpoint: GET https://gmail.googleapis.com/gmail/v1/users/me/labels/UNREAD
 *  - The `messagesUnread` field gives the total unread message count.
 *  - Uses the Google OAuth2 token from google-auth.ts.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/gmail.json.
 *
 * TTL: 5 minutes.
 */

import * as https from 'https';
import type { CollectorResult, ErrorKind } from '../types';
import { writeCacheFile } from '../coordinator';
import { getValidAccessToken } from '../google-auth';

const SERVICE = 'gmail';
const TTL_MS = 5 * 60_000; // 5 minutes

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

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(err: unknown): { errorKind: ErrorKind; detail: string } {
  const msg = err instanceof Error ? err.message : String(err);

  if (/client_secret|tokens|OAuth|refresh_token|token.*not found/i.test(msg)) {
    return { errorKind: 'auth', detail: `Google auth not configured: ${msg}` };
  }

  if (/401|403|invalid_grant|invalid_token|unauthorized|forbidden/i.test(msg)) {
    return { errorKind: 'auth', detail: `Gmail authentication failed: ${msg}` };
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
// Fetch UNREAD label info
// ---------------------------------------------------------------------------

async function fetchUnreadCount(accessToken: string): Promise<number> {
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/labels/UNREAD';
  const raw = await httpsGet(url, accessToken);

  let parsed: GmailLabelResponse;
  try {
    parsed = JSON.parse(raw) as GmailLabelResponse;
  } catch {
    throw new Error(`Failed to parse Gmail API response: ${raw.slice(0, 200)}`);
  }

  if (parsed.messagesUnread === undefined) {
    throw new Error(`Gmail API response missing messagesUnread field: ${raw.slice(0, 200)}`);
  }

  return parsed.messagesUnread;
}

// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------

export async function collect(): Promise<void> {
  const now = new Date().toISOString();

  let result: CollectorResult;

  try {
    // 1. Get a valid access token (refreshes if expired)
    const accessToken = await getValidAccessToken();

    // 2. Fetch unread count from Gmail API
    const count = await fetchUnreadCount(accessToken);

    result = {
      value: count,
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
