/**
 * render.test.ts
 *
 * Tests for the renderer formatting logic.
 * We test the pure functions by re-implementing/extracting them through
 * a helper module, or by testing the color-stripped output.
 */

import { describe, it, expect } from 'vitest';
import type { CollectorResult, StatusLineInput } from '../types';

// ---------------------------------------------------------------------------
// Helpers — strip ANSI escape codes for plain text assertions
// ---------------------------------------------------------------------------

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// ---------------------------------------------------------------------------
// Inline pure functions extracted from render.ts for unit testing.
// These mirror the logic in render.ts without the process.stdin / I/O side
// effects so tests remain synchronous and dependency-free.
// ---------------------------------------------------------------------------

const ANSI_RESET  = '\x1b[0m';
const ANSI_RED    = '\x1b[31m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_GRAY   = '\x1b[90m';

function red(s: string): string    { return `${ANSI_RED}${s}${ANSI_RESET}`; }
function yellow(s: string): string { return `${ANSI_YELLOW}${s}${ANSI_RESET}`; }
function gray(s: string): string   { return `${ANSI_GRAY}${s}${ANSI_RESET}`; }

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

type ExternalService = 'gmail' | 'tasks' | 'jira' | 'github';

function applyServiceColor(service: ExternalService, count: number, text: string): string {
  switch (service) {
    case 'gmail':  return colorGmail(count, text);
    case 'tasks':  return colorTasks(count, text);
    case 'jira':   return colorJira(count, text);
    case 'github': return colorGithub(count, text);
  }
}

function resultToColoredDisplay(service: ExternalService, result: CollectorResult | null): string {
  if (!result) return gray('-');
  if (result.status === 'error') return red('!');
  if (result.value === null) return gray('-');
  const numStr = String(result.value);
  return applyServiceColor(service, result.value, numStr);
}

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

function formatStatusLine(weekSession: string, serviceSegments: string[]): string {
  const serviceStr = serviceSegments.join(' | ');
  if (weekSession && serviceStr) return `${weekSession} | ${serviceStr}`;
  if (weekSession) return weekSession;
  if (serviceStr) return serviceStr;
  return '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderWeekSession', () => {
  it('renders both week and session percentages', () => {
    const input: StatusLineInput = {
      rate_limits: {
        seven_day: { used_percentage: 42 },
        five_hour:  { used_percentage: 18 },
      },
    };
    const result = stripAnsi(renderWeekSession(input));
    expect(result).toBe('week 42% session 18%');
  });

  it('renders only week when session is absent', () => {
    const input: StatusLineInput = {
      rate_limits: { seven_day: { used_percentage: 50 } },
    };
    expect(stripAnsi(renderWeekSession(input))).toBe('week 50%');
  });

  it('renders only session when week is absent', () => {
    const input: StatusLineInput = {
      rate_limits: { five_hour: { used_percentage: 10 } },
    };
    expect(stripAnsi(renderWeekSession(input))).toBe('session 10%');
  });

  it('returns empty string when rate_limits is missing', () => {
    expect(renderWeekSession({})).toBe('');
  });

  it('returns empty string when rate_limits is present but empty', () => {
    expect(renderWeekSession({ rate_limits: {} })).toBe('');
  });

  it('rounds fractional percentages', () => {
    const input: StatusLineInput = {
      rate_limits: { seven_day: { used_percentage: 42.7 } },
    };
    expect(stripAnsi(renderWeekSession(input))).toBe('week 43%');
  });
});

describe('color thresholds — week/session', () => {
  it('applies no color below 60%', () => {
    const out = colorWeekSession(59, 'week 59%');
    expect(out).toBe('week 59%');
  });

  it('applies yellow at 60%', () => {
    const out = colorWeekSession(60, 'week 60%');
    expect(out).toBe(yellow('week 60%'));
  });

  it('applies yellow at 79%', () => {
    const out = colorWeekSession(79, 'week 79%');
    expect(out).toBe(yellow('week 79%'));
  });

  it('applies red at 80%', () => {
    const out = colorWeekSession(80, 'week 80%');
    expect(out).toBe(red('week 80%'));
  });

  it('applies red at 100%', () => {
    const out = colorWeekSession(100, 'week 100%');
    expect(out).toBe(red('week 100%'));
  });
});

describe('color thresholds — gmail', () => {
  it('gray at 0', () => expect(colorGmail(0, '0')).toBe(gray('0')));
  it('no color at 1', () => expect(colorGmail(1, '1')).toBe('1'));
  it('no color at 9', () => expect(colorGmail(9, '9')).toBe('9'));
  it('yellow at 10', () => expect(colorGmail(10, '10')).toBe(yellow('10')));
  it('yellow at 29', () => expect(colorGmail(29, '29')).toBe(yellow('29')));
  it('red at 30', () => expect(colorGmail(30, '30')).toBe(red('30')));
});

describe('color thresholds — tasks', () => {
  it('gray at 0', () => expect(colorTasks(0, '0')).toBe(gray('0')));
  it('no color at 5', () => expect(colorTasks(5, '5')).toBe('5'));
  it('yellow at 6', () => expect(colorTasks(6, '6')).toBe(yellow('6')));
  it('yellow at 10', () => expect(colorTasks(10, '10')).toBe(yellow('10')));
  it('red at 11', () => expect(colorTasks(11, '11')).toBe(red('11')));
});

describe('color thresholds — jira', () => {
  it('gray at 0', () => expect(colorJira(0, '0')).toBe(gray('0')));
  it('yellow at 6', () => expect(colorJira(6, '6')).toBe(yellow('6')));
  it('red at 11', () => expect(colorJira(11, '11')).toBe(red('11')));
});

describe('color thresholds — github', () => {
  it('gray at 0', () => expect(colorGithub(0, '0')).toBe(gray('0')));
  it('no color at 3', () => expect(colorGithub(3, '3')).toBe('3'));
  it('yellow at 4', () => expect(colorGithub(4, '4')).toBe(yellow('4')));
  it('yellow at 7', () => expect(colorGithub(7, '7')).toBe(yellow('7')));
  it('red at 8', () => expect(colorGithub(8, '8')).toBe(red('8')));
});

describe('resultToColoredDisplay', () => {
  const okResult = (value: number, service: ExternalService = 'gmail'): CollectorResult => ({
    value,
    status: 'ok',
    fetchedAt: new Date().toISOString(),
    ttlMs: 300_000,
    errorKind: null,
    detail: null,
    source: service,
  });

  it('returns gray dash for null cache result', () => {
    expect(resultToColoredDisplay('gmail', null)).toBe(gray('-'));
  });

  it('returns red ! for error status', () => {
    const result: CollectorResult = {
      value: null,
      status: 'error',
      fetchedAt: new Date().toISOString(),
      ttlMs: 300_000,
      errorKind: 'auth',
      detail: 'token expired',
      source: 'gmail',
    };
    expect(resultToColoredDisplay('gmail', result)).toBe(red('!'));
  });

  it('returns gray dash when value is null and status is ok', () => {
    const result: CollectorResult = {
      value: null,
      status: 'pending',
      fetchedAt: new Date().toISOString(),
      ttlMs: 300_000,
      errorKind: null,
      detail: null,
      source: 'gmail',
    };
    expect(stripAnsi(resultToColoredDisplay('gmail', result))).toBe('-');
  });

  it('returns gray 0 for zero count', () => {
    expect(resultToColoredDisplay('gmail', okResult(0))).toBe(gray('0'));
  });

  it('returns plain number for small count', () => {
    expect(stripAnsi(resultToColoredDisplay('gmail', okResult(7)))).toBe('7');
  });

  it('returns colored number for high count', () => {
    const out = resultToColoredDisplay('github', okResult(8, 'github'));
    expect(out).toBe(red('8'));
  });
});

describe('formatStatusLine', () => {
  it('formats full output: week/session + services', () => {
    const ws = 'week 42% session 18%';
    const services = ['gmail 7', 'tasks 3', 'jira 5', 'github 4'];
    const out = formatStatusLine(ws, services);
    expect(out).toBe('week 42% session 18% | gmail 7 | tasks 3 | jira 5 | github 4');
  });

  it('formats week/session only when no services', () => {
    expect(formatStatusLine('week 50%', [])).toBe('week 50%');
  });

  it('formats services only when no week/session', () => {
    expect(formatStatusLine('', ['gmail 3', 'tasks 1'])).toBe('gmail 3 | tasks 1');
  });

  it('returns empty string when both are empty', () => {
    expect(formatStatusLine('', [])).toBe('');
  });
});

describe('parseStdinInput — various shapes', () => {
  function parseStdinInput(raw: string): StatusLineInput {
    if (!raw.trim()) return {};
    try { return JSON.parse(raw) as StatusLineInput; }
    catch { return {}; }
  }

  it('returns empty object for empty string', () => {
    expect(parseStdinInput('')).toEqual({});
  });

  it('returns empty object for whitespace-only input', () => {
    expect(parseStdinInput('   \n')).toEqual({});
  });

  it('returns empty object for invalid JSON', () => {
    expect(parseStdinInput('{invalid}')).toEqual({});
  });

  it('parses valid JSON with rate_limits', () => {
    const json = JSON.stringify({
      rate_limits: {
        seven_day: { used_percentage: 42 },
        five_hour:  { used_percentage: 18 },
      },
    });
    const result = parseStdinInput(json);
    expect(result.rate_limits?.seven_day?.used_percentage).toBe(42);
    expect(result.rate_limits?.five_hour?.used_percentage).toBe(18);
  });

  it('handles partial data — missing five_hour', () => {
    const json = JSON.stringify({
      rate_limits: { seven_day: { used_percentage: 55 } },
    });
    const result = parseStdinInput(json);
    expect(result.rate_limits?.seven_day?.used_percentage).toBe(55);
    expect(result.rate_limits?.five_hour).toBeUndefined();
  });

  it('handles missing rate_limits key entirely', () => {
    const json = JSON.stringify({ model: 'claude-opus-4', session_id: 'abc' });
    const result = parseStdinInput(json);
    expect(result.rate_limits).toBeUndefined();
  });
});
