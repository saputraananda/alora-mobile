import { useEffect, useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { fetchBugarLeaderboard } from '../../lib/bugarApi.js';
import {
  MONTH_NAMES_ID,
  currentWibYearMonth,
  formatMonthLabelId,
  initialsFromName,
  minYearFromMonthKeys,
  monthKeyFromParts,
  scoreForEntry,
} from '../../utils/bugarLeaderboard.js';

const PODIUM_STYLES = [
  {
    ring: 'border-sky-400',
    score: 'text-sky-400',
    badge: 'bg-sky-500',
    size: 'w-14 h-14 text-[13px]',
    offset: 'mt-8',
  },
  {
    ring: 'border-amber-400',
    score: 'text-amber-400',
    badge: 'bg-amber-500',
    size: 'w-16 h-16 text-[14px]',
    offset: 'mt-0',
    crown: true,
  },
  {
    ring: 'border-emerald-400',
    score: 'text-emerald-400',
    badge: 'bg-emerald-500',
    size: 'w-14 h-14 text-[13px]',
    offset: 'mt-8',
  },
];

function PodiumSlot({ entry, rank, style, sortBy, isMe, empty }) {
  const score = entry ? scoreForEntry(entry, sortBy) : null;
  const unit = sortBy === 'sessions' ? 'sesi' : 'km';

  return (
    <div className={`flex flex-col items-center flex-1 min-w-0 max-w-[110px] ${style.offset}`}>
      <div className="relative mb-2">
        {style.crown && (
          <Crown className={`absolute -top-4 left-1/2 -translate-x-1/2 w-5 h-5 ${empty ? 'text-white/20' : 'text-amber-400 fill-amber-400/20'}`} />
        )}
        <div
          className={`rounded-full border-4 grid place-items-center font-extrabold ${style.size} ${
            empty
              ? 'border-white/15 bg-[#0E203B]/60 text-white/25'
              : `bg-[#0E203B] text-white ${style.ring} ${isMe ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#050B14]' : ''}`
          }`}
        >
          {empty ? '—' : initialsFromName(entry.employee_name)}
        </div>
        <div
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-md grid place-items-center text-[10px] font-extrabold text-white ${
            empty ? 'bg-white/20' : style.badge
          }`}
        >
          {rank}
        </div>
      </div>
      <p className={`text-[11px] font-bold truncate w-full text-center px-0.5 ${empty ? 'text-white/35' : 'text-white'}`}>
        {empty ? 'Kosong' : entry.employee_name}
        {!empty && isMe && <span className="text-[9px] text-white/70 block">Kamu</span>}
      </p>
      <p className={`text-[16px] font-extrabold leading-tight ${empty ? 'text-white/25' : style.score}`}>
        {empty ? '—' : score.value}
        <span className={`text-[10px] font-semibold ml-0.5 ${empty ? 'text-white/20' : 'text-white/60'}`}>
          {empty ? unit : score.unit}
        </span>
      </p>
    </div>
  );
}

function PodiumTopThree({ entries, sortBy, employeeId }) {
  const top = entries.slice(0, 3);

  const ordered = [
    { entry: top[1], rank: 2, style: PODIUM_STYLES[0] },
    { entry: top[0], rank: 1, style: PODIUM_STYLES[1] },
    { entry: top[2], rank: 3, style: PODIUM_STYLES[2] },
  ];

  return (
    <div className="relative bg-[#050B14] rounded-[20px] px-3 pt-6 pb-5 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810] pointer-events-none" />
      <div className="relative flex items-end justify-center gap-1 min-h-[160px]">
        {ordered.map(({ entry, rank, style }) => (
          <PodiumSlot
            key={rank}
            entry={entry}
            rank={rank}
            style={style}
            sortBy={sortBy}
            empty={!entry}
            isMe={entry?.employee_id === employeeId}
          />
        ))}
      </div>
    </div>
  );
}

function RankListRow({ entry, rank, sortBy, isMe }) {
  const score = scoreForEntry(entry, sortBy);
  return (
    <div
      className={`bg-white rounded-[18px] border p-3.5 flex items-center gap-3 ${
        isMe ? 'border-navy-950' : 'border-slate-200'
      }`}
    >
      <span className="w-6 text-[13px] font-extrabold text-navy-950 text-center">{rank}</span>
      <div className="w-9 h-9 rounded-full bg-slate-100 text-[11px] font-extrabold text-navy-950 grid place-items-center flex-shrink-0">
        {initialsFromName(entry.employee_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-navy-950 truncate">
          {entry.employee_name}
          {isMe && <span className="ml-1.5 text-[10px] font-bold text-navy-600">Kamu</span>}
        </div>
        <div className="text-[11px] text-slate-500">{entry.session_count} sesi</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[14px] font-extrabold text-navy-950">{score.value}</div>
        <div className="text-[10px] text-slate-400">{score.unit}</div>
      </div>
    </div>
  );
}

export default function BugarLeaderboard({ employeeId }) {
  const wibNow = currentWibYearMonth();
  const [sortBy, setSortBy] = useState('km');
  const [year, setYear] = useState(wibNow.year);
  const [month, setMonth] = useState(wibNow.month);
  const [data, setData] = useState({
    month: '',
    available_months: [],
    entries: [],
    my_rank: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const monthKey = monthKeyFromParts(year, month);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBugarLeaderboard({ sort: sortBy, month: monthKey })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Gagal memuat peringkat');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sortBy, monthKey]);

  const yearOptions = useMemo(() => {
    const minYear = minYearFromMonthKeys(data.available_months, wibNow.year);
    const maxYear = wibNow.year;
    const years = [];
    for (let y = maxYear; y >= minYear; y -= 1) years.push(y);
    return years;
  }, [data.available_months, wibNow.year]);

  const restEntries = data.entries.slice(3);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-extrabold text-navy-950">Peringkat Bulanan</p>
          <p className="text-[11px] text-slate-500">
            {data.my_rank
              ? `Peringkat saya: #${data.my_rank}`
              : 'Belum ada sesi bulan ini'}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {['km', 'sessions'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
                sortBy === s ? 'bg-navy-950 text-white' : 'bg-white border border-slate-200 text-slate-500'
              }`}
            >
              {s === 'km' ? 'Km' : 'Sesi'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold text-navy-950 bg-white"
          aria-label="Pilih bulan"
        >
          {MONTH_NAMES_ID.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-[100px] border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold text-navy-950 bg-white"
          aria-label="Pilih tahun"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-slate-400 -mt-1">{formatMonthLabelId(monthKey)} · WIB</p>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] text-slate-400 font-medium">Memuat peringkat…</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-[12px] bg-red-50 text-red-600 text-[12px] font-semibold px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <PodiumTopThree entries={data.entries} sortBy={sortBy} employeeId={employeeId} />
          {data.entries.length === 0 && (
            <p className="text-[12px] text-slate-500 text-center px-2">
              Belum ada aktivitas olahraga di {formatMonthLabelId(monthKey)}.
            </p>
          )}
          {restEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              {restEntries.map((entry, i) => (
                <RankListRow
                  key={entry.employee_id}
                  entry={entry}
                  rank={i + 4}
                  sortBy={sortBy}
                  isMe={entry.employee_id === employeeId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
