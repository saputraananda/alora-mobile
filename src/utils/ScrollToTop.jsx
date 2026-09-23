import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function resetScrollPosition() {
  const container = document.getElementById('mobile-scroll-container');
  if (container) {
    container.scrollTop = 0;
    if (typeof container.scrollTo === 'function') {
      container.scrollTo(0, 0);
    }
  }
  if (typeof window !== 'undefined') {
    window.scrollTo(0, 0);
  }
  if (document.documentElement) {
    document.documentElement.scrollTop = 0;
  }
  if (document.body) {
    document.body.scrollTop = 0;
  }
}

/**
 * Resets window + mobile container scroll on every route change.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    resetScrollPosition();
  }, [pathname]);

  return null;
}
