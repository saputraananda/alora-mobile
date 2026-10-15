import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft,
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Calendar, 
  Hourglass, 
  Clock, 
  Moon,
  AlertCircle
} from 'lucide-react';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { getAuthToken } from '../../../utils/authSession.js';
import { getDefaultCutoff } from '../../../utils/cutoffPeriod.js';
import PageHeaderRefreshButton from '../../../components/PageHeaderRefreshButton.jsx';

const ringkasanApi = axios.create({ baseURL: '/api' });
ringkasanApi.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

function formatCutoffDisplay(month, year) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const m1 = MONTH_NAMES_SHORT[prevMonth - 1];
  const m2 = MONTH_NAMES_SHORT[month - 1];
  if (prevYear !== year) {
    return `26 ${m1} ${prevYear} – 25 ${m2} ${year}`;
  }
  return `26 ${m1} – 25 ${m2} ${year}`;
}

export default function Ringkasan() {
  useDocumentTitle('Ringkasan');
  const navigate = useNavigate();

  const defaultCutoff = getDefaultCutoff();
  const [cutoffMonth, setCutoffMonth] = useState(defaultCutoff.cutoffMonth);
  const [cutoffYear, setCutoffYear] = useState(defaultCutoff.cutoffYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async (m, y) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ringkasanApi.get('/attendance/summary-cutoff', {
        params: { cutoffMonth: m, cutoffYear: y }
      });
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Gagal mengambil data ringkasan');
      }
    } catch (err) {
      console.error('[Ringkasan] fetch error', err);
      setError('Terjadi kendala saat memuat data ringkasan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(cutoffMonth, cutoffYear);
  }, [cutoffMonth, cutoffYear, fetchSummary]);

  const handlePrevCutoff = () => {
    if (cutoffMonth === 1) {
      setCutoffMonth(12);
      setCutoffYear((prev) => prev - 1);
    } else {
      setCutoffMonth((prev) => prev - 1);
    }
  };

  const handleNextCutoff = () => {
    if (cutoffMonth === 12) {
      setCutoffMonth(1);
      setCutoffYear((prev) => prev + 1);
    } else {
      setCutoffMonth((prev) => prev + 1);
    }
  };

  const handleRefresh = () => {
    return fetchSummary(cutoffMonth, cutoffYear);
  };

  const stats = data?.stats || { total_days: 0, work_days: 0, holiday_days: 0, additional_holiday_days: 0, sunday_days: 0 };
  const paidDays = data?.paid_days || {
    hadir_harian: 0,
    wfa: 0,
    sakit_skd: 0,
    replace_off: 0,
    cuti: 0,
    izin_pakai_lembur: 0,
    half_day: 0,
    total: 0
  };
  const offDays = data?.off_days || {
    tidak_hadir_harian: 0,
    wod: 0,
    sakit_non_skd: 0,
    izin_unpaid_leave: 0,
    total: 0
  };
  const unpaidHours = data?.unpaid_hours || {
    izin_pakai_lembur: { label: '0j 00m' },
    half_day: { label: '0j 00m' },
    total: { label: '0j 00m' }
  };
  const terlambat = data?.terlambat || {
    terencana: { count: 0, duration: { label: '0j 00m' } },
    tidak_terencana: { count: 0, duration: { label: '0j 00m' } },
    total: { count: 0, duration: { label: '0j 00m' } }
  };
  const lembur = data?.lembur || {
    saldo_lembur: { label: '0j 00m' },
    lembur_terpakai: { label: '0j 00m' },
    lembur_dibayar: { label: '0j 00m' }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#F8FAFC] pb-28">
      {/* Top Header with Back button and Refresh */}
      <header className="px-5 pt-6 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-navy-950 hover:bg-slate-50 transition active:scale-90 flex-shrink-0"
            aria-label="Kembali ke Beranda"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[20px] font-black text-navy-950 tracking-tight leading-tight truncate">
              Ringkasan
            </h1>
            <p className="text-[12px] text-slate-500 font-medium mt-0.5 truncate">
              Rekap kehadiran per cut off
            </p>
          </div>
        </div>
        <PageHeaderRefreshButton
          onRefresh={handleRefresh}
          tone="onLight"
          className="!w-9 !h-9 !rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-navy-950 transition active:scale-95 shadow-sm flex-shrink-0"
        />
      </header>

      {/* Main Container */}
      <main className="px-5 flex flex-col gap-4 mt-2">
        {/* Cutoff Period Navigator */}
        <div className="w-full bg-white rounded-[22px] border border-slate-200/80 shadow-[0_2px_12px_rgb(0,0,0,0.03)] px-3 py-2.5 flex items-center justify-between">
          <button
            onClick={handlePrevCutoff}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-navy-950 hover:bg-slate-100 transition active:scale-90"
            aria-label="Bulan Sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-medium">Periode cut off</span>
            <span className="text-[13px] sm:text-[14px] font-extrabold text-navy-950 tracking-tight">
              {formatCutoffDisplay(cutoffMonth, cutoffYear)}
            </span>
          </div>

          <button
            onClick={handleNextCutoff}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-navy-950 hover:bg-slate-100 transition active:scale-90"
            aria-label="Bulan Selanjutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-[18px] text-red-600 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Stats: Total Hari, Hari Libur & Hari Kerja */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white rounded-[20px] p-3 sm:p-4 border border-slate-200/80 shadow-[0_2px_12px_rgb(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 block truncate">Total Hari</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-[20px] sm:text-[24px] font-black text-navy-950 leading-none tracking-tight">
                  {stats.total_days}
                </span>
                <span className="text-[10px] sm:text-[12px] font-bold text-slate-500">hari</span>
              </div>
            </div>
            <p className="text-[9px] sm:text-[10.5px] text-slate-400 font-normal leading-tight mt-2">
              Periode cut off
            </p>
          </div>

          <div className="bg-white rounded-[20px] p-3 sm:p-4 border border-slate-200/80 shadow-[0_2px_12px_rgb(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <span className="text-[10px] sm:text-[11px] font-medium text-amber-600 block truncate">Total Libur</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-[20px] sm:text-[24px] font-black text-amber-600 leading-none tracking-tight">
                  {stats.holiday_days ?? Math.max(0, stats.total_days - stats.work_days)}
                </span>
                <span className="text-[10px] sm:text-[12px] font-bold text-amber-600/70">hari</span>
              </div>
            </div>
            <p className="text-[9px] sm:text-[10.5px] text-slate-400 font-normal leading-tight mt-2">
              Total hari libur
            </p>
          </div>

          <div className="bg-white rounded-[20px] p-3 sm:p-4 border border-slate-200/80 shadow-[0_2px_12px_rgb(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 block truncate">Hari Kerja</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-[20px] sm:text-[24px] font-black text-navy-950 leading-none tracking-tight">
                  {stats.work_days}
                </span>
                <span className="text-[10px] sm:text-[12px] font-bold text-slate-500">hari</span>
              </div>
            </div>
            <p className="text-[9px] sm:text-[10.5px] text-slate-400 font-normal leading-tight mt-2">
              Hari kerja seharusnya
            </p>
          </div>
        </div>

        {/* 1. Paid Days Card (Dark Navy) */}
        <section className="bg-[#0B172B] rounded-[26px] p-5 text-white shadow-lg border border-slate-800">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white tracking-tight leading-tight">
                Paid Days
              </h2>
              <p className="text-[11px] text-slate-400">Hari yang dibayar</p>
            </div>
          </div>

          {/* Table Header */}
          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 pt-3 pb-1">
            <span>Komponen</span>
            <span>Hari</span>
          </div>

          {/* Rows */}
          <div className="flex flex-col divide-y divide-white/5 text-sm">
            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-white text-[13px]">Hadir Harian</div>
                <div className="text-[10.5px] text-slate-400">Hadir sesuai absensi harian</div>
              </div>
              <span className="font-bold text-white text-[14px]">{paidDays.hadir_harian}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-white text-[13px]">WFA</div>
                <div className="text-[10.5px] text-slate-400">Tanpa Konsumsi dan Transport</div>
              </div>
              <span className="font-bold text-white text-[14px]">{paidDays.wfa}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-white text-[13px]">Sakit SKD</div>
                <div className="text-[10.5px] text-slate-400">Tanpa Konsumsi dan Transport</div>
              </div>
              <span className="font-bold text-white text-[14px]">{paidDays.sakit_skd}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-white text-[13px]">Replace Off</div>
                <div className="text-[10.5px] text-slate-400">WOD yang dipakai sebagai pengganti OFF</div>
              </div>
              <span className="font-bold text-white text-[14px]">{paidDays.replace_off}</span>
            </div>

            <div className="flex justify-between items-center py-2.5">
              <div className="font-bold text-white text-[13px]">Cuti</div>
              <span className="font-bold text-white text-[14px]">{paidDays.cuti}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-white text-[13px]">Izin Pakai Lembur</div>
                <div className="text-[10.5px] text-slate-400">Izin yang ditutup lembur. Tanpa Konsumsi dan Transport</div>
              </div>
              <span className="font-bold text-white text-[14px]">{paidDays.izin_pakai_lembur}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-white text-[13px]">Half Day</div>
                <div className="text-[10.5px] text-slate-400">Jam tidak masuk dihitung di Unpaid Hour</div>
              </div>
              <span className="font-bold text-white text-[14px]">{paidDays.half_day}</span>
            </div>
          </div>

          {/* Highlight Footer */}
          <div className="mt-3 bg-white/10 rounded-[18px] px-4 py-3 flex justify-between items-center border border-white/10">
            <span className="text-[13px] font-bold text-white">Total Paid Days</span>
            <span className="text-[20px] font-extrabold text-white">
              {paidDays.total} <span className="text-[12px] font-normal text-slate-300">hari</span>
            </span>
          </div>
        </section>

        {/* 2. OFF Card (White Card with Soft Red/Pink highlight) */}
        <section className="bg-white rounded-[26px] p-5 border border-slate-200/80 shadow-[0_2px_14px_rgb(0,0,0,0.03)]">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-navy-950 tracking-tight leading-tight">
                OFF
              </h2>
              <p className="text-[11px] text-slate-500">Hari tidak masuk</p>
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 pt-3 pb-1">
            <span>Komponen</span>
            <span>Hari</span>
          </div>

          <div className="flex flex-col divide-y divide-slate-100 text-sm">
            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Tidak Hadir Harian</div>
                <div className="text-[10.5px] text-slate-500">Tidak ada status presensi</div>
              </div>
              <span className="font-bold text-navy-950 text-[14px]">{offDays.tidak_hadir_harian}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-navy-950 text-[13px]">WOD</div>
                <div className="text-[10.5px] text-slate-500">Bisa dipakai sebagai Replace Off</div>
              </div>
              <span className="font-bold text-navy-950 text-[14px]">{offDays.wod}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Sakit Non SKD</div>
                <div className="text-[10.5px] text-slate-500">Sakit tanpa surat keterangan dokter</div>
              </div>
              <span className="font-bold text-navy-950 text-[14px]">{offDays.sakit_non_skd}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Izin Unpaid Leave</div>
                <div className="text-[10.5px] text-slate-500">Izin sehari penuh, tidak dibayar</div>
              </div>
              <span className="font-bold text-navy-950 text-[14px]">{offDays.izin_unpaid_leave}</span>
            </div>
          </div>

          <div className="mt-3 bg-rose-50/80 rounded-[18px] px-4 py-3 flex justify-between items-center border border-rose-100">
            <span className="text-[13px] font-bold text-rose-950">Total OFF</span>
            <span className="text-[20px] font-extrabold text-rose-600">
              {offDays.total} <span className="text-[12px] font-normal text-rose-500">hari</span>
            </span>
          </div>
        </section>

        {/* 3. Unpaid Hour Card */}
        <section className="bg-white rounded-[26px] p-5 border border-slate-200/80 shadow-[0_2px_14px_rgb(0,0,0,0.03)]">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center flex-shrink-0">
              <Hourglass className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-navy-950 tracking-tight leading-tight">
                Unpaid Hour
              </h2>
              <p className="text-[11px] text-slate-500">Jam tidak masuk yang tidak dibayar</p>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-slate-100 text-sm mt-1">
            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Izin Pakai Lembur</div>
                <div className="text-[10.5px] text-slate-500">Hari masuk Paid Days. Jam ini tidak ter-cover lembur.</div>
              </div>
              <span className="font-bold text-navy-950 text-[14px] tracking-tight">{unpaidHours.izin_pakai_lembur?.label}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Half Day</div>
                <div className="text-[10.5px] text-slate-500">Hari masuk Paid Days. Jam ini potongan Half Day.</div>
              </div>
              <span className="font-bold text-navy-950 text-[14px] tracking-tight">{unpaidHours.half_day?.label}</span>
            </div>
          </div>

          <div className="mt-3 bg-sky-50/80 rounded-[18px] px-4 py-3 flex justify-between items-center border border-sky-100">
            <span className="text-[13px] font-bold text-sky-950">Total Unpaid Hour</span>
            <span className="text-[20px] font-extrabold text-sky-800 tracking-tight">
              {unpaidHours.total?.label}
            </span>
          </div>
        </section>

        {/* 4. Terlambat Card */}
        <section className="bg-white rounded-[26px] p-5 border border-slate-200/80 shadow-[0_2px_14px_rgb(0,0,0,0.03)]">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-navy-950 tracking-tight leading-tight">
                Terlambat
              </h2>
              <p className="text-[11px] text-slate-500">Jumlah kali dan durasi</p>
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 pt-3 pb-1">
            <span className="w-1/2">Jenis</span>
            <div className="w-1/2 flex justify-between">
              <span className="text-right flex-1 pr-4">Kali</span>
              <span className="text-right">Durasi</span>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-slate-100 text-sm">
            <div className="flex justify-between items-start py-2.5">
              <div className="w-1/2 pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Terencana</div>
                <div className="text-[10.5px] text-slate-500">Sudah diinfokan sebelumnya</div>
              </div>
              <div className="w-1/2 flex justify-between items-center">
                <span className="font-bold text-navy-950 text-[14px] text-right flex-1 pr-6">
                  {terlambat.terencana?.count}
                </span>
                <span className="font-bold text-navy-950 text-[14px] tracking-tight text-right">
                  {terlambat.terencana?.duration?.label}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="w-1/2 pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Tidak Terencana</div>
                <div className="text-[10.5px] text-slate-500">Tidak diinfokan sebelumnya</div>
              </div>
              <div className="w-1/2 flex justify-between items-center">
                <span className="font-bold text-navy-950 text-[14px] text-right flex-1 pr-6">
                  {terlambat.tidak_terencana?.count}
                </span>
                <span className="font-bold text-navy-950 text-[14px] tracking-tight text-right">
                  {terlambat.tidak_terencana?.duration?.label}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 bg-amber-50/80 rounded-[18px] px-4 py-3 flex justify-between items-center border border-amber-100">
            <span className="text-[13px] font-bold text-amber-950">Total Terlambat</span>
            <span className="text-[18px] font-extrabold text-amber-800 tracking-tight">
              {terlambat.total?.count} kali · {terlambat.total?.duration?.label}
            </span>
          </div>
        </section>

        {/* 5. Lembur Card */}
        <section className="bg-white rounded-[26px] p-5 border border-slate-200/80 shadow-[0_2px_14px_rgb(0,0,0,0.03)]">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Moon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-navy-950 tracking-tight leading-tight">
                Lembur
              </h2>
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 pt-3 pb-1">
            <span>Komponen</span>
            <span>Jam</span>
          </div>

          <div className="flex flex-col divide-y divide-slate-100 text-sm">
            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Saldo Lembur</div>
                <div className="text-[10.5px] text-slate-500">Total lembur yang terkumpul</div>
              </div>
              <span className="font-bold text-navy-950 text-[14px] tracking-tight">{lembur.saldo_lembur?.label}</span>
            </div>

            <div className="flex justify-between items-start py-2.5">
              <div className="pr-2">
                <div className="font-bold text-navy-950 text-[13px]">Lembur Terpakai</div>
                <div className="text-[10.5px] text-slate-500">Dipakai untuk menutup jam izin</div>
              </div>
              <span className="font-bold text-navy-950 text-[14px] tracking-tight">{lembur.lembur_terpakai?.label}</span>
            </div>
          </div>

          <div className="mt-3 bg-emerald-50/80 rounded-[18px] px-4 py-3 flex justify-between items-center border border-emerald-100">
            <span className="text-[13px] font-bold text-emerald-950">Lembur Dibayar</span>
            <span className="text-[20px] font-extrabold text-emerald-700 tracking-tight">
              {lembur.lembur_dibayar?.label}
            </span>
          </div>

          <p className="text-[10.5px] text-slate-400 font-normal leading-tight mt-3 text-center">
            Dihitung dari Saldo Lembur dikurangi Lembur Terpakai.
          </p>
        </section>
      </main>
    </div>
  );
}
