import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { countLeaveDaysClient } from '../utils/countLeaveDays.js';
import {
  computeIzinFundingClient,
  computeLeaveDurationHoursClient,
  formatTimeHHmm,
  isPartialDurationType,
  todayStrJakarta,
} from '../utils/leaveTimeClient.js';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('alora_auth_token') || localStorage.getItem('alora_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const LEAVE_TYPES = [
  {
    key: 'izin',
    label: 'Izin',
    desc: 'Kepentingan pribadi / keluarga',
    color: '#3B82F6',
    bg: '#EFF6FF',
  },
  {
    key: 'sakit',
    label: 'Sakit',
    desc: 'Surat dokter opsional (SKD jika dilampirkan)',
    color: '#EF4444',
    bg: '#FEF2F2',
  },
  {
    key: 'cuti',
    label: 'Cuti',
    desc: 'Cuti tahunan (bisa multi-hari)',
    color: '#059669',
    bg: '#ECFDF5',
  },
];

const DURATION_TYPES = [
  {
    key: 'full_day',
    label: 'Seharian Penuh',
    desc: 'Jam mengikuti jadwal kerja hari tersebut',
  },
  {
    key: 'partial',
    label: 'Partial (pilih jam)',
    desc: 'Isi jam mulai dan selesai secara bebas',
  },
];

const FUNDING_SOURCE_OPTIONS = [
  { key: 'replace_off', label: 'Replace Off' },
  { key: 'overtime', label: 'Akumulasi Lembur' },
  { key: 'unpaid', label: 'Unpaid' },
];

const STATUS_META = {
  Pending_Supervisor: { label: 'Menunggu Supervisor', color: '#F59E0B', bg: '#FFFBEB' },
  Pending_HRD: { label: 'Menunggu HRD', color: '#2563EB', bg: '#EFF6FF' },
  Rejected_Supervisor: { label: 'Ditolak Supervisor', color: '#EF4444', bg: '#FEF2F2' },
  Rejected_HRD: { label: 'Ditolak HRD', color: '#EF4444', bg: '#FEF2F2' },
  disetujui: { label: 'Disetujui', color: '#059669', bg: '#ECFDF5' },
};

const EDITABLE_STATUSES = new Set(['Pending_Supervisor', 'Rejected_Supervisor', 'Rejected_HRD']);

const LEAVE_TYPE_LABEL = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti' };
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DURATION_LABEL = {
  full_day: 'Seharian Penuh',
  partial: 'Partial (pilih jam)',
  half_day_morning: 'Partial (legacy pagi)',
  half_day_afternoon: 'Partial (legacy siang)',
};

function formatFundingChips(item) {
  if (item.leave_type !== 'izin') return null;
  const chips = [];
  if (Number(item.funding_ro_hours) > 0) chips.push(`RO ${item.funding_ro_hours}j`);
  if (Number(item.funding_overtime_hours) > 0) chips.push(`Lembur ${item.funding_overtime_hours}j`);
  if (Number(item.funding_unpaid_hours) > 0) chips.push(`Unpaid ${item.funding_unpaid_hours}j`);
  return chips;
}

const fmt2 = (n) => String(n).padStart(2, '0');
const todayStr = todayStrJakarta;
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

