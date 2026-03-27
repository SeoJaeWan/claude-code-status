/**
 * watcher.ts
 *
 * Background cache watcher — spawned once per session by session-start.sh.
 * Periodically invokes collect.js for each enabled service so the cache
 * stays fresh even when the user is not actively chatting.
 *
 * Duplicate prevention: uses a PID file at ${CLAUDE_PLUGIN_DATA}/watcher.pid.
 * If a living watcher already exists, this process exits immediately.
 *
 * Exit:
 *   - Naturally dies when the parent shell session ends (detached but
 *     orphaned processes are harmless — they just refresh cache files).
 *   - SIGTERM / SIGINT cause graceful shutdown + PID file cleanup.
 */
export {};
//# sourceMappingURL=watcher.d.ts.map