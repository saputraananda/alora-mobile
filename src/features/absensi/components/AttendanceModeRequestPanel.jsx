import { useCallback, useEffect, useState } from 'react';

const STATUS_META = {
  Pending_Supervisor: { label: 'Menunggu', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  disetujui: { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Rejected_Supervisor: { label: 'Ditolak', cls: 'bg-red-50 text-red-600 border-red-200' },
};

const fmt2 = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`;
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status || 'Status', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default function AttendanceModeRequestPanel({ api, requestType }) {
  const typeLabel = requestType === 'wod' ? 'WOD' : 'WFA';
  const typeDesc = requestType === 'wod'
    ? 'Work on Day Off — setelah disetujui, absensi terkunci ke WOD.'
    : 'Work From Anywhere — setelah disetujui, absensi terkunci ke WFA.';

  const now = new Date();
  const filterMonth = now.getMonth() + 1;
  const filterYear = now.getFullYear();
  const [workDate, setWorkDate] = useState(todayStr());
  const [reason, setReason] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const mineRes = await api.get('/attendance-mode-requests/mine', {
        params: {
          request_type: requestType,
          month: filterMonth,
          year: filterYear,
        },
      });
      setItems(mineRes.data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat pengajuan');
    } finally {
      setLoading(false);
    }
  }, [api, requestType, filterMonth, filterYear]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/attendance-mode-requests', {
        request_type: requestType,
        work_date: workDate,
        reason: reason.trim(),
      });
      setReason('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim pengajuan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      await api.delete(`/attendance-mode-requests/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membatalkan');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-[14px] font-extrabold text-navy-950">Ajukan {typeLabel}</div>
        <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">{typeDesc}</p>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="text-[12px] font-bold text-slate-700">Tanggal</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px]"
              required
            />
          </div>
          <div>
            <label className="text-[12px] font-bold text-slate-700">Tugas yang dikerjakan</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] resize-none"
              placeholder={`Jelaskan tugas yang dikerjakan untuk ${typeLabel}...`}
              required
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || reason.trim().length < 5}
            className="w-full py-3 rounded-xl bg-navy-950 text-white text-[13px] font-bold disabled:opacity-50"
          >
            {submitting ? 'Mengirim…' : `Kirim Pengajuan ${typeLabel}`}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <div className="text-[13px] font-extrabold text-navy-950">Pengajuan saya</div>
        {loading ? (
          <p className="text-[12px] text-slate-400">Memuat…</p>
        ) : items.length === 0 ? (
          <p className="text-[12px] text-slate-500">Belum ada pengajuan {typeLabel} bulan ini.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12.5px] font-semibold text-slate-800">{item.work_date}</div>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-[12px] text-slate-600 mt-1 line-clamp-2">{item.reason}</p>
              {item.status === 'Pending_Supervisor' && (
                <button
                  type="button"
                  onClick={() => handleCancel(item.id)}
                  className="mt-2 text-[11px] font-semibold text-red-500"
                >
                  Batalkan
                </button>
              )}
              {item.supervisor_rejection_reason && (
                <p className="mt-1 text-[11px] text-red-600">{item.supervisor_rejection_reason}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
