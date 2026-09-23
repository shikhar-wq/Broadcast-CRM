# Zero-Cost Production Deployment & Architecture Blueprint

This blueprint guides you through running and deploying **IntelliGreen WA CRM** completely **FREE forever ($0/month)**. You will never pay any monthly platform, software, server, or cloud storage fees. The **only** expense you will ever incur is the raw wholesale per-conversation cost billed directly by Meta for delivered WhatsApp messages (with 1,000 free service conversations every month).

---

## 1. Zero-Cost Architecture Overview

| Component | Industry Standard (Paid Platforms) | IntelliGreen WA CRM (Our Stack) | Monthly Cost | Max File Size |
| :--- | :--- | :--- | :--- | :--- |
| **CRM & Broadcast Software** | WATI, AiSensy, Interakt ($49 – $199/mo) | **IntelliGreen WA CRM** (In-house) | **$0.00** | Unlimited |
| **Media Storage Option 1 (Recommended)** | AWS S3, Cloudinary ($15 – $30/mo) | **Built-in App Storage (on Render / Server)** | **$0.00** | **Up to 50 MB+** |
| **Media Storage Option 2 (Cloud Bucket)**| AWS S3, Cloudflare Paid ($10 – $20/mo) | **Supabase Storage (Free Tier)** | **$0.00** | **50 MB** exact free limit |
| **Media Storage Option 3 (Legacy)** | ImageKit Free ($0/mo) | **ImageKit.io** | **$0.00** | 25 MB max limit |
| **Cloud Server / Hosting** | AWS EC2, Heroku ($10 – $25/mo) | **Render.com** (Free Web Service) | **$0.00** | 750 free hrs/mo |
| **SSL / HTTPS Certificate** | Paid SSL certificate ($20/yr) | **Let's Encrypt / Render SSL** | **$0.00** | Included free |
| **Database** | Managed AWS RDS ($15/mo) | **Embedded SQLite / Turso Free** | **$0.00** | Embedded disk |
| **WhatsApp API Markup** | $0.005 - $0.01 extra per message | **Direct Meta Cloud API (v21.0)** | **$0.00** | Meta wholesale |
| **Total Monthly Fixed Cost** | **$75 - $270 / month** | **Our Free Architecture** | **$0.00 / month** | **Supports 50 MB!** |

---

## 2. 50 MB Media Storage Solutions (100% Free)

Meta WhatsApp Cloud API requires media headers (images and videos) and broadcast attachments to be accessible via **public HTTPS URLs**. We provide two 100% free ways to handle files up to **50 MB**:

### Option 1: Built-in App Storage (Recommended — 0 Setup, Supports 50 MB+)
When deployed to **Render.com** (or Fly.io), your CRM runs on a free public HTTPS domain (e.g. `https://intelligreen-wa-crm.onrender.com`).
* **Zero External Accounts**: No need to register for ImageKit, AWS, or Supabase.
* **Direct HTTPS URLs**: Files are stored in `data/uploads/` and served directly over your app's secure SSL URL (`https://intelligreen-wa-crm.onrender.com/uploads/<file>.mp4`).
* **50 MB+ Video Support**: Bypasses the 25 MB limits of external free tiers.
* **How to use**: In the CRM Settings, select **"App Storage"** under Media Storage. When deployed, enter your Render domain into **Public App URL** (e.g. `https://your-app.onrender.com`).

---

### Option 2: Supabase Cloud Storage (Free Tier — 50 MB per file)
If you prefer storing media on an external cloud CDN rather than the server disk:
* **Generous Free Limit**: Supabase Free plan allows up to **50 MB per file upload** (unlike ImageKit which caps at 25 MB).
* **Storage Quota**: 1 GB storage + 5 GB monthly bandwidth for **$0 forever**.
* **Step-by-Step Setup**:
  1. Go to [https://supabase.com](https://supabase.com) and create a free project.
  2. In your Supabase dashboard, go to **Storage** -> **New Bucket**. Name it `whatsapp-media` and toggle **Public Bucket** to ON.
  3. Go to **Project Settings** -> **API** to find your **Project URL** and **Anon / Public Key**.
  4. In IntelliGreen WA CRM Settings -> select **Supabase (50MB)**, enter the credentials, and click **Test Supabase Connection**.

---

### Option 3: ImageKit.io (Free Plan — 25 MB max)
* ImageKit provides 20 GB free storage, but enforces a strict **25 MB file size limit** on its free tier.
* Best suited for images or short video clips under 25 MB.

---

## 3. Step-by-Step Free Cloud Deployment on Render.com

Render provides free Web Services with automatic HTTPS, continuous GitHub deployment, and free environment variables.

#### Step 1: Push Code to GitHub
Ensure your code is in a GitHub repository:
```bash
git init
git add .
git commit -m "IntelliGreen WA CRM 50MB video support"
git remote add origin https://github.com/<your-username>/intelligreen-wa-crm.git
git push -u origin main
```

#### Step 2: Create a Free Web Service on Render
1. Go to [https://render.com](https://render.com) and create a free account.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Name**: `intelligreen-wa-crm`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm --prefix client install && npm --prefix client run build`
   - **Start Command**: `npx tsx server/index.ts`
   - **Instance Type**: `Free` ($0/month)
5. Under **Environment Variables**, add:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `PUBLIC_URL`: `https://intelligreen-wa-crm.onrender.com` (your Render URL)
6. Click **Create Web Service**.
7. Render will build and deploy your application to a free live URL: `https://intelligreen-wa-crm.onrender.com`.

---

## 4. Connecting Your Live Meta WhatsApp Account for $0

When you are ready to switch from Simulation Sandbox to Live Meta API:

1. **Meta Developer App**: Go to [https://developers.facebook.com](https://developers.facebook.com) -> Select your WhatsApp App.
2. Under **WhatsApp** -> **Configuration**:
   - **Callback URL**: `https://your-app.onrender.com/api/webhook`
   - **Verify Token**: `intelligreen_secret_token_123` (or matching your CRM settings)
   - Click **Verify and Save**.
3. Under **Webhook Fields**, click **Subscribe** to `messages` (to receive incoming customer chats and STOP unsubscribes).
4. Copy your:
   - **WhatsApp Business Account ID** (WABA ID)
   - **Phone Number ID**
   - **Permanent System User Access Token**
5. Paste these credentials into the **Settings** tab in your CRM and toggle to **Live Meta API**.

---

## 5. What Charges You Actually Pay (Only Meta Delivery)

By using direct Meta Cloud API, you bypass all middleman markups:

* **Platform / Subscription Cost**: **$0.00**
* **First 1,000 Customer Service Chats**: **Free every single month** from Meta.
* **Outgoing Marketing / Utility Messages**: Charged directly by Meta to your credit card on file in Meta Business Manager:
  - **India**: ~₹0.78 to ₹0.80 per delivered conversation
  - **USA / Canada**: ~$0.025 per delivered conversation
  - **Undelivered or Opted-Out Contacts**: **$0.00 (Never charged)**
