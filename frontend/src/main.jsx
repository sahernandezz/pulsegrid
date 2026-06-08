import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { I18nProvider } from './lib/i18n.jsx';
import { initFirebase } from './lib/firebase.js';
import './index.css';

// Initialize Firebase + Analytics (no-op without config; analytics is prod-only).
initFirebase();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
