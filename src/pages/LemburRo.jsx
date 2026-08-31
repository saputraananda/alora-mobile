import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Clock, Plus } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import {
  computeDurationHours,
  jakartaWeekday,
} from '../utils/lemburRoClient.js';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('alora_auth_token') || localStorage.getItem('alora_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const REQUEST_TYPES = [
  { key: 'lembur', label: 'Lembur', desc: 'Kerja di luar jam reguler', color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'replace_off', label: 'Replace Off (RO)', desc: 'Kerja di hari libur', color: '#2563EB', bg: '#EFF6FF' },
];

const COMPENSATION_TYPES = [
  { key: 'ganti_hari', label: 'Ganti hari libur', desc: 'Ambil cuti di hari lain' },
  { key: 'kompensasi_tunai', label: 'Kompensasi tunai', desc: 'Tidak ada hari pengganti' },
];

const STATUS_META = {
  Pending_Supervisor: { label: 'Menunggu Approval', color: '#F59E0B', bg: '#FFFBEB' },
  Pending_HRD: { label: 'Menunggu Approval', color: '#F59E0B', bg: '#FFFBEB' },
  Rejected_Supervisor: { label: 'Ditolak', color: '#EF4444', bg: '#FEF2F2' },
  Rejected_HRD: { label: 'Ditolak', color: '#EF4444', bg: '#FEF2F2' },
  disetujui: { label: 'Disetujui', color: '#059669', bg: '#ECFDF5' },
};

