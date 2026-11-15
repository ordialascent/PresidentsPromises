import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MethodPage } from './pages/MethodPage.js';
import { PromisesPage } from './pages/PromisesPage.js';

type Route = 'board' | 'method';

const routeOf = (hash: string): Route => (hash === '#method' ? 'method' : 'board');

/**
 * Two pages on one hash: the promises board, and the methodology page at
 * `#method`. The board stays mounted while the method page is open, so a
 * reader who opens it from a promise comes back to the same filters, the same
 * open promise and the same scroll position.
 */
export function App() {
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.hash));
  const boardScroll = useRef(0);

  useEffect(() => {
    const onHash = () => {
      const next = routeOf(window.location.hash);
      setRoute((cur) => {
        if (cur === 'board' && next === 'method') boardScroll.current = window.scrollY;
        return next;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useLayoutEffect(() => {
    window.scrollTo({ top: route === 'board' ? boardScroll.current : 0 });
  }, [route]);

  return (
    <>
      <div hidden={route !== 'board'}>
        <PromisesPage />
      </div>
      {route === 'method' && <MethodPage />}
    </>
  );
}
