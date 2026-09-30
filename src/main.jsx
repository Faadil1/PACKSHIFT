import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted variable fonts: Archivo with the full width axis (62–125)
// drives the load-sensitive headline; no third-party font request.
import '@fontsource-variable/archivo/standard.css';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/newsreader';
import '@fontsource/caveat/700.css';
import './styles.css';
import './game/game.css';
import Game from './game/Game.jsx';

// The public puzzle ("Est-ce que ça rentre ?") is the front door. The full
// studio (V6 Rapport négocié) stays one click away as "mode pro", and every
// old studio link (#m=…) still opens it directly.
const Studio = lazy(() => import('./App.jsx'));

const wantsPro = () => {
  const { hash, search } = window.location;
  return hash === '#pro' || /(^#|&)m=/.test(hash) || new URLSearchParams(search).has('pro');
};

function Root() {
  const [pro, setPro] = useState(wantsPro);
  useEffect(() => {
    const onHash = () => setPro(wantsPro());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    document.title = pro ? 'PACKSHIFT — mode pro' : 'Est-ce que ça rentre ? — PACKSHIFT';
  }, [pro]);
  if (pro) {
    return (
      <Suspense fallback={<div className="game" />}>
        <Studio onExit={() => { window.location.hash = ''; setPro(false); }} />
      </Suspense>
    );
  }
  return <Game onPro={() => { window.location.hash = 'pro'; setPro(true); }} />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
