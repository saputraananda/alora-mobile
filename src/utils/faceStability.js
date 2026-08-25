export const SCAN_INTERVAL_MS = 400;
export const STABLE_FRAMES = 3;
export const SAMPLE_GAP_MS = 800;
export const FAIL_COOLDOWN_MS = 2000;
export const MAX_OVAL_JITTER_PX = 18;

function boxCenter(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

export function isFaceInOval(box, videoWidth, videoHeight) {
  if (!box || !videoWidth || !videoHeight) return false;

  const center = boxCenter(box);
  const ovalWidth = videoWidth * 0.62;
  const ovalHeight = ovalWidth * (4 / 3);
  const ovalLeft = (videoWidth - ovalWidth) / 2;
  const ovalTop = (videoHeight - ovalHeight) / 2;

  const nx = (center.x - ovalLeft) / ovalWidth;
  const ny = (center.y - ovalTop) / ovalHeight;

  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const inside = (dx * dx) / 0.25 + (dy * dy) / 0.36 <= 1;

  const minFace = Math.min(videoWidth, videoHeight) * 0.18;
  const maxFace = Math.min(videoWidth, videoHeight) * 0.72;
  const faceSize = Math.max(box.width, box.height);

  return inside && faceSize >= minFace && faceSize <= maxFace;
}

export function isBoxStable(previousBox, currentBox, maxJitterPx = MAX_OVAL_JITTER_PX) {
  if (!previousBox || !currentBox) return false;
  const prev = boxCenter(previousBox);
  const curr = boxCenter(currentBox);
  const dx = Math.abs(prev.x - curr.x);
  const dy = Math.abs(prev.y - curr.y);
  return dx <= maxJitterPx && dy <= maxJitterPx;
}

export function countStableFrames(history, maxJitterPx = MAX_OVAL_JITTER_PX) {
  if (history.length < STABLE_FRAMES) return 0;

  let streak = 1;
  for (let i = history.length - 1; i > 0; i -= 1) {
    if (isBoxStable(history[i - 1].box, history[i].box, maxJitterPx)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}
