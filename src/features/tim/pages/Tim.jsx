import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  RotateCw,
  Info,
  Clock,
  FileText,
  Moon,
  Repeat,
  AlertCircle,
  Users as UsersIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { getAuthToken } from '../../../utils/authSession.js';
import { getDefaultCutoff } from '../../../utils/cutoffPeriod.js';
import UserAvatar from '../../../components/UserAvatar.jsx';
import Modal from '../../../components/Modal.jsx';

const teamApi = axios.create({ baseURL: '/api' });
teamApi.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function getBadgeStyle(variant) {
  switch (variant) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/90';
    case 'warning':
      return 'bg-amber-50 text-amber-800 border-amber-200/90';
    case 'info':
      return 'bg-sky-50 text-sky-700 border-sky-200/90';
    case 'danger':
      return 'bg-rose-50 text-rose-700 border-rose-200/90';
    case 'purple':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200/90';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export default function Tim() {
  useDocumentTitle('Ringkasan Tim');

  const defaultCutoff = getDefaultCutoff();
  const [cutoffMonth, setCutoffMonth] = useState(defaultCutoff.cutoffMonth);
  const [cutoffYear, setCutoffYear] = useState(defaultCutoff.cutoffYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const fetchTeamData = useCallback(async (isManualRefresh = false, m = cutoffMonth, y = cutoffYear) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await teamApi.get('/team/summary', {
        params: { cutoffMonth: m, cutoffYear: y },
      });
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Gagal memuat ringkasan data tim');
      }
    } catch (err) {
      console.error('[Tim] fetch error:', err);
      const msg = err.response?.data?.message || 'Terjadi kendala saat memuat data tim';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cutoffMonth, cutoffYear]);

  useEffect(() => {
    fetchTeamData(false, cutoffMonth, cutoffYear);
  }, [cutoffMonth, cutoffYear, fetchTeamData]);

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
    if (refreshing || loading) return;
    fetchTeamData(true, cutoffMonth, cutoffYear);
  };

  const supervisor = data?.supervisor || {};
  const period = data?.period || {};
  const teamSummary = data?.team_summary || {
    total_members: 0,
    telat: { duration_label: '0j 00m', count: 0 },
    izin: { duration_label: '0j 00m', count: 0 },
    lembur: { duration_label: '0j 00m', count: 0 },
    replace_off: { days_label: '0 hari', sub_label: 'WOD' },
  };
  const members = data?.members || [];

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#F8FAFC] pb-32">
      {/* ===================== TOP HEADER (DARK NAVY) ===================== */}
      <header className="w-full bg-gradient-to-b from-[#07111F] via-[#0B172B] to-[#0D1D38] text-white px-5 pt-6 pb-6 rounded-b-[32px] shadow-[0_10px_30px_rgb(11,23,43,0.25)] relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -ml-16 -mb-16" />

        {/* Row 1: SPV Profile + Action Buttons */}
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              src={supervisor.avatar}
              name={supervisor.name || 'Supervisor'}
              className="w-12 h-12 rounded-full bg-blue-600/30 border border-blue-400/40 text-white font-extrabold flex-shrink-0 shadow-inner"
              initialsClassName="text-[15px]"
            />
            <div className="min-w-0">
              <h1 className="text-[17px] font-extrabold text-white tracking-tight leading-tight truncate">
                {supervisor.name || 'Supervisor'}
              </h1>
              <p className="text-[12px] text-slate-300/80 font-medium mt-0.5 truncate">
                {supervisor.role_title || 'Supervisor'}
                {supervisor.employee_code ? ` · ${supervisor.employee_code}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 active:scale-90 border border-white/10 flex items-center justify-center text-white transition shadow-sm"
              aria-label="Refresh Data"
              title="Perbarui Data"
            >
              <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Info Button */}
            <button
              type="button"
              onClick={() => setIsInfoOpen(true)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 active:scale-90 border border-white/10 flex items-center justify-center text-white transition shadow-sm"
              aria-label="Informasi Metrik"
              title="Info Metrik"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Team Name & Watermark */}
        <div className="relative z-10 mt-5 flex items-center justify-between">
          <p className="text-[12.5px] font-semibold text-slate-300 tracking-tight truncate">
            Tim {supervisor.department_name || 'Operasional'} · {teamSummary.total_members || members.length} anggota aktif
          </p>
          <span className="text-[11px] font-bold text-slate-400/90 tracking-tight flex-shrink-0">
            Alora Mobile
          </span>
        </div>

        {/* Row 2.5: Cutoff Period Filter Navigator */}
        <div className="relative z-10 mt-3 bg-white/10 backdrop-blur-md rounded-[20px] p-2 border border-white/15 flex items-center justify-between shadow-sm">
          <button
            type="button"
            onClick={handlePrevCutoff}
            disabled={loading || refreshing}
            className="w-9 h-9 rounded-[14px] bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white transition disabled:opacity-40"
            aria-label="Periode Cut Off Sebelumnya"
            title="Cut Off Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center px-2 min-w-0">
            <span className="text-[10px] text-slate-300/80 font-medium tracking-wider uppercase">
              Periode Cut Off
            </span>
            <span className="text-[15px] sm:text-[16px] font-black text-white tracking-tight truncate mt-0.5">
              {period.month_label || 'Cut Off'}
            </span>
            <span className="text-[11.5px] text-sky-300 font-semibold tracking-tight mt-0.5">
              {period.range_label || '26 – 25'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextCutoff}
            disabled={loading || refreshing}
            className="w-9 h-9 rounded-[14px] bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white transition disabled:opacity-40"
            aria-label="Periode Cut Off Selanjutnya"
            title="Cut Off Selanjutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Row 3: 4 Team Summary Cards */}
        <div className="relative z-10 mt-4 grid grid-cols-4 gap-2">
          {/* Telat */}
          <div className="bg-white/10 backdrop-blur-md rounded-[18px] p-2.5 sm:p-3 border border-white/10 flex flex-col justify-between shadow-sm min-h-[82px]">
            <span className="text-[11.5px] font-semibold text-slate-300 truncate">Telat</span>
            <div className="mt-1">
              <div className="text-[16px] sm:text-[17px] font-black text-white leading-tight tracking-tight truncate">
                {teamSummary.telat?.days_label || `${teamSummary.telat?.count ?? 0} hari`}
              </div>
              <div className="text-[12px] sm:text-[12.5px] font-semibold text-slate-300/80 mt-0.5">
                {teamSummary.telat?.duration_label || '0j 00m'}
              </div>
            </div>
          </div>

          {/* Izin & Sakit */}
          <div className="bg-white/10 backdrop-blur-md rounded-[18px] p-2.5 sm:p-3 border border-white/10 flex flex-col justify-between shadow-sm min-h-[82px]">
            <span className="text-[11.5px] font-semibold text-slate-300 truncate" title="Izin & Sakit">Izin & Sakit</span>
            <div className="mt-1">
              <div className="text-[16px] sm:text-[17px] font-black text-white leading-tight tracking-tight truncate">
                {teamSummary.izin?.days_label || `${teamSummary.izin?.count ?? 0} hari`}
              </div>
              <div className="text-[12px] sm:text-[12.5px] font-semibold text-slate-300/80 mt-0.5">
                {teamSummary.izin?.duration_label || '0j 00m'}
              </div>
            </div>
          </div>

          {/* Lembur */}
          <div className="bg-white/10 backdrop-blur-md rounded-[18px] p-2.5 sm:p-3 border border-white/10 flex flex-col justify-between shadow-sm min-h-[82px]">
            <span className="text-[11.5px] font-semibold text-slate-300 truncate">Lembur</span>
            <div className="mt-1">
              <div className="text-[16px] sm:text-[17px] font-black text-white leading-tight tracking-tight truncate">
                {teamSummary.lembur?.days_label || `${teamSummary.lembur?.count ?? 0} hari`}
              </div>
              <div className="text-[12px] sm:text-[12.5px] font-semibold text-slate-300/80 mt-0.5">
                {teamSummary.lembur?.duration_label || '0j 00m'}
              </div>
            </div>
          </div>

          {/* Replace Off */}
          <div className="bg-white/10 backdrop-blur-md rounded-[18px] p-2.5 sm:p-3 border border-white/10 flex flex-col justify-between shadow-sm min-h-[82px]">
            <span className="text-[11.5px] font-semibold text-slate-300 truncate">Replace Off</span>
            <div className="mt-1">
              <div className="text-[16px] sm:text-[17px] font-black text-white leading-tight tracking-tight truncate">
                {teamSummary.replace_off?.days_label || '0 hari'}
              </div>
              <div className="text-[12px] sm:text-[12.5px] font-semibold text-slate-300/80 mt-0.5">
                {teamSummary.replace_off?.sub_label || 'WOD'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===================== MAIN CONTENT BODY ===================== */}
      <main className="px-5 mt-5 flex flex-col gap-3">
        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-[18px] text-red-600 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => fetchTeamData()}
              className="text-xs font-bold underline ml-2"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Section Title */}
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[12.5px] font-black text-navy-950 tracking-wider uppercase">
            ANGGOTA TIM
          </h3>
          <span className="text-[11.5px] text-slate-400 font-medium">
            Data s.d. hari ini
          </span>
        </div>

        {/* Loading Skeleton */}
        {loading && !refreshing && (
          <div className="flex flex-col gap-3 mt-1">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-[24px] p-4 border border-slate-200/80 shadow-sm animate-pulse flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-slate-200" />
                    <div>
                      <div className="w-32 h-4 bg-slate-200 rounded-md" />
                      <div className="w-20 h-3 bg-slate-100 rounded-md mt-1.5" />
                    </div>
                  </div>
                  <div className="w-16 h-6 bg-slate-200 rounded-full" />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {[1, 2, 3, 4].map((b) => (
                    <div key={b} className="h-16 bg-slate-100 rounded-[16px]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && members.length === 0 && !error && (
          <div className="bg-white rounded-[24px] p-8 border border-slate-200/80 text-center flex flex-col items-center justify-center my-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <UsersIcon className="w-6 h-6" />
            </div>
            <h4 className="text-[15px] font-bold text-navy-950">Belum Ada Anggota Tim</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
              Tidak ada staf lain yang terdaftar dalam departemen Anda.
            </p>
          </div>
        )}

        {/* Member Cards List */}
        {!loading && members.length > 0 && (
          <div className="flex flex-col gap-3 mt-0.5">
            {members.map((member) => {
              const metrics = member.metrics || {};
              const todayStatus = member.today_status || { label: 'Belum clock in', badge_variant: 'warning' };

              return (
                <div
                  key={member.employee_id}
                  className="bg-white rounded-[24px] p-4 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col gap-3 transition hover:shadow-md"
                >
                  {/* Top Row: Avatar + Name/Role + Today Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        src={member.avatar}
                        name={member.name}
                        className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-navy-950 font-bold flex-shrink-0"
                        initialsClassName="text-[13px]"
                      />
                      <div className="min-w-0">
                        <h4 className="text-[14.5px] font-black text-navy-950 tracking-tight leading-tight truncate">
                          {member.name}
                        </h4>
                        <p className="text-[11.5px] text-slate-400 font-medium mt-0.5 truncate">
                          {member.role_title || 'Staff'} · {member.employee_code}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-3 py-1 rounded-full border flex-shrink-0 tracking-tight ${getBadgeStyle(
                        todayStatus.badge_variant
                      )}`}
                    >
                      {todayStatus.label}
                    </span>
                  </div>

                  {/* 4 Colored Metric Mini Boxes (Grid 4 Cols) */}
                  <div className="grid grid-cols-4 gap-2">
                    {/* 1. Telat (Warm Amber) */}
                    <div className="bg-[#FFF9F2] border border-[#FFE8D1] rounded-[18px] p-2.5 flex flex-col justify-between min-h-[84px]">
                      <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <div className="mt-1">
                        <span className="text-[10.5px] sm:text-[11px] text-slate-500 font-medium block leading-tight">
                          Telat
                        </span>
                        <span className="text-[15px] sm:text-[16px] font-black text-navy-950 leading-tight tracking-tight block mt-0.5">
                          {metrics.telat?.days_label || `${metrics.telat?.count ?? 0} hari`}
                        </span>
                        <span className="text-[11px] sm:text-[11.5px] font-bold text-slate-500 block mt-0.5 truncate">
                          {metrics.telat?.duration_label || '0j 00m'}
                        </span>
                      </div>
                    </div>

                    {/* 2. Izin & Sakit (Soft Sky Blue) */}
                    <div className="bg-[#F0F8FF] border border-[#D9EEFF] rounded-[18px] p-2.5 flex flex-col justify-between min-h-[84px]">
                      <FileText className="w-4 h-4 text-sky-500 flex-shrink-0" />
                      <div className="mt-1">
                        <span className="text-[10px] sm:text-[10.5px] text-slate-500 font-medium block leading-tight truncate" title="Izin & Sakit">
                          Izin & Sakit
                        </span>
                        <span className="text-[15px] sm:text-[16px] font-black text-navy-950 leading-tight tracking-tight block mt-0.5">
                          {metrics.izin?.days_label || `${metrics.izin?.count ?? 0} hari`}
                        </span>
                        <span className="text-[11px] sm:text-[11.5px] font-bold text-slate-500 block mt-0.5 truncate">
                          {metrics.izin?.duration_label || '0j 00m'}
                        </span>
                      </div>
                    </div>

                    {/* 3. Lembur (Soft Lavender / Purple) */}
                    <div className="bg-[#F7F3FF] border border-[#E9DEFF] rounded-[18px] p-2.5 flex flex-col justify-between min-h-[84px]">
                      <Moon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <div className="mt-1">
                        <span className="text-[10.5px] sm:text-[11px] text-slate-500 font-medium block leading-tight">
                          Lembur
                        </span>
                        <span className="text-[15px] sm:text-[16px] font-black text-navy-950 leading-tight tracking-tight block mt-0.5">
                          {metrics.lembur?.days_label || `${metrics.lembur?.count ?? 0} hari`}
                        </span>
                        <span className="text-[11px] sm:text-[11.5px] font-bold text-slate-500 block mt-0.5 truncate">
                          {metrics.lembur?.duration_label || '0j 00m'}
                        </span>
                      </div>
                    </div>

                    {/* 4. Replace Off (Soft Emerald Green) */}
                    <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-[18px] p-2.5 flex flex-col justify-between min-h-[84px]">
                      <Repeat className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div className="mt-1">
                        <span className="text-[10px] sm:text-[10.5px] text-slate-500 font-medium block leading-tight">
                          Replace Off
                        </span>
                        <span className="text-[15px] sm:text-[16px] font-black text-navy-950 leading-tight tracking-tight block mt-0.5 truncate">
                          {metrics.replace_off?.days_label || '0 hari'}
                        </span>
                        <span className="text-[11px] sm:text-[11.5px] font-bold text-slate-500 block mt-0.5">
                          {metrics.replace_off?.sub_label || 'WOD'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ===================== INFO METRIK MODAL ===================== */}
      <Modal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title="Ringkasan Tim"
        icon={<Info className="w-4 h-4 text-navy-950" />}
        actionButtonText="Mengerti"
      >
        <div className="flex flex-col gap-2.5 text-[12px] text-slate-600">
          <p>
            Halaman ini memberikan gambaran ringkas kehadiran anggota tim di bawah supervisi Anda pada periode cut off berjalan:
          </p>
          <div className="space-y-2 mt-1">
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
              <span className="font-bold text-amber-900 block">Telat</span>
              <span className="text-[11px] text-amber-800">
                Total durasi keterlambatan presensi masuk dan jumlah hari terlambat.
              </span>
            </div>
            <div className="p-2 bg-sky-50 rounded-xl border border-sky-100">
              <span className="font-bold text-sky-900 block">Izin & Sakit</span>
              <span className="text-[11px] text-sky-800">
                Akumulasi hari dan jam perizinan (izin, sakit, dan cuti) yang telah disetujui dalam periode cut off.
              </span>
            </div>
            <div className="p-2 bg-purple-50 rounded-xl border border-purple-100">
              <span className="font-bold text-purple-900 block">Lembur</span>
              <span className="text-[11px] text-purple-800">
                Total durasi lembur yang disetujui supervisor dan jumlah hari lembur.
              </span>
            </div>
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="font-bold text-emerald-900 block">Replace Off (WOD)</span>
              <span className="text-[11px] text-emerald-800">
                Jumlah hari WOD atau replace off yang tercatat sebagai pengganti libur.
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
