import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck, Trash2, Archive, Search, X, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import type { AppNotification } from '../types';
import {
  archiveNotification,
  deleteNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../core/services/notifications.service';

interface NotificationCenterProps {
  userId?: string;
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const PAGE_SIZE = 8;
const TYPE_OPTIONS = ['all', 'membership', 'progress', 'workout', 'nutrition', 'coach', 'system', 'custom'];
const PRIORITY_OPTIONS = ['all', 'low', 'medium', 'high', 'urgent'];

function normalizeNotification(note: AppNotification) {
  const body = note.body || note.message || '';
  const read = note.read ?? note.isRead ?? false;
  return { ...note, body, read };
}

export default function NotificationCenter({ userId, open, onClose, onUnreadCountChange }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!userId || !open) return;

    setLoading(true);
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AppNotification));
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      console.error('[NotificationCenter] listener error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [open, userId]);

  const normalized = useMemo(() => notifications.map(normalizeNotification), [notifications]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return normalized.filter((note) => {
      const matchesType = typeFilter === 'all' || (note.type || 'system') === typeFilter;
      const matchesPriority = priorityFilter === 'all' || (note.priority || 'medium') === priorityFilter;
      const matchesSearch = !term || [note.title, note.body, note.type].some((value) => (value || '').toLowerCase().includes(term));
      return matchesType && matchesPriority && matchesSearch;
    });
  }, [normalized, priorityFilter, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, priorityFilter]);

  useEffect(() => {
    onUnreadCountChange?.(normalized.filter((note) => !note.read).length);
  }, [normalized, onUnreadCountChange]);

  const handleMarkRead = async (note: AppNotification) => {
    if (!userId) return;
    await markNotificationAsRead(userId, note.id);
  };

  const handleArchive = async (note: AppNotification) => {
    if (!userId) return;
    await archiveNotification(userId, note.id);
  };

  const handleDelete = async (note: AppNotification) => {
    if (!userId) return;
    await deleteNotification(userId, note.id);
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await markAllNotificationsAsRead(userId);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="fixed inset-x-4 top-16 bottom-4 z-[96] max-w-5xl mx-auto overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl"
            dir="rtl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-800/70 px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-white">
                  <Bell size={18} className="text-blue-400" />
                  <h3 className="font-bold text-lg">مركز الإشعارات</h3>
                </div>
                <p className="text-xs text-slate-400">إدارة التنبيهات والرسائل الذكية</p>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-white/10 bg-slate-950/30 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
                  <Search size={16} className="text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="البحث في الإشعارات"
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
                    <Filter size={14} />
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-transparent text-sm text-white outline-none">
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option} className="bg-slate-900 text-white">
                          {option === 'all' ? 'كل الأنواع' : option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
                    <Filter size={14} />
                    <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="bg-transparent text-sm text-white outline-none">
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option} value={option} className="bg-slate-900 text-white">
                          {option === 'all' ? 'كل الأولويات' : option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">إجمالي {filtered.length} إشعار</p>
                <button onClick={handleMarkAllRead} className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 transition hover:bg-emerald-500/20">
                  <CheckCheck size={14} />
                  تعليم الكل كمقروء
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-8 text-center text-sm text-slate-400">جاري تحميل الإشعارات…</div>
              ) : paged.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-800/40 p-8 text-center text-sm text-slate-400">
                  لا توجد إشعارات تطابق الفلاتر الحالية.
                </div>
              ) : (
                paged.map((note) => (
                  <div key={note.id} className={`rounded-2xl border p-4 transition ${note.read ? 'border-white/10 bg-slate-800/70' : 'border-blue-500/20 bg-blue-500/10'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-white">{note.title}</h4>
                          <span className="rounded-full bg-slate-700/70 px-2 py-0.5 text-[10px] text-slate-300">{note.type || 'system'}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${note.priority === 'urgent' ? 'bg-red-500/15 text-red-300' : note.priority === 'high' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                            {note.priority || 'medium'}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-300">{note.body}</p>
                        {note.createdAt && (
                          <p className="mt-2 text-[11px] text-slate-500">
                            {new Date(note.createdAt).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                      {!note.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {!note.read && (
                        <button onClick={() => handleMarkRead(note)} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-300 transition hover:bg-blue-500/20">
                          تعليم كمقروء
                        </button>
                      )}
                      <button onClick={() => handleArchive(note)} className="flex items-center gap-1 rounded-full border border-white/10 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700">
                        <Archive size={14} /> أرشفة
                      </button>
                      <button onClick={() => handleDelete(note)} className="flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/20">
                        <Trash2 size={14} /> حذف
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 bg-slate-800/70 px-4 py-3">
              <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40">
                <ChevronRight size={14} /> السابق
              </button>
              <span className="text-sm text-slate-400">صفحة {safePage} من {totalPages}</span>
              <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40">
                التالي <ChevronLeft size={14} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
