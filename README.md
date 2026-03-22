# gooaye-automated-email-summary
Automatically fetches the latest episode of the Gooaye (股癌) Podcast, transcribes it using AI speech-to-text, analyzes it with a large language model, and delivers an institutional-grade financial briefing to your inbox.

---

## How It Works

```
Gooaye RSS Feed
     ↓
AssemblyAI Speech-to-Text Transcription
     ↓
Google Gemini AI Analysis
     ↓
Gmail HTML Morning Note Delivery
```

---

## Prerequisites

| Item | Where to Get It | Cost |
|------|-----------------|------|
| AssemblyAI API Key | Sign up at [assemblyai.com](https://assemblyai.com) | Free ($50/month credit) |
| Gemini API Key | [aistudio.google.com](https://aistudio.google.com) | Free |
| Google Sheet | Create a new sheet, rename the tab to `log` | Free |
| Google Apps Script | [script.google.com](https://script.google.com) | Free |

---

## Setup Instructions

### Step 1: Fill in CONFIG

Open `gooaye_morning_note.gs` and fill in your credentials at the top:

```javascript
var CONFIG = {
  ASSEMBLYAI_API_KEY: 'your AssemblyAI key',
  GEMINI_API_KEY:     'your Gemini key',
  EMAIL_ADDRESS:      'your Gmail address',
  SHEET_ID:           'your Google Sheet ID',
  RSS_URL:            '...'  // no need to change
};
```

> **How to find your Sheet ID?** Open your Google Sheet and copy the string between `/d/` and `/edit` in the URL.

### Step 2: Create a GAS Project

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Paste the entire contents of `gooaye_morning_note.gs`
4. Save (Ctrl + S)

### Step 3: Test the Flow

1. Select `testFullFlow` from the dropdown menu → Click "Run"
2. On the first run, Google will ask for authorization — allow everything
3. Wait approximately 10 minutes (AssemblyAI needs time to transcribe)
4. Switch to `checkAndSendReport` → Click "Run"
5. Check your inbox for the morning note

### Step 4: Set Up Automated Triggers

In the GAS left sidebar, click "Triggers" and add two:

| Function | Trigger Timing | Purpose |
|----------|----------------|---------|
| `startTranscription` | Every Wednesday & Saturday (set separately) | Submit transcription job |
| `checkAndSendReport` | Every 5 minutes | Poll for completion and send email |

---

## Morning Note Structure

Each email contains four sections:

- **Section 1 — Companies Mentioned** — Categorized by US stocks, Taiwan stocks, Japan stocks, and others
- **Section 2 — Episode Key Points** — Numbered bullet summary
- **Section 3 — Detailed Analysis** — In-depth paragraph analysis with bolded keywords
- **Section 4 — Listener Q&A** — Summary of the Q&A segment

---

## Important Notes

- AssemblyAI free tier provides $50/month — Gooaye runs ~2 episodes/week at ~50 min each, costing roughly $8/month
- The `log` sheet tracks each job's status: `processing` → `done`
- If transcription fails, the status column will show `error: ...`

---

## Tech Stack

- **Runtime:** Google Apps Script (GAS)
- **Speech-to-Text:** AssemblyAI Universal-2 model (Chinese supported)
- **AI Analysis:** Google Gemini 2.5 Flash
- **Data Source:** Gooaye official RSS Feed (SoundOn platform)
- **Output Format:** HTML Email with inline CSS
