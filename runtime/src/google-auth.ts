/**
 * google-auth.ts
 *
 * Google OAuth2 token management for Gmail and Tasks collectors.
 *
 * Design:
 *  - The user provides their own Desktop OAuth2 client credentials at:
 *      ${CLAUDE_PLUGIN_DATA}/google/client_secret.json
 *    (Downloaded from Google Cloud Console → APIs & Services → Credentials)
 *
 *  - Access + refresh tokens are stored at:
 *      ${CLAUDE_PLUGIN_DATA}/google/tokens.json
 *
 *  - This module handles:
 *      1. Loading stored credentials and tokens.
 *      2. Refreshing access tokens when expired.
 *      3. Persisting updated tokens back to disk.
 *
 *  - Scopes required:
 *      - https://www.googleapis.com/auth/gmail.readonly
 *      - https://www.googleapis.com/auth/tasks.readonly
 *
 * NOTE: Initial OAuth flow (obtaining the first refresh_token) is NOT
 * handled here — the user must complete the one-time browser-based auth
 * using the companion `scripts/google-auth-setup.js` script (Phase 3).
 * This module only refreshes an existing refresh_token.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleClientSecret {
  installed?: GoogleClientCredentials;
  web?: GoogleClientCredentials;
}

export interface GoogleClientCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  auth_uri?: string;
  token_uri?: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number; // Unix timestamp in milliseconds
  token_type?: string;
  scope?: string;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getGoogleDir(): string {
  const pluginData = process.env['CLAUDE_PLUGIN_DATA'];
  if (!pluginData) {
    throw new Error('CLAUDE_PLUGIN_DATA environment variable is not set');
  }
  return path.join(pluginData, 'google');
}

export function getClientSecretPath(): string {
  return path.join(getGoogleDir(), 'client_secret.json');
}

export function getTokensPath(): string {
  return path.join(getGoogleDir(), 'tokens.json');
}

// ---------------------------------------------------------------------------
// Load credentials
// ---------------------------------------------------------------------------

export function loadClientSecret(): GoogleClientCredentials {
  const secretPath = getClientSecretPath();

  if (!fs.existsSync(secretPath)) {
    throw new Error(
      `Google OAuth client secret not found at ${secretPath}. ` +
      'Please download your Desktop OAuth client credentials from Google Cloud Console ' +
      'and save them to this path.',
    );
  }

  let raw: string;
  try {
    raw = fs.readFileSync(secretPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read client secret file: ${err instanceof Error ? err.message : String(err)}`);
  }

  let parsed: GoogleClientSecret;
  try {
    parsed = JSON.parse(raw) as GoogleClientSecret;
  } catch {
    throw new Error('client_secret.json is not valid JSON');
  }

  const creds = parsed.installed ?? parsed.web;
  if (!creds) {
    throw new Error('client_secret.json must contain an "installed" or "web" key');
  }
  if (!creds.client_id || !creds.client_secret) {
    throw new Error('client_secret.json is missing client_id or client_secret');
  }

  return creds;
}

export function loadTokens(): GoogleTokens {
  const tokensPath = getTokensPath();

  if (!fs.existsSync(tokensPath)) {
    throw new Error(
      `Google tokens not found at ${tokensPath}. ` +
      'Please complete the one-time Google OAuth setup by running: ' +
      'node scripts/google-auth-setup.js',
    );
  }

  let raw: string;
  try {
    raw = fs.readFileSync(tokensPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read tokens file: ${err instanceof Error ? err.message : String(err)}`);
  }

  let parsed: GoogleTokens;
  try {
    parsed = JSON.parse(raw) as GoogleTokens;
  } catch {
    throw new Error('tokens.json is not valid JSON');
  }

  if (!parsed.refresh_token) {
    throw new Error('tokens.json is missing refresh_token. Please re-run the Google OAuth setup.');
  }

  return parsed;
}

function saveTokens(tokens: GoogleTokens): void {
  const googleDir = getGoogleDir();
  fs.mkdirSync(googleDir, { recursive: true });

  const tokensPath = getTokensPath();
  const tmpPath = tokensPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(tokens, null, 2), 'utf8');
  fs.renameSync(tmpPath, tokensPath);
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

interface TokenRefreshResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function httpsPost(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    });

    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('Request timeout'));
    });

    req.write(body);
    req.end();
  });
}

async function refreshAccessToken(
  creds: GoogleClientCredentials,
  tokens: GoogleTokens,
): Promise<GoogleTokens> {
  const tokenUri = creds.token_uri ?? 'https://oauth2.googleapis.com/token';

  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
  }).toString();

  let raw: string;
  try {
    raw = await httpsPost(tokenUri, body);
  } catch (err) {
    throw new Error(`Token refresh request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let response: TokenRefreshResponse;
  try {
    response = JSON.parse(raw) as TokenRefreshResponse;
  } catch {
    throw new Error(`Failed to parse token refresh response: ${raw.slice(0, 200)}`);
  }

  if (response.error) {
    throw new Error(`Token refresh error: ${response.error} — ${response.error_description ?? ''}`);
  }

  if (!response.access_token) {
    throw new Error('Token refresh response missing access_token');
  }

  const updatedTokens: GoogleTokens = {
    ...tokens,
    access_token: response.access_token,
    expiry_date: Date.now() + (response.expires_in ?? 3600) * 1000,
    token_type: response.token_type ?? tokens.token_type,
    scope: response.scope ?? tokens.scope,
  };

  saveTokens(updatedTokens);
  return updatedTokens;
}

// ---------------------------------------------------------------------------
// Public API: get a valid access token
// ---------------------------------------------------------------------------

/** Buffer before expiry to trigger a refresh (30 seconds). */
const EXPIRY_BUFFER_MS = 30_000;

/**
 * Returns a valid Google access token.
 * Automatically refreshes if the token is expired or about to expire.
 * Throws an error (classified as 'auth') if credentials are missing or refresh fails.
 */
export async function getValidAccessToken(): Promise<string> {
  const creds = loadClientSecret();
  let tokens = loadTokens();

  const isExpired = tokens.expiry_date < Date.now() + EXPIRY_BUFFER_MS;

  if (isExpired) {
    tokens = await refreshAccessToken(creds, tokens);
  }

  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// Scopes constant (for reference by setup scripts)
// ---------------------------------------------------------------------------

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
];
