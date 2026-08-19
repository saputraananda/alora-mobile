import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import aloraMobileLogo from '../../assets/images/aloramobile-white.webp';
import Modal from '../../components/Modal.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function Login({ onLoginSuccess }) {
  useDocumentTitle('Login');
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('Silakan masukkan Username atau Email Anda.');
      setIsErrorModalOpen(true);
      return;
    }

    if (!password) {
      setErrorMsg('Silakan masukkan Kata Sandi Anda.');
      setIsErrorModalOpen(true);
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { username, password });
      
      if (response.data && response.data.success) {
        localStorage.setItem('alora_auth_token', response.data.token);
        localStorage.setItem('alora_user', JSON.stringify(response.data.user || {}));

        if (onLoginSuccess) {
          onLoginSuccess(response.data.user);
        }

        navigate('/');
      } else {
        setErrorMsg(response.data?.message || 'Login gagal. Periksa kembali akun Anda.');
        setIsErrorModalOpen(true);
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.response?.data?.message || 'Gagal memproses login. Periksa koneksi atau kredensial Anda.');
      setIsErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#050B14] relative overflow-hidden justify-between w-full">
      {/* BACKGROUND LAYER 1: Deep Navy Radial Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />

      {/* BACKGROUND LAYER 2: Subtle Luxury Grain / Noise Overlay ("Gremek-gremek" texture) */}
      <div 
        className="absolute inset-0 opacity-[0.07] pointer-events-none z-10 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* BACKGROUND LAYER 3: Soft Ambient Glow Behind Logo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-blue-600/20 via-indigo-500/20 to-sky-400/20 rounded-full blur-[100px] pointer-events-none" />

      {/* TOP HERO BRANDING AREA */}
      <div className="relative z-20 pt-10 pb-8 px-6 flex flex-col items-center justify-center flex-grow">
        <img 
          src={aloraMobileLogo} 
          alt="Alora Mobile" 
          className="w-44 sm:w-52 h-auto object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.6)] animate-float-slow"
        />
      </div>

      {/* BOTTOM WHITE DRAWER SHEET */}
      <div className="relative z-30 bg-white rounded-t-[36px] shadow-[0_-12px_40px_rgba(0,0,0,0.35)] px-6 pt-6 pb-6 border-t border-slate-100 flex flex-col animate-fade-in mt-auto">
        {/* Drawer Pull Handle Indicator */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />

        {/* Drawer Title & Subtitle */}
        <div className="mb-5">
          <h1 className="text-xl font-black text-navy-950 tracking-tight mb-1">
            Selamat Datang Kembali
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Silakan masukkan akun Anda untuk melanjutkan
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Username Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-navy-900 uppercase tracking-wider pl-1">
              Username atau Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username atau email Anda"
                className="w-full bg-slate-50 border border-slate-200 focus:border-navy-900 rounded-[14px] pl-10 pr-4 py-3 text-[16px] text-navy-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20 transition font-medium"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-navy-900 uppercase tracking-wider pl-1">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 focus:border-navy-900 rounded-[14px] pl-10 pr-10 py-3 text-[16px] text-navy-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20 transition font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy-900 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-[16px] bg-gradient-to-r from-navy-950 via-navy-900 to-blue-900 text-white font-extrabold text-xs shadow-lg shadow-navy-950/25 hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk ke Aplikasi</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info inside drawer */}
        <div className="mt-5 text-center text-[10px] text-slate-400 font-semibold tracking-wider">
          Alora Group Indonesia &bull; Team Alora
        </div>
      </div>

      {/* POPUP NOTIFICATION MODAL USING Modal.jsx */}
      <Modal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        title="Autentikasi Gagal"
        icon={<AlertCircle className="w-5 h-5 text-rose-500" />}
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-1">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="font-bold text-navy-950 text-[13px]">
            Gagal Masuk ke Akun
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {errorMsg}
          </p>
        </div>
      </Modal>
    </div>
  );
}
