/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  /** `auto` (default) | `firestore` | `static` — see docs/firebase-waiver-setup.md */
  readonly VITE_LEAGUE_SOURCE?: string;
  /** Region where `syncMatchFantasyScores` is deployed (default us-central1). */
  readonly VITE_FIREBASE_FUNCTIONS_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
