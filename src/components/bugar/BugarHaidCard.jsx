import { Heart } from 'lucide-react';
import { daysUntilHaidEnd, HAID_DEFAULT_DURATION_DAYS } from '../../utils/bugarHaid.js';

export default function BugarHaidCard({
  profile,
  onStartClick,
  onStopClick,
  stopping,
}) {
  if (!profile?.haid_eligible) return null;

  const active = profile.haid_active === true;
  const daysLeft = active ? daysUntilHaidEnd(profile) : 0;
  const tips = profile.haid_light_tips || [];

  return (
    <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-[18px] border border-rose-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 grid place-items-center">
          <Heart className="w-4 h-4" fill="currentColor" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-extrabold text-rose-900">Mode Haid</div>
          <div className="text-[10px] text-rose-600/80 font-medium">
            {active
              ? `Aktif · sisa ${daysLeft} hari`
              : 'Target & intensitas olahraga lebih ringan'}
          </div>
        </div>
        {active && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
            Aktif
          </span>
        )}
      </div>

      {active && tips.length > 0 && (
        <ul className="text-[10px] text-rose-800/90 space-y-1 list-disc pl-4">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}

      {active ? (
        <button
          type="button"
          onClick={onStopClick}
          disabled={stopping}
          className="w-full py-2.5 rounded-xl bg-white border border-rose-200 text-[12px] font-bold text-rose-700 disabled:opacity-60"
        >
          {stopping ? 'Mengakhiri…' : 'Akhiri lebih awal'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartClick}
          className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-[12px] font-bold"
        >
          Aktifkan Mode Haid ({HAID_DEFAULT_DURATION_DAYS} hari)
        </button>
      )}
    </div>
  );
}
