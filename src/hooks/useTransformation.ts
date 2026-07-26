import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { TransformationPhoto, TransformationReport, TransformationSession } from '../types';
import { createTransformationSession, generateTransformationAnalysis } from '../lib/transformation';

export function useTransformation(userId?: string) {
  const [sessions, setSessions] = useState<TransformationSession[]>([]);
  const [reports, setReports] = useState<TransformationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;

    const sessionsRef = collection(db, 'users', userId, 'transformationSessions');
    const sessionsQuery = query(sessionsRef, orderBy('date', 'desc'));
    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TransformationSession));
      setSessions(items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Unable to load transformation sessions');
      setLoading(false);
    });

    const reportsRef = collection(db, 'users', userId, 'transformationReports');
    const reportsQuery = query(reportsRef, orderBy('generatedAt', 'desc'));
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TransformationReport));
      setReports(items);
    });

    return () => {
      unsubscribeSessions();
      unsubscribeReports();
    };
  }, [userId]);

  const saveSession = useCallback(async (session: TransformationSession) => {
    if (!userId) return null;
    const payload = createTransformationSession({ ...session, userId });
    const sessionId = payload.id || `transformation-${Date.now()}`;
    const persisted = { ...payload, id: sessionId };
    await setDoc(doc(db, 'users', userId, 'transformationSessions', sessionId), persisted);
    return persisted;
  }, [userId]);

  const saveReport = useCallback(async (report: TransformationReport) => {
    if (!userId) return null;
    const reportId = report.id || `report-${Date.now()}`;
    const persisted = { ...report, id: reportId };
    await setDoc(doc(db, 'users', userId, 'transformationReports', reportId), persisted);
    return persisted;
  }, [userId]);

  const generateAndSaveReport = useCallback(async (session: TransformationSession, profile?: any) => {
    const report = await generateTransformationAnalysis(session, profile);
    const persisted = await saveReport(report);
    await setDoc(doc(db, 'users', userId || '', 'transformationSessions', session.id || session.sessionId || 'unknown'), { aiReportId: persisted?.id || report.id });
    return persisted;
  }, [saveReport, userId]);

  const deleteSession = useCallback(async (session: TransformationSession) => {
    if (!userId || !session.id) return;
    await deleteDoc(doc(db, 'users', userId, 'transformationSessions', session.id));
    await Promise.all((session.photos || []).map((photo) => {
      if (!photo.storagePath) return Promise.resolve();
      return deleteObject(ref(storage, photo.storagePath)).catch(() => undefined);
    }));
  }, [userId]);

  return useMemo(() => ({
    sessions,
    reports,
    loading,
    error,
    saveSession,
    saveReport,
    generateAndSaveReport,
    deleteSession,
  }), [deleteSession, error, generateAndSaveReport, loading, reports, saveReport, saveSession, sessions]);
}

export default useTransformation;
