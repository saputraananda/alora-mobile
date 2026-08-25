import { useCallback, useEffect, useRef, useState } from 'react';
import { detectFaceDescriptorFromVideo } from '../utils/faceApiLoader.js';
import {
  SCAN_INTERVAL_MS,
  STABLE_FRAMES,
  SAMPLE_GAP_MS,
  FAIL_COOLDOWN_MS,
  isFaceInOval,
  countStableFrames,
} from '../utils/faceStability.js';

const PHASE_TEXT = {
  scanning: 'Posisikan wajah Anda di dalam oval',
  hold: 'Tahan wajah...',
  capturing: (n) => `Memindai wajah (${n}/2)...`,
  verifying: 'Memverifikasi...',
  success: 'Berhasil! Masuk...',
};

export function useAutoFaceLogin({
  open,
  videoRef,
  modelsReady,
  ready,
  busy,
  onComplete,
  onFail,
}) {
  const [phase, setPhase] = useState('idle');
  const [statusText, setStatusText] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);

  const historyRef = useRef([]);
  const runningRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const captureLockRef = useRef(false);

  const resetScan = useCallback(() => {
    historyRef.current = [];
    captureLockRef.current = false;
    setSampleIndex(0);
    setPhase('scanning');
    setStatusText(PHASE_TEXT.scanning);
  }, []);

  const triggerFail = useCallback((message) => {
    cooldownUntilRef.current = Date.now() + FAIL_COOLDOWN_MS;
    setPhase('failed');
    setStatusText(message);
    onFail?.(message);
    setTimeout(() => {
      if (runningRef.current) resetScan();
    }, FAIL_COOLDOWN_MS);
  }, [onFail, resetScan]);

  useEffect(() => {
    if (!open) {
      runningRef.current = false;
      historyRef.current = [];
      captureLockRef.current = false;
      setPhase('idle');
      setStatusText('');
      setSampleIndex(0);
      return undefined;
    }

    runningRef.current = true;
    resetScan();

    return () => {
      runningRef.current = false;
    };
  }, [open, resetScan]);

  useEffect(() => {
    if (!open || !ready || !modelsReady || busy) return undefined;

    const tick = async () => {
      if (!runningRef.current || captureLockRef.current || Date.now() < cooldownUntilRef.current) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      try {
        const result = await detectFaceDescriptorFromVideo(video);
        if (!runningRef.current || captureLockRef.current) return;

        if (!result) {
          historyRef.current = [];
          setPhase('scanning');
          setStatusText(PHASE_TEXT.scanning);
          return;
        }

        const { descriptor, box } = result;
        const inOval = isFaceInOval(box, video.videoWidth, video.videoHeight);

        if (!inOval) {
          historyRef.current = [];
          setPhase('scanning');
          setStatusText(PHASE_TEXT.scanning);
          return;
        }

        historyRef.current.push({ box, timestamp: Date.now() });
        if (historyRef.current.length > 8) {
          historyRef.current = historyRef.current.slice(-8);
        }

        const stableCount = countStableFrames(historyRef.current);
        if (stableCount < STABLE_FRAMES) {
          setPhase('hold');
          setStatusText(PHASE_TEXT.hold);
          return;
        }

        captureLockRef.current = true;
        setPhase('capturing');
        setSampleIndex(1);
        setStatusText(PHASE_TEXT.capturing(1));

        const sample1 = descriptor;

        await new Promise((resolve) => {
          setTimeout(resolve, SAMPLE_GAP_MS);
        });

        if (!runningRef.current) {
          captureLockRef.current = false;
          return;
        }

        const result2 = await detectFaceDescriptorFromVideo(video);
        if (!result2?.descriptor) {
          captureLockRef.current = false;
          triggerFail('Wajah tidak terdeteksi saat verifikasi. Coba lagi.');
          return;
        }

        setSampleIndex(2);
        setStatusText(PHASE_TEXT.capturing(2));
        setPhase('verifying');
        setStatusText(PHASE_TEXT.verifying);

        try {
          await onComplete?.([sample1, result2.descriptor]);
          setPhase('success');
          setStatusText(PHASE_TEXT.success);
        } catch (err) {
          captureLockRef.current = false;
          triggerFail(err?.message || 'Login wajah gagal');
        }
      } catch {
        if (runningRef.current && !captureLockRef.current) {
          setPhase('scanning');
          setStatusText(PHASE_TEXT.scanning);
        }
      }
    };

    const id = setInterval(tick, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [open, ready, modelsReady, busy, videoRef, onComplete, triggerFail]);

  return { phase, statusText, sampleIndex, resetScan };
}
