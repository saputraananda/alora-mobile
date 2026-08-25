import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Bike,
  ChevronRight,
  Clock,
  Flame,
  Leaf,
  Play,
} from 'lucide-react';
import { FaRunning } from 'react-icons/fa';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import {
  fetchBugarProfile,
  fetchBugarSessions,
  fetchBugarStats,
  fetchBugarStatsAll,
  isBugarBodyComplete,
  saveBugarProfile,
  startBugarHaid,
  respondBugarHaidFollowUp,
  stopBugarHaid,
  effectiveWeeklyTargetKm,
  HAID_WEEKLY_TARGET_KM,
} from '../lib/bugarApi.js';
import { fmtDateId, fmtDurationHours, fmtTime, formatPace, formatSpeed } from '../utils/bugarFormat.js';
import {
  computeWeeklyProgress,
  getWeeklyMotivation,
} from '../utils/bugarMotivation.js';
import BugarLeaderboard from '../components/bugar/BugarLeaderboard.jsx';
import BugarHaidCard from '../components/bugar/BugarHaidCard.jsx';
import BugarHaidStartModal from '../components/bugar/BugarHaidStartModal.jsx';
import BugarHaidFollowUpModal from '../components/bugar/BugarHaidFollowUpModal.jsx';
import { HAID_DEFAULT_DURATION_DAYS } from '../utils/bugarHaid.js';

const ACCENT = {
  run: { hex: '#e11d48', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  cycle: { hex: '#0284c7', text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
};

const GOAL_OPTIONS = [
  {
    id: 'diet',
    title: 'Fokus Diet',
    desc: 'Target otomatis 20 km/minggu (lari + sepeda).',
    Icon: Leaf,
    cardBg: 'bg-emerald-50/80',
    cardBorder: 'border-emerald-200',
    iconBox: 'bg-emerald-500 text-white',
    titleColor: 'text-emerald-900',
  },
  {
    id: 'maintenance',
    title: 'Fokus Maintenance',
    desc: 'Target otomatis 12 km/minggu (lari + sepeda).',
    Icon: Activity,
    cardBg: 'bg-sky-50/80',
    cardBorder: 'border-sky-200',
    iconBox: 'bg-sky-500 text-white',
    titleColor: 'text-sky-900',
  },
];

function goalChipClass(goalFocus) {
  return goalFocus === 'diet'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-sky-50 text-sky-700';
}

function weekLabels() {
  const labels = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    labels.push(d.toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 3));
  }
  return labels;
}

function resolveSetupStep(profile, changingGoal, pendingSummary) {
  if (!isBugarBodyComplete(profile)) return 'body';
  if (!profile?.goal_focus || changingGoal) return 'goal';
  if (pendingSummary) return 'summary';
  return null;
}

function WeeklyTargetCard({ statsAll, targetKm, haidActive }) {
  const progress = computeWeeklyProgress(statsAll?.total_km ?? 0, targetKm);
  const motivation = getWeeklyMotivation({
    totalKm: statsAll?.total_km ?? 0,
    targetKm,
    calories: statsAll?.calories ?? 0,
    sessionCount: statsAll?.count ?? 0,
  });

  return (
    <div className="bg-white rounded-[18px] border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,.04)] p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[13px] font-extrabold text-navy-950">Target Mingguan</span>
          {haidActive && (
            <div className="text-[9px] font-bold text-rose-600 mt-0.5">Target mode haid (lebih ringan)</div>
          )}
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
          progress.achieved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {progress.achieved ? 'Tercapai ✓' : `${progress.totalKm} / ${progress.targetKm} km`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progress.achieved ? 'bg-emerald-500' : 'bg-blue-500'}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {!progress.achieved && (
        <p className="text-[11px] text-slate-500 font-medium">
          Kurang <span className="font-bold text-slate-700">{progress.remainingKm} km</span> menuju target
        </p>
      )}
      <div className="rounded-[14px] bg-slate-50 border border-slate-100 px-3 py-2.5">
        <p className="text-[12px] font-extrabold text-navy-950">{motivation.headline}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{motivation.subline}</p>
        {motivation.calorieLine && (
          <p className="text-[11px] text-rose-600 font-semibold mt-1.5">{motivation.calorieLine}</p>
        )}
      </div>
    </div>
  );
}

