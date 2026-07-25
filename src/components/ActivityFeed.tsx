import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Droplets, Heart, Zap, Dumbbell, Utensils, FileText,
  RefreshCw, Camera, Mic, MessageCircle, Clock,
} from 'lucide-react';
import { UserProfile } from '../types';
import { ActivityType } from '../lib/activityLog';

interface FeedEntry {
  id: string;
  userId: string;
  userName: string;
  type: ActivityType | string;
  title: string;
  metadata?: Record<string, any>;
  createdAt?: any;
}

const TYPE_META: Record<string, { icon: React.ComponentType<any>; cls: string; label: string }> = {
  water:                  { icon: Droplets,     cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     label: 'مياه' },
  mood:                   { icon: Heart,        cls: 'bg-pink-500/10 text-pink-400 border-pink-500/20',     label: 'مزاج' },
  energy:                 { icon: Zap,          cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',  label: 'طاقة' },
  workout_completed:      { icon: Dumbbell,     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'تمرين' },
  meal_completed:         { icon: Utensils,     cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'وجبة' },
  plan_requested:         { icon: FileText,     cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', label: 'طلب خطة' },
  modification_requested: { icon: RefreshCw,    cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20', label: 'طلب تعديل' },
  measurement_logged:     { icon: Activity,     cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',     label: 'قياسات' },
  voice_note_uploaded:    { icon: Mic,          cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'رسالة صوتية' },
  photo_uploaded:         { icon: Camera,       cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',     label: 'صورة' },
  chat_sent:              { icon: MessageCircle, cls: 'bg-slate-500/10 text-slate-300 border-slate-500/20', label: 'محادثة' },
};

function relativeTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return 'الآن';
  if (diff < 60) return `منذ ${diff} ث`;
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  if (diff < 86400 * 7) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return d.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' });
}

interface ActivityFeedProps {
  clients: UserProfile[];
  /** Max entries to show in the feed (default 30). */
  maxEntries?: number;
}

/**
 * Admin "Big Brother" live feed.
 *
 * Strategy: opens one Firestore listener PER client subcollection
 * (`users/{uid}/clientActivity`). This is correct under the existing
 * per-doc Firestore rules (no collectionGroup index/rule needed) and
 * scales fine for the typical coach roster (≤ 200 clients). Listeners
 * are torn down whenever the client list changes.
 */
export default function ActivityFeed({ clients, maxEntries = 30 }: ActivityFeedProps) {
  const [entriesByUser, setEntriesByUser] = useState<Record<string, FeedEntry[]>>({});

  useEffect(() => {
    if (!clients?.length) {
      setEntriesByUser({});
      return;
    }
    const unsubs: (() => void)[] = [];
    clients.forEach((c) => {
      if (!c.uid) return;
      const q = query(
        collection(db, 'users', c.uid, 'clientActivity'),
        orderBy('createdAt', 'desc'),
        limit(maxEntries),
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list: FeedEntry[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              userId: c.uid,
              userName: data.userName || c.name || 'Client',
              type: data.type,
              title: data.title || '',
              metadata: data.metadata,
              createdAt: data.createdAt,
            };
          });
          setEntriesByUser((prev) => ({ ...prev, [c.uid]: list }));
        },
        (err) => console.warn('[ActivityFeed] listener err for', c.uid, err.message),
      );
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [clients.map((c) => c.uid).join('|'), maxEntries]);

  const merged = useMemo(() => {
    const all: FeedEntry[] = [];
    for (const list of Object.values(entriesByUser)) all.push(...list);
    return all
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      })
      .slice(0, maxEntries);
  }, [entriesByUser, maxEntries]);

  return (
    <div className="bg-slate-900 border border-white/5 rounded-[2rem] overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-slate-800/40 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          البث المباشر لنشاط العملاء
        </h3>
        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {merged.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-xs italic">
            لم يسجّل أي عميل أي نشاط بعد. ستظهر الأحداث هنا فور حدوثها.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            <AnimatePresence initial={false}>
              {merged.map((e) => {
                const meta = TYPE_META[e.type] || {
                  icon: Activity,
                  cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                  label: String(e.type),
                };
                const Icon = meta.icon;
                const when = e.createdAt?.toDate ? relativeTime(e.createdAt.toDate()) : '';
                return (
                  <motion.li
                    key={`${e.userId}_${e.id}`}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.cls}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 truncate">
                        <span className="font-bold text-white">{e.userName}</span>{' '}
                        <span className="text-slate-400">{e.title}</span>
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1.5">
                        <Clock size={10} /> {when}
                        <span className="text-slate-700">·</span>
                        <span className="font-bold text-slate-500 uppercase tracking-wider">{meta.label}</span>
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
