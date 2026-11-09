// EPSILON supaya 3,85 tidak terbaca 3,8499999 lalu turun.
const round1 = (value) => Math.round((value + Number.EPSILON) * 10) / 10;

/** Bintang dari PDF: ≤2,0 Basic, ≤3,0 Intermediate, di bawah 3,9 Proficient, 3,9 ke atas Master. */
export function starFromScore(score) {
  if (score <= 2) return 1;
  if (score <= 3) return 2;
  if (score < 3.9) return 3;
  return 4;
}

/**
 * Nilai posisi = Σ (rata-rata indikator kategori × bobot kategori).
 * Rata-rata kategori dibulatkan 1 desimal seperti yang tampil di rapor, lalu nilai posisi juga 1 desimal.
 */
export function computeSkillScore(categories) {
  const categoryAverages = categories.map((c) => round1(c.scores.reduce((sum, s) => sum + Number(s), 0) / c.scores.length));
  const score = round1(categories.reduce((sum, c, i) => sum + (categoryAverages[i] * Number(c.weight)) / 100, 0));
  return { categoryAverages, score, star: starFromScore(score) };
}
