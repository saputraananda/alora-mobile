import { useState } from 'react';

export default function OutsideNoteModal({
  open,
  onClose,
  onSubmit,
  loading,
  error,
}) {
  if (!open) return null;
  return (
    <OutsideNoteForm
      onClose={onClose}
      onSubmit={onSubmit}
      loading={loading}
      error={error}
    />
  );
}

function OutsideNoteForm({ onClose, onSubmit, loading, error }) {
  const [note, setNote] = useState('');
  const trimmedLength = note.trim().length;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (trimmedLength < 5) return;
    onSubmit(note.trim());
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-extrabold text-slate-900">Catatan absen di luar HO/IKM</h3>
        <p className="mt-1 text-sm text-slate-500">
          Lokasi Anda di luar HO dan IKM. Tulis alasan sebelum absen keluar.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Contoh: kunjungan ke RS Eka Cibubur"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none"
          />
          {trimmedLength > 0 && trimmedLength < 5 && (
            <p className="text-[11px] text-amber-700">Minimal 5 karakter</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || trimmedLength < 5}
              className="flex-1 rounded-xl bg-navy-950 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Mengirim…' : 'Simpan & Absen Keluar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
