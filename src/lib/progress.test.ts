import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgressAnalytics, calculateBodyMetrics, calculateProgressDiffs } from './progress';

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
  assert.equal(metrics.bmr, 1664);
  assert.equal(metrics.tdee, 2579);
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

test('buildProgressAnalytics creates trend summaries and chart data', () => {
  const analytics = buildProgressAnalytics([
    {
      date: '2024-01-01T00:00:00.000Z',
      weight: 80,
      fatPercentage: 24,
      muscleMass: 30,
      waterPercentage: 58,
      protein: 160,
      photos: { front: '', side: '', inBody: '' },
    },
    {
      date: '2024-02-01T00:00:00.000Z',
      weight: 78,
      fatPercentage: 22,
      muscleMass: 31,
      waterPercentage: 60,
      protein: 170,
      photos: { front: '', side: '', inBody: '' },
    },
  ], {
    height: 175,
    birthDate: '1995-02-12',
    gender: 'male',
    goal: 'loss',
  } as any);

  assert.equal(analytics.summary.start, 80);
  assert.equal(analytics.summary.current, 78);
  assert.equal(analytics.summary.change, -2);
  assert.equal(analytics.summary.changePercent, -2.5);
  assert.equal(analytics.summary.goal, 'خسارة الدهون');
  assert.equal(analytics.chartData[analytics.chartData.length - 1].bmi, 25.5);
  assert.equal(analytics.metrics[0].current, 78);
});
