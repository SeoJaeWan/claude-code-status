/**
 * config.ts
 *
 * Reads and writes the user configuration file at
 * ${CLAUDE_PLUGIN_DATA}/config.json.
 *
 * Currently supports toggling service visibility in the status line.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getPluginDataDir } from './cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServiceVisibility {
  gmail?: boolean;
  tasks?: boolean;
  jira?: boolean;
  github?: boolean;
}

export interface PluginConfig {
  services?: ServiceVisibility;
}

type ExternalService = keyof ServiceVisibility;

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

function getConfigPath(): string {
  return path.join(getPluginDataDir(), 'config.json');
}

/**
 * Reads the config file. Returns an empty object if it doesn't exist or is
 * invalid JSON — missing config is never an error.
 */
export function readConfig(): PluginConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return JSON.parse(raw) as PluginConfig;
  } catch {
    return {};
  }
}

/**
 * Writes the config file, merging with existing values.
 */
export function writeConfig(patch: PluginConfig): void {
  const current = readConfig();
  const merged: PluginConfig = {
    ...current,
    ...patch,
    services: { ...current.services, ...patch.services },
  };

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
}

/**
 * Returns true if the given service should be displayed.
 * Defaults to true when no config exists or the service is not mentioned.
 */
export function isServiceEnabled(service: ExternalService): boolean {
  const config = readConfig();
  const value = config.services?.[service];
  return value !== false;
}
