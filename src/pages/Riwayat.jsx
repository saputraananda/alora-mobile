import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  User, 
  Sparkles, 
  History as HistoryIcon, 
  CheckCircle2, 
  AlertCircle, 
  CalendarDays,
  X,
  Camera,
  CameraOff,
  Maximize2,
  CheckCircle
} from 'lucide-react';
import { formatName } from '../utils/FormatName.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Available years for Google Calendar style year picker
const AVAILABLE_YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

// Demo attendance selfie photos
const SAMPLE_FOTO_MASUK = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80';
const SAMPLE_FOTO_KELUAR = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80';

/**
 * Generate Realistic Attendance Data for a specific Month & Year
 * Includes cases where fotoMasuk / fotoKeluar or clock in/out are missing
 */
const generateAttendanceDataForMonth = (year, month) => {
  const data = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    if (d % 9 === 0) {
      // Periodic Izin
      data[key] = {
        date: key,
        day: d,
        label: 'Izin',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/20',
        dot: 'bg-amber-500',
        in: '-',
        out: '-',
        catatan: 'Ada urusan keluarga mendesak Pak/Bu, mohon izin tidak masuk dulu hari ini.'
      };
    } else if (d % 13 === 0) {
      // Periodic Sakit
      data[key] = {
        date: key,
        day: d,
        label: 'Sakit',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-400/20',
        dot: 'bg-rose-500',
        in: '-',
        out: '-',
        catatan: 'Sakit demam tinggi Pak/Bu, izin istirahat hari ini.'
      };
    } else {
      // Hadir / Masuk Kerja
      const hasMasuk = d % 7 !== 3; // Some days haven't clocked in yet
      const hasKeluar = d % 4 !== 0 && d % 2 === 0; // Some days haven't clocked out yet (Belum Keluar)

      const inTime = hasMasuk ? (d % 2 === 0 ? '07:55 WIB' : '08:02 WIB') : '-';
      const outTime = hasKeluar ? (d % 2 === 0 ? '17:04 WIB' : '17:15 WIB') : '-';

      data[key] = {
        date: key,
        day: d,
        label: 'Hadir',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20',
        dot: 'bg-emerald-500',
        in: inTime,
        out: outTime,
        fotoMasuk: hasMasuk ? SAMPLE_FOTO_MASUK : null,
        fotoKeluar: hasKeluar ? SAMPLE_FOTO_KELUAR : null
      };
    }
  }

  return data;
};

