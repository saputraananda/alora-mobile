import test from 'node:test';
import assert from 'node:assert/strict';
import { starFromScore, computeSkillScore } from '../api/modules/skill-matrix/skillScore.js';

test('batas bintang sesuai PDF', () => {
  assert.equal(starFromScore(1.0), 1);
  assert.equal(starFromScore(2.0), 1);
  assert.equal(starFromScore(2.1), 2);
  assert.equal(starFromScore(3.0), 2);
  assert.equal(starFromScore(3.1), 3);
  assert.equal(starFromScore(3.8), 3);
  assert.equal(starFromScore(3.9), 4);
  assert.equal(starFromScore(4.0), 4);
});

test('contoh PDF Cuci Satuan: 3,5 × 40% + 3,0 × 30% + 3,0 × 30% = 3,2, Bintang 3', () => {
  const result = computeSkillScore([
    { weight: 40, scores: [3, 4, 4, 3] },
    { weight: 30, scores: [3, 3] },
    { weight: 30, scores: [3, 3, 3] },
  ]);
  assert.deepEqual(result.categoryAverages, [3.5, 3, 3]);
  assert.equal(result.score, 3.2);
  assert.equal(result.star, 3);
});

test('bintang dibaca dari nilai yang sudah dibulatkan', () => {
  // 3,85 tampil 3,9 sehingga Bintang 4, supaya angka dan bintang tidak bertentangan.
  const result = computeSkillScore([
    { weight: 50, scores: [4] },
    { weight: 50, scores: [3.7] },
  ]);
  assert.equal(result.score, 3.9);
  assert.equal(result.star, 4);
});

test('bobot dari database berupa teks desimal tetap terbaca', () => {
  const result = computeSkillScore([
    { weight: '60.00', scores: [2] },
    { weight: '40.00', scores: [4] },
  ]);
  assert.equal(result.score, 2.8);
  assert.equal(result.star, 2);
});
