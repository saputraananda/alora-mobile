import Modal from '../Modal.jsx';
import { HAID_DURATION_OPTIONS, HAID_DEFAULT_DURATION_DAYS } from '../../utils/bugarHaid.js';

export default function BugarHaidStartModal({
  isOpen,
  onClose,
  onConfirm,
  durationDays,
  onDurationChange,
  targetKm,
  loading,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aktifkan Mode Haid" hideActionButton>
      <div className="flex flex-col gap-3 pt-1">
        <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
          Target km mingguan akan turun menjadi <span className="font-bold text-rose-600">{targetKm} km</span> (50% dari normal).
          Olahraga ringan disarankan: jalan pelan atau sepeda santai 15–30 menit.
        </p>
        <div>
          <div className="text-[11px] font-bold text-slate-500 mb-2">Durasi periode haid</div>
          <div className="flex gap-2">
            {HAID_DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDurationChange(d)}
                className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border ${
                  durationDays === d
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {d} hari
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-[14px] bg-slate-100 text-slate-700 text-xs font-extrabold"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onConfirm(durationDays ?? HAID_DEFAULT_DURATION_DAYS)}
            disabled={loading}
            className="flex-1 py-3 rounded-[14px] bg-rose-600 text-white text-xs font-black disabled:opacity-60"
          >
            {loading ? 'Menyimpan…' : 'Aktifkan'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
