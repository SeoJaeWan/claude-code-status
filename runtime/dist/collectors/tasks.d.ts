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
export declare function collect(): Promise<void>;
//# sourceMappingURL=tasks.d.ts.map