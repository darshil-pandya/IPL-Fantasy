# Firebase waiver sync (optional)

The app stores waiver rounds in **localStorage** by default. To let multiple people see the same nominations and bids in real time, enable **Firestore**.

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Add a **Web** app and copy the config (apiKey, authDomain, projectId).

## 2. Enable Firestore

1. In Firebase Console → **Build** → **Firestore Database** → Create database.
2. For a private friends league using honor-system logins, you may temporarily use **test mode** or a rule that allows all reads/writes. **Anyone with your API key can change data** — this is not secure. Tighten rules before exposing the app publicly.

Example **very permissive** rule (development only):

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

## 3. Env vars in this repo

Copy `.env.example` to `.env.local` and set:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`

Redeploy or restart `npm run dev`.

## 4. Document path

The app reads/writes a single document: **`iplFantasy/waiverState`** with field `payload` = the full waiver JSON state (same shape as in localStorage).

## 5. Auth

This build does **not** use Firebase Authentication. Access control is honor-system only. For a public site, add Firebase Auth and Firestore security rules that match signed-in users to franchise owners.
