/**
 * collect.ts
 *
 * CLI entrypoint for the collector dispatcher.
 *
 * Usage:
 *   node collect.js --service <name> [--force]
 *
 * Services: github | jira | gmail | tasks
 *
 * Flags:
 *   --service <name>  Required. The service to collect data for.
 *   --force           Optional. Bypass TTL check and always fetch fresh data.
 *
 * Exit codes:
 *   0  - success (cache written)
 *   1  - error (cache written with error status; also logged to stderr)
 *   2  - usage error (unknown service, missing flag)
 *
 * This script is spawned by the coordinator as a detached background process
 * during render, and can also be run manually for testing.
 *
 * Example:
 *   node collect.js --service github --force
 */
export {};
//# sourceMappingURL=collect.d.ts.map