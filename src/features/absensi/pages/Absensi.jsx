import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Camera,
  CameraOff,
  CheckCircle,
  History,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { formatName } from '../../../utils/FormatName.js';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import MobileCameraCapture from '../../../components/MobileCameraCapture.jsx';
import ConfirmModal from '../../../components/ConfirmModal.jsx';
import LateCheckInModal from '../components/LateCheckInModal.jsx';
import SessionTodoModal from '../components/SessionTodoModal.jsx';
import AttendanceIntentModal from '../components/AttendanceIntentModal.jsx';
import AttendanceModeRequestPanel from '../components/AttendanceModeRequestPanel.jsx';
import {
  DEFAULT_ABSEN_RADIUS_KM,
  resolveAttendanceLocationLabel,
} from '../../../utils/attendanceLocation.js';
import { fetchAttendancePhotoBlob } from '../../../utils/attendancePhoto.js';
import {
  MONTHS_ID,
  mapItemToRecord,
  locationLabelClass,
} from '../../../utils/attendanceDisplay.js';
import { getAuthToken, getAuthUser } from '../../../utils/authSession.js';
import PageHeaderRefreshButton from '../../../components/PageHeaderRefreshButton.jsx';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function fetchPhotoBlob(filePath) {
  return fetchAttendancePhotoBlob(api, filePath);
}

