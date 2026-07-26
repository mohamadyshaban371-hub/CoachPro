import React from 'react';
import type { ProfessionalExercise } from '../types';

interface Props {
  exercise: ProfessionalExercise | null;
  onClose?: () => void;
}

export default function ExerciseDetails({ exercise, onClose }: Props) {
  if (!exercise) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 max-w-3xl rounded-2xl bg-slate-900 p-6 text-slate-100">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{exercise.name}</h3>
            <p className="text-sm text-slate-400">{exercise.arabicName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400">Close</button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-slate-300">Category: {exercise.category}</p>
            <p className="mb-2 text-sm text-slate-300">Primary: {exercise.muscleGroup}</p>
            <p className="mb-2 text-sm text-slate-300">Secondary: {(exercise.secondaryMuscles || []).join(', ')}</p>
            <p className="mb-2 text-sm text-slate-300">Equipment: {exercise.equipment}</p>
            <p className="mb-2 text-sm text-slate-300">Difficulty: {exercise.difficulty}</p>
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-300">Type: {exercise.exerciseType}</p>
            <p className="mb-2 text-sm text-slate-300">Movement: {exercise.movementPattern}</p>
            <p className="mb-2 text-sm text-slate-300">Unilateral: {exercise.unilateral ? 'Yes' : 'No'}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm text-slate-300">
          <div>
            <h4 className="font-semibold text-white">Instructions</h4>
            <p>{exercise.instructions}</p>
          </div>
          <div>
            <h4 className="font-semibold text-white">Coaching Cues</h4>
            <ul className="list-disc pl-5">
              {(exercise.coachingCues || []).map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white">Common Mistakes</h4>
            <ul className="list-disc pl-5">
              {(exercise.commonMistakes || []).map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white">Alternatives / Replacements</h4>
            <p>{(exercise.replacementExercises || []).join(', ')}</p>
          </div>
          <div>
            <h4 className="font-semibold text-white">Progressions</h4>
            <p>{(exercise.progressionExercises || []).join(', ')}</p>
          </div>
          <div>
            <h4 className="font-semibold text-white">Regressions</h4>
            <p>{(exercise.regressionExercises || []).join(', ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
