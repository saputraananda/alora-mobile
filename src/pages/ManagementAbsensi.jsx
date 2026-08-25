import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import { formatName } from '../utils/FormatName.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import MobileCameraCapture from '../components/MobileCameraCapture.jsx';
import { fetchAttendancePhotoBlob } from '../utils/attendancePhoto.js';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('alora_auth_token') || localStorage.getItem('alora_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const MANAGEMENT_LOCATION_STAMP = 'Lokasi: Alora Management';

const fmt2 = (n) => String(n).padStart(2, '0');

function fmtTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}

function fmtDateFull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}/${d.getFullYear()} ${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}

function formatLiveDate(d) {
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function ManagementAbsensi() {
  useDocumentTitle('Absensi Management');
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [userData, setUserData] = useState(null);
  const [todayData, setTodayData] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingPunchType, setPendingPunchType] = useState(null);
  const [msgIn, setMsgIn] = useState(null);
  const [msgOut, setMsgOut] = useState(null);
  const [loadingPunch, setLoadingPunch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingPunch, setDeletingPunch] = useState(null);

  const displayName = userData?.name ? formatName(userData.name) : 'Pengguna Alora';
  const empId = userData?.employee_code || '';
  const liveTime = `${fmt2(now.getHours())}:${fmt2(now.getMinutes())}:${fmt2(now.getSeconds())}`;

  const hasIn = !!todayData?.check_in_time;
  const hasOut = !!todayData?.check_out_time;
  const isComplete = hasIn && hasOut;

  const fetchToday = useCallback(async () => {
    try {
      const { data } = await api.get('/management-attendance/today');
      setTodayData(data?.data || null);
    } catch {
      setTodayData(null);
    }
  }, []);

  useEffect(() => {
    api.get('/auth/leader-role')
      .then((r) => {
        if (r.data?.data?.role !== 'management') setDenied(true);
      })
      .catch(() => setDenied(true))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('alora_user') || sessionStorage.getItem('alora_user');
    if (storedUser) {
      try {
        setUserData(JSON.parse(storedUser));
      } catch {
        setUserData(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!checking && !denied) fetchToday();
  }, [checking, denied, fetchToday]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handlePunch = (punchType) => {
    const setMsg = punchType === 'in' ? setMsgIn : setMsgOut;
    setMsg(null);
    setLoadingPunch(punchType);
    setPendingPunchType(punchType);
    setCameraOpen(true);
  };

  const handleCameraCapture = async (file) => {
    if (!file || !pendingPunchType) return;

    const punchType = pendingPunchType;
    const setMsg = punchType === 'in' ? setMsgIn : setMsgOut;

    setCameraOpen(false);
    setPendingPunchType(null);
    setSubmitting(true);

    try {
      const form = new FormData();
      form.append('punch_type', punchType);
      form.append('selfie', file, 'selfie.jpg');

      const { data } = await api.post('/management-attendance/punch-selfie', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg({ text: data.message || 'Absensi berhasil', type: 'success' });
      await fetchToday();
    } catch (err) {
      setMsg({
        text: err.response?.data?.message || 'Gagal menyimpan absensi',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
      setLoadingPunch(null);
    }
  };

  const handleCameraClose = () => {
    if (pendingPunchType) {
      const setMsg = pendingPunchType === 'in' ? setMsgIn : setMsgOut;
      setMsg({ text: 'Absen dibatalkan.', type: 'error' });
    }
    setCameraOpen(false);
    setPendingPunchType(null);
    setLoadingPunch(null);
  };

  const handleDeletePunch = async () => {
    if (!confirmDelete) return;
    const { punchType } = confirmDelete;
    const setMsg = punchType === 'in' ? setMsgIn : setMsgOut;
    setDeletingPunch(punchType);

    try {
      await api.post('/management-attendance/delete-punch', { punch_type: punchType });
      setMsg({ text: 'Absensi dihapus. Silakan absen ulang.', type: 'error' });
      await fetchToday();
    } catch (err) {
      setMsg({
        text: err.response?.data?.message || 'Gagal menghapus absensi',
        type: 'error',
      });
    } finally {
      setDeletingPunch(null);
      setConfirmDelete(null);
    }
  };

  const openPhotoPreview = async (filePath, title) => {
    try {
      const url = await fetchAttendancePhotoBlob(api, filePath);
      if (url) setPhotoPreview({ url, title });
    } catch {
      const setMsg = title.includes('Masuk') ? setMsgIn : setMsgOut;
      setMsg({ text: 'Gagal memuat foto absensi', type: 'error' });
    }
  };

  if (checking) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-slate-50 items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-slate-400 font-medium mt-3">Memverifikasi akses…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      {cameraOpen && (
        <MobileCameraCapture
          open={cameraOpen}
          title={`Selfie — Absen ${pendingPunchType === 'in' ? 'Masuk' : 'Keluar'}`}
          includeLocation={false}
          staticLocationLabel={MANAGEMENT_LOCATION_STAMP}
          confirmLabel={submitting ? 'Mengirim…' : 'Ambil & Kirim'}
          onCapture={handleCameraCapture}
          onClose={handleCameraClose}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[340px] bg-white rounded-[20px] overflow-hidden shadow-xl">
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="text-[15px] font-extrabold text-slate-900 mb-1.5">Hapus & Ulang Absen?</div>
              <div className="text-[12.5px] text-slate-500 leading-relaxed font-medium">
                Data absen <span className="font-bold text-slate-700">{confirmDelete.label}</span> akan dihapus.
                Anda perlu foto selfie ulang. Lanjutkan?
              </div>
            </div>
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-[42px] rounded-xl border border-slate-200 bg-white text-slate-700 text-[12.5px] font-extrabold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeletePunch}
                disabled={!!deletingPunch}
                className="h-[42px] rounded-xl bg-red-500 text-white text-[12.5px] font-extrabold disabled:opacity-50"
              >
                {deletingPunch ? 'Menghapus…' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-3 py-4"
          onClick={() => {
            URL.revokeObjectURL(photoPreview.url);
            setPhotoPreview(null);
          }}
        >
          <div
            className="w-full max-w-[430px] bg-white rounded-[18px] overflow-hidden shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-[13px] font-extrabold text-slate-900 truncate pr-3">
                {photoPreview.title || 'Foto Absensi'}
              </div>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(photoPreview.url);
                  setPhotoPreview(null);
                }}
                className="w-9 h-9 rounded-xl border border-slate-200 text-slate-600"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <div className="p-3">
              <img
                src={photoPreview.url}
                alt={photoPreview.title}
                className="w-full h-auto max-h-[72dvh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {denied && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5">
          <div className="w-full max-w-[320px] bg-white rounded-[20px] overflow-hidden shadow-xl">
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="text-[15px] font-extrabold text-slate-900 mb-1.5">Akses Ditolak</div>
              <div className="text-[12.5px] text-slate-500 leading-relaxed font-medium">
                Hanya <span className="font-bold text-slate-700">Tim Manajemen</span> yang bisa membuka halaman ini.
              </div>
            </div>
            <div className="px-5 pb-5 pt-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full h-[42px] rounded-xl bg-blue-600 text-white text-[13.5px] font-extrabold"
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        </div>
      )}

      <header
        className="relative pt-4 pb-5 px-5 rounded-b-[28px] overflow-hidden text-white"
        style={{ background: 'linear-gradient(160deg, #0F172A 0%, #1E3A5F 35%, #1D4ED8 70%, #60A5FA 100%)' }}
      >
        <div className="relative z-[1] flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-[11px] bg-white/10 border border-white/12 grid place-items-center flex-shrink-0"
              aria-label="Kembali"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold truncate">{displayName}</div>
              <div className="text-[10.5px] text-white/50 font-medium truncate">
                Management{empId ? ` · ${empId}` : ''}
              </div>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/15 border-2 border-white/20 text-[13px] font-extrabold grid place-items-center flex-shrink-0">
            {initials(displayName)}
          </div>
        </div>

        <div className="relative z-[1] flex items-end justify-between">
          <div>
            <div className="font-mono text-[26px] font-bold tracking-tight leading-none">{liveTime}</div>
            <div className="text-[11.5px] text-white/45 font-medium mt-1">{formatLiveDate(now)}</div>
          </div>
          <div className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/12 border border-white/10 whitespace-nowrap">
            {isComplete ? '✓ Hadir Lengkap' : hasIn ? 'Sudah Masuk' : 'Belum Absen'}
          </div>
        </div>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-3">
        <div className="rounded-[18px] px-3.5 py-3 flex items-center gap-2.5 border-[1.5px] bg-white border-blue-100 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-50 grid place-items-center flex-shrink-0 text-blue-600 font-bold text-sm">
            i
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-bold text-blue-700">Absensi Bebas Lokasi</div>
            <div className="text-[10.5px] font-medium text-slate-400 mt-0.5">
              Tim manajemen dapat absen dari mana saja · Selfie wajib
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between py-0.5">
          <div className="text-[14px] font-extrabold text-slate-900">Absensi Management</div>
          <div className="text-[11px] font-semibold text-slate-400">Hari ini</div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className={`bg-white rounded-[20px] border-[1.5px] shadow-sm overflow-hidden ${hasIn ? 'border-blue-200' : 'border-transparent'}`}>
            <div className="px-3.5 pt-3 pb-2 flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 text-xs font-extrabold grid place-items-center">IN</div>
              <div>
                <div className="text-[12.5px] font-extrabold text-blue-700">Masuk</div>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${hasIn ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-300'}`}>
                  {hasIn ? '✓ Tercatat' : 'Belum'}
                </span>
              </div>
            </div>
            <div className="px-3.5 pb-3.5">
              <div className={`rounded-[14px] p-3 border-[1.5px] ${hasIn ? 'border-blue-100 bg-blue-50/40' : 'border-slate-100 bg-slate-50/80'}`}>
                <div className={`font-mono text-[22px] font-bold tabular-nums ${hasIn ? 'text-slate-900' : 'text-slate-200 font-light'}`}>
                  {hasIn ? fmtTime(todayData.check_in_time) : '--:--'}
                </div>
                {hasIn && (
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {fmtDateFull(todayData.check_in_time)}
                  </div>
                )}
                {msgIn && (
                  <div className={`mt-1.5 text-[10.5px] font-semibold px-2 py-1 rounded-lg ${msgIn.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-900'}`}>
                    {msgIn.text}
                  </div>
                )}
                <div className="mt-2">
                  {hasIn ? (
                    <button type="button" disabled className="w-full h-[34px] rounded-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11.5px] font-bold flex items-center justify-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Tercatat
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePunch('in')}
                      disabled={loadingPunch === 'in' || submitting}
                      className="w-full h-[34px] rounded-[10px] bg-blue-600 text-white text-[11.5px] font-bold disabled:opacity-40"
                    >
                      {loadingPunch === 'in' ? 'Simpan…' : 'Absen Masuk'}
                    </button>
                  )}
                </div>
                {hasIn && todayData.check_in_photo_path && (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => openPhotoPreview(todayData.check_in_photo_path, 'Foto Masuk Management')}
                      className="h-[30px] rounded-[9px] border border-blue-200 bg-blue-50 text-blue-700 text-[10.5px] font-bold"
                    >
                      Foto
                    </button>
                    {!hasOut && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ punchType: 'in', label: 'Masuk' })}
                        className="h-[30px] rounded-[9px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold"
                      >
                        Ulang
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-[20px] border-[1.5px] shadow-sm overflow-hidden ${hasOut ? 'border-emerald-200' : 'border-transparent'}`}>
            <div className="px-3.5 pt-3 pb-2 flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 text-xs font-extrabold grid place-items-center">OUT</div>
              <div>
                <div className="text-[12.5px] font-extrabold text-sky-600">Keluar</div>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${hasOut ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-300'}`}>
                  {hasOut ? '✓ Tercatat' : 'Belum'}
                </span>
              </div>
            </div>
            <div className="px-3.5 pb-3.5">
              <div className={`rounded-[14px] p-3 border-[1.5px] ${hasOut ? 'border-sky-100 bg-sky-50/40' : 'border-slate-100 bg-slate-50/80'}`}>
                <div className={`font-mono text-[22px] font-bold tabular-nums ${hasOut ? 'text-slate-900' : 'text-slate-200 font-light'}`}>
                  {hasOut ? fmtTime(todayData.check_out_time) : '--:--'}
                </div>
                {hasOut && (
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {fmtDateFull(todayData.check_out_time)}
                  </div>
                )}
                {msgOut && (
                  <div className={`mt-1.5 text-[10.5px] font-semibold px-2 py-1 rounded-lg ${msgOut.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-900'}`}>
                    {msgOut.text}
                  </div>
                )}
                <div className="mt-2">
                  {hasOut ? (
                    <button type="button" disabled className="w-full h-[34px] rounded-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11.5px] font-bold flex items-center justify-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Tercatat
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => hasIn && handlePunch('out')}
                      disabled={loadingPunch === 'out' || submitting || !hasIn}
                      className="w-full h-[34px] rounded-[10px] text-white text-[11.5px] font-bold disabled:opacity-40"
                      style={{ background: hasIn ? '#0EA5E9' : '#CBD5E1' }}
                    >
                      {loadingPunch === 'out' ? 'Simpan…' : !hasIn ? 'Belum Masuk' : 'Absen Keluar'}
                    </button>
                  )}
                </div>
                {hasOut && todayData.check_out_photo_path && (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => openPhotoPreview(todayData.check_out_photo_path, 'Foto Keluar Management')}
                      className="h-[30px] rounded-[9px] border border-blue-200 bg-blue-50 text-blue-700 text-[10.5px] font-bold"
                    >
                      Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ punchType: 'out', label: 'Keluar' })}
                      className="h-[30px] rounded-[9px] border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-bold"
                    >
                      Ulang
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {(hasIn || hasOut) && (
          <div className="bg-white rounded-[18px] px-4 py-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-[10px] text-slate-400 font-medium mb-1">Masuk</div>
                <div className="text-[16px] font-extrabold font-mono text-slate-800">
                  {fmtTime(todayData?.check_in_time) || '--:--'}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center gap-1 px-3">
                <div className={`flex-1 h-0.5 rounded-full ${hasIn ? 'bg-blue-300' : 'bg-slate-100'}`} />
                <div className={`w-2.5 h-2.5 rounded-full ${isComplete ? 'bg-emerald-400' : hasIn ? 'bg-amber-400' : 'bg-slate-200'}`} />
                <div className={`flex-1 h-0.5 rounded-full ${hasOut ? 'bg-sky-300' : 'bg-slate-100'}`} />
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-400 font-medium mb-1">Keluar</div>
                <div className="text-[16px] font-extrabold font-mono text-slate-800">
                  {fmtTime(todayData?.check_out_time) || '--:--'}
                </div>
              </div>
            </div>
            {isComplete && (
              <div className="mt-3 pt-3 border-t border-slate-50 text-center text-[12px] font-bold text-emerald-600">
                Absensi Hari Ini Lengkap
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
