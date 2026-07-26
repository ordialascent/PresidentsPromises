import { useEffect, useState } from 'react';
import { PromisesPage } from './pages/PromisesPage.js';
import { DeficitPage } from './pages/DeficitPage.js';

/**
 * Minimal hash routing — no dependency, static-host friendly. The promises
 * overview is the front page; the deficit deep-dive is kept reachable at
 * #deficit (hidden for now) as the template for future per-promise pages.
 */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, ''));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const route = useHashRoute();
  return route === 'deficit' ? <DeficitPage /> : <PromisesPage />;
}
