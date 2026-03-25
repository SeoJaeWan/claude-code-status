---
name: slack-setup
description: Set up Slack integration — register token and select channels to monitor. Use when user wants to connect Slack to the status line.
user-invocable: true
allowed-tools: "Read, Bash, Edit"
---

Set up Slack integration for the status line.

## When to use

- First-time Slack setup
- Changing the Slack token
- Adding or removing monitored channels

## Prerequisites

The user needs a **Slack User OAuth Token** (`xoxp-...`) with these scopes:
- `channels:read` — public channel list + unread
- `groups:read` — private channel list + unread
- `im:read` — DM unread
- `mpim:read` — group DM unread

Guide them to create one:
1. Go to https://api.slack.com/apps and create an app (or use an existing one)
2. Go to **OAuth & Permissions** → **User Token Scopes**
3. Add: `channels:read`, `groups:read`, `im:read`, `mpim:read`
4. Install the app to the workspace
5. Copy the **User OAuth Token** (`xoxp-...`)

## Steps

### 1. Ask for the token

Ask the user to provide their Slack User OAuth Token (`xoxp-...`).

If they already have one configured, show the masked version (first 10 chars + `...`) and ask if they want to replace it.

### 2. Save the token to config.json

Read the existing config, merge the token, and write back:

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}"
CONFIG="$CLAUDE_PLUGIN_DATA/config.json"
```

Use `node -e` to merge:

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}" node -e "
const fs = require('fs');
const p = process.env.CLAUDE_PLUGIN_DATA + '/config.json';
let c = {};
try { c = JSON.parse(fs.readFileSync(p,'utf8')); } catch {}
if (!c.slack) c.slack = {};
c.slack.token = '<TOKEN>';
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('Token saved.');
"
```

### 3. Validate the token

Test the token by calling the Slack API:

```bash
curl -s -H "Authorization: Bearer <TOKEN>" "https://slack.com/api/auth.test" | node -e "
const chunks = []; process.stdin.on('data', c => chunks.push(c)); process.stdin.on('end', () => {
  const r = JSON.parse(Buffer.concat(chunks).toString());
  if (r.ok) console.log('Authenticated as: ' + r.user + ' (team: ' + r.team + ')');
  else console.log('ERROR: ' + r.error);
});
"
```

If the token is invalid, tell the user and ask for a correct one.

### 4. Fetch and display channel list

Fetch all channels the user is a member of:

```bash
curl -s -H "Authorization: Bearer <TOKEN>" "https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200" | node -e "
const chunks = []; process.stdin.on('data', c => chunks.push(c)); process.stdin.on('end', () => {
  const r = JSON.parse(Buffer.concat(chunks).toString());
  if (!r.ok) { console.log('ERROR: ' + r.error); return; }
  const channels = (r.channels || []).filter(c => c.is_member);
  channels.sort((a,b) => a.name.localeCompare(b.name));
  channels.forEach((ch, i) => {
    const prefix = ch.is_private ? '🔒' : '#';
    console.log((i+1) + '. ' + prefix + ch.name + '  (ID: ' + ch.id + ')');
  });
  console.log('\nTotal: ' + channels.length + ' channels');
});
"
```

### 5. Ask user to select channels

Present the numbered list and ask the user which channels they want to monitor.

They can specify:
- Numbers: `1, 3, 5`
- Ranges: `1-5`
- All: `all`
- None: `none` (DM only)

### 6. Save selected channel IDs to config.json

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}" node -e "
const fs = require('fs');
const p = process.env.CLAUDE_PLUGIN_DATA + '/config.json';
let c = {};
try { c = JSON.parse(fs.readFileSync(p,'utf8')); } catch {}
if (!c.slack) c.slack = {};
c.slack.channels = [<CHANNEL_IDS>];
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('Channels saved:', c.slack.channels);
"
```

### 7. Enable the service

Make sure slack is enabled in the services config:

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}" node -e "
const fs = require('fs');
const p = process.env.CLAUDE_PLUGIN_DATA + '/config.json';
let c = {};
try { c = JSON.parse(fs.readFileSync(p,'utf8')); } catch {}
if (!c.services) c.services = {};
c.services.slack = true;
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('Slack enabled in status line.');
"
```

### 8. Run initial collection

```bash
CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/claude-code-status-claude-code-status}" node "$CLAUDE_PLUGIN_DATA/runtime/dist/collect.js" --service slack --force 2>&1
```

Then read and display the result:

```bash
cat "$CLAUDE_PLUGIN_DATA/cache/slack.json"
```

### 9. Report

Tell the user:
- Token is configured and validated
- Which channels are being monitored (list names)
- Current unread count
- The status line will show `slack <count>` on next refresh

## Deriving CLAUDE_PLUGIN_DATA

If `$CLAUDE_PLUGIN_DATA` is not set, derive it:
```bash
CLAUDE_PLUGIN_DATA="$HOME/.claude/plugins/data/claude-code-status-claude-code-status"
```