export default function Absensi() {
  useDocumentTitle('Absensi');
  const navigate = useNavigate();
  const now = new Date();

  const [userData, setUserData] = useState(null);
  const calMonth = now.getMonth();
  const calYear = now.getFullYear();
  const selectedDate = now.getDate();
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
  const [todayLeave, setTodayLeave] = useState(null);
  const [dayContext, setDayContext] = useState(null);
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateModalError, setLateModalError] = useState('');
  const [sessionTodoTarget, setSessionTodoTarget] = useState(null);
  const [intentModalOpen, setIntentModalOpen] = useState(false);
  const [punchContext, setPunchContext] = useState(null);
  const [intentError, setIntentError] = useState('');
  const [pendingLateFields, setPendingLateFields] = useState(null);
  const [segment, setSegment] = useState('absensi'); // absensi | wfa | wod

  useEffect(() => {
    const storedUser = getAuthUser();
    if (storedUser) {
      setUserData(storedUser);
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
    if (previewPhoto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewPhoto]);

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

  const fetchTodayLeave = useCallback(async () => {
    try {
      const { data } = await api.get('/leave/today');
      setTodayLeave(data?.leave || null);
    } catch {
      setTodayLeave(null);
    }
  }, []);

  useEffect(() => {
    fetchTodayLeave();
  }, [fetchTodayLeave]);

  const fetchDayContext = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/day-context');
      setDayContext(data);
    } catch {
      setDayContext(null);
    }
  }, []);

  const handlePageRefresh = useCallback(async () => {
    await Promise.all([fetchMonth(), fetchDayContext(), fetchTodayLeave()]);
  }, [fetchMonth, fetchDayContext, fetchTodayLeave]);

  useEffect(() => {
    fetchDayContext();
  }, [fetchDayContext]);

  useEffect(() => {
    if (segment === 'absensi') {
      fetchDayContext();
    }
  }, [segment, fetchDayContext]);

  const rawUserName = userData?.name || '';
  const formattedUserName = rawUserName ? formatName(rawUserName) : 'Pegawai Alora';

  const getKey = (d) => `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const selectedKey = selectedDate ? getKey(selectedDate) : null;
  const selectedRecord = selectedKey ? recordsByDate[selectedKey] : null;

  const selectedIsToday = true;

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

  const submitPunch = async (action, lateFields = null, todoItems = null) => {
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
    const effectiveLate = lateFields || pendingLateFields;
    if (action === 'in') {
      formData.append('attendance_mode', effectiveLate?.attendance_mode || 'regular');
      if (effectiveLate?.mode_reason) {
        formData.append('mode_reason', effectiveLate.mode_reason);
      }
      if (effectiveLate?.late_reason) {
        formData.append('late_reason', effectiveLate.late_reason);
      }
      if (effectiveLate?.late_category) {
        formData.append('late_category', effectiveLate.late_category);
      }
    }
    if (action === 'out' && todoItems) {
      formData.append('todo_items', JSON.stringify(todoItems));
    }

    setActionLoading(true);
    setActionError('');
    setLateModalError('');
    setIntentError('');
    try {
      if (action === 'in') {
        await api.post('/attendance/check-in', formData);
        clearPendingIn();
        setIntentModalOpen(false);
        setPunchContext(null);
        setPendingLateFields(null);
      } else {
        await api.post('/attendance/check-out', formData);
        clearPendingOut();
        setSessionTodoTarget(null);
      }
      await fetchMonth();
      await fetchDayContext();
      setLiveLocationLabel('');
      setShowLateModal(false);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mengirim absensi.';
      setActionError(msg);
      if (action === 'in') {
        setIntentError(msg);
        if (err.response?.status === 422 && /terlambat/i.test(msg)) {
          setPunchContext((prev) => (prev ? { ...prev, is_late: true } : prev));
        }
      }
      if (err.response?.status === 422 && action === 'in' && !intentModalOpen) {
        setLateModalError(msg);
        setShowLateModal(true);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openIntentModal = async () => {
    const meta = pendingInMeta;
    if (!pendingInFile || meta?.latitude == null) {
      setActionError('Ambil foto dari kamera terlebih dahulu.');
      return;
    }
    setIntentError('');
    try {
      const { data } = await api.get('/attendance/punch-context', {
        params: { latitude: meta.latitude, longitude: meta.longitude },
      });
      setPunchContext(data);
      setIntentModalOpen(true);
    } catch {
      setActionError('Gagal memuat konteks absensi.');
    }
  };

  const prepareCheckIn = () => {
    if (!pendingInFile || pendingInMeta?.latitude == null) {
      setActionError('Ambil foto dari kamera terlebih dahulu.');
      return;
    }
    openIntentModal();
  };

  const handleIntentConfirm = ({ attendance_mode, mode_reason, late_reason, late_category }) => {
    submitPunch('in', {
      ...(pendingLateFields || {}),
      attendance_mode,
      mode_reason,
      ...(late_reason ? { late_reason } : {}),
      ...(late_category ? { late_category } : {}),
    });
  };

  const prepareCheckOut = () => {
    if (!pendingOutFile || pendingOutMeta?.latitude == null) {
      setActionError('Ambil foto dari kamera terlebih dahulu.');
      return;
    }
    if (dayContext?.attendance?.attendance_mode === 'wod') {
      setSessionTodoTarget('wod');
      return;
    }
    submitPunch('out');
  };

  const handleLateModalSubmit = (fields) => {
    setPendingLateFields(fields);
    setShowLateModal(false);
    openIntentModal();
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

  const handleSessionTodoSubmit = ({ todo_items }) => {
    if (sessionTodoTarget === 'wod') {
      submitPunch('out', null, todo_items);
    }
  };

  const masukLocationText = selectedRecord?.clockIn
    ? (selectedRecord.clockInLocationName || 'Lokasi belum tercatat')
    : (selectedIsToday && liveLocationLabel ? liveLocationLabel : '');
  const keluarLocationText = selectedRecord?.clockOut
    ? (selectedRecord.clockOutLocationName || 'Lokasi belum tercatat')
    : (selectedIsToday && selectedRecord?.clockIn && liveLocationLabel ? liveLocationLabel : '');

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <header className="relative pt-5 pb-12 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none z-0" />

        <div className="relative z-10 flex items-center gap-3 mb-4">
          <button
            type="button"
            className="w-9 h-9 rounded-[11px] bg-white/10 border border-white/12 text-white grid place-items-center flex-shrink-0"
            onClick={() => navigate('/')}
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-[17.5px] font-black text-white tracking-tight drop-shadow-sm">
              Absensi
            </h1>
            <span className="text-[11px] text-blue-200/80 font-medium block mt-0.5 truncate">
              Clock In &amp; Out GPS &bull; {formattedUserName}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PageHeaderRefreshButton onRefresh={handlePageRefresh} />
            <button
              type="button"
              onClick={() => navigate('/riwayat')}
              className="w-9 h-9 rounded-[11px] bg-white/10 border border-white/12 text-white grid place-items-center flex-shrink-0"
              aria-label="Lihat riwayat"
              title="Lihat riwayat"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="w-full relative px-5">
        <div className="-mt-6 relative z-20 animate-fade-in space-y-3">
          <div className="flex gap-2.5">
            {[
              { id: 'absensi', label: 'Absensi', icon: Briefcase, active: 'bg-navy-50 border-navy-950 text-navy-950', iconBg: 'bg-navy-950 text-white' },
              { id: 'wfa', label: 'WFA', icon: MapPin, active: 'bg-sky-50 border-sky-500 text-sky-800', iconBg: 'bg-sky-600 text-white' },
              { id: 'wod', label: 'WOD', icon: CalendarDays, active: 'bg-violet-50 border-violet-500 text-violet-800', iconBg: 'bg-violet-600 text-white' },
            ].map((s) => {
              const active = segment === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSegment(s.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-[16px] border ${
                    active ? s.active : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-[12px] grid place-items-center ${active ? s.iconBg : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[11px] font-bold ${active ? '' : 'text-slate-500'}`}>{s.label}</span>
                </button>
              );
            })}
          </div>

          {segment === 'wfa' && <AttendanceModeRequestPanel api={api} requestType="wfa" />}
          {segment === 'wod' && <AttendanceModeRequestPanel api={api} requestType="wod" />}

          {segment === 'absensi' && (
            <>
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

                {(selectedRecord?.modeLocationLabel || selectedRecord?.approvalPending || selectedRecord?.approvalStatus === 'Pending_Supervisor') && (
                  <div className="flex flex-wrap gap-2">
                    {selectedRecord?.modeLocationLabel ? (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-800">
                        {selectedRecord.modeLocationLabel}
                      </span>
                    ) : null}
                    {(selectedRecord?.approvalPending || selectedRecord?.approvalStatus === 'Pending_Supervisor') ? (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">
                        Menunggu persetujuan SPV
                      </span>
                    ) : null}
                    {selectedRecord?.approvalStatus === 'disetujui' && selectedRecord?.attendanceMode !== 'regular' ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
                        Disetujui SPV
                      </span>
                    ) : null}
                  </div>
                )}

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
                          onClick={prepareCheckIn}
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
                          onClick={prepareCheckOut}
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
                      Foto + GPS wajib · lokasi dicatat untuk audit (tidak memblokir absen)
                    </p>
                    <p className="text-[10px] text-slate-400 text-center font-medium">
                      Ambil dari kamera, bukan dari galeri.
                    </p>
                  </div>
                )}

                {selectedIsToday && dayContext?.is_off_day && !selectedRecord?.clockIn && !isLockedByLeave && (
                  <p className="text-[11px] text-amber-700 text-center">
                    {dayContext?.approved_mode_request?.request_type === 'wod'
                      ? 'Hari libur — mode WOD sudah disetujui, silakan absen masuk'
                      : 'Hari libur — ajukan WOD di tab WOD dulu, setelah disetujui baru bisa absen'}
                  </p>
                )}

                {selectedIsToday && dayContext?.approved_mode_request && !selectedRecord?.clockIn && (
                  <div className="rounded-[16px] border border-violet-200 bg-violet-50 px-3.5 py-3 text-[12px] text-violet-900">
                    Mode terkunci:{' '}
                    <b>{String(dayContext.approved_mode_request.request_type).toUpperCase()}</b>
                    {' '}— absensi hari ini mengikuti pengajuan yang disetujui.
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
            </>
          )}
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
        title={confirmDelete === 'out' ? 'Hapus absen keluar?' : 'Hapus absen masuk?'}
        message="Data absen (jam, lokasi, dan foto) akan dihapus. Anda perlu absen ulang. Lanjutkan?"
        confirmText="Ya, Hapus"
        cancelText="Batal"
      />

      <LateCheckInModal
        open={showLateModal}
        onClose={() => setShowLateModal(false)}
        onSubmit={handleLateModalSubmit}
        loading={actionLoading}
        error={lateModalError}
      />

      <SessionTodoModal
        open={Boolean(sessionTodoTarget)}
        title={sessionTodoTarget === 'wod' ? 'Selesaikan WOD' : 'To-do Pekerjaan'}
        onClose={() => {
          setSessionTodoTarget(null);
        }}
        onSubmit={handleSessionTodoSubmit}
        loading={actionLoading}
        error={actionError}
      />

      <AttendanceIntentModal
        open={intentModalOpen}
        punchContext={punchContext}
        onClose={() => {
          if (!actionLoading) {
            setIntentModalOpen(false);
            setIntentError('');
          }
        }}
        onConfirm={handleIntentConfirm}
        submitting={actionLoading}
        error={intentError}
      />
    </div>
  );
}
