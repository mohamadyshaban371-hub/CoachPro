import { useCallback, useEffect, useRef, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { playNotify } from '../lib/sounds';
import type { AppNotification, UserProfile } from '../types';

export type NotificationFormState = {
  title: string;
  message: string;
  type: 'birthday' | 'inactivity' | 'system' | 'custom' | 'plan_update';
};

interface UseNotificationsArgs {
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setMessage: React.Dispatch<React.SetStateAction<{ text: string; type: 'success' | 'error' } | null>>;
}

export function useNotifications({ setLoading, setMessage }: UseNotificationsArgs) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<AppNotification[]>([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationTarget, setNotificationTarget] = useState<UserProfile | null>(null);
  const [notificationForm, setNotificationForm] = useState<NotificationFormState>({
    title: '',
    message: '',
    type: 'custom',
  });

  const prevAdminUnreadRef = useRef(0);

  const handleSendNotification = useCallback(async () => {
    if (!notificationTarget || !notificationForm.title || !notificationForm.message) return;

    setLoading(true);
    try {
      const notificationsRef = collection(db, 'users', notificationTarget.uid, 'notifications');
      const newNotification = {
        userId: notificationTarget.uid,
        title: notificationForm.title,
        message: notificationForm.message,
        type: notificationForm.type,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      await addDoc(notificationsRef, newNotification);
      setMessage({ text: 'تم إرسال التنبيه بنجاح', type: 'success' });
      setShowNotificationModal(false);
      setNotificationForm({ title: '', message: '', type: 'custom' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'خطأ في إرسال التنبيه', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [notificationForm.message, notificationForm.title, notificationForm.type, notificationTarget, setLoading, setMessage]);

  useEffect(() => {
    const adminUid = auth.currentUser?.uid;
    if (!adminUid) return;

    const notifRef = collection(db, 'users', adminUid, 'notifications');
    const q = query(notifRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
      const newCount = notifs.filter((n) => !n.isRead).length;
      if (newCount > prevAdminUnreadRef.current) playNotify();
      prevAdminUnreadRef.current = newCount;
      setAdminNotifications(notifs);
    });

    return () => unsub();
  }, []);

  return {
    showNotifications,
    setShowNotifications,
    adminNotifications,
    setAdminNotifications,
    showNotificationModal,
    setShowNotificationModal,
    notificationTarget,
    setNotificationTarget,
    notificationForm,
    setNotificationForm,
    handleSendNotification,
  };
}
