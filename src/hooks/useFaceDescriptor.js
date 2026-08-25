import { useCallback, useEffect, useState } from 'react';
import { computeDescriptorFromVideo, loadFaceModels } from '../utils/faceApiLoader.js';

export function useFaceDescriptor() {
  const [modelsReady, setModelsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadFaceModels()
      .then(() => {
        if (!cancelled) setModelsReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Gagal memuat model wajah');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const captureDescriptor = useCallback(async (videoRef) => {
    const videoEl = videoRef?.current;
    if (!videoEl) {
      throw new Error('Kamera belum siap');
    }

    setLoading(true);
    setError('');

    try {
      await loadFaceModels();
      const descriptor = await computeDescriptorFromVideo(videoEl);
      if (!descriptor) {
        throw new Error('Wajah tidak terdeteksi. Pastikan wajah berada di dalam oval.');
      }
      return descriptor;
    } catch (err) {
      const message = err.message || 'Gagal membaca wajah';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { modelsReady, loading, error, captureDescriptor };
}
