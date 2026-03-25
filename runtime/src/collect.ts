/**
 * collect.ts
 *
 * CLI entrypoint for the collector dispatcher.
 *
 * Usage:
 *   node collect.js --service <name> [--force]
 *
 * Services: github | jira | gmail | tasks | slack
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

import { acquireLock, releaseLock, isStale } from './coordinator';
import type { ServiceName } from './types';

// ---------------------------------------------------------------------------
// Supported services
// week/session are derived from stdin, not collected via this CLI.
// ---------------------------------------------------------------------------

type CollectableService = Extract<ServiceName, 'github' | 'jira' | 'gmail' | 'tasks' | 'slack'>;

const SUPPORTED_SERVICES: CollectableService[] = ['github', 'jira', 'gmail', 'tasks', 'slack'];

function isSupportedService(name: string): name is CollectableService {
  return (SUPPORTED_SERVICES as string[]).includes(name);
}

// ---------------------------------------------------------------------------
// Lazy collector imports (avoids loading all modules on every invocation)
// ---------------------------------------------------------------------------

async function loadCollector(service: CollectableService): Promise<{ collect: () => Promise<void> }> {
  switch (service) {
    case 'github':
      return import('./collectors/github');
    case 'jira':
      return import('./collectors/jira');
    case 'gmail':
      return import('./collectors/gmail');
    case 'tasks':
      return import('./collectors/tasks');
    case 'slack':
      return import('./collectors/slack');
    default: {
      // TypeScript exhaustiveness guard
      const _exhaustive: never = service;
      throw new Error(`Unknown service: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  service: CollectableService;
  force: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // strip 'node' and script path

  let service: string | null = null;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--service' && i + 1 < args.length) {
      service = args[++i] ?? null;
    } else if (arg === '--force') {
      force = true;
    }
  }

  if (!service) {
    process.stderr.write('Usage: node collect.js --service <name> [--force]\n');
    process.stderr.write(`Supported services: ${SUPPORTED_SERVICES.join(', ')}\n`);
    process.exit(2);
  }

  if (!isSupportedService(service)) {
    process.stderr.write(`Unknown service: "${service}"\n`);
    process.stderr.write(`Supported services: ${SUPPORTED_SERVICES.join(', ')}\n`);
    process.exit(2);
  }

  return { service, force };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { service, force } = parseArgs(process.argv);

  // Skip if cache is still fresh (unless --force)
  if (!force && !isStale(service)) {
    process.stderr.write(`[collect] ${service}: cache is still fresh, skipping\n`);
    process.exit(0);
  }

  // Acquire lock to prevent concurrent collectors for the same service
  const locked = acquireLock(service);
  if (!locked) {
    process.stderr.write(`[collect] ${service}: another collector is already running, skipping\n`);
    process.exit(0);
  }

  try {
    process.stderr.write(`[collect] ${service}: starting collection (force=${force})\n`);

    const collector = await loadCollector(service);
    await collector.collect();

    process.stderr.write(`[collect] ${service}: collection complete\n`);
    process.exit(0);
  } catch (err) {
    process.stderr.write(
      `[collect] ${service}: unhandled error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  } finally {
    releaseLock(service);
  }
}

main();
