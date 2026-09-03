export function derivePunchLocationContext(insideRadius) {
  return insideRadius ? 'office' : 'remote';
}

export function resolveSuggestedMode({ isOffDay, insideRadius }) {
  if (isOffDay) return 'wod';
  if (insideRadius) return 'regular';
  return 'wfa';
}

/** Mirror backend getAllowedModes — WOD allowed every day; off-day = WOD only. */
export function getAllowedModes(isOffDay) {
  if (isOffDay) return ['wod'];
  return ['regular', 'wfa', 'wod'];
}

export const OFF_DAY_BLOCK_MESSAGE =
  'Hari ini libur. Absensi Harian/WFA tidak tersedia. Jika Anda bekerja, pilih Ini WOD.';

export function formatModeLocationLabel({ attendanceMode, punchLocationContextIn }) {
  const mode = attendanceMode || 'regular';
  const ctx = punchLocationContextIn || 'remote';
  if (mode === 'wfa') return 'WFA';
  if (mode === 'wod') return ctx === 'office' ? 'WOD Office' : 'WOD Remote';
  return 'Harian';
}

export function formatLocationDetectedLabel(punchLocationContext) {
  return punchLocationContext === 'office' ? 'HO Alora (Kantor)' : 'Luar kantor (Remote)';
}
