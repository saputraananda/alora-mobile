import { useState } from 'react';
import {
  formatLocationDetectedLabel,
  OFF_DAY_BLOCK_MESSAGE,
} from '../utils/attendanceModeClient.js';

const WORK_DAY_OPTIONS = [
  { key: 'regular', label: 'Harian', desc: 'Absensi kerja normal di hari kerja' },
  { key: 'wfa', label: 'WFA', desc: 'Work From Anywhere — perlu approval supervisor' },
];

export default function AttendanceIntentModal({
  open,
  punchContext,
  onClose,
  onConfirm,
  submitting,
  error,
}) {
  if (!open || !punchContext) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <AttendanceIntentForm
        key={`${punchContext.date}-${punchContext.suggested_mode}-${punchContext.is_late ? 'late' : 'on-time'}-${punchContext.is_off_day ? 'off' : 'work'}`}
        punchContext={punchContext}
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
  onClose,
  onConfirm,
  submitting,
  error,
}) {
  const isOffDay = Boolean(punchContext.is_off_day);
  const suggestedWorkMode = punchContext.suggested_mode === 'wfa' ? 'wfa' : 'regular';

  const [isWod, setIsWod] = useState(isOffDay ? true : false);
  const [mode, setMode] = useState(suggestedWorkMode);
  const [reason, setReason] = useState('');
  const [lateCategory, setLateCategory] = useState('unexpected');
  const [lateReason, setLateReason] = useState('');

  const effectiveMode = isWod ? 'wod' : mode;
  const needsReason = effectiveMode === 'wfa' || effectiveMode === 'wod';
  const needsLate = !isWod && Boolean(punchContext.is_late) && mode === 'regular';
  const blockNonWodOnOffDay = !isWod && isOffDay;
  const locLabel = punchContext.punch_location_context
    ? formatLocationDetectedLabel(punchContext.punch_location_context)
    : '—';

  const handleSelectWod = (value) => {
    setIsWod(value);
    if (value) {
      setMode('wod');
    } else if (mode === 'wod') {
      setMode(suggestedWorkMode);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (blockNonWodOnOffDay) return;
    onConfirm({
      attendance_mode: effectiveMode,
      mode_reason: needsReason ? reason.trim() : '',
      ...(needsLate ? { late_category: lateCategory, late_reason: lateReason.trim() } : {}),
    });
  };

  const submitDisabled = submitting
    || blockNonWodOnOffDay
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
        {isOffDay && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900 leading-relaxed">
            <div className="font-bold mb-1">Hari ini libur</div>
            {punchContext.off_day_message || OFF_DAY_BLOCK_MESSAGE}
            {punchContext.holiday_name && (
              <div className="mt-1 text-amber-700">{punchContext.holiday_name}</div>
            )}
          </div>
        )}

        {!isOffDay && !isWod && punchContext.punch_location_context === 'remote' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-[12px] text-blue-900">
            Anda terdeteksi <b>di luar kantor</b>. Disarankan WFA. Tetap bisa pilih Harian jika GPS meleset.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12px] text-slate-600">
          Lokasi terdeteksi: <span className="font-semibold text-slate-800">{locLabel}</span>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-slate-600 mb-2">Apakah ini WOD?</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSelectWod(true)}
              className={`rounded-xl border-2 px-3 py-2.5 text-left ${
                isWod ? 'border-navy-950 bg-navy-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className={`text-[12.5px] font-semibold ${isWod ? 'text-navy-950' : 'text-slate-700'}`}>
                Ini WOD
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Work on Day Off — saldo RO setelah SPV</div>
            </button>
            <button
              type="button"
              onClick={() => handleSelectWod(false)}
              className={`rounded-xl border-2 px-3 py-2.5 text-left ${
                !isWod ? 'border-navy-950 bg-navy-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className={`text-[12.5px] font-semibold ${!isWod ? 'text-navy-950' : 'text-slate-700'}`}>
                Bukan WOD
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Harian atau WFA</div>
            </button>
          </div>
        </div>

        {blockNonWodOnOffDay && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900 leading-relaxed">
            <div className="font-bold mb-1">Konfirmasi: hari ini libur</div>
            {OFF_DAY_BLOCK_MESSAGE}
          </div>
        )}

        {!isWod && !isOffDay && (
          <div className="space-y-2">
            {WORK_DAY_OPTIONS.map((opt) => (
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
        )}

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

        {needsReason && !blockNonWodOnOffDay && (
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              Alasan {effectiveMode === 'wod' ? 'WOD' : 'WFA'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Tuliskan alasan secara singkat..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-slate-50 resize-none"
            />
            {reason.trim().length > 0 && reason.trim().length < 5 && (
              <p className="mt-1 text-[11px] text-amber-700">Minimal 5 karakter</p>
            )}
          </div>
        )}

        {isWod && (
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
          {submitting
            ? 'Mengirim…'
            : isWod
              ? 'Konfirmasi & Absen Masuk (WOD)'
              : 'Konfirmasi & Absen Masuk'}
        </button>
      </form>
    </div>
  );
}
