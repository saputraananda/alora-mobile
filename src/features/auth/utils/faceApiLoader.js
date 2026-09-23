let faceapiModule = null;
let loadPromise = null;
let detectorOptions = null;

const MODEL_BASE = '/models/face-api';

async function getFaceApi() {
  if (!faceapiModule) {
    faceapiModule = await import('@vladmandic/face-api');
  }
  return faceapiModule;
}

async function getDetectorOptions() {
  if (!detectorOptions) {
    const faceapi = await getFaceApi();
    detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.6,
    });
  }
  return detectorOptions;
}

export async function loadFaceModels() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const faceapi = await getFaceApi();
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

  const faceapi = await getFaceApi();
  const options = await getDetectorOptions();

  const detection = await faceapi
    .detectSingleFace(videoEl, options)
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
