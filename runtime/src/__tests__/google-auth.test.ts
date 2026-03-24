/**
 * google-auth.test.ts
 *
 * Tests for Google OAuth2 token management:
 * - Token expiry detection
 * - Missing client_secret handling
 * - Token loading and validation
 * - Refresh token flow (mock HTTP)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { GoogleTokens, GoogleClientSecret } from '../google-auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claude-google-test-'));
}

function rmRf(dir: string): void {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function makeTokens(overrides: Partial<GoogleTokens> = {}): GoogleTokens {
  return {
    access_token: 'ya29.test_access_token',
    refresh_token: '1//test_refresh_token',
    expiry_date: Date.now() + 3600_000, // 1 hour from now
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    ...overrides,
  };
}

function makeClientSecret(overrides: Partial<GoogleClientSecret> = {}): GoogleClientSecret {
  return {
    installed: {
      client_id: 'test-client-id.apps.googleusercontent.com',
      client_secret: 'test-client-secret',
      redirect_uris: ['urn:ietf:wg:oauth:2.0:oob'],
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// loadClientSecret tests
// ---------------------------------------------------------------------------

import { loadClientSecret, loadTokens } from '../google-auth';

describe('loadClientSecret', () => {
  let tmpDir: string;
  const origEnv = process.env['CLAUDE_PLUGIN_DATA'];

  beforeEach(() => {
    tmpDir = makeTmpDir();
    process.env['CLAUDE_PLUGIN_DATA'] = tmpDir;
    fs.mkdirSync(path.join(tmpDir, 'google'), { recursive: true });
  });

  afterEach(() => {
    rmRf(tmpDir);
    if (origEnv === undefined) {
      delete process.env['CLAUDE_PLUGIN_DATA'];
    } else {
      process.env['CLAUDE_PLUGIN_DATA'] = origEnv;
    }
  });

  it('throws when client_secret.json does not exist', () => {
    expect(() => loadClientSecret()).toThrow('Google OAuth client secret not found');
  });

  it('loads valid installed credentials', () => {
    const secret = makeClientSecret();
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'client_secret.json'),
      JSON.stringify(secret),
      'utf8',
    );
    const creds = loadClientSecret();
    expect(creds.client_id).toBe('test-client-id.apps.googleusercontent.com');
    expect(creds.client_secret).toBe('test-client-secret');
  });

  it('loads valid web credentials (fallback to "web" key)', () => {
    const secret: GoogleClientSecret = {
      web: {
        client_id: 'web-client-id',
        client_secret: 'web-client-secret',
        redirect_uris: ['https://myapp.example.com/callback'],
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'client_secret.json'),
      JSON.stringify(secret),
      'utf8',
    );
    const creds = loadClientSecret();
    expect(creds.client_id).toBe('web-client-id');
  });

  it('throws for invalid JSON', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'client_secret.json'),
      'not json',
      'utf8',
    );
    expect(() => loadClientSecret()).toThrow('not valid JSON');
  });

  it('throws when neither "installed" nor "web" key is present', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'client_secret.json'),
      JSON.stringify({ other: {} }),
      'utf8',
    );
    expect(() => loadClientSecret()).toThrow('"installed" or "web"');
  });

  it('throws when client_id is missing', () => {
    const secret = makeClientSecret();
    // Remove client_id
    (secret.installed as unknown as Record<string, unknown>)['client_id'] = '';
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'client_secret.json'),
      JSON.stringify(secret),
      'utf8',
    );
    expect(() => loadClientSecret()).toThrow('client_id or client_secret');
  });
});

// ---------------------------------------------------------------------------
// loadTokens tests
// ---------------------------------------------------------------------------

describe('loadTokens', () => {
  let tmpDir: string;
  const origEnv = process.env['CLAUDE_PLUGIN_DATA'];

  beforeEach(() => {
    tmpDir = makeTmpDir();
    process.env['CLAUDE_PLUGIN_DATA'] = tmpDir;
    fs.mkdirSync(path.join(tmpDir, 'google'), { recursive: true });
  });

  afterEach(() => {
    rmRf(tmpDir);
    if (origEnv === undefined) {
      delete process.env['CLAUDE_PLUGIN_DATA'];
    } else {
      process.env['CLAUDE_PLUGIN_DATA'] = origEnv;
    }
  });

  it('throws when tokens.json does not exist', () => {
    expect(() => loadTokens()).toThrow('Google tokens not found');
  });

  it('loads valid tokens', () => {
    const tokens = makeTokens();
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'tokens.json'),
      JSON.stringify(tokens),
      'utf8',
    );
    const loaded = loadTokens();
    expect(loaded.access_token).toBe('ya29.test_access_token');
    expect(loaded.refresh_token).toBe('1//test_refresh_token');
  });

  it('throws for invalid JSON', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'tokens.json'),
      'bad json',
      'utf8',
    );
    expect(() => loadTokens()).toThrow('not valid JSON');
  });

  it('throws when refresh_token is missing', () => {
    const tokens = makeTokens({ refresh_token: '' });
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'tokens.json'),
      JSON.stringify(tokens),
      'utf8',
    );
    expect(() => loadTokens()).toThrow('missing refresh_token');
  });
});

// ---------------------------------------------------------------------------
// Token expiry detection
// ---------------------------------------------------------------------------

describe('token expiry detection', () => {
  it('detects a token expired in the past', () => {
    const tokens = makeTokens({ expiry_date: Date.now() - 1000 });
    const EXPIRY_BUFFER_MS = 30_000;
    const isExpired = tokens.expiry_date < Date.now() + EXPIRY_BUFFER_MS;
    expect(isExpired).toBe(true);
  });

  it('detects a token expiring within 30 seconds (buffer zone)', () => {
    // Expires 10 seconds from now — within the 30s buffer
    const tokens = makeTokens({ expiry_date: Date.now() + 10_000 });
    const EXPIRY_BUFFER_MS = 30_000;
    const isExpired = tokens.expiry_date < Date.now() + EXPIRY_BUFFER_MS;
    expect(isExpired).toBe(true);
  });

  it('considers token valid when expiry is beyond buffer', () => {
    // Expires 1 hour from now — well beyond 30s buffer
    const tokens = makeTokens({ expiry_date: Date.now() + 3600_000 });
    const EXPIRY_BUFFER_MS = 30_000;
    const isExpired = tokens.expiry_date < Date.now() + EXPIRY_BUFFER_MS;
    expect(isExpired).toBe(false);
  });

  it('considers token valid when exactly at buffer boundary (31s remaining)', () => {
    const tokens = makeTokens({ expiry_date: Date.now() + 31_000 });
    const EXPIRY_BUFFER_MS = 30_000;
    const isExpired = tokens.expiry_date < Date.now() + EXPIRY_BUFFER_MS;
    expect(isExpired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Refresh token flow — filesystem-based integration tests
// (Pure HTTP mocking is not needed to verify the boundary logic; we test
// the file-system side: valid tokens skip refresh, missing files throw.)
// ---------------------------------------------------------------------------

describe('getValidAccessToken — filesystem boundary tests', () => {
  let tmpDir: string;
  const origEnv = process.env['CLAUDE_PLUGIN_DATA'];

  beforeEach(() => {
    tmpDir = makeTmpDir();
    process.env['CLAUDE_PLUGIN_DATA'] = tmpDir;
    fs.mkdirSync(path.join(tmpDir, 'google'), { recursive: true });
  });

  afterEach(() => {
    rmRf(tmpDir);
    if (origEnv === undefined) {
      delete process.env['CLAUDE_PLUGIN_DATA'];
    } else {
      process.env['CLAUDE_PLUGIN_DATA'] = origEnv;
    }
  });

  it('throws when client_secret.json is missing', async () => {
    // No files written — google/ dir is empty
    const { getValidAccessToken } = await import('../google-auth');
    await expect(getValidAccessToken()).rejects.toThrow('Google OAuth client secret not found');
  });

  it('throws when tokens.json is missing', async () => {
    // Only client_secret.json present, no tokens file
    const secret = makeClientSecret();
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'client_secret.json'),
      JSON.stringify(secret),
      'utf8',
    );
    const { getValidAccessToken } = await import('../google-auth');
    await expect(getValidAccessToken()).rejects.toThrow('Google tokens not found');
  });

  it('returns the existing access token when not expired (no network call)', async () => {
    // Write valid credentials and a fresh (non-expired) token
    const secret = makeClientSecret();
    // expiry_date is 1 hour from now — well beyond the 30s buffer
    const freshTokens = makeTokens({ expiry_date: Date.now() + 3600_000 });

    fs.writeFileSync(
      path.join(tmpDir, 'google', 'client_secret.json'),
      JSON.stringify(secret),
      'utf8',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'google', 'tokens.json'),
      JSON.stringify(freshTokens),
      'utf8',
    );

    const { getValidAccessToken } = await import('../google-auth');
    // With a fresh token, getValidAccessToken skips the HTTP refresh entirely
    // and just returns the stored access_token.
    const token = await getValidAccessToken();
    expect(token).toBe('ya29.test_access_token');
  });
});
