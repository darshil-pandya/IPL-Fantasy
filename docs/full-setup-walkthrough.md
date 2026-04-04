# IPL Fantasy: full setup in plain language (GitHub + Firebase + score sync)

This is **one checklist** from “nothing configured” to “live site + optional score sync.” You do **not** need Firebase CLI on your computer. Deployments use **GitHub Actions**; configuration uses **web consoles** (Firebase, Google Cloud, GitHub, Cricket Data).

Skim the **“Before you start”** section first, then follow **Phase A → B → C → D** in order.

---

## Before you start (what you need)

| Thing | Why |
|--------|-----|
| A **Google account** | Owns Firebase and Google Cloud. |
| A **GitHub account** | Hosts code and runs workflows. |
| This **repository** on GitHub with `main` (or your default branch). | Workflows run from it. |
| **Cricket Data** account (free tier is fine if it covers the API calls you need). | Match data for score sync. |
| A **payment method** on file for Firebase **Blaze** | Required to deploy **Cloud Functions** (you often still pay **$0** for a small league—see end of doc). |

**Time:** first time, budget 45–90 minutes with breaks.

---

# Phase A — Firebase project (browser only)

### A1. Open or create a project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. **Add project** (or select your existing project).
3. Finish the wizard (Google Analytics is optional).

### A2. Register a **Web app** (if you have not already)

1. In the project overview, click the **Web** icon `</>` (“Add app”).
2. Register the app (nickname anything, e.g. “IPL Fantasy”).
3. Copy these three values somewhere safe (you will paste them into GitHub later):

   - `apiKey` → GitHub secret **`VITE_FIREBASE_API_KEY`**
   - `authDomain` → **`VITE_FIREBASE_AUTH_DOMAIN`**
   - `projectId` → **`VITE_FIREBASE_PROJECT_ID`**

### A3. Turn on Firestore

1. Left menu: **Build** → **Firestore Database**.
2. **Create database**.
3. Pick a **region** (e.g. close to India: `asia-south1`).
4. Start in **production mode** if you will deploy rules from git soon; or test mode temporarily (less secure).

### A4. Upgrade to **Blaze** (required for Cloud Functions)

1. Firebase Console → **Upgrade** / **Spark plan** indicator → switch to **Blaze (pay as you go)**.
2. Add billing details.  
   **Note:** Blaze does not mean you will pay every month—Firebase includes **free monthly quotas** for Functions; a few syncs per week usually stay free.

### A5. Enable **Authentication** (only for “authorized domains” later)

1. **Build** → **Authentication** → **Get started**.
2. You do **not** have to enable Email/Password for this league app unless you want to.  
3. You **will** use **Authentication → Settings → Authorized domains** in Phase D.

---

# Phase B — Cricket Data (browser only)

### B1. Sign up and get an API key

