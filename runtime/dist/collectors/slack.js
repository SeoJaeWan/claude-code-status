"use strict";
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
exports.collect = collect;
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const coordinator_1 = require("../coordinator");
const cache_1 = require("../cache");
const SERVICE = 'slack';
const TTL_MS = 120000; // 2 minutes
const API_BASE = 'https://slack.com/api';
// ---------------------------------------------------------------------------
// Config reading
// ---------------------------------------------------------------------------
function readSlackConfig() {
    try {
        const configPath = path.join((0, cache_1.getPluginDataDir)(), 'config.json');
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed.slack ?? {};
    }
    catch {
        return {};
    }
}
// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------
function classifyError(err) {
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
function httpsGet(url, token) {
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
            timeout: 15000,
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
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
async function fetchDmUnreadCounts(token) {
    let total = 0;
    let cursor = '';
    do {
        const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
        const url = `${API_BASE}/conversations.list?types=im,mpim&exclude_archived=true&limit=200${cursorParam}`;
        const raw = await httpsGet(url, token);
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            throw new Error(`Failed to parse conversations.list response: ${raw.slice(0, 200)}`);
        }
        if (!parsed.ok) {
            throw new Error(parsed.error ?? 'Unknown Slack API error from conversations.list');
        }
        for (const channel of parsed.channels ?? []) {
            total += channel.unread_count ?? 0;
        }
        cursor = parsed.response_metadata?.next_cursor ?? '';
    } while (cursor);
    return total;
}
async function fetchChannelUnreadCount(token, channelId) {
    const url = `${API_BASE}/conversations.info?channel=${encodeURIComponent(channelId)}`;
    const raw = await httpsGet(url, token);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`Failed to parse conversations.info response for ${channelId}: ${raw.slice(0, 200)}`);
    }
    if (!parsed.ok) {
        throw new Error(parsed.error ?? `Unknown Slack API error from conversations.info for channel ${channelId}`);
    }
    return parsed.channel?.unread_count ?? 0;
}
// ---------------------------------------------------------------------------
// Main fetch
// ---------------------------------------------------------------------------
async function fetchUnreadCount() {
    const slackConfig = readSlackConfig();
    if (!slackConfig.token) {
        throw new Error('Slack token not configured. Add slack.token to config.json.');
    }
    const token = slackConfig.token;
    const channelIds = slackConfig.channels ?? [];
    // Fetch DM + MPIM unread counts
    const dmCount = await fetchDmUnreadCounts(token);
    // Fetch configured channel unread counts
    let channelCount = 0;
    for (const channelId of channelIds) {
        channelCount += await fetchChannelUnreadCount(token, channelId);
    }
    return dmCount + channelCount;
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
//# sourceMappingURL=slack.js.map