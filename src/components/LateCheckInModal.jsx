import { useState } from 'react';

export default function LateCheckInModal({ open, onClose, onSubmit, loading, error }) {
  const [category, setCategory] = useState('unexpected');
  const [reason, setReason] = useState('');

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ late_category: category, late_reason: reason.trim() });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-extrabold text-slate-900">Anda terlambat</h3>
        <p className="mt-1 text-sm text-slate-500">
          Pilih kategori dan isi alasan sebelum absen masuk.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCategory('unexpected')}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                category === 'unexpected'
                  ? 'border-amber-400 bg-amber-50 text-amber-800'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Tidak Terduga
            </button>
            <button
              type="button"
              onClick={() => setCategory('planned')}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                category === 'planned'
                  ? 'border-blue-400 bg-blue-50 text-blue-800'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Rencana
            </button>
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
              disabled={loading || !reason.trim()}
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
