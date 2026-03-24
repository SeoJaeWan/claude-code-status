#!/usr/bin/env node
/**
 * google-auth-flow.js
 *
 * One-time Google OAuth 2.0 Desktop authorization flow for the claude-status plugin.
 *
 * Prerequisites:
 *   - $CLAUDE_PLUGIN_DATA/google/client_secret.json  (downloaded from Google Cloud Console)
 *
 * What this script does:
 *   1. Reads client_secret.json to get client_id and client_secret.
 *   2. Builds an authorization URL and opens the user's default browser.
 *   3. Starts a local HTTP server on localhost:3000 to receive the OAuth callback.
 *   4. Exchanges the authorization code for access + refresh tokens.
 *   5. Saves the tokens to $CLAUDE_PLUGIN_DATA/google/tokens.json.
 *
 * Usage:
 *   node scripts/google-auth-flow.js
 *   # or, if the runtime is built:
 *   node "$CLAUDE_PLUGIN_DATA/runtime/dist/google-auth-flow.js"
 *
 * Scopes requested:
 *   - https://www.googleapis.com/auth/gmail.readonly
 *   - https://www.googleapis.com/auth/tasks.readonly
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const http    = require('http');
const https   = require('https');
const { exec } = require('child_process');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
];

const REDIRECT_PORT = 3000;
const REDIRECT_URI  = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT  = 'https://accounts.google.com/o/oauth2/v2/auth';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function getPluginData() {
  const dir = process.env['CLAUDE_PLUGIN_DATA'];
  if (!dir) {
    throw new Error(
      'CLAUDE_PLUGIN_DATA environment variable is not set.\n' +
      'Start this script from within Claude Code, or set the variable manually.',
    );
  }
  return dir;
}

function getClientSecretPath() {
  return path.join(getPluginData(), 'google', 'client_secret.json');
}

function getTokensPath() {
  return path.join(getPluginData(), 'google', 'tokens.json');
}

// ---------------------------------------------------------------------------
// Load client credentials
// ---------------------------------------------------------------------------

function loadClientCredentials() {
  const secretPath = getClientSecretPath();

  if (!fs.existsSync(secretPath)) {
    throw new Error(
      `client_secret.json not found at:\n  ${secretPath}\n\n` +
      'Please download a Desktop OAuth client credential from:\n' +
      '  https://console.cloud.google.com/apis/credentials\n' +
      'and save it to the path above.\n' +
      'See /claude-status:setup-google for full instructions.',
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse client_secret.json: ${err.message}`);
  }

  const creds = parsed.installed || parsed.web;
  if (!creds || !creds.client_id || !creds.client_secret) {
    throw new Error(
      'client_secret.json must contain an "installed" or "web" key with ' +
      'client_id and client_secret fields.\n' +
      'Make sure you downloaded the correct credential type (Desktop app).',
    );
  }

  return creds;
}

// ---------------------------------------------------------------------------
// Save tokens
// ---------------------------------------------------------------------------

function saveTokens(tokens) {
  const googleDir = path.join(getPluginData(), 'google');
  fs.mkdirSync(googleDir, { recursive: true });

  const tokensPath = getTokensPath();
  const tmpPath    = tokensPath + '.tmp';

  fs.writeFileSync(tmpPath, JSON.stringify(tokens, null, 2), 'utf8');
  fs.renameSync(tmpPath, tokensPath);

  console.log('\nAuthorization successful! Tokens saved to:');
  console.log(`  ${tokensPath}`);
  console.log('\nYou can now close this browser tab.');
}

// ---------------------------------------------------------------------------
// Open browser
// ---------------------------------------------------------------------------

function openBrowser(url) {
  let command;

  if (process.platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log('\nCould not open browser automatically. Please open this URL manually:');
      console.log(`  ${url}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Exchange authorization code for tokens
// ---------------------------------------------------------------------------

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj  = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end',  () => { resolve(data); });
    });

    req.on('error', reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error('Token exchange request timed out'));
    });

    req.write(body);
    req.end();
  });
}

async function exchangeCodeForTokens(creds, code) {
  const body = new URLSearchParams({
    code,
    client_id:     creds.client_id,
    client_secret: creds.client_secret,
    redirect_uri:  REDIRECT_URI,
    grant_type:    'authorization_code',
  }).toString();

  let raw;
  try {
    raw = await httpsPost(TOKEN_ENDPOINT, body);
  } catch (err) {
    throw new Error(`Token exchange failed: ${err.message}`);
  }

  let response;
  try {
    response = JSON.parse(raw);
  } catch {
    throw new Error(`Unexpected token response: ${raw.slice(0, 200)}`);
  }

  if (response.error) {
    throw new Error(`Token error: ${response.error} — ${response.error_description || ''}`);
  }

  if (!response.access_token || !response.refresh_token) {
    throw new Error(
      'Token response is missing access_token or refresh_token.\n' +
      'Make sure the OAuth consent screen is set to "External" and your ' +
      'account is listed as a test user.',
    );
  }

  return {
    access_token:  response.access_token,
    refresh_token: response.refresh_token,
    expiry_date:   Date.now() + (response.expires_in || 3600) * 1000,
    token_type:    response.token_type || 'Bearer',
    scope:         response.scope || SCOPES.join(' '),
  };
}

// ---------------------------------------------------------------------------
// Local callback server
// ---------------------------------------------------------------------------

function waitForCallback() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);

      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code  = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      const html = (title, body) =>
        `<!DOCTYPE html><html><head><title>${title}</title></head><body>` +
        `<h2>${title}</h2><p>${body}</p></body></html>`;

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(html('Authorization failed', `Error: ${error}. You can close this tab.`));
        server.close();
        reject(new Error(`OAuth error from Google: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(html('No code received', 'Authorization failed. You can close this tab.'));
        server.close();
        reject(new Error('No authorization code in callback URL'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html(
        'Authorization successful',
        'Tokens have been saved. You can close this browser tab and return to your terminal.',
      ));

      server.close();
      resolve(code);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${REDIRECT_PORT} is already in use.\n` +
          'Please stop any process using that port and try again.',
        ));
      } else {
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      console.log(`Listening on http://localhost:${REDIRECT_PORT}/oauth2callback`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization flow timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

// ---------------------------------------------------------------------------
// Build authorization URL
// ---------------------------------------------------------------------------

function buildAuthUrl(creds) {
  const params = new URLSearchParams({
    client_id:     creds.client_id,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES.join(' '),
    access_type:   'offline',  // required to receive a refresh_token
    prompt:        'consent',  // force consent screen to always return refresh_token
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[claude-status] Google OAuth setup');
  console.log('===================================\n');

  let creds;
  try {
    creds = loadClientCredentials();
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }

  console.log(`Client ID: ${creds.client_id.slice(0, 20)}...`);
  console.log(`Scopes:    ${SCOPES.join('\n           ')}\n`);

  const authUrl = buildAuthUrl(creds);
  console.log('Opening browser for authorization...');
  console.log(`URL: ${authUrl}\n`);

  openBrowser(authUrl);

  let code;
  try {
    code = await waitForCallback();
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
    process.exit(1);
  }

  console.log('\nReceived authorization code. Exchanging for tokens...');

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(creds, code);
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
    process.exit(1);
  }

  try {
    saveTokens(tokens);
  } catch (err) {
    console.error(`\nERROR: Failed to save tokens: ${err.message}`);
    process.exit(1);
  }

  console.log('\nSetup complete. Run /claude-status:doctor to verify the configuration.');
  process.exit(0);
}

main();
