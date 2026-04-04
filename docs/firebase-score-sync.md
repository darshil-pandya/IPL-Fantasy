# Cricket Data + Firebase score sync — end-to-end (plain language)

**For one combined checklist from zero (Firebase + GitHub + Pages + all secrets + first sync), start here: [full-setup-walkthrough.md](./full-setup-walkthrough.md).**

This page focuses on **score sync** behaviour and the **GitHub-only** deploy path. Your **GitHub Pages** site stays a static build; **Firebase** runs the backend. **You do not need Firebase CLI on your PC** — deploys run from **GitHub Actions**.

---

## What you’re setting up (big picture)

1. **Cricket Data** returns match JSON to your **Cloud Function**.
2. The function writes **fantasy points per player** into **Firestore** (browsers cannot write that document; only the function can).
3. Your **website** reads Firestore and **merges** those points into each player’s matches and season total.

The Cricket Data API key is **not** baked into the Vite app. It is stored as an **encrypted GitHub Actions secret**, copied into **Google Secret Manager** when you run the deploy workflow, and used only by Cloud Functions at runtime.

---

## Step 1 — Accounts

- **Firebase project** — Same one as `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, and `VITE_FIREBASE_PROJECT_ID` (see [firebase-waiver-setup.md](./firebase-waiver-setup.md)).
- **Cricket Data** — Sign up at [cricketdata.org/signup.aspx](https://cricketdata.org/signup.aspx), log in at [member / login](https://cricketdata.org/member.aspx), and copy your **API key** from the dashboard.
- **GitHub repo** — This code on `main` (or the branch you deploy from).

**Billing:** Cloud Functions (2nd gen) need the Firebase project on the **Blaze** plan. In Firebase Console → your project → **Upgrade** if prompted when you enable Functions.

---

## Step 2 — Invent your sync passphrase

This is **not** your Cricket Data password. Use a **long random** string (password manager recommended).

- You will store it as a **GitHub Actions secret** (below).
- The workflow copies it into Firebase as **`FANTASY_SYNC_PASSPHRASE`**.
- You type it on the site’s **Score sync** page whenever you run a sync.

Anyone who knows this passphrase **and** your public site could trigger a sync — treat it like a password.

---

## Step 3 — Service account JSON (browser + GitHub only)

GitHub Actions needs permission to deploy rules and functions. You create a key **in the cloud console**, then paste it into GitHub **once**.

1. Open [Firebase Console](https://console.firebase.google.com/) → your project.
2. **Project settings** (gear) → **Service accounts**.
3. Under **Firebase Admin SDK**, click **Generate new private key** → **Generate key**. Your browser downloads a `.json` file.
4. On GitHub: your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
5. Name: **`FIREBASE_SERVICE_ACCOUNT_JSON`**
6. Value: open the downloaded JSON in a text editor, **copy the entire file contents**, paste into the secret field, save.

**Do not** commit this JSON into git.

Give that service account enough power to deploy (if a deploy fails with “permission denied”, in [Google Cloud Console](https://console.cloud.google.com/) → **IAM** find the same service account email and add roles such as **Cloud Functions Admin**, **Service Account User**, **Firebase Rules Admin**, **Secret Manager Admin** — exact set can vary; **Editor** on the project is heavy-handed but works for a private league while you iterate).

---

## Step 4 — Add the rest of the GitHub Actions secrets

Same place: **Settings → Secrets and variables → Actions**.

| Secret name | What to put there |
|-------------|-------------------|
| **`FIREBASE_SERVICE_ACCOUNT_JSON`** | Full JSON from Step 3 (already added). |
| **`VITE_FIREBASE_PROJECT_ID`** | Your Firebase project id (same value you use for the Pages build — you may already have this). |
| **`CRICKETDATA_API_KEY`** | Your Cricket Data API key string. |
| **`FANTASY_SYNC_PASSPHRASE`** | The passphrase from Step 2. |

The workflow **Deploy Firebase backend** reads the last two and runs `firebase functions:secrets:set` on GitHub’s runners, then deploys. Nothing is stored in plain text in the repo.

Your existing **Pages** workflow secrets (`VITE_FIREBASE_API_KEY`, etc.) stay as they are.

---

## Step 5 — Get this workflow onto GitHub

Merge or push the repo files that matter here, including:

- `.github/workflows/firebase-backend.yml`
- `firebase.json`, `firestore.rules`, `functions/` (with `package-lock.json`)

You can do that with **GitHub’s web UI** (upload/edit files), **GitHub Desktop**, or git from any machine — no requirement to “host” or run deploy scripts locally.

---

## Step 6 — Run the deploy from GitHub (replaces local CLI)

1. On GitHub open **Actions**.
2. Select **Deploy Firebase backend**.
3. Click **Run workflow** → choose branch (usually `main`) → **Run workflow**.

Wait until it finishes green. It will:

1. Copy **`CRICKETDATA_API_KEY`** and **`FANTASY_SYNC_PASSPHRASE`** into Firebase / Secret Manager.
2. Deploy **`firestore.rules`** and **Cloud Functions** (`syncMatchFantasyScores` in `us-central1` by default).

**After you rotate** the Cricket key or passphrase, update the GitHub secrets and **run this workflow again** so Firebase gets the new values and functions redeploy.

---

## Step 7 — Firestore rules (included in the workflow)

You do **not** have to paste rules by hand unless you prefer that. The same workflow runs `firebase deploy --only firestore:rules,functions`.

The file **`firestore.rules`** in the repo defines: **read/write** `waiverState` and `leagueBundle`; **read-only** `fantasyMatchScores` from clients.

If you ever edit rules only in the Firebase Console, remember the **repo file can drift** from what’s live — prefer changing `firestore.rules` in git and re-running **Deploy Firebase backend**.

---

## Step 8 — Authorized domain (Firebase Console)

Callable functions from your live site require an allowed host.

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**.
2. **Add domain** → e.g. `darshil-pandya.github.io` (no `https://`).

