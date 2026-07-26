import type { TransformationPhoto, TransformationReport, TransformationSession, UserProfile } from '../types';
import { safeGenerateContent } from '../services/aiMasterEngine';

export const TRANSFORMATION_POSITIONS = ['front', 'side', 'back'] as const;

export function createTransformationSession(input: Partial<TransformationSession> & { userId: string }): TransformationSession {
  const now = new Date().toISOString();
  return {
    id: input.id || `transformation-${Date.now()}`,
    userId: input.userId,
    sessionId: input.sessionId || `session-${Date.now()}`,
    date: input.date || now,
    weight: input.weight || 0,
    bodyFat: input.bodyFat || 0,
    muscleMass: input.muscleMass || 0,
    bmi: input.bmi || 0,
    notes: input.notes || '',
    coachNotes: input.coachNotes || '',
    measurements: input.measurements || {},
    photos: input.photos || [],
    aiReportId: input.aiReportId,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    thumbnail: input.thumbnail || '',
  };
}

export function formatTransformationDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function groupTransformationSessionsByMonth(sessions: TransformationSession[]) {
  return sessions.reduce<Record<string, TransformationSession[]>>((acc, session) => {
    const month = new Date(session.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    acc[month] = [...(acc[month] || []), session];
    return acc;
  }, {});
}

export function buildTransformationStoragePath(userId: string, sessionId: string, position: string) {
  return `transformations/${userId}/${sessionId}/${position}.jpg`;
}

export function buildConversationSummary(session: TransformationSession, profile?: UserProfile) {
  const base = profile?.name || 'Client';
  return `Create a concise transformation report for ${base} based on the following progress session. Use a professional and motivational tone. Return JSON with keys: summary, fatLossEstimation, muscleGainEstimation, postureObservations, weakPoints, strengths, recommendations, motivationSummary.`;
}

export async function generateTransformationAnalysis(session: TransformationSession, profile?: UserProfile): Promise<TransformationReport> {
  const prompt = `${buildConversationSummary(session, profile)}\n\nSession data:\n${JSON.stringify({
    weight: session.weight,
    bodyFat: session.bodyFat,
    muscleMass: session.muscleMass,
    bmi: session.bmi,
    notes: session.notes,
    coachNotes: session.coachNotes,
    measurements: session.measurements,
  }, null, 2)}`;

  try {
    const response = await safeGenerateContent('gemini-1.5-flash', [{ parts: [{ text: prompt }] }], 'You are a transformation coach generating concise insights for a client progress report.', { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 900 });
    const raw = response?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;

    if (parsed) {
      return {
        id: `report-${Date.now()}`,
        userId: session.userId,
        sessionId: session.id || session.sessionId || `session-${Date.now()}`,
        summary: parsed.summary || 'Progress is moving in the right direction.',
        fatLossEstimation: parsed.fatLossEstimation || 'Steady and sustainable progress.',
        muscleGainEstimation: parsed.muscleGainEstimation || 'Lean mass is trending positively.',
        postureObservations: parsed.postureObservations || 'Posture is improving with consistent adherence.',
        weakPoints: Array.isArray(parsed.weakPoints) ? parsed.weakPoints : ['Recovery consistency'],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ['Consistency', 'Discipline'],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : ['Keep following the current plan.'],
        motivationSummary: parsed.motivationSummary || 'You are building momentum.',
        generatedAt: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn('Transformation AI generation failed, using fallback report', error);
  }

  return {
    id: `report-${Date.now()}`,
    userId: session.userId,
    sessionId: session.id || session.sessionId || `session-${Date.now()}`,
    summary: 'The transformation trend is moving in a positive direction.',
    fatLossEstimation: 'Continue the current approach for steady results.',
    muscleGainEstimation: 'Strength and lean mass are trending up.',
    postureObservations: 'Posture is trending better with consistent work.',
    weakPoints: ['Recovery timing'],
    strengths: ['Consistency', 'Commitment'],
    recommendations: ['Stay consistent with the weekly plan.'],
    motivationSummary: 'Every session is a step toward your next milestone.',
    generatedAt: new Date().toISOString(),
  };
}

export async function exportTransformationReportPdf(session: TransformationSession, report?: TransformationReport, profileName?: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(`${profileName || 'Transformation'} Report`, 40, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Session: ${session.date}`, 40, 70);
  doc.text(`Weight: ${session.weight || 0} kg`, 40, 92);
  doc.text(`Body Fat: ${session.bodyFat || 0}%`, 40, 114);
  doc.text(`Muscle Mass: ${session.muscleMass || 0} kg`, 40, 136);
  doc.text(`Coach Notes: ${session.coachNotes || session.notes || '—'}`, 40, 158, { maxWidth: 500 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('AI Summary', 40, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const summary = report?.summary || 'No report generated yet.';
  doc.text(summary, 40, 244, { maxWidth: 500 });

  doc.setFont('helvetica', 'bold');
  doc.text('Recommendations', 40, 310);
  doc.setFont('helvetica', 'normal');
  const recs = report?.recommendations?.join(' • ') || 'Keep training consistently.';
  doc.text(recs, 40, 334, { maxWidth: 500 });

  const firstPhoto = session.photos?.[0]?.url;
  if (firstPhoto) {
    try {
      const res = await fetch(firstPhoto);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      doc.addImage(dataUrl, 'JPEG', 40, 360, 220, 160);
    } catch {
      // Ignore PDF image errors and keep the text summary intact.
    }
  }

  return doc.output('datauristring');
}
