import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { formatName } from '../utils/FormatName.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import {
  MAX_RANGE_DAYS,
  MONTH_LABEL_ID,
  daysInclusive,
  getCutoffRange,
  getDefaultCutoff,
  formatCutoffPillLabel,
  fetchActivityFeed,
} from '../utils/activityFeed.js';

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

const KIND_META = {
  attendance: { label: 'Absen', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  leave: { label: 'Cuti', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  sakit: { label: 'Sakit', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  cuti: { label: 'Cuti', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  izin: { label: 'Izin', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  wfa: { label: 'WFA', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  wod: { label: 'WOD', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  lembur: { label: 'Lembur', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  session: { label: 'Sesi', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

const TONE_CLS = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  reject: 'bg-red-50 text-red-600 border-red-200',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
};

const SECTION_CHIPS = [
  { key: 'all', label: 'Semua' },
  { key: 'attendance', label: 'Kehadiran' },
  { key: 'sakit', label: 'Sakit' },
  { key: 'cuti', label: 'Cuti' },
  { key: 'izin', label: 'Izin' },
  { key: 'wfa', label: 'WFA' },
  { key: 'wod', label: 'WOD' },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20];

const _nowYear = new Date().getFullYear();
const YEAR_OPTIONS = [_nowYear - 2, _nowYear - 1, _nowYear, _nowYear + 1];

function resolveKindMeta(item) {
  if (item.kind === 'leave') {
    return KIND_META[item.leaveType] || KIND_META.leave;
  }
  return KIND_META[item.kind] || KIND_META.attendance;
}

function filterBySection(items, section) {
  if (section === 'all') return items;
  if (section === 'attendance') return items.filter((i) => i.kind === 'attendance');
  if (section === 'wfa') return items.filter((i) => i.kind === 'wfa');
  if (section === 'wod') return items.filter((i) => i.kind === 'wod');
  if (section === 'sakit' || section === 'cuti' || section === 'izin') {
    return items.filter((i) => i.kind === 'leave' && i.leaveType === section);
  }
  return items;
}

function splitSubtitle(text) {
  const raw = String(text || '').trim();
  if (!raw) return { primary: '', secondary: '' };
  const sep = ' · ';
  const idx = raw.indexOf(sep);
  if (idx < 0) return { primary: raw, secondary: '' };
  return {
    primary: raw.slice(0, idx).trim(),
    secondary: raw.slice(idx + sep.length).trim(),
  };
}

export default function Riwayat() {
  useDocumentTitle('Riwayat');

  const defaultCutoff = getDefaultCutoff();
  const initialRange = getCutoffRange(defaultCutoff.cutoffMonth, defaultCutoff.cutoffYear);

  const [userData, setUserData] = useState(null);
  const [periodMode, setPeriodMode] = useState('cutoff');
  const [cutoffMonth, setCutoffMonth] = useState(defaultCutoff.cutoffMonth);
  const [cutoffYear, setCutoffYear] = useState(defaultCutoff.cutoffYear);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState(initialRange.startDate);
  const [appliedTo, setAppliedTo] = useState(initialRange.endDate);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [filterError, setFilterError] = useState('');
  const [section, setSection] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

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
    if (periodMode !== 'cutoff') return;
    const { startDate, endDate } = getCutoffRange(cutoffMonth, cutoffYear);
    setAppliedFrom(startDate);
    setAppliedTo(endDate);
  }, [periodMode, cutoffMonth, cutoffYear]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      const result = await fetchActivityFeed({
        api,
        from: appliedFrom,
        to: appliedTo,
      });
      setItems(result.items);
      setErrors(result.errors);
    } catch {
      setItems([]);
      setErrors(['Gagal memuat riwayat']);
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = filterBySection(items, section);
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [section, appliedFrom, appliedTo, pageSize]);

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const handlePeriodMode = (mode) => {
    if (mode === periodMode) return;
    setFilterError('');
    if (mode === 'range') {
      setFrom('');
      setTo('');
      setPeriodMode('range');
      return;
    }
    setPeriodMode('cutoff');
  };

  useEffect(() => {
    if (periodMode !== 'range') return;
    if (!from || !to) {
      setFilterError('');
      return;
    }
    if (from > to) {
      setFilterError('Tanggal tidak valid');
      return;
    }
    const span = daysInclusive(from, to);
    if (span == null || span < 1) {
      setFilterError('Tanggal tidak valid');
      return;
    }
    if (span > MAX_RANGE_DAYS) {
      setFilterError(`Maksimal rentang ${MAX_RANGE_DAYS} hari`);
      return;
    }
    setFilterError('');
    setAppliedFrom((prev) => (prev === from ? prev : from));
    setAppliedTo((prev) => (prev === to ? prev : to));
  }, [periodMode, from, to]);

  const rawUserName = userData?.name || '';
  const formattedUserName = rawUserName ? formatName(rawUserName) : 'Pengguna Alora';
  const cutoffPill = formatCutoffPillLabel(cutoffMonth, cutoffYear);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <header className="relative pt-6 pb-12 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none z-0" />

        <div className="relative z-10 text-center mb-1 pt-1">
          <h1 className="text-[17.5px] font-black text-white tracking-tight drop-shadow-sm">
            Riwayat
          </h1>
          <span className="text-[11px] text-blue-200/80 font-medium block mt-0.5">
            Aktivitas aplikasi &bull; {formattedUserName}
          </span>
        </div>
      </header>

      <main className="w-full relative px-5">
        <div className="-mt-6 relative z-20 bg-white rounded-[26px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-4 space-y-3.5">
          <div>
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
              Periode
            </span>

            <div className="space-y-2">
              <div className="flex w-full rounded-full border border-slate-200 p-0.5 bg-white">
                <button
                  type="button"
                  onClick={() => handlePeriodMode('cutoff')}
                  className={`flex-1 px-3 py-2 rounded-full text-[11px] font-extrabold tracking-wide text-center transition ${
                    periodMode === 'cutoff'
                      ? 'bg-navy-950 text-white'
                      : 'text-slate-600'
                  }`}
                >
                  Cutoff
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodMode('range')}
                  className={`flex-1 px-3 py-2 rounded-full text-[11px] font-extrabold tracking-wide text-center transition ${
                    periodMode === 'range'
                      ? 'bg-navy-950 text-white'
                      : 'text-slate-600'
                  }`}
                >
                  Range
                </button>
              </div>

              {periodMode === 'cutoff' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                      <select
                        value={cutoffMonth}
                        onChange={(e) => setCutoffMonth(Number(e.target.value))}
                        className="appearance-none w-full rounded-full border border-slate-200 bg-white pl-3 pr-7 py-1.5 text-[12px] font-bold text-slate-700"
                      >
                        {MONTH_LABEL_ID.map((label, i) => (
                          <option key={label} value={i + 1}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ▾
                      </span>
                    </div>
                    <div className="relative w-[5.5rem] flex-shrink-0">
                      <select
                        value={cutoffYear}
                        onChange={(e) => setCutoffYear(Number(e.target.value))}
                        className="appearance-none w-full rounded-full border border-slate-200 bg-white pl-3 pr-7 py-1.5 text-[12px] font-bold text-slate-700"
                      >
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                        ▾
                      </span>
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-1.5 rounded-full border border-navy-950/15 bg-navy-950/5 px-3 py-1.5 text-[11px] font-bold text-navy-950">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5 flex-shrink-0"
                      aria-hidden
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    <span>{cutoffPill}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="flex-1 min-w-[7.5rem] rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700"
                  />
                  <span className="text-[11px] font-bold text-slate-400 flex-shrink-0">s/d</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="flex-1 min-w-[7.5rem] rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700"
                  />
                </div>
              )}
            </div>

            {periodMode === 'range' && filterError ? (
              <p className="mt-2 text-[12px] text-red-600 font-semibold">{filterError}</p>
            ) : null}
          </div>

          <div>
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">
              Kategori
            </span>
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-none">
              {SECTION_CHIPS.map((chip) => {
                const active = section === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setSection(chip.key)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold tracking-wide transition active:scale-[.97] ${
                      active
                        ? 'bg-navy-950 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 font-semibold">
            Sebagian data gagal dimuat
            {errors.length ? ` (${errors.join(', ')})` : ''}.
          </div>
        )}

        <div className="mt-5">
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block">
              Aktivitas
            </span>
            <span className="text-[10px] text-navy-950 font-black uppercase tracking-wider bg-navy-950/10 px-2.5 py-0.5 rounded-full">
              {totalItems} item
            </span>
          </div>

          <div className="flex justify-between items-center gap-2 mb-3 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex-shrink-0">
                Tampil
              </span>
              <div className="inline-flex rounded-full border border-slate-200 p-0.5 bg-white">
                {PAGE_SIZE_OPTIONS.map((size) => {
                  const active = pageSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPageSize(size)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide transition ${
                        active ? 'bg-navy-950 text-white' : 'text-slate-600'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
            {totalItems > 0 ? (
              <span className="text-[10px] text-slate-400 font-bold flex-shrink-0">
                Hal. {safePage}/{totalPages}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="bg-white rounded-[20px] border border-slate-100 p-4 text-center text-[12px] text-slate-400 font-bold">
              Memuat…
            </div>
          ) : totalItems === 0 ? (
            <div className="bg-white rounded-[20px] border border-dashed border-slate-200 p-4 text-center text-[12px] text-slate-400 font-bold">
              Belum ada aktivitas di periode ini.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {pagedItems.map((item) => {
                  const kind = resolveKindMeta(item);
                  const tone = TONE_CLS[item.statusTone] || TONE_CLS.neutral;
                  const { primary, secondary } = splitSubtitle(item.subtitle);
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-[20px] border border-slate-100 p-3.5 flex items-center gap-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                    >
                      <div
                        className={`w-10.5 h-10.5 rounded-2xl flex items-center justify-center flex-shrink-0 border text-[10px] font-black uppercase ${kind.cls}`}
                      >
                        {kind.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-black text-slate-800 truncate">
                            {item.title}
                          </span>
                        </div>
                        {primary ? (
                          <span className="text-[11px] text-slate-400 font-bold block mt-0.5 truncate">
                            {primary}
                          </span>
                        ) : null}
                        {secondary ? (
                          <span className="text-[11px] text-slate-400/90 font-semibold block mt-0.5 truncate">
                            {secondary}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`flex-shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${tone}`}
                      >
                        {item.statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 disabled:opacity-40 active:scale-[.98] transition"
                >
                  Sebelumnya
                </button>
                <span className="text-[11px] font-bold text-slate-500 px-1 flex-shrink-0">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 disabled:opacity-40 active:scale-[.98] transition"
                >
                  Berikutnya
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
