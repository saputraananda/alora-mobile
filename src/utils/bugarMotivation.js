export const CALORIE_EQUIVALENTS = [
  { name: '1 porsi nasi putih', calories: 200 },
  { name: '1 pisang', calories: 100 },
  { name: '1 gelas susu', calories: 150 },
  { name: '1 potong roti', calories: 80 },
];

export function getCalorieEquivalent(totalCalories) {
  if (!totalCalories || totalCalories <= 0) return null;

  let best = null;
  for (const item of CALORIE_EQUIVALENTS) {
    if (item.calories <= totalCalories && (!best || item.calories > best.calories)) {
      best = item;
    }
  }
  if (!best) return null;

  const count = Math.floor(totalCalories / best.calories);
  if (count <= 1) return `setara ${best.name}`;
  return `setara ${count}× ${best.name}`;
}

export function computeWeeklyProgress(totalKm, targetKm) {
  const safeTotal = Number(totalKm) || 0;
  const safeTarget = Number(targetKm) || 0;
  const percent = safeTarget > 0 ? Math.min(100, Math.round((safeTotal / safeTarget) * 100)) : 0;
  const remainingKm = Math.max(0, Math.round((safeTarget - safeTotal) * 10) / 10);
  return {
    totalKm: Math.round(safeTotal * 10) / 10,
    targetKm: safeTarget,
    remainingKm,
    percent,
    achieved: safeTarget > 0 && safeTotal >= safeTarget,
  };
}

export function getWeeklyMotivation({ totalKm, targetKm, calories, sessionCount }) {
  const progress = computeWeeklyProgress(totalKm, targetKm);
  const equiv = getCalorieEquivalent(calories);

  if (sessionCount === 0) {
    return {
      headline: 'Ayok semangat!',
      subline: 'Mulai sesi pertamamu minggu ini.',
      calorieLine: null,
    };
  }

  if (progress.achieved) {
    return {
      headline: 'Target mingguan tercapai!',
      subline: 'Mantap — pertahankan ritmemu.',
      calorieLine: calories > 0 && equiv ? `Kalori terbakar ~${calories} kcal — ${equiv}` : null,
    };
  }

  if (progress.percent >= 50) {
    return {
      headline: 'Sudah setengah jalan!',
      subline: `Tinggal ${progress.remainingKm} km lagi.`,
      calorieLine: calories > 0 && equiv ? `Kalori terbakar ~${calories} kcal — ${equiv}` : null,
    };
  }

  return {
    headline: 'Ayok semangat!',
    subline: `Kurang ${progress.remainingKm} km menuju target mingguan.`,
    calorieLine: calories > 0 && equiv ? `Kalori terbakar ~${calories} kcal — ${equiv}` : null,
  };
}
