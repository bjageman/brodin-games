import { useState, useEffect } from 'react';
import HomePage from './HomePage';
import HostPage from './HostPage';
import JoinPage from './JoinPage';

type Route = 'home' | 'host' | 'join';

function getRouteFromHash(): Route {
  const hash = window.location.hash;
  if (hash.startsWith('#/host')) return 'host';
  if (hash.startsWith('#/join')) return 'join';
  return 'home';
}

export default function Router() {
  const [route, setRoute] = useState<Route>(getRouteFromHash);

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  switch (route) {
    case 'host':
      return <HostPage />;
    case 'join':
      return <JoinPage />;
    default:
      return <HomePage />;
  }
}
