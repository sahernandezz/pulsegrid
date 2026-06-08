// Firebase initialization + Google Analytics (GA4 via Firebase Analytics).
//
// Config is read from Vite env vars (VITE_FIREBASE_*) so the keys never live in
// source control — see .env.example for the shape and .env (git-ignored) for the
// real values. NOTE: the Firebase web config is not a secret; it is embedded in
// the shipped client bundle by design. Real protection comes from Firebase
// Security Rules / App Check, not from hiding these values.
//
// Analytics only loads in production, in a browser that supports it, and only when
// a measurementId is configured — so local dev never pollutes the GA property.

import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app = null;
let analytics = null;

export function initFirebase() {
  // No config (e.g. a contributor cloned without .env) → quietly do nothing.
  if (!firebaseConfig.apiKey || !firebaseConfig.appId) return;
  if (app) return app;

  app = initializeApp(firebaseConfig);

  // Analytics: production + supported environment + measurementId only.
  if (import.meta.env.PROD && firebaseConfig.measurementId) {
    isSupported()
      .then((ok) => {
        if (ok) analytics = getAnalytics(app);
      })
      .catch(() => {
        /* analytics unsupported (SSR, no cookies, blocked) — ignore */
      });
  }

  return app;
}

export { app, analytics };
