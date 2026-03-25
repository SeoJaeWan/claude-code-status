/**
 * collectors/github.ts
 *
 * GitHub PR notification collector.
 *
 * Strategy:
 *  - Calls `gh api /notifications` (uses gh CLI's stored credentials).
 *  - Filters to unread threads where subject.type === 'PullRequest'.
 *  - Deduplicates by thread id (same PR, multiple reasons = 1 count).
 *  - Respects X-Poll-Interval header stored in the cache metadata.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/github.json.
 *
 * TTL: 1 minute.
 */
export declare function collect(): Promise<void>;
//# sourceMappingURL=github.d.ts.map