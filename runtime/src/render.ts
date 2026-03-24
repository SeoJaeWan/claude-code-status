/**
 * render.ts
 *
 * Main entrypoint for the claude-status statusLine renderer.
 *
 * Called by: scripts/status-line.ps1 (PowerShell launcher)
 * Reads: stdin JSON from Claude Code, cache files from ${CLAUDE_PLUGIN_DATA}/cache/
 * Outputs: one-line status string to stdout
 *
 * CALL CHAIN:
 *   ~/.claude/settings.json (statusLine.command)
 *     -> status-line.ps1 (PowerShell launcher)
 *     -> node render.js  (this file, stdin piped through)
 *     -> stdout: "week 42% session 18% | gmail 7 | tasks 3 | jira 5 | github 4"
 *
 * EXIT CODES:
 *   0  - success
 *   1+ - error (launcher handles fallback output)
 */

import { readCache, isFresh } from './cache';
import type {
  StatusLineInput,
  ServiceName,
  ServiceSegment,
  CollectorResult,
} from './types';

// ---------------------------------------------------------------------------
// Stdin parsing
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    // If stdin is not a pipe (e.g. running directly), resolve immediately
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

function parseStdinInput(raw: string): StatusLineInput {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as StatusLineInput;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// week / session — read from stdin, fall back to cache
// ---------------------------------------------------------------------------

function renderWeekSession(input: StatusLineInput): string {
  const weekPct = input.rate_limits?.seven_day?.used_percentage;
  const sessionPct = input.rate_limits?.five_hour?.used_percentage;

  const weekStr = weekPct != null ? `week ${Math.round(weekPct)}%` : null;
  const sessionStr = sessionPct != null ? `session ${Math.round(sessionPct)}%` : null;

  const parts = [weekStr, sessionStr].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' ') : '';
}

// ---------------------------------------------------------------------------
// Service segment rendering
// ---------------------------------------------------------------------------

/**
 * Converts a collector result to a display string.
 *   - ok + fresh:  the numeric value (or '-' if value is null)
 *   - error:       '!'
 *   - stale/null:  the value if available, otherwise '-'
 */
function resultToDisplay(result: CollectorResult | null): string {
  if (!result) return '-';

  if (result.status === 'error') return '!';

  if (result.value === null) return '-';

  return String(result.value);
}

function renderService(service: ServiceName): ServiceSegment {
  const result = readCache(service);
  const display = resultToDisplay(result);

  // If stale, we could trigger background refresh here in a future phase.
  // For Phase 1 skeleton, we just read and render.
  if (result && !isFresh(result) && result.status === 'ok') {
    // Stale but has a value — show it (Phase 3 will add background refresh)
  }

  return { name: service, display };
}

// ---------------------------------------------------------------------------
// Format the final status line
// ---------------------------------------------------------------------------

function formatStatusLine(
  weekSession: string,
  services: ServiceSegment[],
): string {
  const serviceStr = services
    .map((s) => `${s.name} ${s.display}`)
    .join(' | ');

  if (weekSession && serviceStr) {
    return `${weekSession} | ${serviceStr}`;
  }
  if (weekSession) {
    return weekSession;
  }
  if (serviceStr) {
    return serviceStr;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SERVICES: ServiceName[] = ['gmail', 'tasks', 'jira', 'github'];

async function main(): Promise<void> {
  try {
    const rawStdin = await readStdin();
    const input = parseStdinInput(rawStdin);

    const weekSession = renderWeekSession(input);
    const segments = SERVICES.map(renderService);

    const output = formatStatusLine(weekSession, segments);

    // Write output without trailing newline issues — process.stdout.write
    // ensures exactly what we output; PowerShell launcher trims trailing whitespace.
    process.stdout.write(output + '\n');
    process.exit(0);
  } catch (err) {
    // Write to stderr so launcher can log it; stdout stays clean
    process.stderr.write(
      `[render] ERROR: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

main();
