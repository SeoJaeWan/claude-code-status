/**
 * collectors/slack.ts
 *
 * Slack unread count collector.
 *
 * Strategy:
 *  - Reads `slack.token` and `slack.channels` from ${CLAUDE_PLUGIN_DATA}/config.json.
 *  - Calls Slack Web API via Node.js built-in `https` module (no SDK).
 *  - Fetches DM/MPIM unread counts via conversations.list.
 *  - Fetches configured channel unread counts via conversations.info.
 *  - Sums all unread counts and writes to ${CLAUDE_PLUGIN_DATA}/cache/slack.json.
 *
 * TTL: 2 minutes.
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import type { CollectorResult, CollectorItem, ErrorKind } from '../types';
import { writeCacheFile } from '../coordinator';
import { getPluginDataDir } from '../cache';

const SERVICE = 'slack';
const TTL_MS = 120_000; // 2 minutes
const API_BASE = 'https://slack.com/api';

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

interface SlackConfig {
  token?: string;
  channels?: string[];
}

interface PluginConfig {
  slack?: SlackConfig;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Slack API response types
// ---------------------------------------------------------------------------

interface SlackChannel {
  id: string;
  name?: string;
  user?: string;
  is_im?: boolean;
  is_mpim?: boolean;
  unread_count?: number;
}

interface SlackConversationsListResponse {
  ok: boolean;
  channels?: SlackChannel[];
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
}

interface SlackConversationsInfoResponse {
  ok: boolean;
  channel?: SlackChannel & { name?: string; mention_count?: number };
  error?: string;
}

interface SlackUnreadDetail {
  name: string;
  unreadCount: number;
  type: 'dm' | 'channel';
}

// ---------------------------------------------------------------------------
// Config reading
// ---------------------------------------------------------------------------

function readSlackConfig(): SlackConfig {
  try {
    const configPath = path.join(getPluginDataDir(), 'config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as PluginConfig;
    return parsed.slack ?? {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(err: unknown): { errorKind: ErrorKind; detail: string } {
  const msg = err instanceof Error ? err.message : String(err);

  if (/token_revoked|invalid_auth|not_authed|account_inactive/i.test(msg)) {
    return { errorKind: 'auth', detail: `Slack auth error: ${msg}` };
  }

  if (/ratelimited/i.test(msg)) {
    return { errorKind: 'rate_limit', detail: `Slack rate limit exceeded: ${msg}` };
  }

  if (/slack token not configured|no token/i.test(msg)) {
    return { errorKind: 'dependency', detail: msg };
  }

  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network|socket|timeout/i.test(msg)) {
    return { errorKind: 'transient', detail: `Network error: ${msg}` };
  }

  return { errorKind: 'transient', detail: msg };
}

// ---------------------------------------------------------------------------
// HTTPS helper
// ---------------------------------------------------------------------------

function httpsGet(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => { resolve(body); });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('ETIMEDOUT: Slack API request timed out'));
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// Slack API calls
// ---------------------------------------------------------------------------

async function fetchDmUnreadDetails(token: string): Promise<SlackUnreadDetail[]> {
  const details: SlackUnreadDetail[] = [];
  let cursor = '';

  do {
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const url = `${API_BASE}/conversations.list?types=im,mpim&exclude_archived=true&limit=200${cursorParam}`;
    const raw = await httpsGet(url, token);

    let parsed: SlackConversationsListResponse;
    try {
      parsed = JSON.parse(raw) as SlackConversationsListResponse;
    } catch {
      throw new Error(`Failed to parse conversations.list response: ${raw.slice(0, 200)}`);
    }

    if (!parsed.ok) {
      throw new Error(parsed.error ?? 'Unknown Slack API error from conversations.list');
    }

    for (const channel of parsed.channels ?? []) {
      const count = channel.unread_count ?? 0;
      if (count > 0) {
        details.push({
          name: channel.user ?? channel.name ?? channel.id,
          unreadCount: count,
          type: 'dm',
        });
      }
    }

    cursor = parsed.response_metadata?.next_cursor ?? '';
  } while (cursor);

  return details;
}

async function fetchChannelUnreadDetail(token: string, channelId: string): Promise<SlackUnreadDetail | null> {
  const url = `${API_BASE}/conversations.info?channel=${encodeURIComponent(channelId)}`;
  const raw = await httpsGet(url, token);

  let parsed: SlackConversationsInfoResponse;
  try {
    parsed = JSON.parse(raw) as SlackConversationsInfoResponse;
  } catch {
    throw new Error(`Failed to parse conversations.info response for ${channelId}: ${raw.slice(0, 200)}`);
  }

  if (!parsed.ok) {
    throw new Error(parsed.error ?? `Unknown Slack API error from conversations.info for channel ${channelId}`);
  }

  const count = parsed.channel?.mention_count ?? 0;
  return {
    name: parsed.channel?.name ?? channelId,
    unreadCount: count,
    type: 'channel',
  };
}

// ---------------------------------------------------------------------------
// Main fetch
// ---------------------------------------------------------------------------

interface SlackFetchResult {
  total: number;
  items: CollectorItem[];
}

async function fetchUnreadDetails(): Promise<SlackFetchResult> {
  const slackConfig = readSlackConfig();

  if (!slackConfig.token) {
    throw new Error('Slack token not configured. Add slack.token to config.json.');
  }

  const token = slackConfig.token;
  const channelIds = slackConfig.channels ?? [];

  // Fetch DM + MPIM unread details
  const dmDetails = await fetchDmUnreadDetails(token);

  // Fetch configured channel unread details
  const channelDetails: SlackUnreadDetail[] = [];
  for (const channelId of channelIds) {
    const detail = await fetchChannelUnreadDetail(token, channelId);
    if (detail) channelDetails.push(detail);
  }

  const allDetails = [...dmDetails, ...channelDetails];
  const total = allDetails.reduce((sum, d) => sum + d.unreadCount, 0);

  const items: CollectorItem[] = allDetails
    .filter(d => d.unreadCount > 0)
    .map(d => ({
      title: d.type === 'dm' ? `@${d.name}` : `#${d.name}`,
      link: null,
      meta: {
        unread: d.unreadCount,
        type: d.type,
      },
    }));

  return { total, items };
}

// ---------------------------------------------------------------------------
// Main collect function
// ---------------------------------------------------------------------------

export async function collect(): Promise<void> {
  const now = new Date().toISOString();

  let result: CollectorResult;

  try {
    const { total, items } = await fetchUnreadDetails();

    result = {
      value: total,
      status: 'ok',
      fetchedAt: now,
      ttlMs: TTL_MS,
      errorKind: null,
      detail: null,
      source: SERVICE,
      items,
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