---

## Step 9 — Ship the website (GitHub Pages)

Your existing **Deploy to GitHub Pages** workflow should keep building with:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`

Redeploy Pages after backend changes if needed. The **Score sync** nav item appears when those three are set.

---

## Step 10 — First sync (Cricket Data match id)

1. Open the live site → **Score sync**.
2. **Sync passphrase** — same as `FANTASY_SYNC_PASSPHRASE`.
3. **Cricket Data match id** — from their API / docs (their id for that fixture).
4. **League match key** — your stable id (e.g. `IPL2026-M01`); reuse to overwrite that match.
5. **Label** + **date** — for display.

Then confirm in Firebase → **Firestore** → `iplFantasy` / `fantasyMatchScores` → field `matches`.

---

## Step 11 — Optional: function region

Default is **`us-central1`**. If you change region in `functions/src/index.ts`, add **`VITE_FIREBASE_FUNCTIONS_REGION`** to your **Pages** build secrets/env and rebuild the site.

---

## If something fails

| Symptom | What to check |
|--------|----------------|
| Workflow fails on **secrets:set** | Service account needs **Secret Manager Admin** (or equivalent). |
| Workflow fails on **deploy** | **Blaze** enabled; **Cloud Build** / **Artifact Registry** APIs enabled; IAM roles on the service account. |
| “Firebase is not configured” on Score sync | Pages build missing `VITE_FIREBASE_*`. |
| Callable blocked from the site | **Authorized domains** (Step 8). |
| Wrong API / passphrase | Update GitHub secrets → run **Deploy Firebase backend** again. |
| Empty or wrong points | Demo scorer uses **batting runs** + **name match** — see `functions/src/cricketdata.ts`. |

---

## Behaviour today (reminder)

- **Demo scoring:** batting **runs** only, matched to roster by **name**. Replace `functions/src/cricketdata.ts` with your full IPL 2026 rules when ready.
- **Same `matchKey`:** overwrites that match’s overlay.
- **Abandoned match:** in Firestore, set `matches.<key>.status` to `abandoned` if you maintain that entry manually.

## Files to know

| Area | Path |
|------|------|
| GitHub workflow | `.github/workflows/firebase-backend.yml` |
| Callable function | `functions/src/index.ts` |
| Demo parser | `functions/src/cricketdata.ts` |
| Firestore rules | `firestore.rules` |
| Firestore listener + merge | `src/lib/firebase/fantasyScoresRemote.ts`, `src/lib/fantasy/mergeOverlay.ts` |
| Admin UI | `src/pages/AdminFantasySync.tsx` |

### Alternative: secrets only in Google Cloud (no Cricket key in GitHub)

If you do **not** want the Cricket API key in GitHub at all, create **`CRICKETDATA_API_KEY`** and **`FANTASY_SYNC_PASSPHRASE`** manually in [Google Cloud → Secret Manager](https://console.cloud.google.com/security/secret-manager) (browser), grant the Cloud Functions runtime service account **Secret Accessor**, remove the “Push Cricket Data…” step from the workflow (or make it optional), and run a workflow that only does `firebase deploy`. That path is more manual but keeps the key out of GitHub entirely.
