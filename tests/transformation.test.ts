import assert from 'node:assert/strict';
import test from 'node:test';

import { createTransformationSession, groupTransformationSessionsByMonth } from '../src/lib/transformation';
import type { TransformationSession } from '../src/types';

test('createTransformationSession creates a normalized session', () => {
  const session = createTransformationSession({
    userId: 'user-1',
    date: '2026-07-26T00:00:00.000Z',
    notes: 'Progress is trending positively.',
  });

  assert.equal(session.userId, 'user-1');
  assert.ok(session.sessionId.startsWith('session-'));
  assert.equal(session.photos.length, 0);
  assert.equal(session.notes, 'Progress is trending positively.');
});

test('groupTransformationSessionsByMonth groups entries by month', () => {
  const sessions: TransformationSession[] = [
    {
      userId: 'user-1',
      date: '2026-07-15T00:00:00.000Z',
      weight: 78,
      notes: '',
      coachNotes: '',
      measurements: {},
      photos: [],
      createdAt: '2026-07-15T00:00:00.000Z',
      updatedAt: '2026-07-15T00:00:00.000Z',
      thumbnail: '',
    },
    {
      userId: 'user-1',
      date: '2026-06-10T00:00:00.000Z',
      weight: 80,
      notes: '',
      coachNotes: '',
      measurements: {},
      photos: [],
      createdAt: '2026-06-10T00:00:00.000Z',
      updatedAt: '2026-06-10T00:00:00.000Z',
      thumbnail: '',
    },
  ];

  const grouped = groupTransformationSessionsByMonth(sessions);
  assert.equal(grouped['Jul 2026']?.length, 1);
  assert.equal(grouped['Jun 2026']?.length, 1);
});
