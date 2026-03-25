/**
 * types.ts
 *
 * Shared type definitions for the claude-status runtime.
 */
export interface RateLimitWindow {
    used_percentage?: number;
    limit?: number;
    used?: number;
}
export interface RateLimits {
    five_hour?: RateLimitWindow;
    seven_day?: RateLimitWindow;
}
/** JSON object passed via stdin by Claude Code to the statusLine command. */
export interface StatusLineInput {
    rate_limits?: RateLimits;
    model?: string;
    session_id?: string;
    /** Any additional fields Claude Code may add in future versions. */
    [key: string]: unknown;
}
/** Status of a collector result. */
export type CollectorStatus = 'ok' | 'error' | 'stale' | 'pending';
/** Error category for collector failures. */
export type ErrorKind = 'auth' | 'dependency' | 'rate_limit' | 'transient' | 'unknown';
/**
 * Schema for each collector's JSON cache file.
 * Stored at: ${CLAUDE_PLUGIN_DATA}/cache/<service>.json
 */
export interface CollectorResult {
    /** Numeric count to display, or null if unavailable. */
    value: number | null;
    /** Collector result status. */
    status: CollectorStatus;
    /** ISO 8601 timestamp of when data was fetched. */
    fetchedAt: string;
    /** Cache TTL in milliseconds. */
    ttlMs: number;
    /** Error category; null when status is 'ok'. */
    errorKind: ErrorKind | null;
    /** Human-readable error detail for doctor/debug output; null when none. */
    detail: string | null;
    /** Data source identifier (service name, e.g. 'gmail', 'github'). */
    source: string;
}
export type ServiceName = 'week' | 'session' | 'gmail' | 'tasks' | 'jira' | 'github';
/** Rendered segment for one service. */
export interface ServiceSegment {
    name: ServiceName;
    /** Display value: number string, '!', or '-' */
    display: string;
}
//# sourceMappingURL=types.d.ts.map