export default function Riwayat() {
  useDocumentTitle('Riwayat');
  const navigate = useNavigate();
  const now = new Date();

  const [userData, setUserData] = useState(null);
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

  // Photo Preview Modal State
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Month & Year Picker Modal State (Google Calendar style)
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [tempPickerMonth, setTempPickerMonth] = useState(now.getMonth());
  const [tempPickerYear, setTempPickerYear] = useState(now.getFullYear());

  // Load user data from localStorage
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

  // Lock scroll when picker modal or photo modal is open
  useEffect(() => {
    if (showPickerModal || previewPhoto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showPickerModal, previewPhoto]);

  const rawUserName = userData?.name || "";
  const formattedUserName = rawUserName ? formatName(rawUserName) : "Pengguna Alora";
  const employeeCode = userData?.employee_code || "";
  const jobLevel = userData?.job_level || "Karyawan";

  // Dynamic attendance data for chosen month & year
  const currentAttendanceData = generateAttendanceDataForMonth(calYear, calMonth);

  // Calendar cells calculation
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells = [];
  for (let i = 0; i < firstDay; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  const prevMonth = () => {
    if (calMonth === 0) { 
      setCalMonth(11); 
      setCalYear(y => y - 1); 
    } else { 
      setCalMonth(m => m - 1); 
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (calMonth === 11) { 
      setCalMonth(0); 
      setCalYear(y => y + 1); 
    } else { 
      setCalMonth(m => m + 1); 
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
  const selectedKey = selectedDate ? getKey(selectedDate) : null;
  const selectedRecord = selectedKey ? currentAttendanceData[selectedKey] : null;

  // Monthly stats summary (Hadir, Izin, Sakit)
  const monthKeys = Object.keys(currentAttendanceData);
  const stats = { hadir: 0, izin: 0, sakit: 0 };
  monthKeys.forEach(k => {
    const item = currentAttendanceData[k];
    if (item.label === 'Hadir') stats.hadir++;
    else if (item.label === 'Izin') stats.izin++;
    else if (item.label === 'Sakit') stats.sakit++;
  });

  const isToday = (d) => d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
  const isFuture = (d) => new Date(calYear, calMonth, d) > now;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">

      {/* ==========================================
          HERO HEADER - ALORA MOBILE NAVY BLUE THEME
          ========================================== */}
      <header className="relative pt-6 pb-12 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white">
        {/* BACKGROUND LAYER 1: Deep Navy Radial Gradient Backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />

        {/* BACKGROUND LAYER 2: Subtle Luxury Grain / Noise Overlay */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none z-10 mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />

        {/* BACKGROUND LAYER 3: Soft Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none z-0" />

        {/* TOP HEADER TITLE */}
        <div className="relative z-10 text-center mb-5 pt-1">
          <h1 className="text-[17.5px] font-black text-white tracking-tight drop-shadow-sm">
            Riwayat Absensi Karyawan
          </h1>
          <span className="text-[11px] text-blue-200/80 font-medium block mt-0.5">
            Rekapitulasi Masuk &amp; Keluar &bull; {formattedUserName}
          </span>
        </div>

        {/* MONTH STATS CARDS STRIP (3 CATEGORIES: HADIR, IZIN, SAKIT) */}
        <div className="relative z-10 grid grid-cols-3 gap-2.5">
          {/* Hadir */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[18px] p-2.5 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[9.5px] text-blue-100/90 font-extrabold uppercase tracking-wider">Hadir</span>
            </div>
            <span className="text-[20px] font-black text-white font-mono leading-none">{stats.hadir}</span>
            <span className="text-[9px] text-emerald-300 font-bold mt-1 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/20">Hari</span>
          </div>

          {/* Izin */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[18px] p-2.5 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[9.5px] text-blue-100/90 font-extrabold uppercase tracking-wider">Izin</span>
            </div>
            <span className="text-[20px] font-black text-white font-mono leading-none">{stats.izin}</span>
            <span className="text-[9px] text-amber-300 font-bold mt-1 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/20">Hari</span>
          </div>

          {/* Sakit */}
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

      {/* ===== MAIN CONTENT AREA ===== */}
      <main className="w-full relative px-5">

        {/* CALENDAR CARD */}
        <div className="-mt-6 relative z-20 bg-white rounded-[26px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">

          {/* Month & Year Navigation Header with Google Calendar Picker Trigger */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-100">
            <button 
              onClick={prevMonth} 
              className="w-8.5 h-8.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-navy-950 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
              aria-label="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>

            {/* Clickable Month & Year Header (Google Calendar Style Picker) */}
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

          {/* Day headers (Minggu Dimerahkan!) */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {DAYS.map((d, idx) => (
              <div key={d} className={`text-center text-[10px] font-black py-1 ${idx === 0 ? 'text-rose-600 font-black' : 'text-slate-400'} uppercase tracking-wider`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells (Minggu Dimerahkan tapi TETAP BISA MASUK!) */}
          <div className="grid grid-cols-7 gap-y-1.5 px-3 pb-4">
            {calCells.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const key = getKey(d);
              const rec = currentAttendanceData[key];
              const isSelected = selectedDate === d;
              const today = isToday(d);
              const future = isFuture(d);
              const dayIndex = (firstDay + d - 1) % 7;
              const isSunday = dayIndex === 0;

              let dotColor = '';
              if (rec?.label === 'Hadir') dotColor = 'bg-emerald-500';
              else if (rec?.label === 'Izin') dotColor = 'bg-amber-500';
              else if (rec?.label === 'Sakit') dotColor = 'bg-rose-500';

              return (
                <button
                  key={key}
                  disabled={future}
                  onClick={() => setSelectedDate(isSelected ? null : d)}
                  className={`flex flex-col items-center justify-center rounded-[14px] py-2 gap-0.5 transition-all duration-150 active:scale-90 ${
                    isSelected
                      ? 'bg-navy-950 text-white scale-[1.08] shadow-md shadow-navy-950/20'
                      : today
                        ? 'bg-blue-50 text-navy-950 border border-blue-200 font-black'
                        : future
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {/* Tanggal Minggu Dimerahkan! */}
                  <span className={`text-[12.5px] font-extrabold leading-none ${
                    isSelected ? 'text-white' : today ? 'text-navy-950' : isSunday ? 'text-rose-600 font-black' : 'text-slate-800'
                  }`}>
                    {d}
                  </span>
                  {dotColor && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor}`} />
                  )}
                  {!dotColor && !future && rec === undefined && (
                    <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SELECTED DATE DETAIL CARD (DENGAN KONDISI BELUM ADA FOTO / BELUM KELUAR) */}
        {selectedDate && (
          <div className="mt-3.5 relative z-10 animate-fade-in">
            {selectedRecord ? (
              <div className="bg-white rounded-[26px] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 flex flex-col gap-4">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">DETAIL ABSENSI</span>
                    <h3 className="text-[15px] font-black text-navy-950 mt-0.5">{selectedDate} {MONTHS_ID[calMonth]} {calYear}</h3>
                  </div>
                  <span className={`px-3.5 py-1 rounded-full text-[11px] font-black border shadow-sm flex items-center gap-1.5 ${selectedRecord.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedRecord.dot}`} />
                    {selectedRecord.label}
                  </span>
                </div>

                {selectedRecord.label === 'Hadir' && (
                  <div className="flex flex-col gap-4">
                    {/* Time Info Row (Jam Masuk & Jam Keluar Kondisional) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-[18px] p-3.5 text-center border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">JAM MASUK</span>
                        {selectedRecord.in && selectedRecord.in !== '-' ? (
                          <span className="text-[15px] font-black text-emerald-600 font-mono mt-0.5 block">{selectedRecord.in}</span>
                        ) : (
                          <span className="text-[12px] font-bold text-slate-400 mt-0.5 block">Belum Masuk</span>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-[18px] p-3.5 text-center border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">JAM KELUAR</span>
                        {selectedRecord.out && selectedRecord.out !== '-' ? (
                          <span className="text-[15px] font-black text-blue-600 font-mono mt-0.5 block">{selectedRecord.out}</span>
                        ) : (
                          <span className="text-[12px] font-bold text-slate-400 mt-0.5 block">Belum Keluar</span>
                        )}
                      </div>
                    </div>

                    {/* Presensi Photos Section (Kondisional: Ada Foto vs Belum Ada Foto) */}
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-navy-950" />
                          <span className="text-[11px] font-extrabold text-navy-950 uppercase tracking-wider">
                            DOKUMENTASI
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Foto Masuk Card */}
                        {selectedRecord.fotoMasuk ? (
                          <div 
                            onClick={() => setPreviewPhoto({
                              url: selectedRecord.fotoMasuk,
                              title: 'Foto Presensi Masuk',
                              time: selectedRecord.in,
                              date: `${selectedDate} ${MONTHS_ID[calMonth]} ${calYear}`
                            })}
                            className="flex flex-col gap-1.5 cursor-pointer group"
                          >
                            <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm relative transition duration-200 group-hover:border-emerald-300 group-hover:shadow-md">
                              <img 
                                src={selectedRecord.fotoMasuk} 
                                alt="Foto Masuk" 
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              />
                              <div className="absolute inset-0 bg-navy-950/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white backdrop-blur-[2px]">
                                <Maximize2 className="w-5 h-5 text-white drop-shadow-md" />
                              </div>
                              <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-lg bg-navy-950/80 backdrop-blur-md text-[9.5px] font-extrabold text-white font-mono shadow-sm">
                                {selectedRecord.in}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-center text-emerald-700 flex items-center justify-center gap-1 group-hover:text-emerald-800 transition">
                              Foto Masuk
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <div className="aspect-[4/3] rounded-[20px] bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-3 text-center gap-1">
                              <CameraOff className="w-5 h-5 text-slate-300" />
                              <span className="text-[10px] font-bold text-slate-400 leading-tight">
                                Belum ada Foto Masuk
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-center text-slate-400">
                              Foto Masuk
                            </span>
                          </div>
                        )}

                        {/* Foto Keluar Card */}
                        {selectedRecord.fotoKeluar ? (
                          <div 
                            onClick={() => setPreviewPhoto({
                              url: selectedRecord.fotoKeluar,
                              title: 'Foto Presensi Keluar',
                              time: selectedRecord.out,
                              date: `${selectedDate} ${MONTHS_ID[calMonth]} ${calYear}`
                            })}
                            className="flex flex-col gap-1.5 cursor-pointer group"
                          >
                            <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm relative transition duration-200 group-hover:border-blue-300 group-hover:shadow-md">
                              <img 
                                src={selectedRecord.fotoKeluar} 
                                alt="Foto Keluar" 
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              />
                              <div className="absolute inset-0 bg-navy-950/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white backdrop-blur-[2px]">
                                <Maximize2 className="w-5 h-5 text-white drop-shadow-md" />
                              </div>
                              <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-lg bg-navy-950/80 backdrop-blur-md text-[9.5px] font-extrabold text-white font-mono shadow-sm">
                                {selectedRecord.out}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-center text-blue-700 flex items-center justify-center gap-1 group-hover:text-blue-800 transition">
                              Foto Keluar
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <div className="aspect-[4/3] rounded-[20px] bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-3 text-center gap-1">
                              <CameraOff className="w-5 h-5 text-slate-300" />
                              <span className="text-[10px] font-bold text-slate-400 leading-tight">
                                Belum ada Foto Keluar
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-center text-slate-400">
                              Foto Keluar
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedRecord.label !== 'Hadir' && (
                  <div className="bg-slate-50 rounded-[18px] p-4 text-center mt-1 border border-slate-100 flex flex-col items-center justify-center gap-2">
                    <span className="text-[13px] font-bold text-slate-700">
                      Tidak masuk kerja ({selectedRecord.label})
                    </span>
                    {(selectedRecord.catatan || selectedRecord.notes || selectedRecord.reason) && (
                      <div className="w-full pt-2.5 border-t border-slate-200/70 text-left px-1">
                        <span className="text-[11.5px] font-medium text-slate-600 leading-relaxed block">
                          <strong className="font-extrabold text-navy-950">Catatan : </strong>
                          {selectedRecord.catatan || selectedRecord.notes || selectedRecord.reason}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[22px] border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.03)] p-4 text-center">
                <span className="text-[12px] text-slate-400 font-bold">Tidak ada data absensi untuk tanggal ini.</span>
              </div>
            )}
          </div>
        )}

        {/* RECENT HISTORY LIST FOR CHOSEN MONTH & YEAR */}
        <div className="mt-5">
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block">Log Absensi Bulan Ini</span>
            <span className="text-[10px] text-navy-950 font-black uppercase tracking-wider bg-navy-950/10 px-2.5 py-0.5 rounded-full">
              {monthKeys.length} Hari {MONTHS_ID[calMonth]}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {monthKeys.slice().reverse().map(key => {
              const rec = currentAttendanceData[key];
              const d = parseInt(key.split('-')[2]);
              const dateObj = new Date(calYear, calMonth, d);
              const dayName = DAYS[dateObj.getDay()];
              const isSunday = dateObj.getDay() === 0;
              return (
                <div key={key} className="bg-white rounded-[20px] border border-slate-100 p-3.5 flex items-center gap-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
                  {/* Date badge */}
                  <div className={`w-10.5 h-10.5 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${
                    rec.label === 'Hadir' 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : rec.label === 'Izin' 
                        ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                        : 'bg-rose-50 text-rose-600 border border-rose-100'
                  }`}>
                    <span className={`text-[14.5px] font-black leading-none ${isSunday ? 'text-rose-600' : ''}`}>{d}</span>
                    <span className={`text-[8.5px] font-extrabold uppercase mt-0.5 opacity-80 ${isSunday ? 'text-rose-600' : ''}`}>{dayName}</span>
                  </div>

                  {/* Detail */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${rec.dot}`} />
                      <span className={`text-[13px] font-black ${
                        rec.label === 'Hadir' 
                          ? 'text-emerald-700' 
                          : rec.label === 'Izin' 
                            ? 'text-amber-700' 
                            : 'text-rose-600'
                      }`}>
                        {rec.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-bold block mt-0.5">
                      {rec.label === 'Hadir' 
                        ? (rec.in !== '-' ? `${rec.in} – ${rec.out !== '-' ? rec.out : 'Belum Keluar'}` : 'Belum Masuk') 
                        : 'Tidak Hadir'}
                    </span>
                  </div>

                  {rec.label === 'Hadir' && (
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10.5px] text-slate-400 font-mono font-bold">Terverifikasi</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* ==========================================
          FULL PHOTO PREVIEW MODAL
          ========================================== */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 animate-fade-in cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] bg-white rounded-[28px] shadow-2xl p-5 border border-slate-100 flex flex-col gap-4 relative cursor-default"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-[14px] font-black text-navy-950 leading-tight">{previewPhoto.title}</h3>
                  <span className="text-[10.5px] text-slate-400 font-medium block mt-0.5">{previewPhoto.date} &bull; {previewPhoto.time}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Photo Container */}
            <div className="w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-slate-100 border border-slate-200 shadow-inner relative">
              <img 
                src={previewPhoto.url} 
                alt={previewPhoto.title} 
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 px-3 py-1 rounded-xl bg-navy-950/80 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1.5 shadow-md">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Terverifikasi GPS</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="w-full py-3 rounded-[16px] bg-navy-950 text-white text-xs font-bold hover:bg-navy-900 shadow-md transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          GOOGLE CALENDAR STYLE MONTH & YEAR PICKER MODAL
          ========================================== */}
      {showPickerModal && (
        <div 
          onClick={() => setShowPickerModal(false)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-navy-950/60 backdrop-blur-sm p-4 animate-fade-in cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] bg-white rounded-[28px] shadow-2xl p-5 border border-slate-100 flex flex-col gap-4 relative cursor-default"
          >
            
            {/* Modal Header */}
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

            {/* Year Select Pills */}
            <div>
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Tahun</span>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_YEARS.map(y => (
                  <button
                    key={y}
                    onClick={() => setTempPickerYear(y)}
                    className={`py-2 rounded-xl text-[12.5px] font-black transition-all ${
                      tempPickerYear === y
                        ? 'bg-navy-950 text-white shadow-md shadow-navy-950/20'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Month Select Grid */}
            <div>
              <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Bulan</span>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_ID.map((m, idx) => (
                  <button
                    key={m}
                    onClick={() => setTempPickerMonth(idx)}
                    className={`py-2.5 px-2 rounded-xl text-[12px] font-black transition-all text-center ${
                      tempPickerMonth === idx
                        ? 'bg-navy-950 text-white shadow-md shadow-navy-950/20'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
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