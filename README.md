# IntelliGreen WA CRM — WhatsApp Cloud API Broadcaster & Query Hub

A lightweight, self-hosted WhatsApp Business platform built with **Node.js, Express, SQLite, React, Vite, and Tailwind CSS**.

Includes a **dual-mode engine**:
1. **Simulation Sandbox Mode (Default)**: Full end-to-end testing with **zero Meta account or API keys required**. Simulates Meta template AI approvals, generates 1,000 test contacts, executes rate-limited broadcasts with anti-ban pacing, and simulates customer queries in the Query tab.
2. **Live Meta Cloud API Mode**: Connects directly to Meta Graph API v21.0 using your WhatsApp Business Account (WABA) credentials.

---

## Features

### 1. Template Studio & Verification
- **Visual Template Builder**: Supports Headers (Text, Image, Video, Document), dynamic body variables (`{{1}}`, `{{2}}`), footers, and interactive buttons (Quick Reply, Website URL, Phone Call).
- **Interactive WhatsApp Phone Mockup**: Renders live preview in real-time, exactly as delivered on customer phones.
- **Meta Verification Lifecycle**: Tracks `PENDING`, `APPROVED`, and `REJECTED` states. In Sandbox mode, automatically simulates Meta's 5-second review cycle, with manual "⚡ Fast-Approve" and "Simulate Reject" test buttons.

### 2. Anti-Ban Broadcast Engine (1,000 Contact Capacity)
- **Rate-Limiting Queue with Jitter**: Configurable dispatch speed (default: 5–10 messages/sec with randomized 30–80ms jitter) preventing robotic blast detection by Meta spam heuristics.
- **Mandatory Opt-Out / STOP Support**: Every marketing template includes an opt-out button.
- **Automated Blacklist Suppression**: If a contact texts "STOP" or clicks "Stop Promo", they are automatically marked as opted-out and skipped from all future broadcasts to protect your quality rating.
- **1-Click 1,000 Contact Generator**: Instantly populate 1,000 realistic test contacts to stress-test your broadcasts.
- **Circuit Breaker**: Auto-pauses campaign if consecutive Meta errors exceed 5%.
- **Live Campaign Progress Tracker**: Real-time progress bar tracking Queued, Sent, Delivered, Read, Failed, and Suppressed messages.

### 3. Query Tab (2-Way Customer Support Inbox)
- **Active 24-Hour Service Window Countdown**: Displays exact remaining time before the free customer service window closes.
- **Real-Time Live Chat**: WhatsApp-styled bubble view showing previous broadcast template messages and customer replies.
- **Reply Dispatcher**: Send instant agent answers back to customer inquiries.
- **Simulate Customer Reply**: Built-in simulator to test incoming questions and test the "STOP" unsubscribe trigger right from the browser.

### 4. Settings & Meta Conversation Pricing Calculator
- **Interactive Cost Calculator**: Calculate exact conversation fees across countries (India: ~₹0.80/conv, US: ~$0.025/conv, UK: ~£0.038/conv).
- **Free Tier Allowance**: Highlights the **1,000 free Service conversations per month** provided by Meta.
- **Health & Tier Card**: Displays Phone Quality Rating (Green/Yellow/Red) and Messaging Tier (Tier 1: 1,000/day).

---

## Quick Start Guide

### 1. Start the Server & Client
```powershell
# Run backend and frontend concurrently
npm run dev
```

Or run individually:
```powershell
# Run backend server (http://localhost:5000)
npm run server

# Run frontend development server (http://localhost:3000)
npm run client
```

Open your browser to: **`http://localhost:3000`** (or `http://localhost:5000`).

---

## How to Test Without a Meta Account (Step-by-Step)

1. **Step 1: Open Template Studio**
   - Review pre-seeded approved templates with Image and Video headers.
   - Click **"Create New Template"**, select **Header Type: Image or Video**, fill in variables (`{{1}}`, `{{2}}`), and click **"Submit Template for Meta Verification"**.
   - Notice the status becomes `PENDING` and auto-approves in 5 seconds (or click **"⚡ Fast-Approve"**).

2. **Step 2: Seed 1,000 Test Contacts**
   - Switch to the **Broadcast Engine** or **Contacts Hub** tab.
   - Click the button **"Seed 1,000 Test Contacts"**.
   - 1,000 realistic contacts with names, numbers, and variables will be generated instantly.

3. **Step 3: Launch Rate-Limited Broadcast**
   - In the **Broadcast Engine**, select your approved template.
   - Choose the Rate Limiter slider (e.g., 5 to 10 messages/sec).
   - Click **"Queue & Launch Broadcast to 1,000 Contacts"**.
   - Watch the live progress bar and dispatch stream update in real time (`queued` -> `sent` -> `delivered` -> `read`).
   - Test the **Pause** and **Resume** controls.

4. **Step 4: Test the Query Tab (Customer Replies)**
   - Click the **Query Tab**.
   - Click **"Simulate Reply"** (or type a custom question).
   - Notice the 24-hour service window timer activate (`23h 59m left`).
   - Type an answer in the reply box and click **"Send"** to see 2-way conversation in real time.
   - Click **"Simulate 'STOP'"** to see how the system automatically unregisters the contact and blacklists them from future broadcasts to prevent Meta bans!

5. **Step 5: View Pricing Breakdown**
   - Click **Settings & Pricing**.
   - Use the interactive calculator to calculate costs for 1,000 recipients across India, US, UK, and UAE.

---

## Switching to Live Meta Cloud API (When Ready)

When you set up your Meta WhatsApp Business Account:
1. Go to the **Settings & Pricing** tab in the app.
2. Select **"Live Meta Cloud API"**.
3. Enter your:
   - WhatsApp Business Account ID (WABA ID)
   - Phone Number ID
   - Permanent System User Access Token
   - Webhook Verify Token
4. In your **Meta App Dashboard**:
   - Set the Webhook Callback URL to `https://your-domain.com/api/webhook`.
   - Enter the same Webhook Verify Token.
   - Subscribe to the `messages` and `message_template_status_update` webhook fields.
5. Click **"Save Configuration"**. You are now live!
