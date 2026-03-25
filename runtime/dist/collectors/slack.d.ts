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
export declare function collect(): Promise<void>;
//# sourceMappingURL=slack.d.ts.map