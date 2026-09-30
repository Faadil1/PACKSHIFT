import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Self-hosted variable fonts: Archivo with the full width axis (62–125)
// drives the load-sensitive headline; no third-party font request.
import '@fontsource-variable/archivo/standard.css';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/newsreader';
import '@fontsource/caveat/700.css';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