1. Sign up: [cricketdata.org/signup.aspx](https://cricketdata.org/signup.aspx).
2. Log in: [cricketdata.org/member.aspx](https://cricketdata.org/member.aspx).
3. Find your **API key** on the dashboard (wording may be “API key” or “lifetime key”).
4. Copy it. You will put it in GitHub as **`CRICKETDATA_API_KEY`** (Phase C).

### B2. Check the free plan is enough for you

- Read their current limits (credits, which endpoints work on free tier).
- Your Cloud Function calls **`fantasySummary`** (see `functions/src/index.ts`). If free tier does not include that for IPL, you would need a paid Cricket Data plan—**that is separate from Firebase**.

### B3. Invent your **sync passphrase**

- This is **only for your league** (not your Cricket Data password).
- Use something long and random; save it in a password manager.
- You will put it in GitHub as **`FANTASY_SYNC_PASSPHRASE`** (Phase C).
- You will **type it on the website** every time you run **Score sync**.

---

# Phase C — GitHub repository secrets

All of this is: GitHub → your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

### C1. Secrets for the **website** build (GitHub Pages)

These are already described in [firebase-waiver-setup.md](./firebase-waiver-setup.md). Create **three** secrets (exact names):

| Secret name | Value |
|-------------|--------|
| `VITE_FIREBASE_API_KEY` | From Firebase Web app config (Phase A2). |
| `VITE_FIREBASE_AUTH_DOMAIN` | From Firebase Web app config. |
| `VITE_FIREBASE_PROJECT_ID` | From Firebase Web app config (your **project id** string). |

Without these, the built site cannot talk to Firebase (no Waivers sync, no Score sync nav, no live league).

### C2. Secrets for **Deploy Firebase backend** workflow

Create **four** more secrets:

| Secret name | Value |
|-------------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full contents of a **service account JSON file** (Phase C3 below). **Entire file**, including `{` and `}`. |
| `VITE_FIREBASE_PROJECT_ID` | **Same** project id as in C1 (workflow uses it as `--project` for Firebase CLI). |
| `CRICKETDATA_API_KEY` | Your Cricket Data API key (Phase B). |
| `FANTASY_SYNC_PASSPHRASE` | Your long random passphrase (Phase B3). |

**Important:** `VITE_FIREBASE_PROJECT_ID` is listed twice in the table on purpose—you only create **one** secret with that name in GitHub; it is used by **both** the Pages workflow and the backend workflow.

### C3. Create the **service account JSON** (still browser-only)

1. Firebase Console → **Project settings** (gear) → **Service accounts**.
2. Tab **Firebase Admin SDK**.
3. Click **Generate new private key** → **Generate key**. A `.json` file downloads.
4. Open that file in any text editor.
5. **Select all** → **Copy**.
6. GitHub → **New repository secret** → name **`FIREBASE_SERVICE_ACCOUNT_JSON`** → paste → **Add secret**.

**Never** commit this file into git.

### C4. If the backend workflow fails with “permission denied”

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select **the same project** as Firebase.
2. **IAM & Admin** → **IAM**.
3. Find the email inside the JSON (field `client_email`), e.g. `firebase-adminsdk-….iam.gserviceaccount.com`.
4. **Edit** that principal → **Add role** (for a private league you can temporarily use **Editor** on the project while debugging; later you can tighten roles).
5. Roles that often matter for this repo: **Cloud Functions Admin**, **Service Account User**, **Secret Manager Admin** (or **Secret Manager Secret Accessor** + ability to create secrets), **Firebase Rules Admin** / **Firebase Admin** as applicable.
6. **If the log shows HTTP 403 and `secretmanager.googleapis.com` or `serviceusage.services.use`:** add **`Service Usage Consumer`** (`roles/serviceusage.serviceUsageConsumer`) to that **same** service account. Without it, `firebase functions:secrets:set` cannot use the Secret Manager API on your project.
7. **Enable the API once (browser, as project owner):** **APIs & Services** → **Library** → search **Secret Manager API** → **Enable**.
8. Save IAM changes, then **re-run** the **Deploy Firebase backend** workflow.

---

# Phase D — GitHub Pages + workflows

### D1. Turn on GitHub Pages with Actions

1. GitHub repo → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**: choose **GitHub Actions** (not “Deploy from branch” unless you know you use that).

Until this is set, the “Deploy to GitHub Pages” workflow can fail with a Pages-related error.

### D2. Confirm workflow files exist on `main`

Your repo should include at least:

- `.github/workflows/deploy.yml` — builds and publishes the **website**.
- `.github/workflows/firebase-backend.yml` — deploys **Firestore rules + Cloud Functions**.
- `firebase.json`, `firestore.rules`, and the **`functions/`** folder (with `package-lock.json`).

If you are reading this from a clone, **push** these to GitHub (any method you like).

### D3. Run **Deploy Firebase backend** (first time)

1. GitHub → **Actions**.
2. Click **Deploy Firebase backend** in the left list.
3. **Run workflow** → branch **main** → **Run workflow**.
4. Open the run; wait until every step is **green**.

What this did:

- Piped **`CRICKETDATA_API_KEY`** and **`FANTASY_SYNC_PASSPHRASE`** into **Google Secret Manager** (Firebase Functions secrets).
- Deployed **`firestore.rules`** (waivers + league writable; `fantasyMatchScores` read-only from browsers).
- Deployed **`syncMatchFantasyScores`** (callable Cloud Function, default region **`us-central1`**).

If it fails, read the red log line and use **Phase E (troubleshooting)** below.

### D4. Run or wait for **Deploy to GitHub Pages**

- **Automatic:** pushing to `main` usually starts **Deploy to GitHub Pages**.
- **Manual:** **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

Wait until green. Then open the site URL shown on the workflow (or your usual `https://<user>.github.io/<repo>/...`).

### D5. Add your site to **Firebase authorized domains**

1. Firebase Console → **Authentication** → **Settings** → scroll to **Authorized domains**.
2. **Add domain**.
3. Enter your **GitHub Pages host** only, e.g. `darshil-pandya.github.io`  
   - No `https://`  
   - No path like `/IPL-Fantasy`
4. Save.

Without this, **Score sync** may fail when the browser calls the Cloud Function.

### D6. (Optional) Functions in a different region

- Default in code is **`us-central1`**.
- If you change it in `functions/src/index.ts`, add a GitHub Actions variable or secret for the **front-end** build: **`VITE_FIREBASE_FUNCTIONS_REGION`** = that region, then rebuild Pages (see [firebase-score-sync.md](./firebase-score-sync.md)).

---

# Phase E — Verify everything

### E1. Website

1. Open the live site.
2. You should see navigation including **Waivers** (when Firebase env is set).
3. You should see **Score sync** when the three `VITE_FIREBASE_*` vars were present at build time.

### E2. Firestore

1. Firebase Console → **Firestore Database**.
2. Confirm collection/document paths your app uses, for example:
   - `iplFantasy` / `waiverState` — appears after waivers are used.
   - `iplFantasy` / `leagueBundle` — appears after **Publish league to Firestore** (Waivers commissioner).
   - `iplFantasy` / `fantasyMatchScores` — appears **after your first successful Score sync** (field `matches`).

### E3. First **Score sync** (commissioner test)

1. Open **Score sync** on the live site.
2. Fill in:
   - **Sync passphrase** — exactly what you stored as **`FANTASY_SYNC_PASSPHRASE`** in GitHub (and that the workflow pushed to Firebase).
   - **Cricket Data match id** — the id their API expects for **one** match (from their docs or listing API).
   - **League match key** — **your** stable id, e.g. `IPL2026-M01`. Reusing it **overwrites** that match next time.
   - **Display label** — human text, e.g. `GT vs CSK`.
   - **Match date** — calendar date for your records.
3. Submit and read the success or error message.
4. Check Firestore → `fantasyMatchScores` → `matches` for your key.

**Today’s logic is a demo:** points are **batting runs** matched by **player name** only. Your real IPL 2026 rules go in `functions/src/cricketdata.ts` later.

### E4. Waivers and league bundle (if you use them)

- See [firebase-waiver-setup.md](./firebase-waiver-setup.md): publish league, `VITE_LEAGUE_SOURCE`, etc.

---

# Phase F — What to do when something changes

| Situation | What to do |
|-----------|------------|
| You change Cricket Data API key | Update GitHub secret **`CRICKETDATA_API_KEY`** → run **Deploy Firebase backend** again. |
| You change sync passphrase | Update **`FANTASY_SYNC_PASSPHRASE`** → run **Deploy Firebase backend** again. |
| You change Cloud Function code | Push to GitHub → **Deploy Firebase backend** again. |
| You change `firestore.rules` | Push → **Deploy Firebase backend** again. |
| You change **React** site code | Push to `main` → **Deploy to GitHub Pages** runs (or run it manually). |

---

# Troubleshooting (quick)

## Reading a failed “Deploy Firebase backend” run

1. GitHub → **Actions** → click the **red** workflow run.
2. Click the **deploy** job.
3. Expand steps **top to bottom**. The **first step with a red X** is the one that failed; scroll inside it for the **real error line** (not only “exit code 1”).
4. Typical mapping:

| Failed step | Common cause |
|-------------|----------------|
| **Verify required GitHub Actions secrets** | A secret name is wrong or the value was never saved (empty). Fix in **Settings → Secrets → Actions**, re-run workflow. |
| **Install Cloud Function dependencies** | Rare `npm ci` / lockfile issue; try re-run. |
| **google-github-actions/auth** | **`FIREBASE_SERVICE_ACCOUNT_JSON`** is invalid: not the full file, extra text, or broken copy-paste. Regenerate key in Firebase, paste entire JSON again. |
| **Push Cricket Data + sync passphrase** | **403** on `secretmanager.googleapis.com` / `serviceusage.services.use`: add **Service Usage Consumer** to the Firebase Admin service account (see Phase C4); enable **Secret Manager API** in GCP; add **Secret Manager Admin** if still denied. |
| **Push Cricket Data…** shows **“Failed to authenticate, have you run firebase login?”** | The Firebase CLI often **does not** use service-account JSON for `firebase functions:secrets:set` in CI. Current workflow uses **`gcloud secrets create` / `versions add`** instead (same Secret Manager names: `CRICKETDATA_API_KEY`, `FANTASY_SYNC_PASSPHRASE`). Pull the latest `firebase-backend.yml` and re-run. |
| **Deploy Firestore rules and Cloud Functions** | Project not on **Blaze**; or **Cloud Build** / **Artifact Registry** API not enabled; or IAM roles missing for deploy (Phase C4). |

| Problem | Likely fix |
|---------|------------|
| Backend workflow fails on **secrets:set** | Service account needs **Secret Manager** permissions (Phase C4). |
| Backend workflow fails on **deploy** | **Blaze** enabled; enable **Cloud Build** / **Artifact Registry** if prompted; fix IAM (Phase C4). |
| Score sync: “Firebase is not configured” | Pages build missing **`VITE_FIREBASE_*`** secrets; rebuild Pages. |
| Score sync: generic / CORS / blocked | **Authorized domains** (Phase D5). |
| Score sync: wrong passphrase | Must match **`FANTASY_SYNC_PASSPHRASE`**; after changing GitHub secret, **re-run backend workflow**. |
| No points or nonsense points | Expected until you replace **demo** scoring in **`functions/src/cricketdata.ts`**. |

---

# Cost reminder (plain language)

- **Cricket Data:** free tier may be enough; depends on their current rules and your call volume.
- **Firebase:** **Blaze is required** for Cloud Functions, but **low usage** often stays inside **free quotas** → **$0** bill. You still need a card on file.
- **GitHub:** public repo + occasional Actions runs are usually fine on the free tier.

---

## Related docs (shorter / deeper on one topic)

- [firebase-waiver-setup.md](./firebase-waiver-setup.md) — Waivers, league bundle, `VITE_LEAGUE_SOURCE`, Pages secrets.
- [firebase-score-sync.md](./firebase-score-sync.md) — Score sync behaviour, files, optional Secret-Manager-only setup.
