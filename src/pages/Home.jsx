import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Info, 
  CalendarCheck, 
  FileText,
  Wallet,
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
  Bell,
  Megaphone
} from 'lucide-react';
import { FaRunning } from 'react-icons/fa';
import aloraMobileLogo from '../assets/images/aloramobile-white.webp';
import Modal from '../components/Modal.jsx';
import { formatName } from '../utils/FormatName.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function Home() {
  useDocumentTitle('Home');
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Layanan Alora Mobile');
  const [modalContent, setModalContent] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // Load authenticated user data
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

  // Update clock & date dynamically
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}.${minutes}.${seconds}`);

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const dayName = days[now.getDay()];
      const dateNum = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      setCurrentDateStr(`${dayName}, ${dateNum} ${monthName} ${year}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Greeting based on current time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'Selamat Pagi 🌤️';
    if (hour >= 11 && hour < 15) return 'Selamat Siang ☀️';
    if (hour >= 15 && hour < 18) return 'Selamat Sore 🌅';
    return 'Selamat Malam ☁️';
  };

  const openMenuModal = (title, desc) => {
    setModalTitle(title);
    setModalContent(desc);
    setIsModalOpen(true);
  };

  const handleMenuClick = (item) => {
    if (item.id === 'absensi') {
      navigate('/riwayat');
    } else {
      openMenuModal(item.title, item.modalDesc);
    }
  };

  const rawUserName = userData?.name || "";
  const formattedUserName = rawUserName ? formatName(rawUserName) : "Pengguna Alora";
  const employeeCode = userData?.employee_code || "";
  const jobLevel = userData?.job_level || "Karyawan";

  const menuItems = [
    {
      id: 'absensi',
      title: 'Absensi',
      subtitle: 'Clock In & Out GPS',
      icon: <CalendarCheck className="w-5 h-5 text-emerald-600" />,
      badgeColor: 'bg-emerald-50 border-emerald-200/80',
      modalDesc: 'Fitur Presensi GPS & Riwayat Kehadiran Pegawai Alora Mobile.'
    },
    {
      id: 'alorabugar',
      title: 'Alora Bugar',
      subtitle: 'Kesehatan & Kebugaran',
      icon: <FaRunning className="w-5 h-5 text-rose-500" />,
      badgeColor: 'bg-rose-50 border-rose-200/80',
      modalDesc: 'Layanan Pemantauan Kesehatan & Kebugaran Kerja Pegawai.'
    },
    {
      id: 'perizinan',
      title: 'Perizinan',
      subtitle: 'Cuti, Sakit & Izin',
      icon: <FileText className="w-5 h-5 text-amber-600" />,
      badgeColor: 'bg-amber-50 border-amber-200/80',
      modalDesc: 'Pengajuan Cuti Tahunan, Surat Sakit, dan Izin Meninggalkan Pekerjaan.'
    },
    {
      id: 'slipgaji',
      title: 'Slip Gaji',
      subtitle: 'Riwayat Gaji & Insentif',
      icon: <Wallet className="w-5 h-5 text-sky-600" />,
      badgeColor: 'bg-sky-50 border-sky-200/80',
      modalDesc: 'Unduh dan Lihat Riwayat Rincian Slip Gaji Bulanan Pegawai.'
    }
  ];

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      {/* HEADER HERO */}
      <header className="relative pt-5 pb-6 px-6 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white">
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

        {/* HEADER TOP ROW: Avatar, User Info & Action Info Button */}
        <div className="relative z-20 flex items-center justify-between gap-3 mb-1">
          <div 
            onClick={() => navigate('/profil')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {/* Squircle Avatar */}
            <div className="w-[50px] h-[50px] rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white font-extrabold text-base flex-shrink-0 shadow-md backdrop-blur-md group-hover:scale-105 transition">
              {formattedUserName.split(' ').slice(0, 2).map(n => n[0]).join('') || 'AP'}
            </div>

            {/* User Name & Subtitle */}
            <div className="flex flex-col">
              <h2 className="text-[16px] font-bold text-white tracking-tight leading-tight line-clamp-1 group-hover:text-blue-200 transition">
                {formattedUserName}
              </h2>
              <p className="text-xs text-slate-300 font-normal mt-0.5">
                {jobLevel}{employeeCode ? ` · ${employeeCode}` : ''}
              </p>
            </div>
          </div>

          {/* Action Info Circle Button */}
          <button
            onClick={() => openMenuModal('Informasi Aplikasi', 'Aplikasi Alora Mobile terhubung langsung dengan database mainPool.')}
            className="w-10 h-10 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition active:scale-95 flex-shrink-0 backdrop-blur-md"
            aria-label="Info Aplikasi"
          >
            <Info className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* HEADER BOTTOM ROW: Greeting, Digital Clock, Date & Alora Mobile Logo */}
        <div className="relative z-20 flex items-end justify-between pt-3">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-200">
              {getGreeting()}
            </span>
            <span className="text-3xl font-extrabold font-sans tracking-tight text-white mt-0.5 leading-none">
              {currentTime || '23.26.59'}
            </span>
            <span className="text-xs text-slate-300 font-medium mt-1.5">
              {currentDateStr || 'Minggu, 16 Agustus 2026'}
            </span>
          </div>

          {/* Alora Mobile Brand Logo Image & Typography */}
          <div className="flex flex-col items-center justify-end pb-0 pt-2 flex-shrink-0">
            <img
              src={aloraMobileLogo}
              alt="Alora Mobile Logo"
              className="w-16 sm:w-20 h-auto object-contain drop-shadow-md"
            />
            <span className="font-['Outfit'] font-extrabold text-[11px] sm:text-[12px] tracking-wider text-white drop-shadow-sm -mt-2.5 sm:-mt-3">
              Alora Mobile
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="px-5 pt-6 flex flex-col gap-6">
        {/* SECTION 1: 4 MAIN MENU CARDS GRID */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-navy-950 tracking-wider uppercase">
              MENU UTAMA
            </h3>
          </div>

          {/* 4 COLUMNS SINGLE ROW GRID CONTAINER */}
          <div className="bg-white rounded-[26px] p-4 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-200/80 grid grid-cols-4 gap-x-1.5">
            {menuItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleMenuClick(item)}
                className="flex flex-col items-center cursor-pointer group"
              >
                {/* Icon Box */}
                <div className={`w-12 h-12 rounded-[20px] ${item.badgeColor} border flex items-center justify-center shadow-sm group-hover:scale-105 active:scale-95 transition flex-shrink-0`}>
                  {item.icon}
                </div>

                {/* Title */}
                <span className="text-[11px] sm:text-[12px] font-bold text-navy-950 text-center leading-tight mt-2 px-0.5">
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: LIST CARD INFORMASI & REKAP AKTIVITAS */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-navy-950 tracking-wider uppercase">
              INFORMASI & AKTIVITAS
            </h3>
            <span className="text-[10px] font-bold text-slate-400">
              3 Info Terbaru
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {/* INFO CARD 1: ABSENSI */}
            <div 
              onClick={() => navigate('/riwayat')}
              className="bg-white rounded-[22px] p-4 border border-slate-200/80 shadow-sm flex items-start gap-3.5 cursor-pointer hover:border-emerald-300 transition group"
            >
              <div className="w-10 h-10 rounded-[14px] bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col flex-grow">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-navy-950">
                    Presensi Masuk Berhasil
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    08:00 WIB
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                  Kantor Pusat / Outlet Utama Alora
                </p>
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tercatat via GPS</span>
                </div>
              </div>
            </div>

            {/* INFO CARD 2: ALORA BUGAR */}
            <div 
              onClick={() => openMenuModal('Detail Alora Bugar', 'Kondisi kesehatan harian Anda dinyatakan prima dan siap beraktivitas.')}
              className="bg-white rounded-[22px] p-4 border border-slate-200/80 shadow-sm flex items-start gap-3.5 cursor-pointer hover:border-rose-300 transition group"
            >
              <div className="w-10 h-10 rounded-[14px] bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FaRunning className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex flex-col flex-grow">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-navy-950">
                    Kondisi Kesehatan Prima
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    07:30 WIB
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                  Skor harian: <strong className="text-navy-950 font-mono">95 / 100</strong> &bull; Siap bertugas
                </p>
                <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 mt-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Status Kebugaran Baik</span>
                </div>
              </div>
            </div>

            {/* INFO CARD 3: PENGUMUMAN INFORMASI */}
            <div 
              onClick={() => openMenuModal('Detail Informasi', 'Pelaksanaan briefing bulanan koordinasi tim Alora Mobile.')}
              className="bg-white rounded-[22px] p-4 border border-slate-200/80 shadow-sm flex items-start gap-3.5 cursor-pointer hover:border-purple-300 transition group"
            >
              <div className="w-10 h-10 rounded-[14px] bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="flex flex-col flex-grow">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-navy-950">
                    Briefing Bulanan Team Alora
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Kemarin
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                  Rapat koordinasi dan evaluasi kerja bulanan hari Jumat pukul 14:00 WIB.
                </p>
                <div className="flex items-center gap-1 text-[10px] font-bold text-purple-600 mt-2">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Pengumuman Manajemen</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* INTERACTIVE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        icon={<Info className="w-5 h-5 text-blue-600" />}
      >
        <p className="text-xs text-slate-600 leading-relaxed py-1">
          {modalContent}
        </p>
      </Modal>
    </div>
  );
}