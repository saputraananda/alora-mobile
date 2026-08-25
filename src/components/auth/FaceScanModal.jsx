import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ScanFace, Loader2 } from 'lucide-react';
import { useFaceDescriptor } from '../../hooks/useFaceDescriptor.js';
import { useAutoFaceLogin } from '../../hooks/useAutoFaceLogin.js';

const MANUAL_CAPTURE_GAP_MS = 800;

export default function FaceScanModal({
  open,
  mode = 'manual',
  title = 'Scan Wajah',
  hint = 'Posisikan wajah di dalam oval',
  samplesRequired = 1,
  onComplete,
  onClose,
  busy = false,
  busyLabel = 'Memproses...',
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lastManualCaptureRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState('');
  const [samples, setSamples] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const [localError, setLocalError] = useState('');
  const { modelsReady, loading: modelLoading, error: modelError, captureDescriptor } = useFaceDescriptor();

  const isAutoLogin = mode === 'autoLogin';

  const handleAutoFail = useCallback((message) => {
    setLocalError(message);
  }, []);

  const handleAutoComplete = useCallback(async (descriptors) => {
    setLocalError('');
    await onComplete?.(descriptors);
  }, [onComplete]);

  const autoScan = useAutoFaceLogin({
    open: open && isAutoLogin,
    videoRef,
    modelsReady,
    ready,
    busy: busy || capturing,
    onComplete: handleAutoComplete,
    onFail: handleAutoFail,
  });

  const attachStream = useCallback(async (videoEl, stream) => {
    if (!videoEl || !stream) return;
    videoEl.srcObject = stream;
    try {
      await videoEl.play();
      setReady(true);
    } catch (err) {
      setCamError(err.message || 'Gagal menampilkan kamera');
    }
  }, []);

  const setVideoRef = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      attachStream(node, streamRef.current);
    }
  }, [attachStream]);

  useEffect(() => {
    if (!open) {
      setSamples([]);
      setReady(false);
      setCamError('');
      setLocalError('');
      setCapturing(false);
      lastManualCaptureRef.current = 0;
      return undefined;
    }

    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('Browser tidak mendukung kamera. Gunakan Chrome/Safari terbaru.');
        return;
      }

      setCamError('');
      setReady(false);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          await attachStream(videoRef.current, stream);
        }
      } catch (err) {
        if (!cancelled) {
          const name = err?.name || '';
          if (name === 'NotAllowedError') {
            setCamError('Izin kamera ditolak. Aktifkan kamera untuk browser ini.');
          } else if (name === 'NotFoundError') {
            setCamError('Kamera tidak ditemukan di perangkat ini.');
          } else {
            setCamError(err.message || 'Tidak dapat mengakses kamera');
          }
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [open, attachStream]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleCapture = async () => {
    if (capturing || busy || !ready || !modelsReady) return;

    const now = Date.now();
    if (now - lastManualCaptureRef.current < MANUAL_CAPTURE_GAP_MS) {
      return;
    }

    setCapturing(true);
    setLocalError('');
    try {
      const descriptor = await captureDescriptor(videoRef);
      lastManualCaptureRef.current = Date.now();
      const next = [...samples, descriptor];
      setSamples(next);
      if (next.length >= samplesRequired) {
        await onComplete?.(next);
      }
    } catch (err) {
      setLocalError(err.message || 'Gagal membaca wajah');
    } finally {
      setCapturing(false);
    }
  };

  if (!open) return null;

  const progress = `${Math.min(samples.length + 1, samplesRequired)}/${samplesRequired}`;
  const isDone = samples.length >= samplesRequired;
  const displayError = camError || localError || modelError;
  const actionDisabled = !ready || !modelsReady || capturing || busy || isDone || modelLoading;

  const ovalPulse = isAutoLogin && (autoScan.phase === 'hold' || autoScan.phase === 'capturing' || autoScan.phase === 'verifying');

  const statusLine = isAutoLogin
    ? (busy ? busyLabel : autoScan.statusText || 'Menyiapkan...')
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col bg-[#050B14] text-white">
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <div>
          <h2 className="text-base font-black">{title}</h2>
          {!isAutoLogin && hint && (
            <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy && isAutoLogin}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 relative mx-4 mb-4 rounded-[28px] overflow-hidden bg-black min-h-[280px]">
        <video
          ref={setVideoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />

        {!ready && !camError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="w-8 h-8 animate-spin text-white/80" />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-[62%] max-w-[240px] aspect-[3/4] rounded-[50%] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(5,11,20,0.55)] transition-all ${
              ovalPulse ? 'animate-pulse border-emerald-300/90' : ''
            }`}
          />
        </div>

        {!isAutoLogin && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/55 text-[11px] font-bold">
            Sampel {progress}
          </div>
        )}
      </div>

      <div className="px-4 pb-6 flex flex-col gap-3">
        {isAutoLogin && statusLine && (
          <div className="py-3 px-4 rounded-2xl bg-white/10 text-center">
            <p className="text-[13px] font-bold text-white">{statusLine}</p>
            {(autoScan.phase === 'verifying' || busy) && (
              <Loader2 className="w-5 h-5 animate-spin mx-auto mt-2 text-white/80" />
            )}
          </div>
        )}

        {displayError && (
          <p className="text-[11px] text-rose-300 text-center font-medium">{displayError}</p>
        )}

        {!modelsReady && !modelError && (
          <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Memuat model deteksi wajah...
          </p>
        )}

        {!ready && !camError && modelsReady && !isAutoLogin && (
          <p className="text-[11px] text-slate-400 text-center">Menyiapkan kamera...</p>
        )}

        <p className="text-[10px] text-slate-500 text-center leading-relaxed">
          {isAutoLogin
            ? 'Hanya wajah terdaftar di Profil yang dapat masuk.'
            : 'Wajah disimpan sebagai kode terenkripsi, bukan foto.'}
        </p>

        {!isAutoLogin && (
          <button
            type="button"
            disabled={actionDisabled}
            onClick={handleCapture}
            className="w-full py-3.5 rounded-[16px] bg-white text-[#050B14] font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {capturing || modelLoading || busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ScanFace className="w-4 h-4" />
            )}
            <span>
              {busy
                ? busyLabel
                : samples.length >= samplesRequired
                  ? 'Selesai'
                  : samplesRequired > 1
                    ? `Ambil Sampel (${samples.length}/${samplesRequired})`
                    : 'Ambil & Masuk'}
            </span>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
