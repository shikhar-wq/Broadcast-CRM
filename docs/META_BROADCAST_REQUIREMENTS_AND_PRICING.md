# Meta WhatsApp Cloud API: Broadcasting Requirements, Pricing & Anti-Ban Architecture

This document covers all official requirements, prerequisites, pricing structures, rate limiting rules, and best practices for building an in-house broadcast messaging application with an interactive query inbox using the **WhatsApp Business Platform (Cloud API)**.

---

## 1. Conditions & Prerequisites for Broadcasting from Your Own Application

To send broadcast messages from your own custom application, Meta requires specific account credentials, compliance checks, and API integrations.

```
       ┌───────────────────────────────┐
       │   Meta Business Manager       │
       │   (Business Verification)     │
       └──────────────┬────────────────┘
                      │
       ┌──────────────▼────────────────┐
       │ WhatsApp Business Account     │
       │ (WABA) + Verified Phone No.   │
       └──────────────┬────────────────┘
                      │
       ┌──────────────▼────────────────┐
       │ System User & Permanent Token │
       │ (whatsapp_business_messaging) │
       └──────────────┬────────────────┘
                      │
       ┌──────────────▼────────────────┐
       │ Webhook Setup (Messages &     │
       │ Template Status Updates)      │
       └───────────────────────────────┘
```

