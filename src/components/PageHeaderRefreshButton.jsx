import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

const TONE_CLASS = {
  onDark:
    'w-9 h-9 rounded-[11px] bg-white/10 border border-white/12 text-white grid place-items-center flex-shrink-0 disabled:opacity-60',
  onLight:
    'w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0 disabled:opacity-60',
};

/**
 * Soft page refresh control for headers. Spins while onRefresh Promise settles.
 */
export default function PageHeaderRefreshButton({
  onRefresh,
  tone = 'onDark',
  className = '',
  ariaLabel = 'Muat ulang',
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || typeof onRefresh !== 'function') return;
    setBusy(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setBusy(false);
    }
  };

  const base = TONE_CLASS[tone] || TONE_CLASS.onDark;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`${base} ${className}`.trim()}
    >
      <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
    </button>
  );
}
