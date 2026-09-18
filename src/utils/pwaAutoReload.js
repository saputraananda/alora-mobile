import { io } from 'socket.io-client';

const STORAGE_KEY = 'alora_pwa_build_id';

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * Connects to Socket.IO and reloads the standalone PWA when buildId changes
 * after a deploy + Node restart.
 */
export function startPwaAutoReload() {
  if (import.meta.env.DEV) return;
  if (!isStandalonePwa()) return;

  const socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  socket.on('app:version', (payload) => {
    const buildId = payload?.buildId;
    if (!buildId) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, buildId);
      return;
    }

    if (stored !== buildId) {
      localStorage.setItem(STORAGE_KEY, buildId);
      window.location.reload();
    }
  });
}
