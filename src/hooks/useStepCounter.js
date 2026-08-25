import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createStepDetector,
  estimateStepsFromDistance,
  magnitudeFromAcceleration,
} from '../utils/bugarSteps.js';

export function useStepCounter({
  enabled,
  heightCm,
  distanceKm,
  initialSteps = 0,
  initialMode = null,
}) {
  const stepsRef = useRef(initialSteps);
  const [steps, setSteps] = useState(initialSteps);
  const [mode, setMode] = useState(initialMode || 'idle');
  const modeRef = useRef(initialMode || 'idle');
  const detectRef = useRef(createStepDetector());
  const hydratedRef = useRef(false);

  const syncSteps = useCallback((value) => {
    stepsRef.current = value;
    setSteps(value);
  }, []);

  const requestMotionPermission = useCallback(async () => {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const result = await DeviceMotionEvent.requestPermission();
        return result === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }, []);

  const activateCounting = useCallback(async () => {
    const granted = await requestMotionPermission();
    const nextMode = granted ? 'sensor' : 'estimate';
    modeRef.current = nextMode;
    setMode(nextMode);
    if (nextMode === 'estimate') {
      syncSteps(estimateStepsFromDistance(distanceKm, heightCm));
    }
    return nextMode;
  }, [requestMotionPermission, distanceKm, heightCm, syncSteps]);

  useEffect(() => {
    if (!enabled || modeRef.current !== 'estimate') return;
    syncSteps(estimateStepsFromDistance(distanceKm, heightCm));
  }, [enabled, distanceKm, heightCm, syncSteps]);

  useEffect(() => {
    if (!enabled || modeRef.current !== 'sensor') return undefined;

    const onMotion = (event) => {
      const magnitude = magnitudeFromAcceleration(event.accelerationIncludingGravity);
      if (detectRef.current(magnitude)) {
        syncSteps(stepsRef.current + 1);
      }
    };

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [enabled, syncSteps]);

  useEffect(() => {
    if (hydratedRef.current || !initialMode) return;
    hydratedRef.current = true;
    modeRef.current = initialMode;
    setMode(initialMode);
    syncSteps(initialSteps);
  }, [initialMode, initialSteps, syncSteps]);

  return {
    steps,
    mode: enabled ? mode : mode === 'idle' ? 'idle' : mode,
    requestMotionPermission,
    activateCounting,
  };
}
