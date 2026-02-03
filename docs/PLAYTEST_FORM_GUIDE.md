# Playtest Feedback System Setup Guide

Complete setup instructions for the in-game playtest feedback system.

## Overview

The system collects feedback through:
1. **In-game form** → Player submits after Boss 1 (or anytime via menu)
2. **Google Sheet** → Permanent record of all responses
3. **Discord** → Instant notification when feedback arrives
4. **GitHub** → Daily summary comments on version threads

---

## One-Time Setup

### Step 1: Create Discord Webhook (5 min)

1. Open your Discord server
2. Go to **Server Settings → Integrations → Webhooks**
3. Click **New Webhook**
4. Name it "Playtest Feedback"
5. Select the channel for notifications
6. Click **Copy Webhook URL** — save this for Step 3

### Step 2: Create Google Service Account (10 min)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project: "MantaSphere Playtest"
3. Enable the **Google Sheets API**:
   - Go to **APIs & Services → Library**
   - Search "Google Sheets API"
   - Click **Enable**
4. Create credentials:
   - Go to **APIs & Services → Credentials**
   - Click **Create Credentials**
   - When asked "What data will you be accessing?", select **Application data**
     - (NOT "User data" — we're using a service account, not OAuth)
   - Click **Next**
5. Create the service account:
   - Service account name: "playtest-feedback"
   - Click **Create and Continue**
   - Skip the "Grant access" steps (click **Continue** then **Done**)
6. Create a key for the service account:
   - In the Credentials page, find your new service account and click on it
   - Go to **Keys** tab → **Add Key** → **Create new key**
   - Select **JSON** → **Create**
   - Save the downloaded file — this is your `GSHEET_CREDS_JSON`
7. Copy the service account email (looks like `playtest-feedback@project-id.iam.gserviceaccount.com`)

### Step 3: Create Google Sheet (5 min)

1. Create a new Google Sheet named "Playtest Feedback"
2. Add this header row in Row 1:

```
Timestamp | Version | Arena | Wave | Score | Time | Q1 | Q2 | Q3 | Q4 | Q5 | OpenFeedback | TesterName | Processed
```

3. Share the sheet with the service account email (Editor access)
4. Copy the Sheet ID from the URL:
   - URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy the `SHEET_ID_HERE` part

### Step 4: Deploy Google Apps Script (5 min)

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any default code and paste the script below
3. Go to **Project Settings** (gear icon):
   - Add Script Property: `PLAYTEST_TOKEN` = (make up a secret token)
   - Add Script Property: `DISCORD_WEBHOOK` = (your Discord webhook URL)
4. Click **Deploy → New deployment**:
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
5. Click Deploy and authorize when prompted
6. Copy the **Web app URL** — this is your Apps Script endpoint

#### Apps Script Code (Code.gs)

```javascript
/**
 * Playtest Feedback Receiver
 * 
 * Receives POST requests from the game, appends to Sheet, pings Discord.
 */

function doPost(e) {
  try {
    // Parse request
    const data = JSON.parse(e.postData.contents);
    
    // Validate token
    const expectedToken = PropertiesService.getScriptProperties().getProperty('PLAYTEST_TOKEN');
    if (data.token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid token' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle test mode - return diagnostic info without writing to sheet
    if (data.test === true) {
      const hasWebhook = !!PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK');
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        test: true,
        message: 'Connection OK',
        tokenValid: true,
        discordConfigured: hasWebhook,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Append to sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const timestamp = new Date().toISOString();
    
    sheet.appendRow([
      timestamp,
      data.version || '',
      data.arena || '',
      data.wave || '',
      data.score || '',
      data.time || '',
      data.q1 || '',
      data.q2 || '',
      data.q3 || '',
      data.q4 || '',
      data.q5 || '',
      data.openFeedback || '',
      data.testerName || '',
      ''  // Processed column (empty = unprocessed)
    ]);
    
    // Send Discord notification
    sendDiscordNotification(data);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error:', error);
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendDiscordNotification(data) {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK');
  if (!webhookUrl) return;
  
  // Sanitize open feedback
  let feedback = (data.openFeedback || '').trim();
  feedback = feedback
    .replace(/@(everyone|here)/gi, '[mention]')
    .replace(/<@!?\d+>/g, '[user]')
    .replace(/\S+@\S+\.\S+/g, '[email]')
    .replace(/\n/g, ' ');
  if (feedback.length > 140) {
    feedback = feedback.substring(0, 137) + '...';
  }
  
  // Build message
  let message = `📋 **Playtest v${data.version || '?'}** | Score ${data.score || '?'} | Arena ${data.arena || '?'} | ${data.time || '?'}\n`;
  message += `Fun: ${data.q1 || '?'}/5 | Controls: ${data.q2 || '?'} | Clarity: ${data.q3 || '?'}\n`;
  message += `Difficulty: ${data.q4 || '?'} | Play Again: ${data.q5 || '?'}`;
  
  if (feedback) {
    message += `\n💬 "${feedback}"`;
  }
  
  if (data.testerName) {
    message += `\n👤 ${data.testerName}`;
  }
  
  // Send to Discord
  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ content: message })
  });
}

// Test function (run manually to verify setup)
function testSetup() {
  const token = PropertiesService.getScriptProperties().getProperty('PLAYTEST_TOKEN');
  const webhook = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK');
  
  console.log('Token set:', !!token);
  console.log('Webhook set:', !!webhook);
  
  if (token && webhook) {
    console.log('Setup looks good!');
  } else {
    console.log('Missing configuration. Add Script Properties.');
  }
}
```

### Step 5: Configure GitHub Secrets (5 min)

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret** (NOT "Manage environment secrets")
3. Add these two secrets:

| Secret Name | Value |
|-------------|-------|
| `GSHEET_ID` | The Sheet ID from Step 3 (just the ID, not the full URL) |
| `GSHEET_CREDS_JSON` | The **entire contents** of the JSON key file from Step 2 |

> **Note:** Use Repository secrets, not Environment secrets. Environment secrets are for multi-stage deployments with approval gates — overkill for this simple sync workflow.

### Step 6: Configure Game (2 min)

1. Copy the example file:
   ```bash
   cp js/config/debug.local.example.js js/config/debug.local.js
   ```

2. Edit `js/config/debug.local.js` and uncomment/fill in the PLAYTEST_CONFIG:

```javascript
export const DEBUG_SECRET = true;

export const PLAYTEST_CONFIG = {
  url: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  token: 'your-secret-token'
};
```

| Field | Where to get it |
|-------|-----------------|
| `url` | The **Web app URL** from Step 4 (after clicking Deploy) |
| `token` | The same token you set as `PLAYTEST_TOKEN` in Step 4's Script Properties |

> **Note:** `debug.local.js` is gitignored — your secrets won't be committed.

### Step 7: Create Playtest Label (1 min)

1. Go to your GitHub repo → Issues → Labels
2. Create a new label: `playtest` (color: any you like)

---

## How It Works

### Player Flow
1. Player defeats Boss 1 (or clicks Feedback in menu)
2. Feedback overlay appears with 5 questions
3. Player submits → data sent to Apps Script
4. Apps Script appends to Sheet + pings Discord
5. Player sees "Thanks!" and "Play Again?" prompt

### Daily Sync
1. GitHub Action runs at 8:17 AM UTC (or manual trigger)
2. Reads unprocessed rows from Sheet
3. If new rows exist:
   - Creates/finds version thread (e.g., `[Playtest] Feedback Thread - v0.2.x`)
   - Posts daily summary comment
   - Commits raw data to `docs/playtests/YYYY-MM-DD.md`
   - Marks rows as processed

---

## Sheet Columns Reference

| Column | Content | Example |
|--------|---------|---------|
| A: Timestamp | ISO timestamp | 2026-02-03T14:23:00Z |
| B: Version | Game version | 0.2.3 |
| C: Arena | Arena reached | 1 |
| D: Wave | Wave reached | 3 |
| E: Score | Final score | 12450 |
| F: Time | Survival time | 4:32 |
| G: Q1 | Fun rating (1-5) | 4 |
| H: Q2 | Controls feel | Great |
| I: Q3 | Clarity | Mostly |
| J: Q4 | Difficulty | Just Right |
| K: Q5 | Play again | Probably |
| L: OpenFeedback | Free text | "Boss charge needs..." |
| M: TesterName | Optional name | TesterA |
| N: Processed | Sync date | 2026-02-03 |

---

## Troubleshooting

### Discord not receiving messages
- Check DISCORD_WEBHOOK is set correctly in Apps Script properties
- Run `testSetup()` in Apps Script to verify

### GitHub Action failing
- Check GSHEET_ID is correct
- Ensure GSHEET_CREDS_JSON contains the full JSON (including `-----BEGIN PRIVATE KEY-----`)
- Verify the service account has Editor access to the Sheet

### "Invalid token" errors
- Ensure the token in `debug.local.js` matches PLAYTEST_TOKEN in Apps Script
- Check for trailing spaces or quotes

### No rows marked as processed
- Ensure the Sheet has a "Processed" column (Column N)
- Check that the service account has write access

---

## Manual Testing

### Test via Debug Menu (Recommended)

The easiest way to test your connection:

1. Start the game locally
2. Go to **Main Menu → Debug Menu**
3. Find the **Playtest Feedback** section
4. Click **Test Connection**
5. Check the result:
   - **Green "Connected (Xms)"** = Everything working
   - **Red "CORS error"** = Apps Script needs "Anyone" access (create new deployment)
   - **Red "Invalid URL"** = Wrong URL in debug.local.js
   - **Red "Not configured"** = Missing PLAYTEST_CONFIG in debug.local.js

The console will show detailed diagnostics including:
- Token validation status
- Discord webhook configured (yes/no)
- Round-trip latency

### Test Apps Script
1. In Apps Script, run `testSetup()` to verify configuration
2. Use the test function or send a POST request manually

### Test GitHub Action
1. Go to Actions tab → "Sync playtest feedback"
2. Click "Run workflow" to trigger manually
3. Check logs for any errors

### Test In-Game (Full Flow)
1. Start the game locally
2. Go to main menu → click Feedback
3. Fill out form and submit
4. Check Discord for notification
5. Check Sheet for new row
