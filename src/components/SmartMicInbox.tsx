import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
  collectionGroup,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  Sparkles,
  Send,
  Play,
  Pause,
  Loader2,
  Inbox,
  CheckCircle2,
  Bot,
  RefreshCw,
} from 'lucide-react';
import { aiMasterEngine, safeGenerateContent } from '../services/aiMasterEngine';
import type { UserProfile } from '../types';

/**
 * Smart Mic Inbox — coach-side aggregator for every voice note any
 * client has ever sent. Lives in the AdminDashboard "Today" surface.
 *
 * How it works
 * ────────────
 *  • A `collectionGroup('messages')` listener pulls EVERY chat message
 *    where `audioBase64` exists and `senderId !== adminUid`. This way
 *    new voice notes from any client surface here in real time.
 *  • Each item shows the inline audio player, the auto-transcript that
 *    the client side already attached (when the Smart Mic 'note' mode
 *    was used), the sender's name + avatar (resolved from `users/{uid}`)
 *    and a relative timestamp.
 *  • "Summarise" calls Gemini for a 3-bullet Arabic summary (cached
 *    in component state so a re-render doesn't hit the API again).
 *  • "اقترح ردّاً" asks Gemini to draft a coach-style Arabic reply
 *    based on the transcript + the client's profile. The coach can
 *    edit before pressing "إرسال".
 *  • "تم" marks the item as handled (kept in localStorage so the
 *    coach's progress persists across reloads without server writes).
 */

interface VoiceItem {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
  audioBase64: string;
  audioMime: string;
  voiceSummary?: string;
  timestamp: Date;
}

interface CachedSenderInfo {
  name: string;
  avatar?: string;
}

interface SmartMicInboxProps {
  /** The signed-in coach's UID — used to filter OUT their own messages. */
  adminUid: string;
  /** Optional pre-loaded clients list so we can resolve names without N reads. */
  clients?: UserProfile[];
}

const HANDLED_STORAGE_KEY = 'cp.smartMicInbox.handled.v1';