### 1.1 Mandatory Meta Account Setup
1. **Meta Business Manager (WBM)**:
   - A business manager account at [business.facebook.com](https://business.facebook.com).
   - **Business Verification**: Highly recommended before broadcasting. Without business verification, your phone number will be capped at **250 unique business-initiated conversations per 24 hours**. Verification unlocks **Tier 1 (1,000/day)**.
2. **WhatsApp Business Account (WABA)**:
   - Created inside the Meta Business Manager.
3. **Dedicated Clean Phone Number**:
   - The phone number **must NOT** be registered on standard WhatsApp or WhatsApp Business mobile app.
   - If currently registered on the mobile app, it must be deleted from the mobile app first to be registered on the Cloud API.
4. **Meta Developer App**:
   - An app created in the [Meta Developers Portal](https://developers.facebook.com) of type **Business**.
   - Added product: **WhatsApp**.
5. **System User Access Token**:
   - A permanent System User token with permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
6. **Live Webhook Endpoint**:
   - An HTTPS public URL (e.g., using Cloudflare tunnel, Ngrok, or live server) configured in the Developer App to receive:
     - Inbound messages (`messages`) -> for the **Query Tab**
     - Message delivery receipts (`statuses`: sent, delivered, read, failed)
     - Template approval status (`message_template_status_update`)

---

## 2. Meta Message Templates (Prerequisite for Broadcasting)

Meta enforces a strict **24-Hour Customer Service Window**:
* **User-Initiated (Service Window)**: When a customer sends you a message, a 24-hour window opens. You can send free-form text, images, or audio freely.
* **Business-Initiated (Broadcast / Notification)**: Outside the 24-hour window, you **CANNOT** send free-form messages. You **MUST** use a **pre-approved Meta Message Template**.

### 2.1 Template Components Supported
Your application must allow composing:
1. **Header** (Optional):
   - Text (up to 60 characters with optional 1 variable)
   - Media: **Image** (`.jpg`, `.png`), **Video** (`.mp4`), or **Document** (`.pdf`)
2. **Body** (Required):
   - Plain text up to 1,024 characters.
   - Dynamic placeholders / variables: `{{1}}`, `{{2}}`, `{{3}}` (e.g., `Hello {{1}}, here is your exclusive offer...`).
3. **Footer** (Optional):
   - Plain text disclaimer (up to 60 characters).
4. **Buttons** (Optional, up to 3-10 depending on type):
   - **Quick Reply**: Predefined response chips like *"Interested"*, *"Talk to Agent"*, or *"Unsubscribe/STOP"*.
   - **Call-to-Action**:
     - *Visit Website* (Dynamic or static URL)
     - *Call Phone Number*
     - *Copy Offer Code*

### 2.2 Template Categories
Meta categorizes templates into 3 main types:
* **Marketing**: Promotions, offers, product launches, newsletters, re-engagement.
* **Utility**: Order confirmations, account updates, shipping notices, billing reminders.
* **Authentication**: One-time passcodes (OTPs) with copy-code or autofill buttons.

> [!WARNING]
> **Avoid Misclassification**: Submitting promotional content under the "Utility" category to lower costs will cause immediate rejection by Meta's AI or human reviewers, or worse, cause your quality score to plummet.

### 2.3 Template Approval Timeline
* Most templates are reviewed automatically via AI within **2 minutes to 15 minutes**.
* Some templates with complex media or borderline content can take up to **24 hours**.
* Status transitions: `PENDING` -> `APPROVED` | `REJECTED` | `PAUSED`.

---

## 3. Rate Limits, Messaging Tiers & Anti-Ban Architecture

The primary reason businesses get banned by Meta is **NOT API rate limits**; it is **recipient feedback (Spam / Block rate) and rapid blast patterns**.

### 3.1 Messaging Tiers (Unique Contacts per Rolling 24 Hours)
Meta restricts how many *unique phone numbers* your business can initiate conversations with in a 24-hour rolling window:

| Tier | Daily Recipient Limit | How to Reach |
|---|---|---|
| **Unverified Trial** | **250** unique users / 24 hrs | Default when phone number is added without business verification |
| **Tier 1** | **1,000** unique users / 24 hrs | Complete Business Verification in Meta Business Manager |
| **Tier 2** | **10,000** unique users / 24 hrs | Send to >= 500 users in 7 days while keeping High Quality |
| **Tier 3** | **100,000** unique users / 24 hrs | Send to >= 5,000 users in 7 days while keeping High Quality |
| **Tier 4** | **Unlimited** unique users | High volume with sustained High Quality |

> [!IMPORTANT]
> Because your target is **about 1,000 users**, your business must be in **Tier 1 (or higher)**. You **MUST complete Meta Business Verification**; otherwise, you will hit a hard ceiling of 250 contacts per day.

### 3.2 Technical API Throughput Limits
* Meta Cloud API default rate limit is **80 messages per second (MPS)** (and can be increased to 250+ MPS for high tiers).
* **Do NOT send at 80 MPS to 1,000 users!** Sending 1,000 messages in 12 seconds looks like automated spam and increases block rates.

### 3.3 Golden Rules to Prevent Bans
1. **Strict Opt-In Verification**:
   - Only broadcast to users who have explicitly agreed to receive WhatsApp communications from your brand.
   - Never use scraped, purchased, or cold contact lists.
2. **Mandatory Opt-Out Button ("STOP" / "Unsubscribe")**:
   - Every marketing template **MUST** have a quick-reply button like `"Stop Promo"` or `"Unsubscribe"`.
   - If users cannot easily opt out, they will click **"Report and Block"**. Meta's ban trigger is driven by report ratios!
3. **Automated Blacklist Suppression**:
   - When a user clicks `"Stop Promo"` or replies `"STOP"`, your application must immediately tag that contact as `opted_out = true` and suppress future broadcasts.
4. **Throughput Pacing & Jitter (Queue System)**:
   - Pace out 1,000 messages over **15 to 45 minutes** (e.g., **5 to 10 messages per second**, with random jitter of 50-200ms between requests).
   - This mimics natural distribution and prevents server load or automated spam heuristic flags.
5. **Monitor Phone Number Quality Rating**:
   - Meta tracks your quality rating in real-time:
     - **Green (High Quality)**: Safe.
     - **Yellow (Medium Quality)**: Warning. Check recent templates and block rates.
     - **Red (Low Quality)**: Danger. Meta will downgrade your tier or flag the number.
     - **Flagged**: 7-day grace period. If quality does not improve, your daily limit drops to 250.
     - **Restricted**: Broadcasts are blocked.

---

## 4. WhatsApp Cloud API Pricing Model

Meta uses a **Conversation-Based / Per-Message Category Pricing Model**. 

### 4.1 How Charges Work
* A **conversation** is a 24-hour window starting when your template message is successfully delivered to the user.
* All templates sent within that 24-hour window belonging to the *same category* are covered under that single conversation charge.
* If you send another marketing template 25 hours later, a new conversation fee applies.

### 4.2 Conversation Categories & Costs
Pricing varies by country/region of the recipient. Below are typical rates (in USD and INR) across common regions:

| Category | Description | India (Approx.) | US / Canada (Approx.) | UK / Europe (Approx.) |
|---|---|---|---|---|
| **Marketing** | Promotional messages, offers, product updates (Your broadcast) | **~₹0.78 - ₹0.85** ($0.0099 - $0.0102) | **~$0.0250** | **~€0.045 - €0.065** |
| **Utility** | Order status, transaction alerts, billing updates | **~₹0.11 - ₹0.15** ($0.0014 - $0.0018) | **~$0.0150** | **~€0.025 - €0.035** |
| **Authentication** | One-time passcodes (OTP) for login verification | **~₹0.11 - ₹0.13** ($0.0014 - $0.0016) | **~$0.0135** | **~€0.030 - €0.040** |
| **Service (User-Initiated)** | Customer inquiries where user messages first (Query Tab) | **~₹0.29 - ₹0.35** ($0.0035 - $0.0042) | **~$0.0088** | **~€0.030 - €0.040** |

> [!NOTE]
> **Free Tier Allowances**:
> * **1,000 Free Service Conversations per month**: Each WhatsApp Business Account gets 1,000 free **Service (user-initiated)** conversations each month. Customer support chats in your **Query Tab** will mostly be **FREE** within this allowance!
> * *Note*: Marketing and Utility conversations are **NOT** free and are billed from message #1.
> * **Free 72-Hour Window**: If a user messages you via a Click-to-WhatsApp Ad or Facebook Page Call-to-Action button, conversations are free for 72 hours.

### 4.3 Estimated Cost for a 1,000 Contact Broadcast
If you broadcast a **Marketing Template** to 1,000 users:
* **India Audience**:
  `1,000 recipients × ₹0.80 ≈ ₹800 INR` (approx. **\$9.60 USD**).
* **US Audience**:
  `1,000 recipients × $0.025 ≈ $25.00 USD`.
* **Failed / Undelivered Numbers**:
  You are only charged if the message is **successfully delivered** (`delivered` webhook status). Unreachable or invalid numbers are not charged.

---

## 5. Architectural Blueprint for Your Custom Application

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND DASHBOARD                               │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │   Template Studio     │  │   Broadcast Engine   │  │    Query Tab     │  │
│  │ (Text/Img/Video + Meta│  │ (CSV Upload, Pacing, │  │ (2-Way Live Chat │  │
│  │   Approval Status)    │  │  Anti-Ban Throttling)│  │ 24-hr Helpdesk)  │  │
│  └───────────────────────┘  └──────────────────────┘  └──────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST / WebSocket
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                             BACKEND ENGINE                                  │
│  - Template Manager (Meta Graph API /message_templates)                    │
│  - Broadcast Worker & Rate Limiter (5-10 msgs/sec queue with jitter)        │
│  - Webhook Listener (/webhook for incoming messages & delivery receipts)    │
│  - Contacts & Unsubscribe Manager (Auto-suppress "STOP" replies)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS Graph API v21.0
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    META WHATSAPP BUSINESS CLOUD API                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Modules:
1. **Template Manager**:
   - Visual editor with live WhatsApp phone mockup.
   - Supports Header (Text/Image/Video), Body with `{{variables}}`, Footer, and Action/Quick Reply buttons.
   - Submit directly to Meta Graph API (`POST /{WABA_ID}/message_templates`).
   - Real-time approval status badges (`APPROVED`, `PENDING`, `REJECTED`).
2. **Broadcast Engine with Anti-Ban Pacing**:
   - Select approved template.
   - Upload contacts via CSV or pick contact lists (supports tags and variable mapping).
   - Filter out unsubscribed/blacklisted numbers automatically.
   - Configurable sending rate (e.g. 10 msgs/sec) with automated pause if error rate exceeds 5%.
   - Live analytics: Total queued, sent, delivered, read, failed.
3. **Query Tab (Customer Support Inbox)**:
   - Real-time two-way chat interface.
   - Notifies when a broadcast recipient replies with a question or clicks a quick reply.
   - Displays 24-hour countdown timer showing remaining customer service window.
   - Ability to send quick replies, canned responses, or assign conversations.
   - One-click opt-out toggle.
