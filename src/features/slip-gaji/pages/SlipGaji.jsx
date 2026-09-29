import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js';
import { getAuthToken } from '../../../utils/authSession.js';
import PageHeaderRefreshButton from '../../../components/PageHeaderRefreshButton.jsx';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatMonthLabel(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
  if (!match) return value || '-';
  return `${MONTHS_ID[Number(match[2]) - 1] || match[2]} ${match[1]}`;
}

async function readBlobErrorMessage(err, fallback) {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || fallback;
}

export default function SlipGaji() {
  useDocumentTitle('Slip Gaji');
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/payslips');
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setItems([]);
      setError(err.response?.data?.message || 'Gagal memuat slip gaji.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleDownload = async (item) => {
    setDownloadingId(item.id);
    setError('');
    try {
      const { data } = await api.get(`/payslips/${item.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Slip-Gaji-${item.payslip_month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      setError(await readBlobErrorMessage(err, 'Gagal mengunduh slip gaji.'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <header className="relative pt-5 pb-5 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            className="w-9 h-9 rounded-[11px] bg-white/10 border border-white/12 text-white grid place-items-center flex-shrink-0"
            onClick={() => navigate('/')}
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold tracking-[.12em] uppercase text-white/80">
              Pegawai Alora
            </div>
            <div className="text-[15px] font-extrabold text-white tracking-[-0.01em] truncate">
              Slip Gaji
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PageHeaderRefreshButton onRefresh={fetchList} />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 space-y-3">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12.5px] text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-center text-[13px] text-slate-400 py-10">Memuat…</p>
        ) : items.length === 0 ? (
          !error && (
            <p className="text-center text-[13px] text-slate-400 py-10">Belum ada slip gaji.</p>
          )
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200/80 grid place-items-center flex-shrink-0">
                <FileText className="w-5 h-5 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-slate-800">{formatMonthLabel(item.payslip_month)}</p>
                <p className="text-[11.5px] text-slate-500 truncate">{item.file_name}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(item)}
                disabled={downloadingId === item.id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-[12px] font-bold disabled:opacity-60 flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingId === item.id ? 'Mengunduh…' : 'Unduh'}
              </button>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
