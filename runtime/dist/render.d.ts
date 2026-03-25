/**
 * render.ts
 *
 * Main entrypoint for the claude-status statusLine renderer.
 *
 * Called by: scripts/status-line.sh (bash launcher)
 * Reads: stdin JSON from Claude Code, cache files from ${CLAUDE_PLUGIN_DATA}/cache/
 * Outputs: one-line status string to stdout
 *
 * CALL CHAIN:
 *   ~/.claude/settings.json (statusLine.command)
 *     -> status-line.sh (bash launcher)
 *     -> node render.js  (this file, stdin piped through)
 *     -> stdout: "week 42% session 18% | gmail 7 | tasks 3 | jira 5 | github 4"
 *
 * EXIT CODES:
 *   0  - always (even on error — fallback text is written to stdout so Claude
 *         Code does not display a blank status line)
 */
export {};
//# sourceMappingURL=render.d.ts.map