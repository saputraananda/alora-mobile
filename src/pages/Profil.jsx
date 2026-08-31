import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import ConfirmModal from '../components/ConfirmModal.jsx';
import Modal from '../components/Modal.jsx';
import FaceScanModal from '../components/auth/FaceScanModal.jsx';
import { formatName } from '../utils/FormatName.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit3, 
  LogOut, 
  ChevronRight, 
  CreditCard, 
  Home as HomeIcon, 
  Building2, 
  ScanFace, 
  CheckCircle2, 
  Trash2, 
  Calendar,
  Briefcase,
  ShieldCheck,
  Info
} from 'lucide-react';

function getAuthToken() {
  return localStorage.getItem('alora_auth_token')
    || localStorage.getItem('alora_token')
    || localStorage.getItem('token');
}

export default function Profile() {
  useDocumentTitle('Profil');
  const navigate = useNavigate();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    userId: null,
    employee_id: 1,
    fullName: '',
    employee_code: '',
    role: 'Staff Operasional',
    job_level: 'Staff Operasional',
    position: 'Karyawan',
    department: 'PT Waschen Alora Indonesia',
    username: '',
    email: '',
    phone: '',
    address: '',
    assignedOutletName: 'Alora Head Office',
    join_date: '2025-01-15'
  });

  // Biometrics states
  const [biometricStatus, setBiometricStatus] = useState({
    isEnrolled: false,
    sampleCount: 0,
    loading: true,
    enrolledAt: null,
  });
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [faceScanOpen, setFaceScanOpen] = useState(false);
  const [biometricAlertModal, setBiometricAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  });

  // Fetch biometric status from server
  const fetchBiometricStatus = async (token, userId) => {
    try {
      const res = await axios.get('/api/auth/face/status', {
        headers: { Authorization: `Bearer ${token}` },
        params: { userId }
      });
      if (res.data && res.data.success) {
        setBiometricStatus({
          isEnrolled: res.data.isEnrolled,
          sampleCount: res.data.sampleCount || 0,
          enrolledAt: res.data.enrolledAt,
          loading: false
        });
      }
    } catch (e) {
      console.error('Failed to fetch face status:', e);
      setBiometricStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('alora_user') || sessionStorage.getItem('alora_user');
    let email = '';
    let empId = 0;
    let userId = null;

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        email = parsed.email || '';
        empId = parsed.employee_id || parsed.id || 0;
        userId = parsed.id || parsed.userId;

        setCurrentUser(prev => ({
          ...prev,
          userId: parsed.id || parsed.userId || prev.userId,
          fullName: parsed.name || parsed.fullName || prev.fullName,
          email: parsed.email || prev.email,
          username: parsed.username || prev.username,
          employee_code: parsed.employee_code || prev.employee_code,
          job_level: parsed.job_level || prev.job_level,
          department: parsed.department || prev.department,
          join_date: parsed.join_date || prev.join_date
        }));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }

    const token = getAuthToken();
    if (token && userId) {
      fetchBiometricStatus(token, userId);
    }

    // Fetch exact employee profile & join_date directly from database mainpool
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    axios.get(`/api/profile/detail?email=${encodeURIComponent(email)}&employeeId=${empId}&userId=${userId || 0}`, config)
      .then(res => {
        if (res.data?.success && res.data?.data) {
          const dbData = res.data.data;
          setCurrentUser(prev => ({
            ...prev,
            ...dbData,
            fullName: dbData.fullName || dbData.full_name || prev.fullName,
            employee_code: dbData.employee_code || prev.employee_code,
            join_date: dbData.join_date || prev.join_date,
            phone: dbData.phone || dbData.phone_number || prev.phone,
            address: dbData.address || prev.address,
            job_level: dbData.job_level || dbData.job_level_name || prev.job_level,
            position: dbData.position || dbData.position_name || prev.position,
            department: dbData.department || dbData.department_name || prev.department
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleRegisterBiometric = () => {
    const token = getAuthToken();
    const userId = currentUser.userId;

    if (!token) {
      navigate('/login');
      return;
    }

    if (!userId) {
      setBiometricAlertModal({
        isOpen: true,
        title: 'Data Akun Tidak Lengkap',
        message: 'User ID tidak ditemukan. Silakan logout dan login kembali.',
        variant: 'warning'
      });
      return;
    }

    setFaceScanOpen(true);
  };

  const handleFaceEnrollComplete = async (descriptors) => {
    const token = getAuthToken();
    const userId = currentUser.userId;

    if (!token || !userId) return;

    setBiometricLoading(true);

    try {
      const verifyRes = await axios.post(
        '/api/auth/face/enroll',
        { userId, descriptors },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (verifyRes.data?.success) {
        setFaceScanOpen(false);
        setBiometricAlertModal({
          isOpen: true,
          title: 'Registrasi Berhasil!',
          message: 'Wajah Anda telah didaftarkan sebagai kode terenkripsi. Anda sekarang dapat masuk dengan scan wajah di halaman Login.',
          variant: 'info'
        });
        fetchBiometricStatus(token, userId);
      } else {
        throw new Error(verifyRes.data?.message || 'Gagal menyimpan wajah');
      }
    } catch (err) {
      console.error('Face enrollment error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Pendaftaran wajah gagal.';
      setBiometricAlertModal({
        isOpen: true,
        title: 'Gagal Daftarkan Wajah',
        message: errMsg,
        variant: 'warning'
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleDeleteBiometric = async () => {
    const token = getAuthToken();
    const userId = currentUser.userId;

    if (!token || !userId) return;

    setBiometricLoading(true);

    try {
      const res = await axios.delete('/api/auth/face/remove', {
        headers: { Authorization: `Bearer ${token}` },
        data: { userId }
      });

      if (res.data && res.data.success) {
        setBiometricAlertModal({
          isOpen: true,
          title: 'Data Wajah Dihapus',
          message: 'Data login wajah pada akun Anda telah berhasil dihapus.',
          variant: 'info'
        });
        fetchBiometricStatus(token, userId);
      } else {
        throw new Error(res.data?.message || 'Gagal menghapus data wajah');
      }
    } catch (err) {
      console.error('Face deletion error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Gagal menghapus data wajah.';
      setBiometricAlertModal({
        isOpen: true,
        title: 'Gagal Hapus Data Wajah',
        message: errMsg,
        variant: 'warning'
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('alora_auth_token');
    localStorage.removeItem('alora_token');
    localStorage.removeItem('alora_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'AL';
    const parts = String(name).trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase() || 'AL';
  };

  const getRoleDisplay = (user) => {
    if (user?.job_level) return user.job_level;
    if (user?.role) return user.role;
    return 'Staff Operasional';
  };

  // Indonesian Date Formatter for join_date
  const formatIndonesianDate = (dateStr) => {
    if (!dateStr) return '15 Januari 2025';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Dynamic Masa Kerja Calculation (Current Date - join_date)
  const getMasaKerja = (dateStr) => {
    if (!dateStr) return '1 Tahun 1 Bulan';
    const start = new Date(dateStr);
    if (isNaN(start.getTime())) return '1 Tahun 1 Bulan';
    const now = new Date();

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();

    if (days < 0) months--;
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years <= 0 && months <= 0) return 'Kurang dari 1 Bulan';
    if (years <= 0) return `${months} Bulan`;
    if (months === 0) return `${years} Tahun`;
    return `${years} Tahun ${months} Bulan`;
  };

  const rawName = currentUser.fullName || currentUser.name || '';
  const formattedName = rawName ? formatName(rawName) : 'Karyawan Alora';

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">

      {/* ==========================================
          HERO HEADER - ALORA MOBILE NAVY BLUE THEME
          ========================================== */}
      <header className="relative pt-7 pb-14 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white">
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

        {/* Big Avatar + Name */}
        <div className="relative z-20 flex flex-col items-center text-center pt-2">
          {/* Avatar ring */}
          <div className="relative mb-3">
            <div className="w-[84px] h-[84px] rounded-full bg-gradient-to-br from-blue-400/40 via-[#0E203B] to-[#050B14] border-[3px] border-white/40 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
              <span className="text-[28px] font-black text-white">{getInitials(formattedName)}</span>
            </div>
          </div>

          {/* Name */}
          <h2 className="text-[19px] font-black text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            {formattedName}
          </h2>

          {/* Subtitle / Role Display */}
          <span className="text-[12px] text-blue-100/90 font-bold mt-1 px-3.5 py-1 rounded-full bg-white/12 border border-white/15 backdrop-blur-md">
            {getRoleDisplay(currentUser)}
          </span>
        </div>

        {/* Profile stats strip (Bergabung & Masa Kerja) */}
        <div className="relative z-20 grid grid-cols-2 gap-2.5 mt-6">
          <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[18px] px-3.5 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-blue-200" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-blue-200/80 font-bold uppercase tracking-wider block">Bergabung</span>
              <span className="text-[12px] text-white font-extrabold truncate block">
                {formatIndonesianDate(currentUser.join_date)}
              </span>
            </div>
          </div>

          <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[18px] px-3.5 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4 text-blue-200" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-blue-200/80 font-bold uppercase tracking-wider block">Masa Kerja</span>
              <span className="text-[12px] text-white font-extrabold truncate block">
                {getMasaKerja(currentUser.join_date)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT AREA ===== */}
      <main className="w-full relative px-5">

        {/* INFORMASI AKUN CARD */}
        <div className="-mt-6 relative z-20 bg-white rounded-[26px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
          <div className="px-5 pt-4 pb-2.5 border-b border-slate-100 flex justify-between items-center">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">Informasi Akun</span>
          </div>

          <div className="divide-y divide-slate-100/80">
            {/* 1. Nama */}
            <div className="flex items-center gap-3.5 px-5 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-navy-950/10 text-navy-950 flex items-center justify-center flex-shrink-0">
                <User className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Nama</span>
                <span className="text-[13px] text-slate-800 font-bold truncate block">{formattedName || '-'}</span>
              </div>
            </div>

            {/* 2. Employee Code */}
            <div className="flex items-center gap-3.5 px-5 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-navy-950/10 text-navy-950 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Nomor Induk Karyawan</span>
                <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.employee_code || '-'}</span>
              </div>
            </div>

            {/* 3. Alamat */}
            <div className="flex items-center gap-3.5 px-5 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-navy-950/10 text-navy-950 flex items-center justify-center flex-shrink-0">
                <HomeIcon className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Alamat</span>
                <span className="text-[12.5px] text-slate-800 font-bold leading-snug block">{currentUser.address || '-'}</span>
              </div>
            </div>

            {/* 4. No. Telp */}
            <div className="flex items-center gap-3.5 px-5 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-navy-950/10 text-navy-950 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">No. Telp</span>
                <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.phone || '-'}</span>
              </div>
            </div>

            {/* 5. Email */}
            <div className="flex items-center gap-3.5 px-5 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-navy-950/10 text-navy-950 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Email</span>
                <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.email || '-'}</span>
              </div>
            </div>

            {/* 6. Outlet */}
            <div className="flex items-center gap-3.5 px-5 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-navy-950/10 text-navy-950 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Outlet</span>
                <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.assignedOutletName || 'Alora Head Office'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS SECTION */}
        <div className="mt-5">
          <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2.5 px-1">Pengaturan Akun</span>
          <div className="flex flex-col gap-3">

            {/* Edit Profil */}
            <button
              id="edit-profile-btn"
              onClick={() => navigate('/edit-profile')}
              className="bg-white border border-slate-100 rounded-[22px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-4 flex items-center gap-3.5 hover:shadow-[0_8px_24px_rgba(5,11,20,0.08)] hover:-translate-y-0.5 active:scale-[.98] transition-all group text-left cursor-pointer"
            >
              <div className="w-10 h-10 rounded-2xl bg-navy-950/10 text-navy-950 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <span className="text-[13.5px] font-black text-slate-800 group-hover:text-navy-950 transition-colors block leading-tight">
                  Edit Profil Lengkap
                </span>
                <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                  Perbarui data pribadi &amp; dokumen KTP/KK
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-navy-950 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </button>

            {/* Face login enrollment card */}
            <div className="relative group w-full bg-white border border-slate-100 rounded-[22px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-4 flex items-center gap-3.5 hover:shadow-[0_8px_24px_rgba(5,11,20,0.08)] hover:-translate-y-0.5 transition-all">
              <button
                id="biometric-card-btn"
                type="button"
                onClick={handleRegisterBiometric}
                disabled={biometricLoading}
                className="flex-1 flex items-center gap-3.5 text-left min-w-0 disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-2xl bg-navy-950/10 text-navy-950 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                  <ScanFace className="w-5.5 h-5.5 text-navy-950" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className="text-[13.5px] font-black text-slate-800 group-hover:text-navy-950 transition-colors block leading-tight">
                    Daftar Login Wajah
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {biometricLoading ? (
                      <span className="text-[11px] text-blue-600 font-bold animate-pulse">
                        Memproses...
                      </span>
                    ) : biometricStatus.isEnrolled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Aktif ({biometricStatus.sampleCount} sampel) &bull; Klik untuk daftar ulang
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium block">
                        Belum terdaftar &bull; Klik untuk mendaftarkan
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Wajah disimpan sebagai kode terenkripsi, bukan foto.
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1 flex-shrink-0">
                {biometricStatus.isEnrolled && (
                  <button
                    id="remove-biometric-btn"
                    type="button"
                    title="Hapus Data Wajah"
                    onClick={handleDeleteBiometric}
                    disabled={biometricLoading}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )}
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-navy-950 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>

            {/* Logout button */}
            <button
              id="profile-logout-btn"
              onClick={() => setShowLogoutModal(true)}
              className="w-full py-3.5 rounded-[22px] bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-[13.5px] font-black shadow-lg shadow-rose-600/20 active:scale-[.97] transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>KELUAR AKUN</span>
            </button>

          </div>
        </div>

        {/* Footer signature */}
        <div className="text-center mt-6 mb-3">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Alora Mobile v1.0 &bull; PT Waschen Alora Indonesia</span>
        </div>
      </main>

      {/* ===== CONFIRM LOGOUT MODAL ===== */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="Keluar Akun"
        message="Apakah Anda yakin ingin keluar dari akun Alora Mobile?"
        confirmText="Keluar"
        cancelText="Batal"
        variant="danger"
      />

      {/* ===== FACE SCAN MODAL ===== */}
      {faceScanOpen && (
      <FaceScanModal
        open={faceScanOpen}
        mode="manual"
        title="Daftar Login Wajah"
        hint="Ambil 3 sampel wajah. Pastikan hanya wajah Anda sendiri."
        samplesRequired={3}
        onComplete={handleFaceEnrollComplete}
        onClose={() => !biometricLoading && setFaceScanOpen(false)}
        busy={biometricLoading}
        busyLabel="Menyimpan wajah..."
      />
      )}

      {/* ===== BIOMETRIC INFORMATION MODAL ===== */}
      <Modal
        isOpen={biometricAlertModal.isOpen}
        onClose={() => setBiometricAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={biometricAlertModal.title}
        icon={<Info className="w-5 h-5 text-blue-600" />}
      >
        <p className="text-xs text-slate-600 leading-relaxed py-1">
          {biometricAlertModal.message}
        </p>
      </Modal>

    </div>
  );
}
