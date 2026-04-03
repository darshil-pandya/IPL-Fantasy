# Firebase + waiver sync

League data (`players.json`, `franchises.json`, etc.) stays on **GitHub Pages** as static files. **Firebase Firestore** is used only to share **waiver state** (phases, nominations, bids, live rosters, budgets) across everyone’s browsers.

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

For a **small private league**, many groups use open read/write on **only** the waiver document path. This is **not** secure against anyone who inspects the client; upgrade to Firebase Auth later if needed.

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

## 3. Local development

1. Copy `.env.example` to **`.env.local`** in the repo root (this file is gitignored).
2. Fill in:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

3. Run `npm run dev`, open **Waivers**. You should see **Firestore: listening** under the page title when all three variables are set.

## 4. Live site (GitHub Actions)

Vite embeds `VITE_*` variables at **build** time. The GitHub Pages workflow passes optional secrets into `npm run build`.

1. On GitHub: repo **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add exactly these names (case-sensitive):

| Secret name | Value |
|-------------|--------|
| `VITE_FIREBASE_API_KEY` | from Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | project id string |

3. Push to `main` (or re-run **Deploy to GitHub Pages**). After deploy, open the live site → **Waivers** and confirm **Firestore: listening**.

If a secret is missing, the build still succeeds; the app falls back to **localStorage-only** waivers (no cross-device sync).

## 5. Data model in Firestore

| Collection | Document ID | Fields |
|------------|-------------|--------|
| `iplFantasy` | `waiverState` | `payload` (object: same JSON as localStorage waiver state), `updatedAt` (server timestamp) |

## 6. Troubleshooting

| Symptom | Check |
|---------|--------|
| **Firestore: listening** never appears | All three `VITE_*` vars set? Rebuild after changing `.env` or secrets. |
| Permission denied in browser console | Firestore **Rules** allow read/write for `iplFantasy/{docId}`. |
| Two browsers show different waivers | One build has Firebase env, the other doesn’t; or rules blocked writes on one side. |
| `Missing or insufficient permissions` | Rules too strict; or wrong project ID. |

## 7. What is not in Firebase

- Predictions, leaderboard math, match points, auction history JSON → still loaded from **`/IPL-Fantasy/IPL-Fantasy/data/*.json`** on GitHub Pages.
- Waiver **login** passwords → still the in-app honor-system list (`src/lib/waiver/auth.ts`), not Firebase Authentication.
