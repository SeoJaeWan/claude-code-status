/**
 * collectors/jira.ts
 *
 * Jira issue collector.
 *
 * Strategy:
 *  - Uses `acli jira` CLI (Atlassian CLI) to execute a JQL query.
 *  - JQL: assignee = currentUser() AND statusCategory != Done
 *  - Extracts the total issue count from the CLI output.
 *  - Checks login status before fetching.
 *  - Writes result to ${CLAUDE_PLUGIN_DATA}/cache/jira.json.
 *
 * TTL: 5 minutes.
 */
export declare function collect(): Promise<void>;
//# sourceMappingURL=jira.d.ts.map