function LeaveCard({ item, onCancel, onEdit, onViewDoctorNote }) {
  const lt = LEAVE_TYPES.find((t) => t.key === item.leave_type) || LEAVE_TYPES[0];
  const sameDay =
    item.start_date === item.end_date
    || item.start_date?.slice(0, 10) === item.end_date?.slice(0, 10);
  const timeLabel = item.start_time && item.end_time
    ? `${formatTimeHHmm(item.start_time)}–${formatTimeHHmm(item.end_time)}`
    : null;
  const fundingChips = formatFundingChips(item);
  const durationLabel = isPartialDurationType(item.duration_type)
    ? DURATION_LABEL.partial
    : (DURATION_LABEL[item.duration_type] || item.duration_type);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,.06)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100" style={{ background: lt.bg }}>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: lt.color }}>{lt.label}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{durationLabel}</div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="px-4 py-3 space-y-1.5">
        <div className="text-[12.5px] text-slate-600">
          {sameDay
            ? formatDateID(item.start_date)
            : `${formatDateID(item.start_date)} – ${formatDateID(item.end_date)}`}
        </div>
        {timeLabel && (
          <div className="text-[12px] text-slate-500">
            Jam: {timeLabel}
            {item.leave_duration_hours != null && ` (${item.leave_duration_hours} jam)`}
          </div>
        )}
        {fundingChips?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {fundingChips.map((chip) => (
              <span
                key={chip}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
        <div className="text-[12.5px] text-slate-600 line-clamp-2">{item.reason}</div>
        {item.doctor_note_file && (
          <button
            type="button"
            onClick={() => onViewDoctorNote(item)}
            className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-xl bg-navy-50 border border-navy-200 text-navy-950 text-[12px] font-semibold"
          >
            <FileText className="w-3.5 h-3.5" />
            Lihat Surat Dokter
          </button>
        )}
        {(item.supervisor_rejection_reason || item.hrd_rejection_reason || item.rejection_note) && (
          <div className="mt-1 text-[11.5px] text-red-600 bg-red-50 rounded-xl px-3 py-2 space-y-1">
            {item.supervisor_rejection_reason && (
              <div>
                <span className="font-semibold">Ditolak Supervisor: </span>
                {item.supervisor_rejection_reason}
              </div>
            )}
            {(item.hrd_rejection_reason || item.rejection_note) && (
              <div>
                <span className="font-semibold">Ditolak HRD: </span>
                {item.hrd_rejection_reason || item.rejection_note}
              </div>
            )}
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

async function fetchDoctorNoteBlobUrl(fileName) {
  const res = await api.get(`/leave/doctor-notes/${encodeURIComponent(fileName)}`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(res.data);
}

export default function Perizinan() {
  useDocumentTitle('Perizinan');
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const _now = new Date();
  const [filterMonth, setFilterMonth] = useState(_now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(_now.getFullYear());
  const [yearOptions, setYearOptions] = useState([_now.getFullYear()]);
  const [stats, setStats] = useState({ izin: 0, sakit: 0, cuti: 0 });

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [leaveType, setLeaveType] = useState('izin');
  const [durationType, setDurationType] = useState('full_day');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [reason, setReason] = useState('');
  const [doctorFile, setDoctorFile] = useState(null);
  const [doctorPreview, setDoctorPreview] = useState(null);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [fundingSources, setFundingSources] = useState(['replace_off']);
  const [fundingBalances, setFundingBalances] = useState(null);
  const [workHoursPreview, setWorkHoursPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [annualBalance, setAnnualBalance] = useState(null);
  const [loadingAnnualBalance, setLoadingAnnualBalance] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [doctorNoteItem, setDoctorNoteItem] = useState(null);
  const [doctorNoteUrl, setDoctorNoteUrl] = useState('');

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const { data } = await api.get(
        `/leave/list?limit=50&month=${filterMonth}&year=${filterYear}`
      );
      setItems(data.items || []);
    } catch {
      setListError('Gagal memuat riwayat pengajuan.');
    } finally {
      setLoadingList(false);
    }
  }, [filterMonth, filterYear]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(
        `/leave/stats?month=${filterMonth}&year=${filterYear}`
      );
      setStats(data.stats || { izin: 0, sakit: 0, cuti: 0 });
    } catch {
      setStats({ izin: 0, sakit: 0, cuti: 0 });
    }
  }, [filterMonth, filterYear]);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, [fetchList, fetchStats]);

  useEffect(() => {
    api.get('/leave/years')
      .then(({ data }) => setYearOptions(data.years || [new Date().getFullYear()]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (leaveType !== 'cuti') setEndDate(startDate);
  }, [leaveType, startDate]);

  useEffect(() => {
    if (durationType !== 'full_day' || isPartialDurationType(durationType)) {
      setEndDate(startDate);
    }
  }, [durationType, startDate]);

  const isIzinToday = leaveType === 'izin' && startDate === todayStr();
  const isPartialMode = durationType === 'partial' || isPartialDurationType(durationType);
  const showFullDayOption = !(leaveType === 'izin' && isIzinToday);

  useEffect(() => {
    if (isIzinToday && durationType === 'full_day') {
      setDurationType('partial');
    }
  }, [isIzinToday, durationType]);

  useEffect(() => {
    if (!formOpen || leaveType !== 'izin') {
      setFundingBalances(null);
      return;
    }
    api.get('/leave/funding-balances')
      .then(({ data }) => setFundingBalances(data))
      .catch(() => setFundingBalances(null));
  }, [formOpen, leaveType]);

  useEffect(() => {
    if (!formOpen || durationType !== 'full_day' || isPartialMode) {
      setWorkHoursPreview(null);
      return;
    }
    api.get('/leave/work-hours', { params: { date: startDate } })
      .then(({ data }) => setWorkHoursPreview(data))
      .catch(() => setWorkHoursPreview(null));
  }, [formOpen, durationType, isPartialMode, startDate]);

  const previewDurationHours = useMemo(() => {
    if (durationType === 'full_day' && workHoursPreview) {
      return computeLeaveDurationHoursClient(workHoursPreview.start_time, workHoursPreview.end_time);
    }
    if (isPartialMode) {
      return computeLeaveDurationHoursClient(startTime, endTime);
    }
    return 0;
  }, [durationType, workHoursPreview, isPartialMode, startTime, endTime]);

  const fundingPreview = useMemo(() => {
    if (leaveType !== 'izin' || previewDurationHours <= 0) return null;
    return computeIzinFundingClient({
      durationHours: previewDurationHours,
      sources: fundingSources,
      roBalance: fundingBalances?.replace_off_hours,
      overtimeBalance: fundingBalances?.overtime_hours,
    });
  }, [leaveType, previewDurationHours, fundingSources, fundingBalances]);

  const izinSubmitBlocked = leaveType === 'izin' && (
    fundingSources.length === 0
    || (fundingPreview?.uncovered > 0)
  );

  const fetchAnnualBalance = useCallback(async () => {
    setLoadingAnnualBalance(true);
    try {
      const params = {};
      if (leaveType === 'cuti') {
        params.preview_start = startDate;
        params.preview_end = endDate;
        params.duration_type = durationType;
      }
      const { data } = await api.get('/leave/annual-balance', { params });
      setAnnualBalance(data);
    } catch {
      setAnnualBalance(null);
    } finally {
      setLoadingAnnualBalance(false);
    }
  }, [leaveType, startDate, endDate, durationType]);

  useEffect(() => {
    if (formOpen && leaveType === 'cuti') {
      fetchAnnualBalance();
    } else if (!formOpen) {
      setAnnualBalance(null);
    }
  }, [formOpen, leaveType, fetchAnnualBalance]);

  const previewLeaveDays = useMemo(() => {
    if (leaveType !== 'cuti') return 0;
    return countLeaveDaysClient({ startDate, endDate, durationType });
  }, [leaveType, startDate, endDate, durationType]);

  const cutiSubmitBlocked = leaveType === 'cuti' && annualBalance && !annualBalance.eligible;

  useEffect(() => {
    let revoked = false;
    let url = '';
    if (!doctorNoteItem?.doctor_note_file) {
      setDoctorNoteUrl('');
      return undefined;
    }
    fetchDoctorNoteBlobUrl(doctorNoteItem.doctor_note_file)
      .then((blobUrl) => {
        if (revoked) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        url = blobUrl;
        setDoctorNoteUrl(blobUrl);
      })
      .catch(() => setDoctorNoteUrl(''));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
      setDoctorNoteUrl('');
    };
  }, [doctorNoteItem]);

  const openNew = () => {
    setEditTarget(null);
    setLeaveType('izin');
    setDurationType('partial');
    setStartDate(todayStr());
    setEndDate(todayStr());
    setStartTime('08:00');
    setEndTime('12:00');
    setFundingSources(['replace_off', 'unpaid']);
    setReason('');
    setDoctorFile(null);
    setDoctorPreview(null);
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEdit = async (item) => {
    setEditTarget(item);
    setLeaveType(item.leave_type);
    const dt = isPartialDurationType(item.duration_type) ? 'partial' : item.duration_type;
    setDurationType(dt);
    setStartDate(item.start_date?.slice(0, 10) || todayStr());
    setEndDate(item.end_date?.slice(0, 10) || todayStr());
    setStartTime(formatTimeHHmm(item.start_time) || '08:00');
    setEndTime(formatTimeHHmm(item.end_time) || '12:00');
    setFundingSources(
      Array.isArray(item.funding_sources) && item.funding_sources.length
        ? item.funding_sources
        : ['replace_off', 'unpaid']
    );
    setReason(item.reason || '');
    setDoctorFile(null);
    setSubmitError(null);
    setFormOpen(true);
    if (item.doctor_note_file) {
      try {
        const url = await fetchDoctorNoteBlobUrl(item.doctor_note_file);
        setDoctorPreview(url);
      } catch {
        setDoctorPreview(null);
      }
    } else {
      setDoctorPreview(null);
    }
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDoctorFile(file);
    const url = URL.createObjectURL(file);
    setDoctorPreview((prev) => {
      if (prev?.startsWith?.('blob:')) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setSubmitError('Keterangan wajib diisi minimal 5 karakter.');
      return;
    }
    if (cutiSubmitBlocked) {
      setSubmitError('Cuti tahunan tersedia setelah 1 tahun kerja.');
      return;
    }
    if (izinSubmitBlocked) {
      setSubmitError('Pilih sumber izin dan pastikan saldo mencukupi (centang Unpaid untuk sisa jam).');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('leave_type', leaveType);
      formData.append('duration_type', durationType);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      formData.append('reason', reason.trim());
      if (isPartialMode) {
        formData.append('start_time', startTime);
        formData.append('end_time', endTime);
      }
      if (leaveType === 'izin') {
        formData.append('funding_sources', JSON.stringify(fundingSources));
      }
      if (doctorFile) formData.append('doctor_note', doctorFile);

      if (editTarget) {
        await api.put(`/leave/${editTarget.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/leave', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
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
      await api.delete(`/leave/${cancelTarget.id}`);
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
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
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
              Izin / Cuti
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
            <p className="text-[11px] text-slate-500 mt-0.5">Filter riwayat pengajuan cutoff bulanan.</p>
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
              {yearOptions.map((y) => (
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
            <p className="text-[11px] text-slate-500 mt-0.5">Total pengajuan di periode terpilih.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'izin', label: 'Total Izin', count: stats.izin, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
              { key: 'sakit', label: 'Total Sakit', count: stats.sakit, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
              { key: 'cuti', label: 'Total Cuti', count: stats.cuti, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
            ].map((s) => (
              <div
                key={s.key}
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
          <div className="rounded-[14px] bg-navy-50 border border-navy-200/60 px-3.5 py-3 text-[12px] text-navy-950 space-y-1">
            <div className="font-bold">Info izin</div>
            <div className="leading-relaxed">
              Izin <b>seharian penuh</b> yang sudah <b>disetujui</b> mengunci absensi hari itu.
              Setengah hari dicatat untuk administrasi.
            </div>
          </div>
        </section>

        <section className="rounded-[18px] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,.04)] border border-slate-200 space-y-3">
          <div>
            <p className="text-[14px] font-extrabold text-slate-900">Riwayat Pengajuan</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Daftar izin, sakit, dan cuti Anda.</p>
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
              <FileText className="w-8 h-8 text-slate-300" />
              <div className="text-[13px] font-semibold text-slate-500">Tidak ada pengajuan</div>
              <div className="text-[12px] text-center leading-relaxed">
                Tidak ada data pada periode <b className="text-slate-600">{MONTHS_ID[filterMonth - 1]} {filterYear}</b>.
                <br />
                Ketuk <b className="text-slate-600">Ajukan</b> untuk membuat pengajuan baru.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <LeaveCard
                  key={item.id}
                  item={item}
                  onEdit={openEdit}
                  onCancel={setCancelTarget}
                  onViewDoctorNote={setDoctorNoteItem}
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
              <div className="text-[15px] font-bold text-slate-800">
                {editTarget ? 'Edit Pengajuan' : 'Buat Pengajuan Izin'}
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 grid place-items-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-2">Jenis Izin</label>
                <div className="grid grid-cols-3 gap-2">
                  {LEAVE_TYPES.map((lt) => (
                    <button
                      key={lt.key}
                      type="button"
                      onClick={() => setLeaveType(lt.key)}
                      className={`rounded-xl border-2 p-2.5 flex flex-col items-center gap-1.5 ${
                        leaveType === lt.key ? 'shadow-sm' : 'border-slate-200 bg-white'
                      }`}
                      style={leaveType === lt.key ? { background: lt.bg, borderColor: lt.color } : {}}
                    >
                      <span
                        className="text-[11.5px] font-semibold"
                        style={{ color: leaveType === lt.key ? lt.color : '#64748b' }}
                      >
                        {lt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-2">Durasi</label>
                <div className="space-y-2">
                  {DURATION_TYPES.filter((dt) => dt.key !== 'full_day' || showFullDayOption).map((dt) => (
                    <button
                      key={dt.key}
                      type="button"
                      onClick={() => setDurationType(dt.key)}
                      className={`w-full rounded-xl border-2 px-3 py-2.5 text-left ${
                        durationType === dt.key
                          ? 'border-navy-950 bg-navy-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className={`text-[12.5px] font-semibold ${durationType === dt.key ? 'text-navy-950' : 'text-slate-700'}`}>
                        {dt.label}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{dt.desc}</div>
                    </button>
                  ))}
                </div>
                {isIzinToday && (
                  <p className="text-[11px] text-amber-700 mt-2">
                    Izin hari ini hanya partial (isi jam). Full day untuk tanggal selain hari ini.
                  </p>
                )}
              </div>

              {(durationType === 'full_day' && workHoursPreview) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
                  Jam kerja: {workHoursPreview.start_time}–{workHoursPreview.end_time}
                  {previewDurationHours > 0 && ` (${previewDurationHours} jam)`}
                </div>
              )}

              {isPartialMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Jam Mulai</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Jam Selesai</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-slate-50"
                    />
                  </div>
                </div>
              )}

              {leaveType === 'izin' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-3">
                  <div>
                    <p className="text-[13px] font-bold text-blue-900">Sumber izin</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Saldo RO: {fundingBalances?.replace_off_hours ?? '…'} jam · Lembur: {fundingBalances?.overtime_hours ?? '…'} jam
                    </p>
                  </div>
                  <div className="space-y-2">
                    {FUNDING_SOURCE_OPTIONS.map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 text-[12.5px] text-blue-900">
                        <input
                          type="checkbox"
                          checked={fundingSources.includes(opt.key)}
                          onChange={(e) => {
                            setFundingSources((prev) => {
                              if (e.target.checked) return [...prev, opt.key];
                              return prev.filter((s) => s !== opt.key);
                            });
                          }}
                          className="rounded border-blue-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {fundingPreview && previewDurationHours > 0 && (
                    <div className="text-[11px] text-blue-800 space-y-0.5 border-t border-blue-200 pt-2">
                      <div>Potong RO: {fundingPreview.funding_ro_hours} jam</div>
                      <div>Potong Lembur: {fundingPreview.funding_overtime_hours} jam</div>
                      <div>Unpaid: {fundingPreview.funding_unpaid_hours} jam</div>
                      {fundingPreview.uncovered > 0 && (
                        <div className="text-red-600 font-semibold">
                          Saldo tidak cukup ({fundingPreview.uncovered} jam) — centang Unpaid
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {leaveType === 'cuti' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1">
                  {loadingAnnualBalance ? (
                    <p className="text-[12px] text-emerald-700">Memuat saldo cuti…</p>
                  ) : annualBalance?.eligible ? (
                    <>
                      <p className="text-[13px] font-bold text-emerald-800">
                        Saldo cuti tahunan: {annualBalance.balance_days} hari
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Siklus {formatDateID(annualBalance.cycle_start)} – {formatDateID(annualBalance.cycle_end)}
                      </p>
                      {previewLeaveDays > 0 && (
                        <p className="text-[11px] text-emerald-600">
                          Pengajuan ini: ~{previewLeaveDays} hari kerja (estimasi, Minggu dikecualikan)
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-bold text-amber-800">
                        Cuti tahunan tersedia setelah 1 tahun kerja
                      </p>
                      {annualBalance?.join_date && (
                        <p className="text-[11px] text-amber-700">
                          Tanggal masuk: {formatDateID(annualBalance.join_date)}
                        </p>
                      )}
                      {annualBalance?.next_anniversary && (
                        <p className="text-[11px] text-amber-700">
                          Berhak cuti dari: {formatDateID(annualBalance.next_anniversary)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                    {leaveType === 'cuti' ? 'Tanggal Mulai' : 'Tanggal'}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    min={leaveType === 'izin' ? undefined : todayStr()}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-slate-50"
                  />
                </div>
                {leaveType === 'cuti' && (
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-slate-50"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                  Keterangan / Alasan
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Tuliskan alasan pengajuan secara singkat dan jelas..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-slate-50 resize-none"
                />
              </div>

              {leaveType === 'sakit' && (
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                    Foto Surat Dokter
                    <span className="text-slate-400 font-normal"> (opsional — jika ada, status Sakit SKD)</span>
                  </label>
                  {doctorPreview && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-slate-200">
                      <img src={doctorPreview} alt="Surat dokter" className="w-full max-h-40 object-contain bg-slate-100" />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFilePick}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-3 text-[12.5px] text-slate-500"
                  >
                    {doctorFile ? 'Ganti Foto Surat Dokter' : 'Unggah Foto Surat Dokter'}
                  </button>
                </div>
              )}

              {submitError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[12.5px] text-red-600 font-medium">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || cutiSubmitBlocked || izinSubmitBlocked}
                className="w-full py-3 rounded-[16px] bg-navy-950 text-white text-[13.5px] font-bold disabled:opacity-60"
              >
                {submitting ? 'Mengirim…' : editTarget ? 'Simpan Perubahan' : 'Kirim Pengajuan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
          <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-[15px] font-bold text-slate-800">Batalkan Pengajuan?</div>
              <div className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
                Pengajuan <b>{LEAVE_TYPE_LABEL[cancelTarget.leave_type]}</b> pada{' '}
                <b>{formatDateID(cancelTarget.start_date)}</b> akan dihapus.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-semibold"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[13px] font-bold disabled:opacity-60"
              >
                {cancelling ? 'Membatalkan…' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {doctorNoteItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75">
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="text-[15px] font-bold text-slate-800">Surat Dokter</div>
                <div className="text-[11.5px] text-slate-400 mt-0.5">
                  {LEAVE_TYPE_LABEL[doctorNoteItem.leave_type]} · {formatDateID(doctorNoteItem.start_date)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDoctorNoteItem(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-3 bg-slate-50 flex items-center justify-center min-h-[240px] max-h-[55vh]">
              {doctorNoteUrl ? (
                <img
                  src={doctorNoteUrl}
                  alt="Surat Dokter"
                  className="max-w-full max-h-[52vh] object-contain rounded-xl shadow"
                />
              ) : (
                <span className="text-sm text-slate-400">Memuat gambar…</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
