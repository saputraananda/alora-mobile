import * as faceapi from '@vladmandic/face-api';

let loadPromise = null;

const MODEL_BASE = '/models/face-api';

export const FACE_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.6,
});

export async function loadFaceModels() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE),
    ]);
  })();

  return loadPromise;
}

export async function detectFaceDescriptorFromVideo(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return null;

  await loadFaceModels();

  const detection = await faceapi
    .detectSingleFace(videoEl, FACE_DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection?.descriptor) return null;

  return {
    descriptor: Array.from(detection.descriptor),
    box: detection.detection.box,
  };
}

export async function computeDescriptorFromVideo(videoEl) {
  const result = await detectFaceDescriptorFromVideo(videoEl);
  return result?.descriptor ?? null;
}
