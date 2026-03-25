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
 * TTL: 5 minutes.
 */
export declare function collect(): Promise<void>;
//# sourceMappingURL=gmail.d.ts.map