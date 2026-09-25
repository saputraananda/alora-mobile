import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { getAuthToken } from '../../../utils/authSession.js';
import PageHeaderRefreshButton from '../../../components/PageHeaderRefreshButton.jsx';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'wfa', label: 'WFA' },
  { id: 'wod', label: 'WOD' },
  { id: 'lembur', label: 'Lembur' },
  { id: 'leave', label: 'Perizinan' },
];

const KIND_META = {
  wfa: { label: 'WFA', color: '#0369A1', bg: '#F0F9FF' },
  wod: { label: 'WOD', color: '#C2410C', bg: '#FFF7ED' },
  lembur: { label: 'Lembur', color: '#7C3AED', bg: '#F5F3FF' },
  leave: { label: 'Perizinan', color: '#D97706', bg: '#FFFBEB' },
};

const MONTH_LABEL_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const formatDateID = (str) => {
  if (!str) return '-';
  const d = new Date(`${String(str).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

function formatCutoffPeriodLabel(month, year) {
  const m = Number(month);
  const y = Number(year);
  if (!(m >= 1 && m <= 12) || !Number.isFinite(y)) return '';
  return `${MONTH_LABEL_ID[m - 1]} ${y}`;
}

function actionUrl(item, action) {
  const id = item.id;
  if (item.kind === 'wfa' || item.kind === 'wod') {
    return `/attendance-mode-requests/${id}/${action === 'approve' ? 'approve' : 'reject'}`;
  }
  const role = item.action_role === 'hrd' ? 'hrd' : 'supervisor';
  const verb = action === 'approve' ? 'approve' : 'reject';
  if (item.kind === 'leave') return `/leave/${id}/${role}-${verb}`;
  if (item.kind === 'lembur') return `/lembur-ro/${id}/${role}-${verb}`;
  return null;
}

export default function Approvals() {
  useDocumentTitle('Approval');
  const navigate = useNavigate();

  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const capRes = await api.get('/approvals/capability');
      if (!capRes.data?.can_access) {
        navigate('/', { replace: true });
        return;
      }
      const inboxRes = await api.get('/approvals/inbox', {
        params: { type: filter },
      });
      setItems(inboxRes.data.items || []);
    } catch (err) {
      if (err.response?.status === 403) {
        navigate('/', { replace: true });
        return;
      }
      setError(err.response?.data?.message || 'Gagal memuat antrian approval');
    } finally {
      setLoading(false);
    }
  }, [filter, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (item) => {
    const url = actionUrl(item, 'approve');
    if (!url) return;
    setActingId(item.id);
    setError('');
    try {
      await api.post(url);
      setRejectId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyetujui');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (item) => {
    const url = actionUrl(item, 'reject');
    if (!url) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setError('Alasan penolakan wajib diisi');
      return;
    }
    setActingId(item.id);
    setError('');
    try {
      await api.post(url, { reason });
      setRejectId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menolak');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-extrabold text-navy-950">Approval</div>
            <div className="text-[11px] text-slate-500">Antrian persetujuan SPV & HRD</div>
          </div>
          <PageHeaderRefreshButton tone="onLight" onRefresh={load} />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold border ${
                  active
                    ? 'bg-navy-950 text-white border-navy-950'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-[12px] text-slate-400 text-center py-10">Memuat antrian…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-slate-700">Tidak ada antrian</p>
            <p className="text-[12px] text-slate-500 mt-1">Semua pengajuan sudah diproses.</p>
          </div>
        ) : (
          items.map((item) => {
            const meta = KIND_META[item.kind] || KIND_META.leave;
            const key = `${item.kind}-${item.id}`;
            const busy = actingId === item.id;
            const periodLabel =
              item.kind === 'lembur'
                ? formatCutoffPeriodLabel(item.period_month, item.period_year)
                : '';
            return (
              <div
                key={key}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,.06)]"
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b border-slate-100"
                  style={{ background: meta.bg }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: meta.color }}>
                      {item.title || meta.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatDateID(item.work_date)}
                      {item.action_role === 'hrd' ? ' · HRD' : ' · SPV'}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600"
                  >
                    {meta.label}
                  </span>
                </div>

                <div className="px-4 py-3 space-y-2">
                  <div className="text-[13px] font-bold text-slate-800">
                    {item.employee_name || `ID ${item.employee_id}`}
                  </div>
                  {item.subtitle ? (
                    <p className="text-[12px] text-slate-600 leading-relaxed">{item.subtitle}</p>
                  ) : null}

                  {item.kind === 'lembur' ? (
                    <div>
                      <div className="text-[11px] font-bold text-slate-500">
                        Akumulasi periode{periodLabel ? ` ${periodLabel}` : ''}
                      </div>
                      <p className="text-[12px] text-slate-600 leading-relaxed">
                        {Number(item.approved_period_hours) || 0} jam
                      </p>
                    </div>
                  ) : null}

                  {item.kind === 'lembur' && String(item.description || '').trim() ? (
                    <div>
                      <div className="text-[11px] font-bold text-slate-500">Keterangan</div>
                      <p className="text-[12px] text-slate-600 leading-relaxed">{String(item.description).trim()}</p>
                    </div>
                  ) : null}

                  {item.kind === 'lembur' && Array.isArray(item.todo_items) && item.todo_items.length > 0 ? (
                    <div>
                      <div className="text-[11px] font-bold text-slate-500">To-do Pekerjaan</div>
                      <ul className="mt-0.5 space-y-0.5">
                        {item.todo_items.map((todo, idx) => (
                          <li key={`${idx}-${todo}`} className="text-[12px] text-slate-600">
                            · {todo}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {rejectId === key ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] resize-none"
                        placeholder="Alasan penolakan..."
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReject(item)}
                          disabled={busy || rejectReason.trim().length < 3}
                          className="flex-1 py-2 rounded-xl bg-red-600 text-white text-[12px] font-bold disabled:opacity-50"
                        >
                          {busy ? '…' : 'Tolak'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectId(null);
                            setRejectReason('');
                          }}
                          className="flex-1 py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApprove(item)}
                        disabled={busy}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold disabled:opacity-50"
                      >
                        {busy ? '…' : 'Setujui'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectId(key);
                          setRejectReason('');
                        }}
                        disabled={busy}
                        className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-[12px] font-bold bg-red-50 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
