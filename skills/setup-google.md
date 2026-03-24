# /claude-status:setup-google

Complete the one-time Google OAuth 2.0 Desktop setup for Gmail and Tasks access.

## When to use

- First-time setup after installing the plugin to enable Gmail and Tasks status.
- When the status line shows `!` for Gmail or Tasks with `errorKind: auth`.
- When Google tokens have been deleted and need to be re-obtained.

## Overview

The plugin uses a Desktop OAuth 2.0 client that you create in your own Google
Cloud project.  This means:

1. You control the credentials — nothing is shared with the plugin author.
2. The one-time browser consent flow runs on your machine.
3. Refresh tokens are stored locally at `$CLAUDE_PLUGIN_DATA/google/tokens.json`.

---

## Step 1: Create a Google Cloud project

1. Open https://console.cloud.google.com/
2. Click **Select a project** at the top, then **New Project**.
3. Name it something like `claude-status` and click **Create**.
4. Wait for the project to be created and select it.

---

## Step 2: Enable the required APIs

In your new project:

1. Go to **APIs & Services > Library**.
2. Search for **Gmail API** and click **Enable**.
3. Search for **Google Tasks API** and click **Enable**.

---

## Step 3: Configure the OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** (or Internal if you have a Workspace org).
3. Fill in the required fields:
   - App name: `claude-status` (or any name)
   - User support email: your email
   - Developer contact email: your email
4. Click **Save and Continue** through the remaining steps.
5. On the **Scopes** step, add:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/tasks.readonly`
6. On the **Test users** step, add your own Google account email.
7. Click **Save and Continue**, then **Back to Dashboard**.

---

## Step 4: Create a Desktop OAuth client

1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Application type: **Desktop app**.
4. Name: `claude-status-desktop` (any name).
5. Click **Create**.
6. In the popup, click **Download JSON**.
7. Save the downloaded file as:

```
$CLAUDE_PLUGIN_DATA/google/client_secret.json
```

On Windows (PowerShell):
```powershell
$dest = Join-Path $env:CLAUDE_PLUGIN_DATA 'google' 'client_secret.json'
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
Copy-Item "C:\Users\<you>\Downloads\client_secret_*.json" $dest
```

On macOS/Linux:
```bash
mkdir -p "$CLAUDE_PLUGIN_DATA/google"
cp ~/Downloads/client_secret_*.json "$CLAUDE_PLUGIN_DATA/google/client_secret.json"
```

---

## Step 5: Run the OAuth authorization flow

This step opens a browser window, asks you to log in with your Google account
and grant the scopes, then saves the resulting tokens locally.

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/google-auth-flow.js"
```

What the script does:
1. Reads `client_secret.json`.
2. Builds an authorization URL and opens your browser.
3. Starts a local HTTP server on `localhost:3000` to receive the callback.
4. Exchanges the authorization code for access + refresh tokens.
5. Saves tokens to `$CLAUDE_PLUGIN_DATA/google/tokens.json`.

After the browser redirects back, you should see:

```
Authorization successful! Tokens saved to:
  /path/to/CLAUDE_PLUGIN_DATA/google/tokens.json

You can now close this browser tab.
```

---

## Step 6: Verify

Run `/claude-status:doctor` to confirm both files are in place:

```
google-client   found   OK
google-token    found   OK
```

Then force-refresh both services:

```bash
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service gmail --force
node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service tasks --force
```

The status line should now show numeric counts for Gmail and Tasks.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `client_secret.json not found` | Repeat Step 4 and verify the file path |
| `Error 400: redirect_uri_mismatch` | In Google Console, verify the OAuth client type is **Desktop app** (not Web) |
| `Access blocked: app not verified` | Add your Google account as a test user (Step 3) |
| `tokens.json missing refresh_token` | Delete `tokens.json` and re-run Step 5 |
| Status line still shows `!` after setup | Run `/claude-status:doctor` for a detailed check |

---

## Notes

- The OAuth client credentials (`client_secret.json`) are safe to keep private
  on your machine.  Do not commit them to version control.
- Tokens are refreshed automatically when they expire — you should not need to
  repeat this setup unless tokens are deleted or revoked.
- The plugin only requests read-only scopes:
  - `gmail.readonly`
  - `tasks.readonly`
