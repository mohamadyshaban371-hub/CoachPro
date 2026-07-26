import React, { useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { useAIWorkoutGenerator } from '../hooks/useAIWorkoutGenerator';
import type { ClientTrainingProfile, AIGeneratedProgram } from '../types';
import { 
  Sparkles, Download, Save, Copy, Send, Eye, X, Loader, Edit2, ChevronDown, ChevronUp, Dumbbell, Calendar, Clock, Target, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIWorkoutGeneratorUIProps {
  clientUid?: string;
  onSave?: (program: AIGeneratedProgram) => void;
}

export default function AIWorkoutGeneratorUI({ clientUid: propClientUid, onSave }: AIWorkoutGeneratorUIProps) {
  const { user } = useAuth();
  const clientUid = propClientUid || user?.uid;
  
  const { generateProgram, program, loading, error } = useAIWorkoutGenerator();
  
  const [showForm, setShowForm] = useState(!program);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<Partial<ClientTrainingProfile>>({
    goal: 'hypertrophy',
    age: 25,
    gender: 'male',
    height: 180,
    weight: 80,
    bodyFat: 15,
    experience: 'intermediate',
    injuries: [],
    weakMuscles: [],
    strongMuscles: [],
    availableEquipment: ['barbell', 'dumbbells', 'cables'],
    trainingLocation: 'gym',
    availableDays: 4,
    sessionDuration: 60,
    recoveryQuality: 7,
    sleepHours: 7,
    stressLevel: 5,
    preferredStyle: 'strength',
    periodizationPreference: 'linear',
  });

  const handleGenerateProgram = async () => {
    if (!clientUid) {
      alert('Please log in first');
      return;
    }

    const fullProfile: ClientTrainingProfile = {
      clientUid,
      goal: (profile.goal || 'hypertrophy') as any,
      age: profile.age || 25,
      gender: (profile.gender || 'male') as 'male' | 'female' | 'other',
      height: profile.height || 180,
      weight: profile.weight || 80,
      bodyFat: profile.bodyFat || 15,
      experience: (profile.experience || 'intermediate') as 'beginner' | 'intermediate' | 'advanced' | 'elite',
      injuries: profile.injuries || [],
      weakMuscles: profile.weakMuscles || [],
      strongMuscles: profile.strongMuscles || [],
      availableEquipment: profile.availableEquipment || ['barbell', 'dumbbells', 'cables'],
      trainingLocation: (profile.trainingLocation || 'gym') as 'gym' | 'home' | 'both',
      availableDays: profile.availableDays || 4,
      sessionDuration: profile.sessionDuration || 60,
      recoveryQuality: profile.recoveryQuality || 7,
      sleepHours: profile.sleepHours || 7,
      stressLevel: profile.stressLevel || 5,
      preferredStyle: (profile.preferredStyle || 'strength') as 'strength' | 'hypertrophy' | 'endurance' | 'functional' | 'powerlifting',
      periodizationPreference: (profile.periodizationPreference || 'linear') as 'linear' | 'undulating' | 'block' | 'conjugate',
    };

    await generateProgram(fullProfile);
    setShowForm(false);
  };

  const handleExportPDF = () => {
    if (!program) return;
    
    const content = `
AI Generated Training Program
Goal: ${program.profile.goal}
Generated: ${new Date(program.generatedAt).toLocaleDateString()}

Weekly Schedule:
${Object.entries(program.weeklySchedule || {})
  .map(([day, exercises]) => {
    if (typeof exercises === 'string') return `${day}: ${exercises}`;
    const exList = Array.isArray(exercises) 
      ? exercises.map((e: any) => `${e.name} - ${e.sets}x${e.reps}`).join(', ')
      : 'Rest day';
    return `${day}: ${exList}`;
  })
  .join('\n')}

Progression Strategy:
${program.progressionStrategy || 'Follow RPE-based progression'}

Periodization Plan:
${program.periodizationPlan?.map((block: any) => `${block.name}: ${block.duration} weeks`).join(', ') || 'Linear progression'}

Rationale:
${program.rationale || 'Program designed based on your profile'}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-program-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (program && onSave) {
      onSave(program);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Sparkles className="h-6 w-6 text-cyan-400" />
            AI Workout Generator
          </h2>
          <p className="mt-1 text-sm text-slate-400">Create personalized training programs powered by AI</p>
        </div>
        {program && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {showForm ? 'View Program' : 'Edit Profile'}
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mb-2 inline h-4 w-4" /> {error}
        </div>
      )}

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 space-y-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 p-6"
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Goal */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Training Goal</span>
                <select
                  value={profile.goal || 'hypertrophy'}
                  onChange={(e) => setProfile({ ...profile, goal: e.target.value as any })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                >
                  <option value="strength">Strength</option>
                  <option value="hypertrophy">Hypertrophy</option>
                  <option value="power">Power</option>
                  <option value="endurance">Endurance</option>
                  <option value="fat-loss">Fat Loss</option>
                </select>
              </label>

              {/* Experience */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Experience Level</span>
                <select
                  value={profile.experience || 'intermediate'}
                  onChange={(e) => setProfile({ ...profile, experience: e.target.value as any })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                >
                  <option value="beginner">Beginner (0-1 years)</option>
                  <option value="intermediate">Intermediate (1-3 years)</option>
                  <option value="advanced">Advanced (3-5 years)</option>
                  <option value="elite">Elite (5+ years)</option>
                </select>
              </label>

              {/* Age */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Age</span>
                <input
                  type="number"
                  value={profile.age || 25}
                  onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                />
              </label>

              {/* Weight */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Weight (kg)</span>
                <input
                  type="number"
                  value={profile.weight || 80}
                  onChange={(e) => setProfile({ ...profile, weight: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                />
              </label>

              {/* Body Fat */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Body Fat %</span>
                <input
                  type="number"
                  value={profile.bodyFat || 15}
                  onChange={(e) => setProfile({ ...profile, bodyFat: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                />
              </label>

              {/* Training Days */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Available Days/Week</span>
                <select
                  value={profile.availableDays || 4}
                  onChange={(e) => setProfile({ ...profile, availableDays: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                >
                  {[3, 4, 5, 6].map(d => <option key={d} value={d}>{d} days</option>)}
                </select>
              </label>

              {/* Session Duration */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Session Duration (min)</span>
                <input
                  type="number"
                  value={profile.sessionDuration || 60}
                  onChange={(e) => setProfile({ ...profile, sessionDuration: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                />
              </label>

              {/* Sleep */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Average Sleep (hours)</span>
                <input
                  type="number"
                  step="0.5"
                  value={profile.sleepHours || 7}
                  onChange={(e) => setProfile({ ...profile, sleepHours: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                />
              </label>

              {/* Stress Level */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Stress Level (1-10)</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={profile.stressLevel || 5}
                  onChange={(e) => setProfile({ ...profile, stressLevel: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="mt-1 text-right text-sm text-slate-400">{profile.stressLevel}</div>
              </label>

              {/* Periodization */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Periodization Model</span>
                <select
                  value={profile.periodizationPreference || 'linear'}
                  onChange={(e) => setProfile({ ...profile, periodizationPreference: e.target.value as any })}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-white outline-none"
                >
                  <option value="linear">Linear</option>
                  <option value="undulating">Undulating</option>
                  <option value="block">Block</option>
                  <option value="conjugate">Conjugate</option>
                </select>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGenerateProgram}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Program
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Program Display */}
      {program && !showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Program Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Goal</p>
              <p className="mt-1 text-lg font-bold text-white capitalize">{program.profile.goal}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Experience Level</p>
              <p className="mt-1 text-lg font-bold text-white capitalize">{program.profile.experience}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Training Days/Week</p>
              <p className="mt-1 text-lg font-bold text-white">{program.profile.availableDays}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Session Duration</p>
              <p className="mt-1 text-lg font-bold text-white">{program.profile.sessionDuration} min</p>
            </div>
          </div>

          {/* Weekly Schedule */}
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <h3 className="mb-4 font-semibold text-white">Weekly Schedule</h3>
            <div className="space-y-2">
              {program.weeklySchedule && Object.entries(program.weeklySchedule).map(([day, exercises]) => (
                <div
                  key={day}
                  className="cursor-pointer rounded-lg border border-white/5 bg-slate-900/30 p-3 hover:border-white/20"
                  onClick={() => setExpandedDay(expandedDay === day ? null : day)}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white capitalize">{day}</p>
                    {expandedDay === day ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  {expandedDay === day && typeof exercises !== 'string' && Array.isArray(exercises) && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      {exercises.map((ex: any, idx: number) => (
                        <div key={idx} className="text-sm text-slate-300">
                          <p className="font-medium text-white">{ex.name}</p>
                          <p className="text-xs text-slate-500">
                            {ex.sets}x{ex.reps} @ RPE {ex.rpe || '7-8'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Progression Strategy */}
          {program.progressionStrategy && (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <h3 className="mb-2 font-semibold text-white">Progression Strategy</h3>
              <p className="text-sm text-slate-300">{program.progressionStrategy}</p>
            </div>
          )}

          {/* Periodization Plan */}
          {program.periodizationPlan && program.periodizationPlan.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <h3 className="mb-3 font-semibold text-white">Periodization Plan</h3>
              <div className="space-y-2">
                {program.periodizationPlan.map((block: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/30 p-3">
                    <div>
                      <p className="font-medium text-white">{block.name}</p>
                      <p className="text-xs text-slate-500">{block.duration} weeks</p>
                    </div>
                    <p className="text-sm font-semibold text-cyan-400">{block.focusArea || 'Adaptation'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rationale */}
          {program.rationale && (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <h3 className="mb-2 font-semibold text-white">Program Rationale</h3>
              <p className="text-sm text-slate-300">{program.rationale}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
            >
              <Save className="h-4 w-4" />
              Save Program
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-700"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setExpandedDay(null);
              }}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-700"
            >
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </button>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader className="mx-auto mb-4 h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-sm text-slate-400">Generating your personalized program...</p>
          </div>
        </div>
      )}
    </div>
  );
}
