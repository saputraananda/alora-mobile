import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Camera,
  CameraOff,
  CheckCircle
} from 'lucide-react';
import { formatName } from '../utils/FormatName.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import MobileCameraCapture from '../components/MobileCameraCapture.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import {
  INSIDE_LOCATION_LABEL,
  OUTSIDE_LOCATION_LABEL,
  DEFAULT_ABSEN_RADIUS_KM,
  resolveAttendanceLocationLabel,
} from '../utils/attendanceLocation.js';
import { fetchAttendancePhotoBlob } from '../utils/attendancePhoto.js';

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

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const AVAILABLE_YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

function toDateKey(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function formatClock(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
}

function mapItemToRecord(item) {
  const key = toDateKey(item.attendance_date);
  const inTime = formatClock(item.clock_in);
  const outTime = formatClock(item.clock_out);
  return {
    date: key,
    day: Number(key.split('-')[2] || 0),
    label: 'Hadir',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
    in: inTime || '-',
    out: outTime || '-',
    fotoMasukPath: item.foto_masuk_path || null,
    fotoKeluarPath: item.foto_keluar_path || null,
    clockIn: item.clock_in || null,
    clockOut: item.clock_out || null,
    clockInLocationName: item.clock_in_location_name || null,
    clockOutLocationName: item.clock_out_location_name || null,
  };
}

function locationLabelClass(label) {
  if (label === INSIDE_LOCATION_LABEL) return 'text-[11px] text-emerald-700 font-bold mt-1 block';
  if (label === OUTSIDE_LOCATION_LABEL) return 'text-[11px] text-amber-700 font-bold mt-1 block';
  return 'text-[11px] text-slate-400 mt-1 block';
}

async function fetchPhotoBlob(filePath) {
  return fetchAttendancePhotoBlob(api, filePath);
}

export default function Riwayat() {
  useDocumentTitle('Riwayat');
  const now = new Date();

  const [userData, setUserData] = useState(null);
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(now.getDate());
  const [recordsByDate, setRecordsByDate] = useState({});
  const [photoBlobs, setPhotoBlobs] = useState({ masuk: null, keluar: null });
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [absenOffice, setAbsenOffice] = useState(null);
  const [liveLocationLabel, setLiveLocationLabel] = useState('');
  const [cameraTarget, setCameraTarget] = useState(null);
  const [pendingInFile, setPendingInFile] = useState(null);
  const [pendingOutFile, setPendingOutFile] = useState(null);
  const [pendingInMeta, setPendingInMeta] = useState(null);
  const [pendingOutMeta, setPendingOutMeta] = useState(null);
  const [pendingInPreviewUrl, setPendingInPreviewUrl] = useState('');
  const [pendingOutPreviewUrl, setPendingOutPreviewUrl] = useState('');
  const [photoAction, setPhotoAction] = useState(null);
  const [pendingReplaceInFile, setPendingReplaceInFile] = useState(null);
  const [pendingReplaceOutFile, setPendingReplaceOutFile] = useState(null);
  const [pendingReplaceInPreviewUrl, setPendingReplaceInPreviewUrl] = useState('');
  const [pendingReplaceOutPreviewUrl, setPendingReplaceOutPreviewUrl] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [photoManageLoading, setPhotoManageLoading] = useState(false);
  const [photoManageError, setPhotoManageError] = useState('');
  const pendingInPreviewUrlRef = useRef('');
  const pendingOutPreviewUrlRef = useRef('');

  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [tempPickerMonth, setTempPickerMonth] = useState(now.getMonth());
  const [tempPickerYear, setTempPickerYear] = useState(now.getFullYear());
  const [todayLeave, setTodayLeave] = useState(null);

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
    const loadOffice = async () => {
      try {
        const { data } = await api.get('/attendance/location');
        if (
          data &&
          Number.isFinite(Number(data.latitude)) &&
          Number.isFinite(Number(data.longitude))
        ) {
          setAbsenOffice({
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            radius_km: Number(data.radius_km) || DEFAULT_ABSEN_RADIUS_KM,
          });
        } else {
          setAbsenOffice(null);
        }
      } catch {
        setAbsenOffice(null);
      }
    };
    loadOffice();
  }, []);

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
    const loadTodayLeave = async () => {
      try {
        const { data } = await api.get('/leave/today');
        setTodayLeave(data?.leave || null);
      } catch {
        setTodayLeave(null);
      }
    };
    loadTodayLeave();
  }, []);

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
  const selectedKey = selectedDate ? getKey(selectedDate) : null;
  const selectedRecord = selectedKey ? recordsByDate[selectedKey] : null;

  const monthKeys = Object.keys(recordsByDate).filter((k) => recordsByDate[k]?.clockIn).sort();
  const stats = { hadir: monthKeys.length, izin: 0, sakit: 0 };

  const isToday = (d) => d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
  const isFuture = (d) => new Date(calYear, calMonth, d) > now;
  const selectedIsToday = selectedDate ? isToday(selectedDate) : false;

  useEffect(() => {
    let revoked = false;
    let masukUrl = null;
    let keluarUrl = null;

    const load = async () => {
      try {
        if (selectedRecord?.fotoMasukPath) {
          masukUrl = await fetchPhotoBlob(selectedRecord.fotoMasukPath);
        }
        if (selectedRecord?.fotoKeluarPath) {
          keluarUrl = await fetchPhotoBlob(selectedRecord.fotoKeluarPath);
        }
        if (!revoked) setPhotoBlobs({ masuk: masukUrl, keluar: keluarUrl });
        else {
          if (masukUrl) URL.revokeObjectURL(masukUrl);
          if (keluarUrl) URL.revokeObjectURL(keluarUrl);
        }
      } catch {
        if (!revoked) setPhotoBlobs({ masuk: null, keluar: null });
      }
    };

    setPhotoBlobs({ masuk: null, keluar: null });
    load();
    return () => {
      revoked = true;
      if (masukUrl) URL.revokeObjectURL(masukUrl);
      if (keluarUrl) URL.revokeObjectURL(keluarUrl);
    };
  }, [selectedRecord?.fotoMasukPath, selectedRecord?.fotoKeluarPath]);

  const resolveLocationLabel = useCallback(
    (lat, lng) => {
      if (!absenOffice) return null;
      return resolveAttendanceLocationLabel(
        lat,
        lng,
        absenOffice.latitude,
        absenOffice.longitude,
        absenOffice.radius_km ?? DEFAULT_ABSEN_RADIUS_KM
      );
    },
    [absenOffice]
  );

  const clearPendingIn = () => {
    setPendingInFile(null);
    setPendingInMeta(null);
    setPendingInPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setLiveLocationLabel('');
  };

  const clearPendingOut = () => {
    setPendingOutFile(null);
    setPendingOutMeta(null);
    setPendingOutPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setLiveLocationLabel('');
  };

  useEffect(() => {
    pendingInPreviewUrlRef.current = pendingInPreviewUrl;
  }, [pendingInPreviewUrl]);

  useEffect(() => {
    pendingOutPreviewUrlRef.current = pendingOutPreviewUrl;
  }, [pendingOutPreviewUrl]);

  useEffect(() => {
    return () => {
      if (pendingInPreviewUrlRef.current) URL.revokeObjectURL(pendingInPreviewUrlRef.current);
      if (pendingOutPreviewUrlRef.current) URL.revokeObjectURL(pendingOutPreviewUrlRef.current);
    };
  }, []);

  const submitPunch = async (action) => {
    const file = action === 'in' ? pendingInFile : pendingOutFile;
    const meta = action === 'in' ? pendingInMeta : pendingOutMeta;
    if (!file || meta?.latitude == null || meta?.longitude == null) {
      setActionError('Ambil foto dari kamera terlebih dahulu.');
      return;
    }

    const formData = new FormData();
    formData.append(action === 'in' ? 'foto_masuk' : 'foto_keluar', file);
    formData.append('latitude', String(meta.latitude));
    formData.append('longitude', String(meta.longitude));

    setActionLoading(true);
    setActionError('');
    try {
      if (action === 'in') {
        await api.post('/attendance/check-in', formData);
        clearPendingIn();
      } else {
        await api.post('/attendance/check-out', formData);
        clearPendingOut();
      }
      await fetchMonth();
      setLiveLocationLabel('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Gagal mengirim absensi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCameraCapture = (file, meta) => {
    const key = cameraTarget?.key;
    setCameraTarget(null);
    if (key === 'check_out_photo') {
      setPendingOutFile(file || null);
      setPendingOutMeta(meta || null);
      setPendingOutPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return file ? URL.createObjectURL(file) : '';
      });
      setLiveLocationLabel(meta?.locationName || '');
      return;
    }
    if (key === 'check_in_photo') {
      setPendingInFile(file || null);
      setPendingInMeta(meta || null);
      setPendingInPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return file ? URL.createObjectURL(file) : '';
      });
      setLiveLocationLabel(meta?.locationName || '');
    }
  };

  const clearReplaceIn = () => {
    setPendingReplaceInFile(null);
    setPendingReplaceInPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  };

  const clearReplaceOut = () => {
    setPendingReplaceOutFile(null);
    setPendingReplaceOutPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  };

  const handleReplaceCapture = (file) => {
    const side = photoAction;
    setPhotoAction(null);
    if (side === 'out') {
      setPendingReplaceOutFile(file || null);
      setPendingReplaceOutPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return file ? URL.createObjectURL(file) : '';
      });
      return;
    }
    if (side === 'in') {
      setPendingReplaceInFile(file || null);
      setPendingReplaceInPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return file ? URL.createObjectURL(file) : '';
      });
    }
  };

  const submitReplacePhoto = async (side) => {
    const file = side === 'in' ? pendingReplaceInFile : pendingReplaceOutFile;
    if (!file) {
      setPhotoManageError('Ambil foto dari kamera terlebih dahulu.');
      return;
    }
    const formData = new FormData();
    formData.append(side === 'in' ? 'foto_masuk' : 'foto_keluar', file);
    setPhotoManageLoading(true);
    setPhotoManageError('');
    try {
      await api.put(side === 'in' ? '/attendance/photo-in' : '/attendance/photo-out', formData);
      if (side === 'in') clearReplaceIn();
      else clearReplaceOut();
      await fetchMonth();
    } catch (err) {
      setPhotoManageError(err.response?.data?.message || 'Gagal menyimpan foto.');
    } finally {
      setPhotoManageLoading(false);
    }
  };

  const confirmDeletePhoto = async () => {
    const side = confirmDelete;
    if (!side) return;
    setPhotoManageLoading(true);
    setPhotoManageError('');
    try {
      await api.delete(side === 'in' ? '/attendance/photo-in' : '/attendance/photo-out');
      setConfirmDelete(null);
      if (side === 'in') clearReplaceIn();
      else clearReplaceOut();
      await fetchMonth();
    } catch (err) {
      setPhotoManageError(err.response?.data?.message || 'Gagal menghapus foto.');
    } finally {
      setPhotoManageLoading(false);
    }
  };

  const isLockedByLeave = Boolean(todayLeave && todayLeave.duration_type === 'full_day');
  const canCheckIn = selectedIsToday && !selectedRecord?.clockIn && !isLockedByLeave;
  const canCheckOut = selectedIsToday && selectedRecord?.clockIn && !selectedRecord?.clockOut && !isLockedByLeave;

  const masukLocationText = selectedRecord?.clockIn
    ? (selectedRecord.clockInLocationName || 'Lokasi belum tercatat')
    : (selectedIsToday && liveLocationLabel ? liveLocationLabel : '');
  const keluarLocationText = selectedRecord?.clockOut
    ? (selectedRecord.clockOutLocationName || 'Lokasi belum tercatat')
    : (selectedIsToday && selectedRecord?.clockIn && liveLocationLabel ? liveLocationLabel : '');

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

        {selectedDate && (
          <div className="mt-3.5 relative z-10 animate-fade-in">
            {(selectedRecord || selectedIsToday) ? (
              <div className="bg-white rounded-[26px] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">DETAIL ABSENSI</span>
                    <h3 className="text-[15px] font-black text-navy-950 mt-0.5">{selectedDate} {MONTHS_ID[calMonth]} {calYear}</h3>
                  </div>
                  <span className={`px-3.5 py-1 rounded-full text-[11px] font-black border shadow-sm flex items-center gap-1.5 ${selectedRecord?.clockIn ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedRecord?.clockIn ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {selectedRecord?.clockOut ? 'Hadir' : selectedRecord?.clockIn ? 'Hadir' : 'Belum Masuk'}
                  </span>
                </div>

                {selectedIsToday && isLockedByLeave && (
                  <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-800">
                    <span className="font-bold">Absensi terkunci.</span>{' '}
                    Ada cuti/izin seharian penuh yang sudah disetujui untuk hari ini
                    {todayLeave?.leave_type ? ` (${todayLeave.leave_type})` : ''}.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-[18px] p-3.5 text-center border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">JAM MASUK</span>
                    {selectedRecord?.clockIn ? (
                      <span className="text-[15px] font-black text-emerald-600 font-mono mt-0.5 block">{selectedRecord.in}</span>
                    ) : (
                      <span className="text-[12px] font-bold text-slate-400 mt-0.5 block">Belum Masuk</span>
                    )}
                    {masukLocationText ? (
                      <span className={locationLabelClass(masukLocationText)}>{masukLocationText}</span>
                    ) : null}
                  </div>
                  <div className="bg-slate-50 rounded-[18px] p-3.5 text-center border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">JAM KELUAR</span>
                    {selectedRecord?.clockOut ? (
                      <span className="text-[15px] font-black text-blue-600 font-mono mt-0.5 block">{selectedRecord.out}</span>
                    ) : (
                      <span className="text-[12px] font-bold text-slate-400 mt-0.5 block">Belum Keluar</span>
                    )}
                    {keluarLocationText ? (
                      <span className={locationLabelClass(keluarLocationText)}>{keluarLocationText}</span>
                    ) : null}
                  </div>
                </div>

                {selectedIsToday && (
                  <div className="flex flex-col gap-2">
                    {canCheckIn && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setCameraTarget({ key: 'check_in_photo', label: 'Foto Masuk' })}
                          className="w-full py-3 rounded-[16px] border-2 border-dashed border-slate-300 text-navy-950 text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                          <Camera className="w-4 h-4" />
                          {pendingInFile ? 'Ambil Ulang' : 'Ambil Foto Masuk'}
                        </button>
                        {pendingInPreviewUrl ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={clearPendingIn}
                              className="absolute right-2 top-2 z-[1] inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white"
                              aria-label="Hapus foto masuk"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <img src={pendingInPreviewUrl} alt="Preview masuk" className="h-40 w-full object-cover rounded-[16px]" />
                          </div>
                        ) : null}
                        <button
                          type="button"
                          disabled={!pendingInFile || actionLoading}
                          onClick={() => submitPunch('in')}
                          className="w-full py-3 rounded-[16px] bg-navy-950 text-white text-[13px] font-black disabled:opacity-60"
                        >
                          {actionLoading ? 'Mengirim…' : 'Simpan Absen Masuk'}
                        </button>
                      </>
                    )}
                    {canCheckOut && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setCameraTarget({ key: 'check_out_photo', label: 'Foto Keluar' })}
                          className="w-full py-3 rounded-[16px] border-2 border-dashed border-slate-300 text-navy-950 text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                          <Camera className="w-4 h-4" />
                          {pendingOutFile ? 'Ambil Ulang' : 'Ambil Foto Keluar'}
                        </button>
                        {pendingOutPreviewUrl ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={clearPendingOut}
                              className="absolute right-2 top-2 z-[1] inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white"
                              aria-label="Hapus foto keluar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <img src={pendingOutPreviewUrl} alt="Preview keluar" className="h-40 w-full object-cover rounded-[16px]" />
                          </div>
                        ) : null}
                        <button
                          type="button"
                          disabled={!pendingOutFile || actionLoading}
                          onClick={() => submitPunch('out')}
                          className="w-full py-3 rounded-[16px] bg-navy-950 text-white text-[13px] font-black disabled:opacity-60"
                        >
                          {actionLoading ? 'Mengirim…' : 'Simpan Absen Keluar'}
                        </button>
                      </>
                    )}
                    {actionError && (
                      <p className="text-[12px] font-bold text-red-600 text-center">{actionError}</p>
                    )}
                    <p className="text-[10px] text-slate-400 text-center font-medium">
                      Foto + GPS wajib · dalam 2 km: HO Alora · di luar: Lokasi diluar jangkauan
                    </p>
                    <p className="text-[10px] text-slate-400 text-center font-medium">
                      Ambil dari kamera, bukan dari galeri.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-navy-950" />
                    <span className="text-[11px] font-extrabold text-navy-950 uppercase tracking-wider">
                      DOKUMENTASI
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {photoBlobs.masuk ? (
                      <div
                        onClick={() => setPreviewPhoto({
                          url: photoBlobs.masuk,
                          title: 'Foto Presensi Masuk',
                          time: selectedRecord?.in,
                          date: `${selectedDate} ${MONTHS_ID[calMonth]} ${calYear}`
                        })}
                        className="flex flex-col gap-1.5 cursor-pointer group"
                      >
                        <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm">
                          <img src={photoBlobs.masuk} alt="Foto Masuk" className="w-full h-full object-cover" />
                          <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-lg bg-navy-950/80 text-[9.5px] font-extrabold text-white font-mono">
                            {selectedRecord?.in}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-center text-emerald-700">Foto Masuk</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <div className="aspect-[4/3] rounded-[20px] bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-3 text-center gap-1">
                          <CameraOff className="w-5 h-5 text-slate-300" />
                          <span className="text-[10px] font-bold text-slate-400">Belum ada Foto Masuk</span>
                        </div>
                        <span className="text-[11px] font-bold text-center text-slate-400">Foto Masuk</span>
                      </div>
                    )}
                    {photoBlobs.keluar ? (
                      <div
                        onClick={() => setPreviewPhoto({
                          url: photoBlobs.keluar,
                          title: 'Foto Presensi Keluar',
                          time: selectedRecord?.out,
                          date: `${selectedDate} ${MONTHS_ID[calMonth]} ${calYear}`
                        })}
                        className="flex flex-col gap-1.5 cursor-pointer group"
                      >
                        <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm">
                          <img src={photoBlobs.keluar} alt="Foto Keluar" className="w-full h-full object-cover" />
                          <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-lg bg-navy-950/80 text-[9.5px] font-extrabold text-white font-mono">
                            {selectedRecord?.out}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-center text-blue-700">Foto Keluar</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <div className="aspect-[4/3] rounded-[20px] bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-3 text-center gap-1">
                          <CameraOff className="w-5 h-5 text-slate-300" />
                          <span className="text-[10px] font-bold text-slate-400">Belum ada Foto Keluar</span>
                        </div>
                        <span className="text-[11px] font-bold text-center text-slate-400">Foto Keluar</span>
                      </div>
                    )}
                  </div>
                  {selectedIsToday && (selectedRecord?.clockIn || selectedRecord?.clockOut) ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        {selectedRecord?.clockIn && selectedRecord?.fotoMasukPath ? (
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              disabled={photoManageLoading}
                              onClick={() => setPhotoAction('in')}
                              className="text-[12px] font-bold text-navy-950"
                            >
                              Ambil ulang
                            </button>
                            <button
                              type="button"
                              disabled={photoManageLoading}
                              onClick={() => setConfirmDelete('in')}
                              className="text-[12px] font-bold text-rose-600"
                            >
                              Hapus
                            </button>
                          </div>
                        ) : null}
                        {selectedRecord?.clockIn && !selectedRecord?.fotoMasukPath ? (
                          <button
                            type="button"
                            disabled={photoManageLoading}
                            onClick={() => setPhotoAction('in')}
                            className="text-[12px] font-bold text-navy-950"
                          >
                            Ambil foto masuk
                          </button>
                        ) : null}
                        {pendingReplaceInPreviewUrl ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={clearReplaceIn}
                              className="absolute right-2 top-2 z-[1] inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white"
                              aria-label="Hapus preview foto masuk"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <img src={pendingReplaceInPreviewUrl} alt="Preview ganti masuk" className="h-40 w-full object-cover rounded-[16px]" />
                          </div>
                        ) : null}
                        {pendingReplaceInFile ? (
                          <button
                            type="button"
                            disabled={photoManageLoading}
                            onClick={() => submitReplacePhoto('in')}
                            className="w-full py-2 rounded-[12px] bg-navy-950 text-white text-[12px] font-bold disabled:opacity-60"
                          >
                            {photoManageLoading ? 'Mengirim…' : 'Simpan foto'}
                          </button>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {selectedRecord?.clockOut && selectedRecord?.fotoKeluarPath ? (
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              disabled={photoManageLoading}
                              onClick={() => setPhotoAction('out')}
                              className="text-[12px] font-bold text-navy-950"
                            >
                              Ambil ulang
                            </button>
                            <button
                              type="button"
                              disabled={photoManageLoading}
                              onClick={() => setConfirmDelete('out')}
                              className="text-[12px] font-bold text-rose-600"
                            >
                              Hapus
                            </button>
                          </div>
                        ) : null}
                        {selectedRecord?.clockOut && !selectedRecord?.fotoKeluarPath ? (
                          <button
                            type="button"
                            disabled={photoManageLoading}
                            onClick={() => setPhotoAction('out')}
                            className="text-[12px] font-bold text-navy-950"
                          >
                            Ambil foto keluar
                          </button>
                        ) : null}
                        {pendingReplaceOutPreviewUrl ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={clearReplaceOut}
                              className="absolute right-2 top-2 z-[1] inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white"
                              aria-label="Hapus preview foto keluar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <img src={pendingReplaceOutPreviewUrl} alt="Preview ganti keluar" className="h-40 w-full object-cover rounded-[16px]" />
                          </div>
                        ) : null}
                        {pendingReplaceOutFile ? (
                          <button
                            type="button"
                            disabled={photoManageLoading}
                            onClick={() => submitReplacePhoto('out')}
                            className="w-full py-2 rounded-[12px] bg-navy-950 text-white text-[12px] font-bold disabled:opacity-60"
                          >
                            {photoManageLoading ? 'Mengirim…' : 'Simpan foto'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {photoManageError ? (
                    <p className="text-[12px] font-bold text-red-600 text-center">{photoManageError}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[22px] border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.03)] p-4 text-center">
                <span className="text-[12px] text-slate-400 font-bold">Tidak ada data absensi untuk tanggal ini.</span>
              </div>
            )}
          </div>
        )}

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

      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] bg-white rounded-[28px] shadow-2xl p-5 border border-slate-100 flex flex-col gap-4 relative cursor-default"
          >
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
            <div className="w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-slate-100 border border-slate-200 shadow-inner relative">
              <img src={previewPhoto.url} alt={previewPhoto.title} className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 px-3 py-1 rounded-xl bg-navy-950/80 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1.5 shadow-md">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Terverifikasi GPS</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="w-full py-3 rounded-[16px] bg-navy-950 text-white text-xs font-bold hover:bg-navy-900 shadow-md transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

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

      <MobileCameraCapture
        open={Boolean(cameraTarget) || Boolean(photoAction)}
        title={
          photoAction === 'in'
            ? 'Ambil Foto Masuk'
            : photoAction === 'out'
              ? 'Ambil Foto Keluar'
              : cameraTarget
                ? `Ambil ${cameraTarget.label}`
                : 'Ambil Foto'
        }
        initialFacingMode="user"
        confirmLabel="Ambil Foto"
        includeLocation
        locationDisplayMode="label"
        resolveLocationLabel={resolveLocationLabel}
        onClose={() => {
          setCameraTarget(null);
          setPhotoAction(null);
        }}
        onCapture={(file, meta) => {
          if (photoAction) {
            handleReplaceCapture(file);
            return;
          }
          handleCameraCapture(file, meta);
        }}
      />

      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeletePhoto}
        title={confirmDelete === 'out' ? 'Hapus foto keluar?' : 'Hapus foto masuk?'}
        message="Jam absensi tetap tersimpan. File foto akan dihapus dari server."
        confirmText="Hapus"
        cancelText="Batal"
      />
    </div>
  );
}
