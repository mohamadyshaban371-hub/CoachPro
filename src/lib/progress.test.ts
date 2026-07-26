import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBodyMetrics, calculateProgressDiffs } from './progress';

test('calculateBodyMetrics computes BMI, BMR, and TDEE from latest measurements', () => {
  const metrics = calculateBodyMetrics({
    weight: 72,
    fatPercentage: 18,
    muscleMass: 32,
    waterPercentage: 61,
    protein: 160,
    photos: { front: '', side: '', inBody: '' },
  }, {
    height: 175,
    birthDate: '1995-02-12',
    gender: 'male',
  });

  assert.equal(metrics.bmi.toFixed(1), '23.5');
  assert.equal(metrics.bmr, 1682);
  assert.equal(metrics.tdee, 2608);
});

test('calculateProgressDiffs returns signed deltas versus the previous entry', () => {
  const diffs = calculateProgressDiffs(
    {
      weight: 72,
      fatPercentage: 18,
      muscleMass: 32,
      waterPercentage: 61,
      protein: 160,
      photos: { front: '', side: '', inBody: '' },
    },
    {
      weight: 74,
      fatPercentage: 20,
      muscleMass: 31,
      waterPercentage: 59,
      protein: 155,
      photos: { front: '', side: '', inBody: '' },
    }
  );

  assert.equal(diffs.weight, -2);
  assert.equal(diffs.fatPercentage, -2);
  assert.equal(diffs.muscleMass, 1);
  assert.equal(diffs.waterPercentage, 2);
});
