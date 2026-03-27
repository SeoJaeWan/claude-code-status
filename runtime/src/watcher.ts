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

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { getPluginDataDir } from './cache';
import { isServiceEnabled, readConfig } from './config';
import type { ServiceName } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type CollectableService = Extract<ServiceName, 'gmail' | 'tasks' | 'jira' | 'github' | 'slack'>;
const SERVICES: CollectableService[] = ['gmail', 'tasks', 'jira', 'github', 'slack'];
const DEFAULT_INTERVAL_SEC = 60;
const MIN_INTERVAL_SEC = 10;

// ---------------------------------------------------------------------------
// PID file helpers
// ---------------------------------------------------------------------------

function getPidPath(): string {
  return path.join(getPluginDataDir(), 'watcher.pid');
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true if another watcher is already running.
 */
function isAnotherWatcherRunning(): boolean {
  const pidPath = getPidPath();
  try {
    const raw = fs.readFileSync(pidPath, 'utf8').trim();
    const pid = parseInt(raw, 10);
    if (isNaN(pid)) return false;
    if (pid === process.pid) return false;
    return isProcessAlive(pid);
  } catch {
    return false;
  }
}

function writePidFile(): void {
  fs.writeFileSync(getPidPath(), String(process.pid), 'utf8');
}

function removePidFile(): void {
  try {
    fs.unlinkSync(getPidPath());
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Interval config
// ---------------------------------------------------------------------------

function getIntervalMs(): number {
  const config = readConfig();
  const sec = (config as Record<string, unknown>).refreshIntervalSec;
  if (typeof sec === 'number' && sec >= MIN_INTERVAL_SEC) return sec * 1000;
  return DEFAULT_INTERVAL_SEC * 1000;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function refreshAll(): void {
  const collectScript = path.join(__dirname, 'collect.js');
  if (!fs.existsSync(collectScript)) return;

  for (const svc of SERVICES) {
    if (!isServiceEnabled(svc)) continue;
    try {
      const child = spawn(
        process.execPath,
        [collectScript, '--service', svc],
        {
          detached: true,
          stdio: 'ignore',
          env: { ...process.env, CLAUDE_PLUGIN_DATA: getPluginDataDir() },
          windowsHide: true,
        },
      );
      child.unref();
    } catch {
      // ignore individual service failures
    }
  }
}

function log(msg: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [watcher] ${msg}\n`);
}

async function main(): Promise<void> {
  // Duplicate guard
  if (isAnotherWatcherRunning()) {
    log('Another watcher is already running. Exiting.');
    process.exit(0);
  }

  // Claim PID
  writePidFile();

  // Cleanup on exit
  const cleanup = () => removePidFile();
  process.on('exit', cleanup);
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('SIGINT', () => { cleanup(); process.exit(0); });

  const intervalMs = getIntervalMs();
  log(`Started (pid=${process.pid}, interval=${intervalMs / 1000}s)`);

  // Initial refresh immediately
  refreshAll();

  // Loop
  while (true) {
    await sleep(intervalMs);
    refreshAll();
  }
}

main().catch((err) => {
  log(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  removePidFile();
  process.exit(1);
});
