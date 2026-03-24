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
 *   0  - always (even on error — fallback text is written to stdout so Claude
 *         Code does not display a blank status line)
 */

import { readCache, isFresh } from './cache';
import { triggerRefreshIfStale } from './coordinator';
import type {
  StatusLineInput,
  ServiceName,
  CollectorResult,
} from './types';

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

const ANSI_RESET  = '\x1b[0m';
const ANSI_RED    = '\x1b[31m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_GRAY   = '\x1b[90m';

function red(s: string): string    { return `${ANSI_RED}${s}${ANSI_RESET}`; }
function yellow(s: string): string { return `${ANSI_YELLOW}${s}${ANSI_RESET}`; }
function gray(s: string): string   { return `${ANSI_GRAY}${s}${ANSI_RESET}`; }

// ---------------------------------------------------------------------------
// Color thresholds per domain.md
// ---------------------------------------------------------------------------

function colorWeekSession(pct: number, text: string): string {
  if (pct >= 80) return red(text);
  if (pct >= 60) return yellow(text);
  return text;
}

function colorGmail(count: number, text: string): string {
  if (count === 0)  return gray(text);
  if (count >= 30)  return red(text);
  if (count >= 10)  return yellow(text);
  return text;
}

function colorTasks(count: number, text: string): string {
  if (count === 0)  return gray(text);
  if (count >= 11)  return red(text);
  if (count >= 6)   return yellow(text);
  return text;
}

function colorJira(count: number, text: string): string {
  if (count === 0)  return gray(text);
  if (count >= 11)  return red(text);
  if (count >= 6)   return yellow(text);
  return text;
}

function colorGithub(count: number, text: string): string {
  if (count === 0)  return gray(text);
  if (count >= 8)   return red(text);
  if (count >= 4)   return yellow(text);
  return text;
}

type ExternalService = Extract<ServiceName, 'gmail' | 'tasks' | 'jira' | 'github'>;

function applyServiceColor(service: ExternalService, count: number, text: string): string {
  switch (service) {
    case 'gmail':  return colorGmail(count, text);
    case 'tasks':  return colorTasks(count, text);
    case 'jira':   return colorJira(count, text);
    case 'github': return colorGithub(count, text);
  }
}

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
// week / session — read from stdin, rendered with color
// ---------------------------------------------------------------------------

function renderWeekSession(input: StatusLineInput): string {
  const weekPct    = input.rate_limits?.seven_day?.used_percentage;
  const sessionPct = input.rate_limits?.five_hour?.used_percentage;

  let weekStr: string | null    = null;
  let sessionStr: string | null = null;

  if (weekPct != null) {
    const label = `week ${Math.round(weekPct)}%`;
    weekStr = colorWeekSession(weekPct, label);
  }

  if (sessionPct != null) {
    const label = `session ${Math.round(sessionPct)}%`;
    sessionStr = colorWeekSession(sessionPct, label);
  }

  const parts = [weekStr, sessionStr].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' ') : '';
}

// ---------------------------------------------------------------------------
// External service segment rendering
// ---------------------------------------------------------------------------

/**
 * Converts a collector result to a colored display token.
 *
 *   error status       -> red '!'
 *   null value         -> gray '-'
 *   numeric value 0    -> gray '0'  (per domain.md: 0 is always gray)
 *   numeric value > 0  -> colored number per threshold
 */
function resultToColoredDisplay(service: ExternalService, result: CollectorResult | null): string {
  // No cache file at all
  if (!result) {
    return gray('-');
  }

  // Collector reported an error
  if (result.status === 'error') {
    return red('!');
  }

  // Value unavailable (pending / unknown)
  if (result.value === null) {
    return gray('-');
  }

  const numStr = String(result.value);
  return applyServiceColor(service, result.value, numStr);
}

function renderService(service: ExternalService): string {
  const result = readCache(service);

  // Trigger a background refresh if the cache is stale.
  // triggerRefreshIfStale is non-blocking — it spawns a detached child process
  // and returns immediately.  The current (possibly stale) value is shown now.
  if (!result || (result.status !== 'error' && !isFresh(result))) {
    triggerRefreshIfStale(service);
  }

  const display = resultToColoredDisplay(service, result);
  return `${service} ${display}`;
}

// ---------------------------------------------------------------------------
// Format the final status line
// ---------------------------------------------------------------------------

function formatStatusLine(
  weekSession: string,
  serviceSegments: string[],
): string {
  const serviceStr = serviceSegments.join(' | ');

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

const SERVICES: ExternalService[] = ['gmail', 'tasks', 'jira', 'github'];

async function main(): Promise<void> {
  try {
    const rawStdin = await readStdin();
    const input = parseStdinInput(rawStdin);

    const weekSession = renderWeekSession(input);
    const segments    = SERVICES.map(renderService);

    const output = formatStatusLine(weekSession, segments);

    // Write output without trailing newline issues — process.stdout.write
    // ensures exactly what we output; PowerShell launcher trims trailing whitespace.
    process.stdout.write(output + '\n');
    process.exit(0);
  } catch (err) {
    // On any uncaught error: write a fallback line to stdout so Claude Code
    // always gets a valid single-line response, and log details to stderr.
    process.stderr.write(
      `[render] ERROR: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.stdout.write('status: render error\n');
    process.exit(0);
  }
}

main();
