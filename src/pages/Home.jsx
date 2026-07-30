import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Activity, 
  Cpu, 
  Database, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  Server,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function Home() {
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('/api/info');
        if (response.data && response.data.success) {
          setSystemInfo(response.data);
        } else {
          throw new Error(response.data?.message || 'Gagal memuat status sistem');
        }
      } catch (err) {
        console.error('API Fetch error, using fallback client data:', err);
        setError('Koneksi ke backend Express belum aktif atau terjadi kesalahan. Silakan pastikan backend berjalan di port 5000.');
        // Fallback mock data for demo visual check
        setSystemInfo({
          success: true,
          message: "Selamat Datang di React & Express Monorepo Starter Pack (Demo)",
          version: "1.0.0 (Demo Mode)",
          environment: "client-fallback",
          status: "Demo Mode Active",
          timestamp: new Date().toISOString(),
          database: {
            status: "Offline / Unreachable",
            client: "MySQL 2"
          },
          metrics: {
            cpuUsage: "12% (Simulated)",
            memoryUsage: "64 MB (Simulated)",
            uptime: "1.5 hours (Simulated)",
            activeConnections: 4
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSystemInfo();
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 overflow-hidden flex flex-col justify-between">
      {/* Background Decorative Glow Elements */}
      <div className="glow-spot bg-blue-400/25 top-[-100px] left-[-100px]" />
      <div className="glow-spot bg-sky-300/20 bottom-[-150px] right-[-100px]" />
      <div className="glow-spot bg-indigo-300/25 top-[30%] right-[10%]" />

      {/* Navigation / Header */}
      <header className="relative z-10 border-b border-slate-200/80 bg-white/70 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl shadow-lg shadow-sky-500/15">
              <Layers className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5 font-sans">
                REACT + EXPRESS
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200/50 font-medium">
                  Starter Pack
                </span>
              </h1>
              <p className="text-[10px] text-slate-500 tracking-wider uppercase font-semibold">Monorepo Web App Template</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all duration-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              v1.0.0
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-6 py-12 flex-grow flex flex-col justify-center">
        {/* Welcome Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/5 to-indigo-500/5 border border-sky-200 text-sky-600 text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5 text-sky-500" />
            <span>Monorepo Boilerplate Starter Active</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 bg-clip-text text-transparent">
            React & Express Starter Pack
          </h2>
          <p className="text-slate-600 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Starter template siap pakai untuk aplikasi web full-stack modern. Mengintegrasikan frontend React (Vite) dengan backend Express JS dalam satu monorepo yang terkelola secara efisien.
          </p>
          <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-600 text-xs sm:text-sm font-medium">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
            <span>Dibuat oleh <strong className="text-slate-800 font-semibold">Ananda Prathama Saputra</strong> &bull; Institut Pertanian Bogor</span>
          </div>
        </div>

        {/* Backend Connectivity Check Banner */}
        {error && (
          <div className="max-w-4xl mx-auto w-full mb-8 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm shadow-sm">
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Menunggu Koneksi Backend...</span>
                <span className="text-xs text-amber-700/95">{error}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-slate-800 font-mono">
                npm run dev
              </code>
              <span className="text-xs text-slate-500">untuk menjalankan API & Frontend secara paralel</span>
            </div>
          </div>
        )}

        {/* Dynamic Mock Status / Real Status Dashboard Display */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-sm">Menghubungkan ke API Server...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
            {/* API Status Box */}
            <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Status Server API</h3>
                    <p className="text-xs text-slate-400">Merespon dari server.js</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    systemInfo?.environment === 'client-fallback' 
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      systemInfo?.environment === 'client-fallback' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}></span>
                    {systemInfo?.status || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-400 mb-1">Message from Server:</p>
                  <p className="text-slate-700 font-medium">{systemInfo?.message}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Database Connection:</p>
                  <p className="text-slate-700 font-medium flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-sky-500" />
                    {systemInfo?.database?.status} ({systemInfo?.database?.client})
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Cpu className="h-5 w-5" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">System Load</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">CPU Usage</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 tracking-tight">
                    {systemInfo?.metrics?.cpuUsage}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                  <Database className="h-5 w-5" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Memory</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">Memory Usage</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 tracking-tight">
                    {systemInfo?.metrics?.memoryUsage}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Runtime</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">Server Uptime</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 tracking-tight">
                    {systemInfo?.metrics?.uptime}
                  </span>
                </div>
              </div>
            </div>

            {/* Starter Structure Guide Box */}
            <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                Struktur Komponen yang Telah Dibuat
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
                  <span className="text-xs font-bold text-sky-600 block mb-1">1. Routing (Express)</span>
                  <code className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded block mb-2 font-mono">api/routes/info.routes.js</code>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Mengarahkan request <code className="text-sky-600">GET /api/info</code> ke fungsi controller.
                  </p>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
                  <span className="text-xs font-bold text-indigo-600 block mb-1">2. Controller (Express)</span>
                  <code className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded block mb-2 font-mono">api/controllers/info.controller.js</code>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Fungsi <code className="text-indigo-600">getSystemInfo</code> memproses data sistem dan mengembalikan response JSON.
                  </p>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
                  <span className="text-xs font-bold text-pink-600 block mb-1">3. Frontend Page (React)</span>
                  <code className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded block mb-2 font-mono">src/pages/Home.jsx</code>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Halaman Selamat Datang ini yang terintegrasi Axios untuk mengambil data API.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 border-t border-slate-200/60 bg-white/70 backdrop-blur-md text-center">
        <p className="text-xs text-slate-500">
          &copy; {new Date().getFullYear()} React & Express Starter Pack. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
