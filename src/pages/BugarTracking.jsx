import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pause, Play, Square } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useGeolocationTrack } from '../hooks/useGeolocationTrack.js';
import { useStepCounter } from '../hooks/useStepCounter.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import BugarTrackingMap from '../components/bugar/BugarTrackingMap.jsx';
import { calcCalories, avgSpeedKmh, paceMinPerKm, formatPace, formatSpeed } from '../utils/bugarCalories.js';
import { downsamplePoints } from '../utils/bugarGeo.js';
import { rollingPaceMinPerKm, rollingSpeedKmh } from '../utils/bugarPace.js';
import { estimateStepsFromDistance } from '../utils/bugarSteps.js';
import { fmtTime } from '../utils/bugarFormat.js';
import { clearBugarDraft, loadBugarDraft, saveBugarDraft } from '../utils/bugarDraft.js';
import { fetchBugarProfile, isBugarBodyComplete, postBugarSession } from '../lib/bugarApi.js';

const ACCENT = { run: '#e11d48', cycle: '#0284c7' };

export default function BugarTracking() {
  useDocumentTitle('Tracking Bugar');
  const navigate = useNavigate();
  const location = useLocation();
  const querySport = new URLSearchParams(location.search).get('sport');
  const sport = location.state?.sport || querySport;
  const validSport = sport === 'run' || sport === 'cycle';

  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const draftRef = useRef(loadBugarDraft());
  const draft = draftRef.current;
  const canRestore = !!(validSport && draft && draft.sport === sport);

  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [startedAtMs, setStartedAtMs] = useState(null);
  const [pausedAccumMs, setPausedAccumMs] = useState(0);
  const [pauseStartedMs, setPauseStartedMs] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const restoredRef = useRef(false);
  const wakeLockRef = useRef(null);

  const accentColor = ACCENT[sport] || ACCENT.run;
  const {
    points,
    distanceKm,
    movingDurationSec,
    error,
    reset,
    hydrate,
    lastFix,
    isMoving,
  } = useGeolocationTrack({ active: running && validSport, sport: validSport ? sport : 'run' });

  const draftStepInitial = canRestore && draft?.stepCount != null ? Number(draft.stepCount) : 0;
  const draftModeInitial = canRestore && draft?.stepMode ? draft.stepMode : null;

  const {
    steps,
    mode: stepMode,
    activateCounting,
  } = useStepCounter({
    enabled: running && sport === 'run',
    heightCm: Number(profile?.height_cm),
    distanceKm,
    initialSteps: draftStepInitial,
    initialMode: draftModeInitial,
  });

  useEffect(() => {
    if (!validSport) {
      navigate('/bugar', { replace: true });
    }
  }, [validSport, navigate]);

  useEffect(() => {
    let cancelled = false;
    fetchBugarProfile()
      .then((p) => {
        if (cancelled) return;
        if (!isBugarBodyComplete(p)) {
          navigate('/bugar', { replace: true });
          return;
        }
        setProfile(p);
      })
      .catch((err) => {
        if (!cancelled) setProfileError(err.response?.data?.message || 'Gagal memuat profil');
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const computeElapsed = useCallback(() => {
    if (startedAtMs == null) return 0;
    const pauseExtra = pauseStartedMs != null ? Date.now() - pauseStartedMs : 0;
    const paused = pausedAccumMs + (running ? 0 : pauseExtra);
    return Math.max(0, Math.floor((Date.now() - startedAtMs - paused) / 1000));
  }, [startedAtMs, pausedAccumMs, pauseStartedMs, running]);

  const persistDraft = useCallback(() => {
    if (startedAtMs == null || !startedAt || !validSport) return;
    saveBugarDraft({
      sport,
      startedAt,
      startedAtMs,
      pausedAccumMs: pausedAccumMs + (pauseStartedMs != null && !running ? Date.now() - pauseStartedMs : 0),
      running,
      distanceKm,
      movingDurationSec,
      points,
      stepCount: steps,
      stepMode: stepMode === 'idle' ? undefined : stepMode,
      updatedAt: new Date().toISOString(),
    });
  }, [sport, validSport, startedAt, startedAtMs, pausedAccumMs, pauseStartedMs, running, distanceKm, movingDurationSec, points, steps, stepMode]);

  const requestWakeLock = useCallback(async () => {
    try {
      if (!('wakeLock' in navigator) || !running) return;
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // best-effort
    }
  }, [running]);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (!canRestore || !draft) return;
    hydrate({
      points: draft.points,
      distanceKm: draft.distanceKm,
      movingDurationSec: draft.movingDurationSec,
    });
    setStartedAt(draft.startedAt);
    setStartedAtMs(draft.startedAtMs);
    setPausedAccumMs(draft.pausedAccumMs);
    setRunning(draft.running);
    if (!draft.running) setPauseStartedMs(Date.now());
  }, [canRestore, draft, hydrate]);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation tidak didukung di perangkat ini.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocateError('Izin lokasi ditolak. Aktifkan lokasi di pengaturan browser/HP.');
        } else {
          setLocateError('Gagal mengambil lokasi. Coba lagi di area terbuka.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    handleLocate();
  }, []);

  useEffect(() => {
    const tick = () => setElapsedSec(computeElapsed());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [computeElapsed]);

  useEffect(() => {
    if (lastFix) setUserLocation({ lat: lastFix.lat, lng: lastFix.lng });
  }, [lastFix]);

  useEffect(() => {
    if (running) {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }
    return () => {
      void releaseWakeLock();
    };
  }, [running, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setElapsedSec(computeElapsed());
        if (running) void requestWakeLock();
      }
      persistDraft();
    };
    const onHide = () => persistDraft();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, [computeElapsed, persistDraft, running, requestWakeLock]);

  useEffect(() => {
    if (startedAtMs == null) return;
    persistDraft();
    const id = window.setInterval(() => persistDraft(), 5000);
    return () => clearInterval(id);
  }, [startedAtMs, persistDraft, points, distanceKm, movingDurationSec, running, steps, stepMode]);

  const calories = profile
    ? calcCalories({
        sport,
        weightKg: Number(profile.weight_kg),
        distanceKm,
        durationSec: movingDurationSec,
        haidMode: profile.haid_active === true,
      })
    : 0;
  const durationForAvg = movingDurationSec > 0 ? movingDurationSec : elapsedSec;
  const avgPace = paceMinPerKm(distanceKm, durationForAvg);
  const avgSpeed = avgSpeedKmh(distanceKm, durationForAvg);
  const currentPace = isMoving ? rollingPaceMinPerKm(points) : 0;
  const currentSpeed = isMoving ? rollingSpeedKmh(points) : 0;
  const metricLabel = sport === 'run' ? 'Pace' : 'Speed';
  const metricValue = sport === 'run' ? formatPace(currentPace) : formatSpeed(currentSpeed);
  const avgMetricValue = sport === 'run' ? formatPace(avgPace) : formatSpeed(avgSpeed);
  const mapLocation = lastFix
    ? { lat: lastFix.lat, lng: lastFix.lng }
    : userLocation;

  const leaveTracking = () => {
    clearBugarDraft();
    reset();
    navigate('/bugar');
  };

  const handleBack = () => {
    if (running || elapsedSec > 0) {
      setConfirmOpen(true);
      return;
    }
    leaveTracking();
  };

  const handleToggle = async () => {
    if (running) {
      setPauseStartedMs(Date.now());
      setRunning(false);
      return;
    }
    if (startedAtMs == null) {
      const now = Date.now();
      setStartedAt(new Date(now).toISOString());
      setStartedAtMs(now);
      setPausedAccumMs(0);
      setPauseStartedMs(null);
      if (sport === 'run') {
        await activateCounting();
      }
    } else if (pauseStartedMs != null) {
      setPausedAccumMs((p) => p + (Date.now() - pauseStartedMs));
      setPauseStartedMs(null);
    }
    setRunning(true);
  };

  const handleSave = async () => {
    if (!profile) return;
    const endedAt = new Date().toISOString();
    const durationSec = computeElapsed();
    const storedUser = (() => {
      try {
        return JSON.parse(localStorage.getItem('alora_user') || sessionStorage.getItem('alora_user') || 'null');
      } catch {
        return null;
      }
    })();

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        client_session_id: crypto.randomUUID?.() ?? Date.now().toString(36),
        sport,
        started_at: startedAt ?? endedAt,
        ended_at: endedAt,
        duration_sec: durationSec,
        distance_km: Math.round(distanceKm * 100) / 100,
        calories,
        avg_pace_or_speed: (() => {
          const durationForAvgSave = movingDurationSec > 0 ? movingDurationSec : durationSec;
          return sport === 'run'
            ? paceMinPerKm(distanceKm, durationForAvgSave)
            : avgSpeedKmh(distanceKm, durationForAvgSave);
        })(),
        points: downsamplePoints(points),
        employee_name: storedUser?.name || null,
      };
      if (sport === 'run') {
        const source = stepMode === 'sensor' ? 'sensor' : 'estimate';
        const finalSteps = stepMode === 'idle'
          ? estimateStepsFromDistance(distanceKm, Number(profile.height_cm))
          : steps;
        payload.step_count = finalSteps;
        payload.step_source = source;
      }
      if (profile.haid_active === true) {
        payload.haid_mode = true;
      }
      await postBugarSession(payload);
      clearBugarDraft();
      reset();
      navigate('/bugar');
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Gagal menyimpan sesi');
    } finally {
      setSaving(false);
    }
  };

  if (!validSport) return null;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 pb-6">
      <header className="relative pt-5 pb-5 px-5 bg-[#050B14] rounded-b-[36px] overflow-hidden shadow-xl text-white flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E203B] via-[#071324] to-[#040810]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            className="w-9 h-9 rounded-[11px] bg-white/10 border border-white/12 text-white grid place-items-center flex-shrink-0"
            onClick={handleBack}
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold tracking-[.12em] uppercase text-white/80">
              Pegawai Alora
            </div>
            <div className="text-[15px] font-extrabold text-white tracking-[-0.01em] truncate">
              {sport === 'run' ? 'Lari' : 'Sepeda'}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pt-4 flex flex-col gap-3">
        <BugarTrackingMap
          points={points}
          userLocation={mapLocation}
          accentColor={accentColor}
          following={running}
          locating={locating}
          onLocate={handleLocate}
        />

        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          className="w-full py-3 rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-navy-950"
        >
          {locating ? 'Mengambil lokasi…' : mapLocation ? 'Perbarui lokasi saya' : 'Ambil lokasi perangkat'}
        </button>

        {(error || locateError || profileError || saveError) && (
          <div className="text-[12px] font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-2">
            {saveError || profileError || locateError || error}
          </div>
        )}

        {profile?.haid_active && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-[11px] text-rose-800 font-medium leading-relaxed">
            Mode Haid — olahraga ringan: jalan pelan atau sepeda santai, 15–30 menit. Istirahat jika tubuh lemas.
          </div>
        )}

        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-[44px] font-extrabold text-navy-950 leading-none">{distanceKm.toFixed(2)}</span>
            <span className="text-[16px] text-slate-500 font-medium">km</span>
          </div>
          <div className="text-[12px] text-slate-400 mt-1">
            {running ? (isMoving ? 'Bergerak' : 'Diam · jarak tidak naik') : 'Siap tracking'} · {sport === 'run' ? 'Lari' : 'Sepeda'}
          </div>
        </div>

        <div className={sport === 'run' ? 'grid grid-cols-2 gap-2.5' : 'grid grid-cols-3 gap-2.5'}>
          <div className="bg-white rounded-[16px] border border-slate-200 p-3 text-center">
            <div className="text-[10px] text-slate-400 mb-1">Waktu</div>
            <div className="text-[16px] font-extrabold text-navy-950">{fmtTime(elapsedSec)}</div>
          </div>
          <div className="bg-white rounded-[16px] border border-slate-200 p-3 text-center">
            <div className="text-[10px] text-slate-400 mb-1">{metricLabel}</div>
            <div className="text-[14px] font-extrabold text-navy-950">{metricValue}</div>
            {distanceKm > 0 && (
              <div className="text-[9px] text-slate-400 mt-0.5">Rata-rata {avgMetricValue}</div>
            )}
          </div>
          {sport === 'run' && (
            <div className="bg-white rounded-[16px] border border-slate-200 p-3 text-center">
              <div className="text-[10px] text-slate-400 mb-1">Langkah</div>
              <div className="text-[16px] font-extrabold text-navy-950">{steps.toLocaleString('id-ID')}</div>
              <div className="text-[9px] text-slate-400">
                {stepMode === 'sensor' ? 'sensor' : stepMode === 'estimate' ? 'estimasi' : '—'}
              </div>
            </div>
          )}
          <div className="bg-white rounded-[16px] border border-slate-200 p-3 text-center">
            <div className="text-[10px] text-slate-400 mb-1">Kalori</div>
            <div className="text-[16px] font-extrabold text-navy-950">{calories}</div>
            <div className="text-[9px] text-slate-400">estimasi</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          className="w-full py-4 rounded-xl bg-navy-950 text-white text-[16px] font-extrabold flex items-center justify-center gap-2"
        >
          {running ? (
            <><Pause className="w-4 h-4" fill="currentColor" /> Jeda</>
          ) : elapsedSec > 0 ? (
            <><Play className="w-4 h-4" fill="currentColor" /> Lanjut</>
          ) : (
            <><Play className="w-4 h-4" fill="currentColor" /> {sport === 'run' ? 'Mulai Lari' : 'Mulai Sepeda'}</>
          )}
        </button>

        {elapsedSec > 0 && !running && (
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full py-3 rounded-[18px] border border-slate-200 bg-white text-slate-500 text-[14px] font-semibold flex items-center justify-center gap-2"
          >
            <Square className="w-3.5 h-3.5" fill="currentColor" /> Selesai & Simpan
          </button>
        )}
      </main>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          leaveTracking();
        }}
        title="Buang sesi?"
        message="Buang sesi tracking ini?"
        confirmText="Buang"
        cancelText="Batal"
      />
    </div>
  );
}
