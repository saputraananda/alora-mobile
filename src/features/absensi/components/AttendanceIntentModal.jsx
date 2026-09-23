import { useState } from 'react';
import {
  formatLocationDetectedLabel,
} from '../utils/attendanceModeClient.js';

/**
 * Intent modal after check-in photo:
 * - Locked WFA/WOD from approved request → confirm only
 * - Regular → late category (planned/unexpected) + reason if needed
 * - Off day without approved WOD → blocked
 */
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
        key={`${punchContext.date}-${punchContext.approved_mode_request?.id || 'none'}-${punchContext.is_late ? 'late' : 'on-time'}`}
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
  const approved = punchContext.approved_mode_request || null;
  const lockedMode = approved?.request_type || null;
  const isOffDay = Boolean(punchContext.is_off_day);
  const blockedOffDay = isOffDay && !lockedMode;

  const [lateCategory, setLateCategory] = useState('');
  const [lateReason, setLateReason] = useState('');

  const needsLate = !lockedMode && !blockedOffDay && Boolean(punchContext.is_late);
  const locLabel = punchContext.punch_location_context
    ? formatLocationDetectedLabel(punchContext.punch_location_context)
    : '—';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (blockedOffDay) return;
    if (lockedMode) {
      onConfirm({
        attendance_mode: lockedMode,
        mode_reason: approved?.reason || '',
      });
      return;
    }
    onConfirm({
      attendance_mode: 'regular',
      mode_reason: '',
      ...(needsLate
        ? {
          late_category: lateCategory,
          late_reason: lateReason.trim(),
        }
        : {}),
    });
  };

  const submitDisabled = submitting
    || blockedOffDay
    || (needsLate && (
      (lateCategory !== 'planned' && lateCategory !== 'unexpected')
      || lateReason.trim().length < 5
    ));

  const modeTitle = lockedMode === 'wod'
    ? 'WOD'
    : lockedMode === 'wfa'
      ? 'WFA'
      : 'Harian';

  return (
    <div className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[85dvh] flex flex-col">
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-slate-200" />
      </div>
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="text-[15px] font-bold text-slate-800">Konfirmasi Absensi</div>
        <button type="button" onClick={onClose} disabled={submitting} className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
        {blockedOffDay && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900 leading-relaxed">
            <div className="font-bold mb-1">Hari ini libur</div>
            {punchContext.off_day_message
              || 'Ajukan WOD di tab WOD dan tunggu persetujuan sebelum absen.'}
          </div>
        )}

        {lockedMode && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-3 text-[12px] text-violet-900">
            <div className="font-bold">Mode terkunci: {modeTitle}</div>
            <p className="mt-1 text-violet-800/90">
              Sesuai pengajuan yang sudah disetujui. Absensi hari ini memakai mode ini.
            </p>
            {approved?.reason && (
              <p className="mt-2 text-[11px] text-violet-700">Tugas: {approved.reason}</p>
            )}
          </div>
        )}

        {!lockedMode && !blockedOffDay && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[12px] text-slate-700">
            <div className="font-bold text-slate-800">Absensi Harian</div>
            <p className="mt-1 text-slate-500">
              Untuk WFA atau WOD, ajukan dulu di tab terkait dan tunggu disetujui.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12px] text-slate-600">
          Lokasi terdeteksi: <span className="font-semibold text-slate-800">{locLabel}</span>
        </div>

        {needsLate && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 space-y-3">
            <div>
              <div className="text-[12.5px] font-bold text-amber-900">Anda terlambat</div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Pilih kategori dan isi alasan sebelum absen masuk.
              </p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-amber-900 mb-1.5">
                Kategori keterlambatan
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLateCategory('planned')}
                  className={`rounded-xl border px-3 py-2.5 text-left text-[12px] font-bold transition ${
                    lateCategory === 'planned'
                      ? 'border-amber-800 bg-amber-800 text-white'
                      : 'border-amber-200 bg-white text-amber-900'
                  }`}
                >
                  Terlambat Terencana
                </button>
                <button
                  type="button"
                  onClick={() => setLateCategory('unexpected')}
                  className={`rounded-xl border px-3 py-2.5 text-left text-[12px] font-bold transition ${
                    lateCategory === 'unexpected'
                      ? 'border-amber-800 bg-amber-800 text-white'
                      : 'border-amber-200 bg-white text-amber-900'
                  }`}
                >
                  Tidak Terencana
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-amber-900 mb-1.5">
                Alasan keterlambatan
              </label>
              <textarea
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                rows={3}
                placeholder="Contoh: macet di tol, ada keperluan keluarga"
                className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-[13px] bg-white resize-none"
              />
              {lateReason.trim().length > 0 && lateReason.trim().length < 5 && (
                <p className="mt-1 text-[11px] text-amber-700">Minimal 5 karakter</p>
              )}
            </div>
          </div>
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
            : blockedOffDay
              ? 'Tidak bisa absen'
              : `Konfirmasi & Absen Masuk (${modeTitle})`}
        </button>
      </form>
    </div>
  );
}
