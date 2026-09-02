import { useState } from 'react';
import { formatLocationDetectedLabel } from '../utils/attendanceModeClient.js';

const MODE_OPTIONS = {
  regular: { key: 'regular', label: 'Harian', desc: 'Absensi kerja normal di hari kerja' },
  wfa: { key: 'wfa', label: 'WFA', desc: 'Work From Anywhere — perlu approval supervisor' },
  wod: { key: 'wod', label: 'Work on Day Off (WOD)', desc: 'Kerja di hari libur — masuk saldo Replace Off setelah disetujui' },
};

export default function AttendanceIntentModal({
  open,
  punchContext,
  onClose,
  onConfirm,
  submitting,
  error,
}) {
  if (!open || !punchContext) return null;

  const allowed = punchContext.allowed_modes || ['regular', 'wfa'];
  const options = allowed.map((k) => MODE_OPTIONS[k]).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <AttendanceIntentForm
        key={`${punchContext.date}-${punchContext.suggested_mode}-${punchContext.is_late ? 'late' : 'on-time'}`}
        punchContext={punchContext}
        options={options}
        onClose={onClose}
        onConfirm={onConfirm}
        submitting={submitting}
        error={error}
      />
    </div>
  );
}

function AttendanceIntentForm({
  punchContext,
  options,
  onClose,
  onConfirm,
  submitting,
  error,
}) {
  const [mode, setMode] = useState(punchContext.suggested_mode || options[0]?.key || 'regular');
  const [reason, setReason] = useState('');
  const [lateCategory, setLateCategory] = useState('unexpected');
  const [lateReason, setLateReason] = useState('');

  const needsReason = mode === 'wfa' || mode === 'wod';
  const needsLate = Boolean(punchContext.is_late) && mode === 'regular';
  const locLabel = punchContext.punch_location_context
    ? formatLocationDetectedLabel(punchContext.punch_location_context)
    : '—';

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      attendance_mode: mode,
      mode_reason: needsReason ? reason.trim() : '',
      ...(needsLate ? { late_category: lateCategory, late_reason: lateReason.trim() } : {}),
    });
  };

  const submitDisabled = submitting
    || (needsReason && reason.trim().length < 5)
    || (needsLate && !lateReason.trim());

  return (
    <div className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[85dvh] flex flex-col">
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-slate-200" />
      </div>
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="text-[15px] font-bold text-slate-800">Konfirmasi Jenis Absensi</div>
        <button type="button" onClick={onClose} disabled={submitting} className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
        {punchContext.is_off_day && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900 leading-relaxed">
            <div className="font-bold mb-1">Hari ini libur</div>
            {punchContext.off_day_message}
            {punchContext.holiday_name && (
              <div className="mt-1 text-amber-700">{punchContext.holiday_name}</div>
            )}
          </div>
        )}

        {!punchContext.is_off_day && punchContext.punch_location_context === 'remote' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-[12px] text-blue-900">
            Anda terdeteksi <b>di luar kantor</b>. Disarankan WFA. Tetap bisa pilih Hadir jika GPS meleset.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12px] text-slate-600">
          Lokasi terdeteksi: <span className="font-semibold text-slate-800">{locLabel}</span>
        </div>

        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className={`w-full rounded-xl border-2 px-3 py-2.5 text-left ${
                mode === opt.key ? 'border-navy-950 bg-navy-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className={`text-[12.5px] font-semibold ${mode === opt.key ? 'text-navy-950' : 'text-slate-700'}`}>
                {opt.label}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>

        {needsLate && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 space-y-3">
            <div>
              <div className="text-[12.5px] font-bold text-amber-900">Anda terlambat</div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Pilih kategori dan isi alasan sebelum absen masuk.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLateCategory('unexpected')}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                  lateCategory === 'unexpected'
                    ? 'border-amber-400 bg-white text-amber-800'
                    : 'border-amber-200/80 bg-amber-50/50 text-amber-700'
                }`}
              >
                Tidak Terduga
              </button>
              <button
                type="button"
                onClick={() => setLateCategory('planned')}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                  lateCategory === 'planned'
                    ? 'border-blue-400 bg-white text-blue-800'
                    : 'border-amber-200/80 bg-amber-50/50 text-amber-700'
                }`}
              >
                Rencana
              </button>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-amber-900 mb-1.5">
                Alasan keterlambatan
              </label>
              <textarea
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                rows={2}
                placeholder="Contoh: macet di tol, ada keperluan keluarga"
                className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-[13px] bg-white resize-none"
              />
            </div>
          </div>
        )}

        {needsReason && (
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              Alasan {mode === 'wod' ? 'WOD' : 'WFA'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Tuliskan alasan secara singkat..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-slate-50 resize-none"
            />
          </div>
        )}

        {mode === 'wod' && (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Setelah clock out &amp; disetujui supervisor, durasi masuk saldo Replace Off.
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[12.5px] text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full py-3 rounded-[16px] bg-navy-950 text-white text-[13.5px] font-bold disabled:opacity-60"
        >
          {submitting ? 'Mengirim…' : 'Konfirmasi & Absen Masuk'}
        </button>
      </form>
    </div>
  );
}
