import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import {
  X,
  Heart,
  Send,
  Trash2,
  Loader2,
  ShieldCheck,
  CornerDownRight,
  MessageCircle,
} from 'lucide-react';
import type { FeedPost } from './ChampionsFeed';
import { awardCoins } from '../lib/gamification';

interface FeedComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'admin' | 'client';
  text: string;
  parentId?: string | null;
  createdAt: any;
}

function formatRelative(ts: any): string {
  if (!ts) return 'الآن';
  let d: Date;
  if (typeof ts?.toDate === 'function') d = ts.toDate();
  else if (typeof ts === 'string') d = new Date(ts);
  else if (typeof ts === 'number') d = new Date(ts);
  else return 'الآن';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ي`;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

interface Props {
  post: FeedPost;
  profile: UserProfile;
  onClose: () => void;
}

/**
 * Full-screen view of a single feed post with its media and a real-time
 * comment thread. Comments support a single level of replies (Facebook-like)
 * and Arabic UI throughout.
 */
export default function FeedPostFull({ post, profile, onClose }: Props) {
  const isAdmin = profile.role === 'admin';
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerText, setComposerText] = useState('');
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Real-time comment stream for this post.
  useEffect(() => {
    const q = query(
      collection(db, 'feedPosts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as FeedComment[];
        setComments(list);
        setLoading(false);
      },
      (err) => {
        console.error('[FeedPostFull] comments snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [post.id]);

  // ESC closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Group: top-level comments and a map of replies by parent id.
  const { topLevel, repliesByParent } = useMemo(() => {
    const top: FeedComment[] = [];
    const byParent: Record<string, FeedComment[]> = {};
    for (const c of comments) {
      if (c.parentId) {
        (byParent[c.parentId] ||= []).push(c);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesByParent: byParent };
  }, [comments]);

  const handleLike = async () => {
    const ref = doc(db, 'feedPosts', post.id);
    const liked = post.likes?.includes(profile.uid);
    try {
      await updateDoc(ref, {
        likes: liked ? arrayRemove(profile.uid) : arrayUnion(profile.uid),
      });
    } catch (err) {
      console.error('[FeedPostFull] like failed:', err);
    }
  };

  const handleSend = async () => {
    const text = composerText.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await addDoc(collection(db, 'feedPosts', post.id, 'comments'), {
        authorId: profile.uid,
        authorName: profile.name || (isAdmin ? 'الكوتش' : 'Athlete'),
        authorRole: profile.role,
        text,
        parentId: replyTo?.id || null,
        createdAt: serverTimestamp(),
      });
      // Bump the post's commentCount so the card preview updates instantly.
      await updateDoc(doc(db, 'feedPosts', post.id), {
        commentCount: increment(1),
      }).catch(() => {});
      // Award a small reward for engagement (don't block on failure).
      awardCoins(profile.uid, 'FEED_POST').catch(() => {});
      setComposerText('');
      setReplyTo(null);
    } catch (err) {
      console.error('[FeedPostFull] comment failed:', err);
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (c: FeedComment) => {
    if (!isAdmin && c.authorId !== profile.uid) return;
    if (!confirm('حذف التعليق؟')) return;
    try {
      await deleteDoc(doc(db, 'feedPosts', post.id, 'comments', c.id));
      await updateDoc(doc(db, 'feedPosts', post.id), {
        commentCount: increment(-1),
      }).catch(() => {});
    } catch (err) {
      console.error('[FeedPostFull] delete comment failed:', err);
    }
  };

  const startReply = (c: FeedComment) => {
    setReplyTo(c);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const liked = post.likes?.includes(profile.uid);
  const likeCount = post.likes?.length || 0;
  const media = post.media || [];

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-2xl bg-slate-900 sm:rounded-3xl border border-white/5 shadow-2xl flex flex-col max-h-screen sm:max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <header className="flex items-center gap-3 p-4 border-b border-white/5 shrink-0">
            <div
              className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm ${
                post.authorRole === 'admin'
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-400/30'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {(post.authorName || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">{post.authorName}</span>
                {post.authorRole === 'admin' && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-400/30 text-[9px] text-blue-300 font-bold">
                    <ShieldCheck size={10} /> الكوتش
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">{formatRelative(post.createdAt)}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              <X size={18} />
            </button>
          </header>

          {/* Scrollable body: post body + comments */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Post text */}
            {post.text && (
              <p className="px-4 pt-4 text-[15px] text-slate-100 leading-relaxed whitespace-pre-wrap">
                {post.text}
              </p>
            )}

            {/* Media gallery */}
            {media.length > 0 && (
              <div
                className={`mt-3 px-2 grid gap-1 ${
                  media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {media.map((m, i) => (
                  <div
                    key={i}
                    className="relative bg-black rounded-xl overflow-hidden aspect-square"
                  >
                    {m.type === 'video' ? (
                      <video
                        src={m.url}
                        controls
                        playsInline
                        className="w-full h-full object-contain bg-black"
                      />
                    ) : (
                      <img
                        src={m.url}
                        alt=""
                        className="w-full h-full object-contain bg-black"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Reactions row */}
            <div className="px-4 py-3 mt-2 flex items-center gap-2 border-y border-white/5">
              <button
                onClick={handleLike}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12px] font-bold border transition ${
                  liked
                    ? 'bg-rose-500/15 text-rose-300 border-rose-400/30'
                    : 'bg-slate-900/50 text-slate-400 border-white/5 hover:text-rose-300'
                }`}
              >
                <Heart size={13} fill={liked ? 'currentColor' : 'none'} />
                <span className="tabular-nums">{likeCount}</span>
              </button>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12px] font-bold border bg-slate-900/50 text-slate-400 border-white/5">
                <MessageCircle size={13} />
                <span className="tabular-nums">{comments.length}</span>
              </span>
            </div>

            {/* Comments list */}
            <div className="p-4 space-y-4">
              {loading ? (
                <div className="text-center text-slate-500 text-sm py-6">
                  <Loader2 className="mx-auto animate-spin mb-2" size={18} />
                  جارٍ تحميل التعليقات...
                </div>
              ) : topLevel.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-6">
                  لا توجد تعليقات بعد. كن أول واحد يكتب رأيه.
                </div>
              ) : (
                topLevel.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    replies={repliesByParent[c.id] || []}
                    profile={profile}
                    isAdmin={isAdmin}
                    onReply={startReply}
                    onDelete={handleDeleteComment}
                  />
                ))
              )}
            </div>
          </div>

          {/* Composer (sticky at bottom) */}
          <div className="border-t border-white/5 p-3 shrink-0 bg-slate-900/95 backdrop-blur">
            {replyTo && (
              <div className="mb-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-white/5 flex items-center gap-2">
                <CornerDownRight size={14} className="text-slate-400" />
                <span className="text-[12px] text-slate-300 truncate">
                  ردًا على <span className="font-bold text-white">{replyTo.authorName}</span>
                </span>
                <button
                  onClick={() => setReplyTo(null)}
                  className="ms-auto text-slate-500 hover:text-white text-xs"
                >
                  إلغاء
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={replyTo ? 'اكتب ردك...' : 'اكتب تعليقًا...'}
                rows={1}
                maxLength={500}
                className="flex-1 rounded-2xl bg-slate-950/60 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/30 resize-none max-h-32"
              />
              <button
                onClick={handleSend}
                disabled={!composerText.trim() || posting}
                aria-label="إرسال"
                className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition shadow-lg shadow-blue-500/30"
              >
                {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface CommentItemProps {
  comment: FeedComment;
  replies: FeedComment[];
  profile: UserProfile;
  isAdmin: boolean;
  onReply: (c: FeedComment) => void;
  onDelete: (c: FeedComment) => void;
}

function CommentItem({ comment, replies, profile, isAdmin, onReply, onDelete }: CommentItemProps) {
  const isMine = comment.authorId === profile.uid;
  const canDelete = isAdmin || isMine;
  return (
    <div className="space-y-2">
      <CommentBubble comment={comment} canDelete={canDelete} onDelete={onDelete} onReply={onReply} />
      {replies.length > 0 && (
        <div className="ms-10 space-y-2 ps-3 border-s border-white/5">
          {replies.map((r) => {
            const mine = r.authorId === profile.uid;
            return (
              <CommentBubble
                key={r.id}
                comment={r}
                isReply
                canDelete={isAdmin || mine}
                onDelete={onDelete}
                onReply={onReply}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CommentBubbleProps {
  comment: FeedComment;
  canDelete: boolean;
  isReply?: boolean;
  onReply: (c: FeedComment) => void;
  onDelete: (c: FeedComment) => void;
}

function CommentBubble({ comment, canDelete, isReply, onReply, onDelete }: CommentBubbleProps) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={`shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center font-black text-xs ${
          comment.authorRole === 'admin'
            ? 'bg-blue-500/15 text-blue-300 border border-blue-400/30'
            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
        }`}
      >
        {(comment.authorName || '?').slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-slate-800/60 border border-white/5 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-white truncate">{comment.authorName}</span>
            {comment.authorRole === 'admin' && (
              <ShieldCheck size={11} className="text-blue-400" />
            )}
          </div>
          <p className="text-[13px] text-slate-200 whitespace-pre-wrap leading-relaxed mt-0.5">
            {comment.text}
          </p>
        </div>
        <div className="mt-1 ps-1 flex items-center gap-3 text-[11px] text-slate-500">
          <span>{formatRelative(comment.createdAt)}</span>
          {!isReply && (
            <button onClick={() => onReply(comment)} className="hover:text-blue-300 font-bold">
              رد
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(comment)}
              className="hover:text-rose-400 inline-flex items-center gap-1"
              aria-label="حذف"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