const EDITABLE_STATUSES = new Set(['Pending_Supervisor', 'Rejected_Supervisor', 'Rejected_HRD']);
const TYPE_FILTER_OPTIONS = [
  { key: '', label: 'Semua' },
  { key: 'lembur', label: 'Lembur' },
  { key: 'replace_off', label: 'RO' },
];

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const fmt2 = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`;
};

const formatDateID = (str) => {
  if (!str) return '-';
  const d = new Date(`${String(str).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatDateTimeID = (str) => {
  if (!str) return '-';
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const COMP_LABEL = {
  ganti_hari: 'Ganti hari libur',
  kompensasi_tunai: 'Kompensasi tunai',
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status || 'Status', color: '#64748B', bg: '#F8FAFC' };
  return (
    <span
      style={{ background: m.bg, color: m.color }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
    >
      {m.label}
    </span>
  );
}

function LemburRoCard({ item, onCancel, onEdit }) {
  const rt = REQUEST_TYPES.find((t) => t.key === item.request_type) || REQUEST_TYPES[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,.06)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100" style={{ background: rt.bg }}>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: rt.color }}>{rt.label}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {item.start_time} – {item.end_time} · {item.duration_hours} jam
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="px-4 py-3 space-y-1.5">
        <div className="text-[12.5px] text-slate-600">{formatDateID(item.work_date)}</div>
        {item.request_type === 'replace_off' && item.compensation_type && (
          <div className="text-[11.5px] text-slate-500">
            {COMP_LABEL[item.compensation_type] || item.compensation_type}
            {item.replacement_date ? ` · ${formatDateID(item.replacement_date)}` : ''}
          </div>
        )}
        <div className="text-[12.5px] text-slate-600 line-clamp-2">{item.description}</div>
        {(item.supervisor_rejection_reason || item.hrd_rejection_reason || item.rejection_note) && (
          <div className="mt-1 text-[11.5px] text-red-600 bg-red-50 rounded-xl px-3 py-2">
            {item.supervisor_rejection_reason || item.hrd_rejection_reason || item.rejection_note}
          </div>
        )}
        <div className="text-[11px] text-slate-400 pt-0.5">
          Diajukan: {formatDateTimeID(item.created_at)}
        </div>
      </div>
      {EDITABLE_STATUSES.has(item.status) && (
        <div className="flex gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex-1 py-1.5 rounded-xl border border-navy-200 text-navy-950 text-[12px] font-medium bg-navy-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onCancel(item)}
            className="flex-1 py-1.5 rounded-xl border border-red-200 text-red-500 text-[12px] font-medium bg-red-50"
          >
            Batalkan
          </button>
        </div>
      )}
    </div>
  );
}

export default function LemburRo() {
  useDocumentTitle('Lembur & RO');
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');

  const _now = new Date();
  const [filterMonth, setFilterMonth] = useState(_now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(_now.getFullYear());
  const [stats, setStats] = useState({ lembur: 0, replace_off: 0, pending: 0 });

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [requestType, setRequestType] = useState('lembur');
  const [workDate, setWorkDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('21:00');
  const [description, setDescription] = useState('');
  const [compensationType, setCompensationType] = useState('ganti_hari');
  const [replacementDate, setReplacementDate] = useState(todayStr());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const durationPreview = useMemo(() => {
    const result = computeDurationHours(workDate, startTime, endTime);
    if (result.error) return null;
    return result.durationHours;
  }, [workDate, startTime, endTime]);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const qs = new URLSearchParams({
        limit: '50',
        month: String(filterMonth),
        year: String(filterYear),
      });
      if (typeFilter) qs.set('request_type', typeFilter);
      const { data } = await api.get(`/lembur-ro/list?${qs.toString()}`);
      setItems(data.items || []);
    } catch {
      setListError('Gagal memuat riwayat pengajuan.');
    } finally {
      setLoadingList(false);
    }
  }, [filterMonth, filterYear, typeFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(
        `/lembur-ro/stats?month=${filterMonth}&year=${filterYear}`
      );
      setStats(data.stats || { lembur: 0, replace_off: 0, pending: 0 });
    } catch {
      setStats({ lembur: 0, replace_off: 0, pending: 0 });
    }
  }, [filterMonth, filterYear]);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, [fetchList, fetchStats]);

  const resetForm = () => {
    setRequestType('lembur');
    setWorkDate(todayStr());
    setStartTime('18:00');
    setEndTime('21:00');
    setDescription('');
    setCompensationType('ganti_hari');
    setReplacementDate(todayStr());
    setSubmitError(null);
  };

  const openNew = () => {
    setEditTarget(null);
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setRequestType(item.request_type);
    setWorkDate(item.work_date?.slice(0, 10) || todayStr());
    setStartTime(item.start_time || '18:00');
    setEndTime(item.end_time || '21:00');
    setDescription(item.description || '');
    setCompensationType(item.compensation_type || 'ganti_hari');
    setReplacementDate(item.replacement_date?.slice(0, 10) || todayStr());
    setSubmitError(null);
    setFormOpen(true);
  };

  const clientValidate = () => {
    if (!description.trim() || description.trim().length < 5) {
      return 'Keterangan wajib diisi minimal 5 karakter.';
    }
    if (!durationPreview) {
      return 'Jam selesai harus setelah jam mulai.';
    }
    if (requestType === 'replace_off' && jakartaWeekday(workDate) === 0) {
      return 'Hari Minggu libur, tidak dapat diajukan RO.';
    }
    if (requestType === 'replace_off' && compensationType === 'ganti_hari' && jakartaWeekday(replacementDate) === 0) {
      return 'Hari pengganti tidak boleh hari Minggu.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const clientErr = clientValidate();
    if (clientErr) {
      setSubmitError(clientErr);
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        request_type: requestType,
        work_date: workDate,
        start_time: startTime,
        end_time: endTime,
        description: description.trim(),
      };
      if (requestType === 'replace_off') {
        body.compensation_type = compensationType;
        if (compensationType === 'ganti_hari') {
          body.replacement_date = replacementDate;
        }
      }

      if (editTarget) {
        await api.put(`/lembur-ro/${editTarget.id}`, body);
      } else {
        await api.post('/lembur-ro', body);
      }

      setFormOpen(false);
      fetchList();
      fetchStats();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Terjadi kesalahan, coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.delete(`/lembur-ro/${cancelTarget.id}`);
      setCancelTarget(null);
      fetchList();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membatalkan pengajuan.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <header className="relative pt-5 pb-5 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            className="w-9 h-9 rounded-[11px] bg-white/10 border border-white/12 text-white grid place-items-center flex-shrink-0"
            onClick={() => navigate('/')}
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold tracking-[.12em] uppercase text-white/80">
              Pegawai Alora
            </div>
            <div className="text-[15px] font-extrabold text-white tracking-[-0.01em] truncate">
              Lembur & RO
            </div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-navy-950 text-[12px] font-bold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajukan
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 pt-4 flex flex-col gap-2.5">
        <section className="rounded-[18px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,.04)] border border-slate-200 space-y-3">
          <div>
            <p className="text-[14px] font-extrabold text-slate-900">Periode</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Filter riwayat cutoff bulanan.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-700 bg-[#FAFBFC]"
            >
              {MONTHS_ID.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="w-[96px] border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-700 bg-[#FAFBFC]"
            >
              {[filterYear - 1, filterYear, filterYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="rounded-[12px] border border-slate-100 bg-[#FAFBFC] px-3 py-2 text-[11px] text-slate-500 text-center">
            {(() => {
              const pm = filterMonth === 1 ? 12 : filterMonth - 1;
              const py = filterMonth === 1 ? filterYear - 1 : filterYear;
              return `Periode: 26 ${MONTHS_ID[pm - 1].slice(0, 3)} ${py} – 25 ${MONTHS_ID[filterMonth - 1].slice(0, 3)} ${filterYear}`;
            })()}
          </div>
        </section>

        <section className="rounded-[18px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,.04)] border border-slate-200 space-y-3">
          <div>
            <p className="text-[14px] font-extrabold text-slate-900">Ringkasan</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Lembur', count: stats.lembur, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
              { label: 'RO', count: stats.replace_off, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
              { label: 'Menunggu', count: stats.pending, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-[14px] border p-3 flex flex-col items-center gap-0.5 text-center"
                style={{ background: s.bg, borderColor: s.border }}
              >
                <div className="text-[24px] font-extrabold leading-none" style={{ color: s.color }}>{s.count}</div>
                <div className="text-[10px] font-semibold text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,.04)] border border-slate-200">
          <div className="flex gap-2 flex-wrap">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key || 'all'}
                type="button"
                onClick={() => setTypeFilter(opt.key)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${
                  typeFilter === opt.key
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,.04)] border border-slate-200 space-y-3">
          <div>
            <p className="text-[14px] font-extrabold text-slate-900">Riwayat Pengajuan</p>
          </div>

          {loadingList ? (
            <div className="rounded-[14px] border border-slate-100 bg-[#FAFBFC] py-10 text-center text-[13px] text-slate-400">
              Memuat riwayat…
            </div>
          ) : listError ? (
            <div className="rounded-[14px] border border-red-100 bg-red-50 p-4 text-[13px] text-red-600 text-center">
              {listError}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-slate-200 bg-[#FAFBFC] flex flex-col items-center gap-2 py-10 px-4 text-slate-400">
              <Clock className="w-8 h-8 text-slate-300" />
              <div className="text-[13px] font-semibold text-slate-500">Tidak ada pengajuan</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <LemburRoCard
                  key={item.id}
                  item={item}
                  onEdit={openEdit}
                  onCancel={setCancelTarget}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
        >
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[92dvh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="text-[15px] font-extrabold text-slate-900">
                {editTarget ? 'Edit Pengajuan' : 'Ajukan Lembur / RO'}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400 text-sm font-semibold">
                Tutup
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-slate-700">Jenis Pengajuan</label>
                <div className="grid grid-cols-2 gap-2">
                  {REQUEST_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setRequestType(t.key)}
                      className={`rounded-xl border p-3 text-left transition ${
                        requestType === t.key ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200'
                      }`}
                      style={{ background: requestType === t.key ? t.bg : '#fff' }}
                    >
                      <div className="text-[13px] font-bold" style={{ color: t.color }}>{t.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-slate-700">Tanggal Kerja</label>
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-slate-700">Jam Mulai</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-slate-700">Jam Selesai</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px]"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[12px] text-slate-600">
                Durasi: <b>{durationPreview != null ? `${durationPreview} jam` : '—'}</b>
              </div>

              {requestType === 'replace_off' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[12px] font-bold text-slate-700">Tipe Kompensasi</label>
                    {COMPENSATION_TYPES.map((c) => (
                      <label
                        key={c.key}
                        className={`flex items-start gap-2 rounded-xl border p-3 cursor-pointer ${
                          compensationType === c.key ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="compensation"
                          checked={compensationType === c.key}
                          onChange={() => setCompensationType(c.key)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-[13px] font-semibold text-slate-800">{c.label}</div>
                          <div className="text-[11px] text-slate-500">{c.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {compensationType === 'ganti_hari' && (
                    <div>
                      <label className="text-[12px] font-bold text-slate-700">Tanggal Hari Pengganti</label>
                      <input
                        type="date"
                        value={replacementDate}
                        onChange={(e) => setReplacementDate(e.target.value)}
                        className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px]"
                        required
                      />
                    </div>
                  )}
                  {compensationType === 'kompensasi_tunai' && (
                    <p className="text-[11px] text-slate-500">
                      Tidak ada hari pengganti — kompensasi mengikuti kebijakan perusahaan.
                    </p>
                  )}
                </>
              )}

              <div>
                <label className="text-[12px] font-bold text-slate-700">Keterangan</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] resize-none"
                  placeholder="Jelaskan alasan lembur / RO..."
                  required
                />
              </div>

              {submitError && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-[12px] text-red-600">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-violet-600 text-white text-[14px] font-bold disabled:opacity-60"
              >
                {submitting ? 'Mengirim…' : editTarget ? 'Simpan Perubahan' : 'Kirim Pengajuan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4">
            <p className="text-[14px] font-bold text-slate-900">Batalkan pengajuan?</p>
            <p className="text-[12px] text-slate-500">Pengajuan ini akan dihapus permanen.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={cancelling}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-[13px] font-semibold disabled:opacity-60"
              >
                {cancelling ? 'Memproses…' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
