import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export default function SessionTodoModal({
  open,
  title,
  onClose,
  onSubmit,
  loading,
  error,
  showReason = false,
  reason = '',
  onReasonChange,
}) {
  const [items, setItems] = useState(['']);

  if (!open) return null;

  const updateItem = (index, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const addItem = () => {
    if (items.length >= 20) return;
    setItems((prev) => [...prev, '']);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = items.map((s) => s.trim()).filter(Boolean);
    onSubmit({ todo_items: cleaned, reason: reason?.trim() });
  };

  const validItems = items.map((s) => s.trim()).filter(Boolean).length >= 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">Isi pekerjaan yang diselesaikan (min. 1 poin).</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {showReason && (
            <div>
              <label className="text-xs font-bold text-slate-600">Alasan</label>
              <textarea
                value={reason}
                onChange={(e) => onReasonChange?.(e.target.value)}
                rows={2}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          )}
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder={`Poin ${index + 1}`}
              />
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(index)} className="text-slate-400">
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 text-xs font-bold text-violet-600"
          >
            <Plus size={14} /> Tambah poin
          </button>
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
              disabled={loading || !validItems}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Mengirim…' : 'Selesai & Clock Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
