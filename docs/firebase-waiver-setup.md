# Firebase + Firestore (league + waivers)

**Full step-by-step from scratch (including score sync and GitHub Actions):** [full-setup-walkthrough.md](./full-setup-walkthrough.md).

The **React app** is built and hosted on **GitHub Pages**. **Firebase Firestore** holds the live **league bundle** (meta, franchises, players, optional `waiverPool`, auction, rules, predictions) and **waiver state** (phases, nominations, bids, rosters, budgets).

Static JSON under `public/IPL-Fantasy/data/` is still shipped with the site: it is the **source of truth for edits in git**, a **bootstrap path** when the Firestore league document is empty, and the payload used by **Publish league to Firestore** (Waivers → Commissioner). Waiver nominations use `players.json` plus `waiver-pool.json` (see `npm run build:waiver-pool`).

## 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) → **Add project** → finish the wizard (Google Analytics optional).
2. Click **Web** (`</>`) → register an app → copy the config values you need:
   - `apiKey`
   - `authDomain`
   - `projectId`

You do **not** need Firebase Hosting if you already use GitHub Pages.

## 2. Enable Firestore

1. **Build** → **Firestore Database** → **Create database**.
2. Choose a location close to your players (e.g. `asia-south1`).
3. Start in **production mode** if you will paste rules immediately, or **test mode** for a quick test (expires; insecure).

### Security rules (private league)

For a **small private league**, many groups use open read/write on **only** the `iplFantasy` documents. This is **not** secure against anyone who inspects the client; upgrade to Firebase Auth later if needed.

In Firestore → **Rules**, use something like:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /iplFantasy/{docId} {
      allow read, write: if true;
    }
  }
}
```

Click **Publish**.

For **score sync** (Cricket Data → Cloud Function → `fantasyMatchScores`), this repo ships **`firestore.rules`** in the root: waivers and league bundle stay client-writable; **`fantasyMatchScores` is read-only from the browser**. Deploy rules + functions from GitHub (**Actions → Deploy Firebase backend**) — no local CLI required. Details: [firebase-score-sync.md](./firebase-score-sync.md).

## 3. League source mode (`VITE_LEAGUE_SOURCE`)

When all three `VITE_FIREBASE_*` variables are set:

| Value | Behavior |
|-------|----------|
| **`auto`** (default) | Subscribe to `iplFantasy/leagueBundle`. If the document is missing or empty, load JSON from the same GitHub Pages site and show a notice on Home. |
| **`firestore`** | Firestore only; no static fallback. Use after you have published the league at least once. |
| **`static`** | Always load league JSON from `public/.../data/*.json` (Firestore ignored for league data; waivers can still sync if Firebase env is set). |

Set in `.env.local` locally or add a repository variable / secret for the build if you need a non-default value.

## 4. First-time: seed league in Firestore

1. Deploy the site with Firebase env vars so the app can talk to Firestore.
2. Sign in on **Waivers** as **Commissioner** (admin).
3. Click **Publish league to Firestore**. That reads the merged JSON from your deployed static paths and writes document `iplFantasy/leagueBundle` with field `payload` (full `LeagueBundle`).

After that, all clients with `auto` or `firestore` load the league from Firestore and receive live updates when you publish again.

## 5. Local development

1. Copy `.env.example` to **`.env.local`** in the repo root (this file is gitignored).
2. Fill in:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

3. Run `npm run dev`, open **Waivers**. You should see **Firestore: listening** under the page title when all three variables are set.

## 6. Live site (GitHub Actions)

Vite embeds `VITE_*` variables at **build** time. The GitHub Pages workflow passes optional secrets into `npm run build`.

1. On GitHub: repo **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add exactly these names (case-sensitive):

| Secret name | Value |
|-------------|--------|
| `VITE_FIREBASE_API_KEY` | from Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | project id string |

3. Push to `main` (or re-run **Deploy to GitHub Pages**). After deploy, open the live site → **Waivers** and confirm **Firestore: listening**.

If a secret is missing, the build still succeeds; the app uses **static JSON only** for the league and **localStorage-only** waivers (no cross-device sync).

## 7. Data model in Firestore

| Collection | Document ID | Fields |
|------------|-------------|--------|
| `iplFantasy` | `leagueBundle` | `payload` (object: full league bundle), `updatedAt` (server timestamp) |
| `iplFantasy` | `waiverState` | `payload` (object: same shape as localStorage waiver state), `updatedAt` (server timestamp) |

## 8. Troubleshooting

| Symptom | Check |
|---------|--------|
| **Firestore: listening** never appears | All three `VITE_*` vars set? Rebuild after changing `.env` or secrets. |
| Permission denied in browser console | Firestore **Rules** allow read/write for `iplFantasy/{docId}`. |
| League empty with `firestore` mode | Run **Publish league to Firestore** once, or create `leagueBundle` manually. |
| Home shows “Firestore league document is empty” | Expected in `auto` until you publish; static JSON is used meanwhile. |
| Two browsers show different waivers | One build has Firebase env, the other doesn’t; or rules blocked writes on one side. |
| `Missing or insufficient permissions` | Rules too strict; or wrong project ID. |

## 9. What stays in the repo (GitHub)

- League JSON files under **`public/IPL-Fantasy/data/`** — edit, commit, push; then **Publish league to Firestore** so the live app picks up changes without redeploying (or redeploy and publish again).
- Waiver **login** passwords → still the in-app honor-system list (`src/lib/waiver/auth.ts`), not Firebase Authentication.
