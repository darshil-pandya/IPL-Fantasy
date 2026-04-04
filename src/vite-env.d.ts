/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  /** `auto` (default) | `firestore` | `static` — see docs/firebase-waiver-setup.md */
  readonly VITE_LEAGUE_SOURCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
