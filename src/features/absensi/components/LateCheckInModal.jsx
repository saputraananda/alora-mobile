import { useState } from 'react';

export default function LateCheckInModal({ open, onClose, onSubmit, loading, error }) {
  const [lateCategory, setLateCategory] = useState('');
  const [reason, setReason] = useState('');

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      late_category: lateCategory,
      late_reason: reason.trim(),
    });
  };

  const submitDisabled = loading
    || (lateCategory !== 'planned' && lateCategory !== 'unexpected')
    || reason.trim().length < 5;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-extrabold text-slate-900">Anda terlambat</h3>
        <p className="mt-1 text-sm text-slate-500">
          Pilih kategori dan isi alasan sebelum absen masuk.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600">Kategori keterlambatan</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLateCategory('planned')}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${
                  lateCategory === 'planned'
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Terlambat Terencana
              </button>
              <button
                type="button"
                onClick={() => setLateCategory('unexpected')}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${
                  lateCategory === 'unexpected'
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Tidak Terencana
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Alasan keterlambatan</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Contoh: macet di tol, ada keperluan keluarga"
            />
            {reason.trim().length > 0 && reason.trim().length < 5 && (
              <p className="mt-1 text-xs text-amber-700">Minimal 5 karakter</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="flex-1 rounded-xl bg-[#1e3a5f] py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Mengirim…' : 'Lanjut Absen Masuk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