function loadHandled(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(HANDLED_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function persistHandled(map: Record<string, true>) {
  try {
    localStorage.setItem(HANDLED_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  const days = Math.floor(h / 24);
  return `منذ ${days} يوم`;
}

export default function SmartMicInbox({ adminUid, clients = [] }: SmartMicInboxProps) {
  const [items, setItems] = useState<VoiceItem[]>([]);
  const [senderCache, setSenderCache] = useState<Record<string, CachedSenderInfo>>({});
  const [handled, setHandled] = useState<Record<string, true>>(() => loadHandled());
  const [showHandled, setShowHandled] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string>('');
  const [playingId, setPlayingId] = useState<string>('');

  // ─── Live listener ─────────────────────────────────────────────────
  useEffect(() => {
    // We can't filter on `senderId !== adminUid` server-side (Firestore
    // has no `!=` for security-rule-friendly queries on collectionGroup),
    // so we filter client-side after pulling everything with audio.
    const q = query(
      collectionGroup(db, 'messages'),
      where('audioBase64', '>', ''),
      orderBy('audioBase64'),
      orderBy('timestamp', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: VoiceItem[] = [];
        snap.forEach((d) => {
          const data: any = d.data();
          if (!data?.audioBase64) return;
          if (data.senderId === adminUid) return; // skip the coach's own notes
          const ts = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
          // chatId is the parent of /messages/{id} — d.ref.path is
          // `chats/{chatId}/messages/{id}`.
          const parts = d.ref.path.split('/');
          const chatId = parts.length >= 3 ? parts[parts.length - 3] : '';
          next.push({
            id: d.id,
            chatId,
            senderId: data.senderId || '',
            receiverId: data.receiverId || '',
            text: data.text || '',
            audioBase64: data.audioBase64,
            audioMime: data.audioMime || 'audio/webm',
            voiceSummary: data.voiceSummary,
            timestamp: ts,
          });
        });
        setItems(next);
      },
      (err) => {
        console.error('[SmartMicInbox] listener error:', err);
      },
    );
    return () => unsub();
  }, [adminUid]);

  // Hydrate sender info from the clients prop first; fall back to a
  // single Firestore read per unknown UID.
  useEffect(() => {
    const cache: Record<string, CachedSenderInfo> = { ...senderCache };
    let mutated = false;
    for (const c of clients) {
      if (c?.uid && !cache[c.uid]) {
        cache[c.uid] = { name: c.name || c.email || 'عميل', avatar: c.profilePicUrl };
        mutated = true;
      }
    }
    if (mutated) setSenderCache(cache);
    // Now look up anyone still missing.
    const missing = items
      .map((i) => i.senderId)
      .filter((uid, i, arr) => uid && !cache[uid] && arr.indexOf(uid) === i);
    if (!missing.length) return;
    (async () => {
      const next = { ...cache };
      await Promise.all(
        missing.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const u: any = snap.data();
              next[uid] = { name: u.name || u.email || 'عميل', avatar: u.profilePicUrl };
            } else {
              next[uid] = { name: 'عميل غير معروف' };
            }
          } catch {
            next[uid] = { name: 'عميل' };
          }
        }),
      );
      setSenderCache(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, clients]);

  const visibleItems = useMemo(
    () => items.filter((i) => (showHandled ? handled[i.id] : !handled[i.id])),
    [items, handled, showHandled],
  );

  const markHandled = (id: string, value: boolean) => {
    setHandled((prev) => {
      const next = { ...prev };
      if (value) next[id] = true;
      else delete next[id];
      persistHandled(next);
      return next;
    });
  };

  // ─── AI helpers ────────────────────────────────────────────────────
  const summarise = async (item: VoiceItem) => {
    if (summaries[item.id]) return;
    setLoadingId(`s:${item.id}`);
    try {
      const sender = senderCache[item.senderId];
      const systemPrompt = `أنت مساعد مدرب لياقة. لخّص الرسالة الصوتية القادمة من العميل "${sender?.name || 'عميل'}" في 3 نقاط Bullet قصيرة بالعربية المصرية. ركّز على: (١) الشكوى/الطلب الأساسي، (٢) أي إشارات لإصابة أو ألم أو إجهاد، (٣) الإجراء المقترح للكوتش. لا تكتب أي مقدمات.`;
      const userMsg = item.text || '(لا يوجد نص مفرّغ — اعتمد على ما يدل عليه السياق)';
      const resp: any = await safeGenerateContent('gemini-1.5-flash', userMsg, systemPrompt, {
        temperature: 0.4,
        maxOutputTokens: 512,
      });
      const text = (resp?.text || '').trim();
      setSummaries((prev) => ({ ...prev, [item.id]: text || 'تعذّر توليد ملخص.' }));
    } catch (err: any) {
      setSummaries((prev) => ({ ...prev, [item.id]: `خطأ: ${err?.message || 'فشل التلخيص'}` }));
    } finally {
      setLoadingId('');
    }
  };

  const draftReply = async (item: VoiceItem) => {
    setLoadingId(`d:${item.id}`);
    try {
      const profile = clients.find((c) => c.uid === item.senderId);
      let suggestion = '';
      if (profile) {
        // Use the existing personalised quick-reply engine for consistency.
        suggestion = await aiMasterEngine.getQuickReply(
          item.text || 'العميل أرسل رسالة صوتية بدون نص مفرّغ — اقترح ردّاً ودوداً يطلب توضيحاً.',
          profile,
        );
      } else {
        const resp: any = await safeGenerateContent(
          'gemini-1.5-flash',
          item.text || '(رسالة صوتية بدون نص)',
          'اكتب ردّاً قصيراً ومحترفاً بالعربية المصرية من المدرب على رسالة العميل، بدون مقدمات.',
          { temperature: 0.6, maxOutputTokens: 512 },
        );
        suggestion = (resp?.text || '').trim();
      }
      setDrafts((prev) => ({ ...prev, [item.id]: suggestion }));
    } catch (err: any) {
      setDrafts((prev) => ({ ...prev, [item.id]: `خطأ: ${err?.message || 'فشل توليد الرد'}` }));
    } finally {
      setLoadingId('');
    }
  };

  const sendReply = async (item: VoiceItem) => {
    const text = (drafts[item.id] || '').trim();
    if (!text) return;
    setLoadingId(`r:${item.id}`);
    try {
      // Re-use the existing chat document path so the message lands in
      // the same conversation the client opened. chatId is sorted UIDs.
      await addDoc(collection(db, 'chats', item.chatId, 'messages'), {
        text,
        senderId: adminUid,
        receiverId: item.senderId,
        timestamp: serverTimestamp(),
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      markHandled(item.id, true);
    } catch (err: any) {
      alert('تعذّر إرسال الرد: ' + (err?.message || String(err)));
    } finally {
      setLoadingId('');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden">
      {/* Header */}
      <div className="p-5 bg-gradient-to-l from-violet-600/10 to-transparent border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-500/15 rounded-2xl text-violet-300">
            <Inbox size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Mic size={16} className="text-violet-400" /> صندوق الرسائل الصوتية الذكي
            </h3>
            <p className="text-xs text-slate-500">
              كل رسائل العملاء الصوتية في مكان واحد — مع تلخيص واقتراح ردّ بنقرة واحدة.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowHandled(false)}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${
              !showHandled
                ? 'bg-violet-500/20 text-violet-200 border border-violet-500/40'
                : 'bg-slate-800/60 text-slate-400 border border-white/5'
            }`}
          >
            جديدة ({items.filter((i) => !handled[i.id]).length})
          </button>
          <button
            onClick={() => setShowHandled(true)}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${
              showHandled
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                : 'bg-slate-800/60 text-slate-400 border border-white/5'
            }`}
          >
            تم الرد ({items.filter((i) => handled[i.id]).length})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-white/5 max-h-[640px] overflow-y-auto">
        {visibleItems.length === 0 && (
          <div className="p-10 text-center text-slate-500 text-sm">
            {showHandled ? 'لا توجد رسائل تم الرد عليها بعد.' : 'لا توجد رسائل صوتية جديدة 🎉'}
          </div>
        )}
        <AnimatePresence initial={false}>
          {visibleItems.map((item) => {
            const sender = senderCache[item.senderId];
            const isPlaying = playingId === item.id;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-5 space-y-3 hover:bg-slate-900/40 transition"
              >
                {/* Sender row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-white/10 shrink-0">
                      {sender?.avatar ? (
                        <img src={sender.avatar} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                          {(sender?.name || '؟')[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{sender?.name || 'عميل'}</p>
                      <p className="text-[10px] text-slate-500">{relativeTime(item.timestamp)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => markHandled(item.id, !handled[item.id])}
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition ${
                      handled[item.id]
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700'
                    }`}
                  >
                    <CheckCircle2 size={12} /> {handled[item.id] ? 'تم' : 'تحديد كمنجَز'}
                  </button>
                </div>

                {/* Audio + transcript */}
                <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-3 space-y-2">
                  <audio
                    src={item.audioBase64}
                    controls
                    onPlay={() => setPlayingId(item.id)}
                    onPause={() => isPlaying && setPlayingId('')}
                    onEnded={() => setPlayingId('')}
                    className="w-full h-9"
                  />
                  {item.text && (
                    <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {item.text}
                    </p>
                  )}
                  {item.voiceSummary && (
                    <p className="text-[11px] text-emerald-300 bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                      📌 ملخص العميل: {item.voiceSummary}
                    </p>
                  )}
                </div>

                {/* AI summary */}
                {summaries[item.id] && (
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-3">
                    <p className="text-[10px] font-bold text-violet-300 mb-1 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={11} /> ملخص الذكاء الاصطناعي
                    </p>
                    <pre className="whitespace-pre-wrap text-[12px] text-violet-100 font-sans leading-relaxed">
                      {summaries[item.id]}
                    </pre>
                  </div>
                )}

                {/* Draft */}
                {drafts[item.id] !== undefined && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest flex items-center gap-1">
                      <Bot size={11} /> مسودّة الرد المقترحة (عدّلها قبل الإرسال)
                    </p>
                    <textarea
                      value={drafts[item.id]}
                      onChange={(e) => setDrafts((p) => ({ ...p, [item.id]: e.target.value }))}
                      rows={4}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Action row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => summarise(item)}
                    disabled={loadingId === `s:${item.id}` || !!summaries[item.id]}
                    className="text-xs font-bold px-3 py-2 rounded-xl bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 border border-violet-500/30 disabled:opacity-50 flex items-center gap-1"
                  >
                    {loadingId === `s:${item.id}` ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {summaries[item.id] ? 'تم التلخيص' : 'لخّص'}
                  </button>
                  <button
                    onClick={() => draftReply(item)}
                    disabled={loadingId === `d:${item.id}`}
                    className="text-xs font-bold px-3 py-2 rounded-xl bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-500/30 disabled:opacity-50 flex items-center gap-1"
                  >
                    {loadingId === `d:${item.id}` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : drafts[item.id] !== undefined ? (
                      <RefreshCw size={12} />
                    ) : (
                      <Bot size={12} />
                    )}
                    {drafts[item.id] !== undefined ? 'إعادة توليد' : 'اقترح ردّاً'}
                  </button>
                  {drafts[item.id] && (
                    <button
                      onClick={() => sendReply(item)}
                      disabled={loadingId === `r:${item.id}`}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 disabled:opacity-50 flex items-center gap-1"
                    >
                      {loadingId === `r:${item.id}` ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      إرسال الرد
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