export default function Bugar() {
  useDocumentTitle('Alora Bugar');
  const navigate = useNavigate();

  const [tab, setTab] = useState('latihan');
  const [sport, setSport] = useState('run');
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ weekly: [0, 0, 0, 0, 0, 0, 0], duration_sec: 0, calories: 0, count: 0, total_km: 0 });
  const [statsAll, setStatsAll] = useState({ weekly: [0, 0, 0, 0, 0, 0, 0], duration_sec: 0, calories: 0, count: 0, total_km: 0 });
  const [changingGoal, setChangingGoal] = useState(false);
  const [pendingSummary, setPendingSummary] = useState(false);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bodyError, setBodyError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [haidStartOpen, setHaidStartOpen] = useState(false);
  const [haidFollowUpOpen, setHaidFollowUpOpen] = useState(false);
  const [haidDurationPick, setHaidDurationPick] = useState(HAID_DEFAULT_DURATION_DAYS);
  const [haidLoading, setHaidLoading] = useState(false);

  const accent = ACCENT[sport];
  const labels = useMemo(() => weekLabels(), []);
  const chartData = (stats.weekly || []).map((km, i) => ({ name: labels[i], km }));

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('alora_user') || sessionStorage.getItem('alora_user') || 'null');
    } catch {
      return null;
    }
  })();
  const employeeId = storedUser?.employee_id;

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, sess, st, stAll] = await Promise.all([
        fetchBugarProfile(),
        fetchBugarSessions(sport),
        fetchBugarStats(sport),
        fetchBugarStatsAll(),
      ]);
      setProfile(p);
      setSessions(sess);
      setStats(st);
      setStatsAll(stAll);
      if (p) {
        setHeightCm(p.height_cm != null ? String(p.height_cm) : '');
        setWeightKg(p.weight_kg != null ? String(p.weight_kg) : '');
      }
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message || 'Gagal memuat Alora Bugar');
    } finally {
      setProfileLoaded(true);
    }
  }, [sport]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (profile?.haid_follow_up_due) {
      setHaidFollowUpOpen(true);
    }
  }, [profile?.haid_follow_up_due]);

  const handleStartHaid = async (durationDays) => {
    setHaidLoading(true);
    setLoadError(null);
    try {
      const next = await startBugarHaid({ duration_days: durationDays });
      setProfile(next);
      setHaidStartOpen(false);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Gagal mengaktifkan mode haid');
    } finally {
      setHaidLoading(false);
    }
  };

  const handleStopHaid = async () => {
    setHaidLoading(true);
    setLoadError(null);
    try {
      const next = await stopBugarHaid();
      setProfile(next);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Gagal mengakhiri mode haid');
    } finally {
      setHaidLoading(false);
    }
  };

  const handleHaidFollowUp = async (stillOnPeriod) => {
    setHaidLoading(true);
    setLoadError(null);
    try {
      const next = await respondBugarHaidFollowUp({ still_on_period: stillOnPeriod });
      setProfile(next);
      setHaidFollowUpOpen(false);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Gagal menyimpan konfirmasi');
    } finally {
      setHaidLoading(false);
    }
  };

  const setupStep = profileLoaded
    ? resolveSetupStep(profile, changingGoal, pendingSummary)
    : null;

  const handleGoal = async (goal) => {
    setSaving(true);
    setLoadError(null);
    const isFirstPick = !profile?.goal_focus;
    try {
      const next = await saveBugarProfile({ goal_focus: goal });
      setProfile(next);
      setChangingGoal(false);
      if (isFirstPick) setPendingSummary(true);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Gagal menyimpan fokus');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = () => {
    navigate('/bugar/tracking', { state: { sport } });
  };

  const handleSaveBodyWizard = async () => {
    const nextProfile = {
      height_cm: Number(heightCm),
      weight_kg: Number(weightKg),
    };
    if (!isBugarBodyComplete(nextProfile)) {
      setBodyError('Tinggi 100–250 cm dan berat 30–250 kg.');
      return;
    }
    setSaving(true);
    setBodyError(null);
    try {
      const saved = await saveBugarProfile(nextProfile);
      setProfile(saved);
    } catch (err) {
      setBodyError(err.response?.data?.message || 'Gagal menyimpan data tubuh');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-28">
      <header className="relative pt-5 pb-5 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
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
              Alora Bugar
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pt-4 flex flex-col gap-2.5">
        {loadError && (
          <div className="rounded-[12px] bg-red-50 text-red-600 text-[12px] font-semibold px-3 py-2">
            {loadError}
          </div>
        )}

        {!profileLoaded ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-slate-400 font-medium">Memuat…</p>
          </div>
        ) : setupStep === 'body' ? (
          <section className="space-y-3">
            <div>
              <p className="text-[15px] font-extrabold text-slate-900">Data tubuh</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Isi tinggi dan berat untuk estimasi kalori saat olahraga.
              </p>
            </div>
            <div className="bg-white rounded-[18px] border border-slate-200 p-4 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-slate-500">Tinggi (cm)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="170"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-bold text-navy-950 bg-[#FAFBFC]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-slate-500">Berat (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="65"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-bold text-navy-950 bg-[#FAFBFC]"
                />
              </label>
              {bodyError && <p className="text-[12px] font-semibold text-red-600">{bodyError}</p>}
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveBodyWizard}
                className="w-full py-3 rounded-xl bg-navy-950 text-white text-[13px] font-bold disabled:opacity-50"
              >
                Lanjut
              </button>
            </div>
          </section>
        ) : setupStep === 'goal' ? (
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-extrabold text-slate-900">Pilih fokus</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Awalan tujuan; olahraga tetap lari atau sepeda.
                </p>
              </div>
              {changingGoal && (
                <button
                  type="button"
                  onClick={() => setChangingGoal(false)}
                  className="text-[11px] font-bold text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100 flex-shrink-0"
                >
                  Batal
                </button>
              )}
            </div>
            {profile?.haid_eligible && (
              <div className="rounded-[14px] bg-rose-50 border border-rose-200 px-3 py-2.5 text-[11px] text-rose-800 font-medium leading-relaxed">
                Mode Haid tersedia untuk Anda. Pilih fokus dulu — setelah itu card Mode Haid muncul di tab Latihan (target olahraga lebih ringan).
              </div>
            )}
            {GOAL_OPTIONS.map((opt) => {
              const GoalIcon = opt.Icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={saving}
                  onClick={() => handleGoal(opt.id)}
                  className={`w-full text-left rounded-[20px] border-[1.5px] p-4 flex items-center gap-3.5 shadow-sm transition active:scale-[.98] disabled:opacity-50 ${opt.cardBg} ${opt.cardBorder}`}
                >
                  <div className={`w-12 h-12 rounded-[14px] grid place-items-center flex-shrink-0 ${opt.iconBox}`}>
                    <GoalIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[14px] font-extrabold ${opt.titleColor}`}>{opt.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.desc}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                </button>
              );
            })}
          </section>
        ) : setupStep === 'summary' ? (
          <section className="space-y-3">
            <div>
              <p className="text-[15px] font-extrabold text-slate-900">Ringkasan target</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Pastikan data sudah sesuai sebelum mulai.</p>
            </div>
            <div className="bg-white rounded-[18px] border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Fokus</span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${goalChipClass(profile?.goal_focus)}`}>
                  {profile?.goal_focus === 'diet' ? 'Fokus Diet' : 'Fokus Maintenance'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Target mingguan</span>
                <span className="text-[14px] font-extrabold text-navy-950">{profile?.weekly_target_km} km</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Target disesuaikan otomatis berdasarkan fokus yang dipilih.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Perkiraan bulan ini</span>
                <span className="text-[13px] font-bold text-slate-600">
                  ~{Math.round(Number(profile?.weekly_target_km || 0) * 4)} km
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Tinggi / berat</span>
                <span className="text-[13px] font-bold text-slate-600">
                  {profile?.height_cm} cm · {profile?.weight_kg} kg
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPendingSummary(false)}
                className="w-full py-3 rounded-xl bg-navy-950 text-white text-[13px] font-bold mt-2"
              >
                Masuk Alora Bugar
              </button>
            </div>
            {profile?.haid_eligible && (
              <BugarHaidCard
                profile={profile}
                onStartClick={() => setHaidStartOpen(true)}
                onStopClick={handleStopHaid}
                stopping={haidLoading}
              />
            )}
          </section>
        ) : (
          <>
            <div className="flex gap-1.5 overflow-x-auto">
              {[
                { id: 'latihan', label: 'Latihan' },
                { id: 'aktivitas', label: 'Aktivitas' },
                { id: 'statistik', label: 'Statistik' },
                { id: 'peringkat', label: 'Peringkat' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap ${
                    tab === t.id
                      ? 'bg-navy-950 text-white'
                      : 'bg-white border border-slate-200 text-slate-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'latihan' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${goalChipClass(profile.goal_focus)}`}>
                    {profile.goal_focus === 'diet' ? 'Fokus Diet' : 'Fokus Maintenance'}
                  </span>
                  {!profile.haid_active && (
                    <button
                      type="button"
                      className="text-[11px] font-bold text-blue-600"
                      onClick={() => setChangingGoal(true)}
                    >
                      Ubah fokus
                    </button>
                  )}
                </div>

                <BugarHaidCard
                  profile={profile}
                  onStartClick={() => setHaidStartOpen(true)}
                  onStopClick={handleStopHaid}
                  stopping={haidLoading}
                />

                <div className="flex gap-2.5">
                  {[
                    { id: 'run', label: 'Lari', icon: FaRunning },
                    { id: 'cycle', label: 'Sepeda', icon: Bike },
                  ].map((s) => {
                    const active = sport === s.id;
                    const a = ACCENT[s.id];
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSport(s.id)}
                        className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-[16px] border ${
                          active ? `${a.bg} ${a.border}` : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-[14px] grid place-items-center ${active ? (s.id === 'run' ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white') : 'bg-slate-100 text-slate-500'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-[12px] font-bold ${active ? a.text : 'text-slate-500'}`}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white rounded-[18px] border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,.04)] p-4">
                  <div className="text-[14px] font-extrabold text-navy-950">
                    Mulai {sport === 'run' ? 'Lari' : 'Sepeda'}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tracking GPS seperti latihan kebugaran.</p>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="mt-3 w-full py-3 rounded-xl bg-navy-950 text-white text-[13px] font-bold flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" fill="currentColor" />
                    Mulai
                  </button>
                </div>

                <WeeklyTargetCard
                  statsAll={statsAll}
                  targetKm={effectiveWeeklyTargetKm(profile)}
                  haidActive={profile?.haid_active === true}
                />

                <div className="bg-white rounded-[18px] border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,.04)] p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[13px] text-slate-500 font-medium">Beban Mingguan</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${accent.bg} ${accent.text}`}>
                      {stats.total_km} km
                    </span>
                  </div>
                  <div className="h-[72px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <Area type="monotone" dataKey="km" stroke={accent.hex} fill={accent.hex} fillOpacity={0.18} strokeWidth={2.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-1">
                    {labels.map((d, i) => (
                      <span key={i} className="text-[10px] text-slate-400 text-center flex-1">{d}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'aktivitas' && (
              <div className="flex flex-col gap-2.5">
                <p className="text-[13px] font-bold text-navy-950">Riwayat Terbaru</p>
                {sessions.length === 0 && (
                  <div className="bg-white rounded-[18px] border border-slate-200 p-4 text-[13px] text-slate-500">
                    Belum ada aktivitas. Mulai dari tab Latihan.
                  </div>
                )}
                {sessions.map((act) => {
                  const metric = act.sport === 'run'
                    ? formatPace(Number(act.avg_pace_or_speed))
                    : formatSpeed(Number(act.avg_pace_or_speed));
                  return (
                    <div key={act.id} className="bg-white rounded-[18px] border border-slate-200 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-[11px] text-slate-400 mb-1">{fmtDateId(act.ended_at)}</div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-[28px] font-extrabold text-navy-950 leading-none">
                              {Number(act.distance_km).toFixed(2)}
                            </span>
                            <span className="text-[12px] text-slate-500">km</span>
                          </div>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-[10px] ${accent.bg} ${accent.text}`}>
                          {metric}
                        </span>
                        {act.haid_mode && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                            Haid
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <Clock className="w-3 h-3 text-sky-600" /> {fmtTime(act.duration_sec)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <Flame className="w-3 h-3 text-rose-600" /> {act.calories} kal
                        </span>
                        {act.sport === 'run' && act.step_count != null && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {Number(act.step_count).toLocaleString('id-ID')} langkah
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'statistik' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                  <div className="flex-1 bg-white rounded-[18px] border border-slate-200 p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-600" />
                      <span className="text-[11px] text-slate-500 font-medium">Waktu</span>
                    </div>
                    <div className="text-[30px] font-extrabold text-navy-950 leading-none">{fmtDurationHours(stats.duration_sec)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Jam (7 hari)</div>
                  </div>
                  <div className="flex-1 rounded-[18px] bg-emerald-500 p-4 text-white">
                    <div className="text-[11px] font-semibold mb-1.5">Aktivitas</div>
                    <div className="text-[30px] font-extrabold leading-none">{stats.count}</div>
                    <div className="text-[10px] mt-1 text-white/80">Sesi</div>
                  </div>
                </div>
                <div className="bg-white rounded-[18px] border border-slate-200 p-4">
                  <p className="text-[13px] font-bold text-navy-950 mb-2">Ringkasan Minggu Ini</p>
                  <div className="flex justify-between mb-2">
                    <div>
                      <div className="text-[11px] text-slate-400">Total km</div>
                      <div className="text-[24px] font-extrabold text-navy-950">{stats.total_km}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Kalori (estimasi)</div>
                      <div className={`text-[24px] font-extrabold ${accent.text}`}>{stats.calories}</div>
                    </div>
                  </div>
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <Area type="monotone" dataKey="km" stroke={accent.hex} fill={accent.hex} fillOpacity={0.18} strokeWidth={2.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-[18px] border border-slate-200 p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-navy-950 text-white grid place-items-center">
                    {sport === 'run' ? <FaRunning className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-[14px] font-extrabold text-navy-950">{sport === 'run' ? 'Mode Lari' : 'Mode Sepeda'}</div>
                    <div className="text-[10px] text-slate-400">
                      {sport === 'run' ? 'Pace · MET lari' : 'Kecepatan · MET sepeda'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'peringkat' && (
              <BugarLeaderboard employeeId={employeeId} />
            )}
          </>
        )}
      </main>

      <BugarHaidStartModal
        isOpen={haidStartOpen}
        onClose={() => setHaidStartOpen(false)}
        onConfirm={handleStartHaid}
        durationDays={haidDurationPick}
        onDurationChange={setHaidDurationPick}
        targetKm={HAID_WEEKLY_TARGET_KM[profile?.goal_focus] ?? '—'}
        loading={haidLoading}
      />

      <BugarHaidFollowUpModal
        isOpen={haidFollowUpOpen}
        onStillOnPeriod={() => handleHaidFollowUp(true)}
        onFinished={() => handleHaidFollowUp(false)}
        loading={haidLoading}
      />
    </div>
  );
}
