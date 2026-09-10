import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { formatName } from '../utils/FormatName.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import {
  DAYS,
  MONTHS_ID,
  AVAILABLE_YEARS,
  mapItemToRecord,
  locationLabelClass,
} from '../utils/attendanceDisplay.js';

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

export default function Riwayat() {
  useDocumentTitle('Riwayat');
  const now = new Date();

  const [userData, setUserData] = useState(null);
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(now.getDate());
  const [recordsByDate, setRecordsByDate] = useState({});
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [tempPickerMonth, setTempPickerMonth] = useState(now.getMonth());
  const [tempPickerYear, setTempPickerYear] = useState(now.getFullYear());

  useEffect(() => {
    const storedUser = localStorage.getItem('alora_user') || sessionStorage.getItem('alora_user');
    if (storedUser) {
      try {
        setUserData(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing stored user:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (showPickerModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showPickerModal]);

  const fetchMonth = useCallback(async () => {
    try {
      const { data } = await api.get(`/attendance/month?year=${calYear}&month=${calMonth + 1}`);
      const map = {};
      (data.items || []).forEach((item) => {
        const rec = mapItemToRecord(item);
        if (rec.date) map[rec.date] = rec;
      });
      setRecordsByDate(map);
    } catch {
      setRecordsByDate({});
    }
  }, [calYear, calMonth]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  useEffect(() => {
    if (calMonth === now.getMonth() && calYear === now.getFullYear()) {
      setSelectedDate(now.getDate());
    }
  }, [calMonth, calYear]);

  const rawUserName = userData?.name || '';
  const formattedUserName = rawUserName ? formatName(rawUserName) : 'Pengguna Alora';

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells = [];
  for (let i = 0; i < firstDay; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const openPickerModal = () => {
    setTempPickerMonth(calMonth);
    setTempPickerYear(calYear);
    setShowPickerModal(true);
  };

  const applyMonthYearPicker = () => {
    setCalMonth(tempPickerMonth);
    setCalYear(tempPickerYear);
    setSelectedDate(null);
    setShowPickerModal(false);
  };

  const getKey = (d) => `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const monthKeys = Object.keys(recordsByDate).filter((k) => recordsByDate[k]?.clockIn).sort();
  const stats = { hadir: monthKeys.length, izin: 0, sakit: 0 };

  const isToday = (d) => d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
  const isFuture = (d) => new Date(calYear, calMonth, d) > now;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <header className="relative pt-6 pb-12 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none z-0" />

        <div className="relative z-10 text-center mb-5 pt-1">
          <h1 className="text-[17.5px] font-black text-white tracking-tight drop-shadow-sm">
            Riwayat Absensi Karyawan
          </h1>
          <span className="text-[11px] text-blue-200/80 font-medium block mt-0.5">
            Rekapitulasi Masuk &amp; Keluar &bull; {formattedUserName}
          </span>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2.5">
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[18px] p-2.5 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[9.5px] text-blue-100/90 font-extrabold uppercase tracking-wider">Hadir</span>
            </div>
            <span className="text-[20px] font-black text-white font-mono leading-none">{stats.hadir}</span>
            <span className="text-[9px] text-emerald-300 font-bold mt-1 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/20">Hari</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[18px] p-2.5 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[9.5px] text-blue-100/90 font-extrabold uppercase tracking-wider">Izin</span>
            </div>
            <span className="text-[20px] font-black text-white font-mono leading-none">{stats.izin}</span>
            <span className="text-[9px] text-amber-300 font-bold mt-1 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/20">Hari</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[18px] p-2.5 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span className="text-[9.5px] text-blue-100/90 font-extrabold uppercase tracking-wider">Sakit</span>
            </div>
            <span className="text-[20px] font-black text-white font-mono leading-none">{stats.sakit}</span>
            <span className="text-[9px] text-rose-300 font-bold mt-1 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-400/20">Hari</span>
          </div>
        </div>
      </header>

      <main className="w-full relative px-5">
        <div className="-mt-6 relative z-20 bg-white rounded-[26px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-100">
            <button
              onClick={prevMonth}
              className="w-8.5 h-8.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-navy-950 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
              aria-label="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={openPickerModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95 group"
            >
              <CalendarDays className="w-4 h-4 text-blue-600" />
              <span className="text-[14px] font-black text-navy-950 tracking-tight group-hover:text-blue-700 transition-colors">
                {MONTHS_ID[calMonth]} {calYear}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>
            <button
              onClick={nextMonth}
              className="w-8.5 h-8.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-navy-950 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
              aria-label="Bulan Selanjutnya"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {DAYS.map((d, idx) => (
              <div key={d} className={`text-center text-[10px] font-black py-1 ${idx === 0 ? 'text-rose-600 font-black' : 'text-slate-400'} uppercase tracking-wider`}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1.5 px-3 pb-4">
            {calCells.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const key = getKey(d);
              const rec = recordsByDate[key];
              const isSelected = selectedDate === d;
              const today = isToday(d);
              const future = isFuture(d);
              const dayIndex = (firstDay + d - 1) % 7;
              const isSunday = dayIndex === 0;
              const dotColor = rec?.clockIn ? 'bg-emerald-500' : '';

              return (
                <button
                  key={key}
                  disabled={future}
                  onClick={() => setSelectedDate(isSelected ? null : d)}
                  className={`flex flex-col items-center justify-center rounded-[14px] py-2 gap-0.5 transition-all duration-150 active:scale-90 ${isSelected
                    ? 'bg-navy-950 text-white scale-[1.08] shadow-md shadow-navy-950/20'
                    : today
                      ? 'bg-blue-50 text-navy-950 border border-blue-200 font-black'
                      : future
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className={`text-[12.5px] font-extrabold leading-none ${isSelected ? 'text-white' : today ? 'text-navy-950' : isSunday ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                    {d}
                  </span>
                  {dotColor && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor}`} />
                  )}
                  {!dotColor && !future && (
                    <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block">Log Absensi Bulan Ini</span>
            <span className="text-[10px] text-navy-950 font-black uppercase tracking-wider bg-navy-950/10 px-2.5 py-0.5 rounded-full">
              {monthKeys.length} Hari {MONTHS_ID[calMonth]}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {monthKeys.slice().reverse().map((key) => {
              const rec = recordsByDate[key];
              const d = parseInt(key.split('-')[2], 10);
              const dateObj = new Date(calYear, calMonth, d);
              const dayName = DAYS[dateObj.getDay()];
              const isSunday = dateObj.getDay() === 0;
              return (
                <div key={key} className="bg-white rounded-[20px] border border-slate-100 p-3.5 flex items-center gap-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
                  <div className="w-10.5 h-10.5 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <span className={`text-[14.5px] font-black leading-none ${isSunday ? 'text-rose-600' : ''}`}>{d}</span>
                    <span className={`text-[8.5px] font-extrabold uppercase mt-0.5 opacity-80 ${isSunday ? 'text-rose-600' : ''}`}>{dayName}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[13px] font-black text-emerald-700">Hadir</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-bold block mt-0.5">
                      {rec.in !== '-' ? `${rec.in} – ${rec.out !== '-' ? rec.out : 'Belum Keluar'}` : 'Belum Masuk'}
                    </span>
                    {rec.clockInLocationName ? (
                      <span className={`${locationLabelClass(rec.clockInLocationName)} mt-0.5`}>{rec.clockInLocationName}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {monthKeys.length === 0 && (
              <div className="bg-white rounded-[20px] border border-dashed border-slate-200 p-4 text-center text-[12px] text-slate-400 font-bold">
                Belum ada absensi di bulan ini.
              </div>
            )}
          </div>
        </div>
      </main>

      {showPickerModal && (
        <div
          onClick={() => setShowPickerModal(false)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-navy-950/60 backdrop-blur-sm p-4 animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] bg-white rounded-[28px] shadow-2xl p-5 border border-slate-100 flex flex-col gap-4 relative cursor-default"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <h3 className="text-[15px] font-black text-navy-950">Pilih Bulan &amp; Tahun</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tahun</span>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => setTempPickerYear(y)}
                    className={`py-2 rounded-xl text-[12.5px] font-black transition-all ${tempPickerYear === y
                      ? 'bg-navy-950 text-white shadow-md shadow-navy-950/20'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Bulan</span>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_ID.map((m, idx) => (
                  <button
                    key={m}
                    onClick={() => setTempPickerMonth(idx)}
                    className={`py-2.5 px-2 rounded-xl text-[12px] font-black transition-all text-center ${tempPickerMonth === idx
                      ? 'bg-navy-950 text-white shadow-md shadow-navy-950/20'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowPickerModal(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 text-[12.5px] font-extrabold hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button
                onClick={applyMonthYearPicker}
                className="flex-1 py-3 rounded-2xl bg-navy-950 text-white text-[12.5px] font-black shadow-md shadow-navy-950/20 hover:bg-navy-900 transition-all"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
