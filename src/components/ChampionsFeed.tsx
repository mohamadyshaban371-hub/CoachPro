import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  deleteDoc,
} from 'firebase/firestore';
import { ref as storageRef } from 'firebase/storage';
import { db, storage } from '../firebase';
import { uploadWithRetry } from '../lib/firebaseUtils';
import { compressImage } from '../lib/imageUtils';
import { UserProfile } from '../types';
import {
  Heart,
  Megaphone,
  Trophy,
  Sparkles,
  Send,
  Trash2,
  Loader2,
  ShieldCheck,
  Dumbbell,
  Crown,
  ImagePlus,
  Video,
  X,
  Play,
  MessageCircle,
} from 'lucide-react';
import { awardCoins } from '../lib/gamification';
import FeedPostFull from './FeedPostFull';

export type FeedKind = 'motivation' | 'achievement' | 'announcement';

export interface FeedMedia {
  url: string;
  type: 'image' | 'video';
}

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'admin' | 'client';
  /** Optional avatar URL captured at post time so historical posts keep
   *  showing the picture even if the author later changes it. */
  authorPicUrl?: string;
  kind: FeedKind;
  text: string;
  createdAt: any;
  likes: string[];
  media?: FeedMedia[];
  commentCount?: number;
}

interface ChampionsFeedProps {
  profile: UserProfile;
}

const KIND_META: Record<FeedKind, { label: string; icon: React.ReactNode; tone: string; ring: string }> = {
  motivation:   { label: 'تحفيز',  icon: <Sparkles size={14} />,  tone: 'text-amber-300',   ring: 'border-amber-400/30 bg-amber-500/10' },
  achievement:  { label: 'إنجاز',  icon: <Trophy size={14} />,    tone: 'text-emerald-300', ring: 'border-emerald-400/30 bg-emerald-500/10' },
  announcement: { label: 'إعلان',  icon: <Megaphone size={14} />, tone: 'text-blue-300',    ring: 'border-blue-400/30 bg-blue-500/10' },
};

const MAX_MEDIA = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;   // 8 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;  // 50 MB

interface PendingMedia {
  id: string;
  file: File;
  type: 'image' | 'video';
  previewUrl: string;
}

function formatRelative(ts: any): string {
  if (!ts) return 'الآن';
  let d: Date;
  if (typeof ts?.toDate === 'function') d = ts.toDate();
  else if (typeof ts === 'string') d = new Date(ts);
  else if (typeof ts === 'number') d = new Date(ts);
  else return 'الآن';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)        return 'الآن';
  if (diff < 3600)      return `${Math.floor(diff / 60)} د`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)} س`;
  if (diff < 604800)    return `${Math.floor(diff / 86400)} ي`;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

export default function ChampionsFeed({ profile }: ChampionsFeedProps) {
  const isAdmin = profile.role === 'admin';
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerText, setComposerText] = useState('');
  const [composerKind, setComposerKind] = useState<FeedKind>(isAdmin ? 'motivation' : 'achievement');
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState<'all' | FeedKind>('all');
  const [pending, setPending] = useState<PendingMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [openPost, setOpenPost] = useState<FeedPost | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'feedPosts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as FeedPost[];
        setPosts(list);
        setLoading(false);
      },
      (err) => {
        console.error('[ChampionsFeed] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // If the open modal's underlying post is updated (likes/comments), keep the
  // modal in sync by re-reading from the latest posts list.
  useEffect(() => {
    if (!openPost) return;
    const fresh = posts.find((p) => p.id === openPost.id);
    if (fresh && fresh !== openPost) setOpenPost(fresh);
  }, [posts, openPost]);

  // Free object URLs when previews change/unmount.
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? posts : posts.filter((p) => p.kind === filter)),
    [posts, filter]
  );

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow picking the same file again later
    if (!files.length) return;

    const next: PendingMedia[] = [...pending];
    for (const file of files) {
      if (next.length >= MAX_MEDIA) {
        alert(`الحد الأقصى ${MAX_MEDIA} ملفات لكل منشور.`);
        break;
      }
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isVideo && !isImage) {
        alert(`نوع الملف غير مدعوم: ${file.name}`);
        continue;
      }
      if (isImage && file.size > MAX_IMAGE_BYTES) {
        alert(`الصورة "${file.name}" أكبر من 8 ميجا.`);
        continue;
      }
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        alert(`الفيديو "${file.name}" أكبر من 50 ميجا.`);
        continue;
      }
      next.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        type: isVideo ? 'video' : 'image',
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPending(next);
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  /**
   * Upload all pending files via the server-side `/api/upload` route. The
   * server uses Firebase Admin SDK (no client-rules / CORS friction) and
   * returns a public storage URL. The same helper backs InBody photos so
   * we know it works in this environment.
   */
  const uploadPending = async (): Promise<FeedMedia[]> => {
    if (pending.length === 0) return [];
    setUploadProgress(0);
    const uploaded: FeedMedia[] = [];

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `feedPosts/${profile.uid}/${Date.now()}_${item.id}_${safeName}`;
      const ref = storageRef(storage, path);

      // Compress images before upload (skip videos — can't canvas-compress them).
      let dataToUpload: File | Blob = item.file;
      if (item.type === 'image') {
        try {
          dataToUpload = await compressImage(item.file, 1200, 0.82);
        } catch {
          dataToUpload = item.file;
        }
      }

      // allowBase64Fallback=false: feed images can be large (up to 4×300KB)
      // which would exceed Firestore's 1MB document limit if stored inline.
      // If Firebase Storage is not provisioned, uploads fail with a clear error.
      const result = await uploadWithRetry(ref, dataToUpload, (filePct) => {
        const overall = Math.round(((i + filePct / 100) / pending.length) * 100);
        setUploadProgress(overall);
      }, 2, 300000, false);

      uploaded.push({ url: result.url, type: item.type });
    }

    setUploadProgress(null);
    return uploaded;
  };

  const handleQuickWorkout = async () => {
    if (posting) return;
    setPosting(true);
    try {
      await addDoc(collection(db, 'feedPosts'), {
        authorId: profile.uid,
        authorName: profile.name || 'Athlete',
        authorRole: 'client',
        ...(profile.profilePicUrl ? { authorPicUrl: profile.profilePicUrl } : {}),
        kind: 'achievement',
        text: '✅ خلصت تمريني النهاردة! يلا خليكم معايا.',
        createdAt: serverTimestamp(),
        likes: [],
        commentCount: 0,
      });
      await awardCoins(profile.uid, 'FEED_POST');
    } catch (err) {
      console.error('[ChampionsFeed] quick post failed:', err);
    } finally {
      setPosting(false);
    }
  };

  const handlePost = async () => {
    const text = composerText.trim();
    if ((!text && pending.length === 0) || posting) return;
    setPosting(true);
    let media: FeedMedia[] = [];
    try {
      // Phase 2 / item #8 — explicit media-failure path. Earlier the post
      // would silently fall through to addDoc with `media: []` if the
      // upload threw, leaving the user wondering why their photo never
      // appeared. Now we surface the error and abort the post so they
      // can retry with the photos still queued.
      try {
        media = await uploadPending();
      } catch (uploadErr: any) {
        console.error('[ChampionsFeed] media upload failed:', uploadErr);
        const errMsg = String(uploadErr?.message || '');
        const isStorageDown =
          errMsg.includes('firebase-storage-not-provisioned') ||
          errMsg.includes('تخزين الصور غير مفعّل') ||
          errMsg.includes('Storage');
        const reason = uploadErr?.message === 'TIMEOUT'
          ? 'انتهى وقت الرفع — جرّب على شبكة أسرع.'
          : isStorageDown
            ? 'خدمة تخزين الصور غير مفعّلة بعد. يمكنك نشر منشور نصي بدون صور، أو تفعيل Firebase Storage أولاً.'
            : (uploadErr?.message || 'سبب غير معروف');
        alert(`تعذّر رفع الصور: ${reason}`);
        setUploadProgress(null);
        setPosting(false);
        return;
      }
      await addDoc(collection(db, 'feedPosts'), {
        authorId: profile.uid,
        authorName: profile.name || (isAdmin ? 'الكوتش' : 'Athlete'),
        authorRole: profile.role,
        ...(profile.profilePicUrl ? { authorPicUrl: profile.profilePicUrl } : {}),
        kind: isAdmin ? composerKind : 'achievement',
        text,
        createdAt: serverTimestamp(),
        likes: [],
        commentCount: 0,
        ...(media.length > 0 ? { media } : {}),
      });
      await awardCoins(profile.uid, 'FEED_POST');
      // Reset composer
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
      setComposerText('');
    } catch (err) {
      console.error('[ChampionsFeed] post failed:', err);
      alert('تعذر نشر المنشور. حاول مرة تانية.');
    } finally {
      setPosting(false);
      setUploadProgress(null);
    }
  };

  const handleLike = async (post: FeedPost) => {
    const ref = doc(db, 'feedPosts', post.id);
    const liked = post.likes?.includes(profile.uid);
    try {
      await updateDoc(ref, { likes: liked ? arrayRemove(profile.uid) : arrayUnion(profile.uid) });
    } catch (err) {
      console.error('[ChampionsFeed] like failed:', err);
    }
  };

  const handleDelete = async (post: FeedPost) => {
    if (!isAdmin && post.authorId !== profile.uid) return;
    if (!confirm('حذف المنشور؟')) return;
    try {
      await deleteDoc(doc(db, 'feedPosts', post.id));
      if (openPost?.id === post.id) setOpenPost(null);
    } catch (err) {
      console.error('[ChampionsFeed] delete failed:', err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-white/10">
            <Crown size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">حائط الأبطال</h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
              Champions Feed · {posts.length} منشور
            </p>
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="rounded-3xl bg-slate-900/60 border border-white/5 p-4 space-y-3">
        {isAdmin ? (
          <div className="flex items-center gap-2">
            {(['motivation', 'announcement'] as FeedKind[]).map((k) => {
              const m = KIND_META[k];
              const active = composerKind === k;
              return (
                <button
                  key={k}
                  onClick={() => setComposerKind(k)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition flex items-center gap-1.5 ${
                    active ? `${m.ring} ${m.tone}` : 'border-white/5 bg-slate-900/50 text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {m.icon} {m.label}
                </button>
              );
            })}
            <span className="ms-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
              <ShieldCheck size={12} className="text-blue-400" /> أدمن
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleQuickWorkout}
              disabled={posting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[12px] font-bold transition shadow-lg shadow-emerald-500/20"
            >
              <Dumbbell size={13} /> خلّصت تمرين
            </button>
            <span className="text-[10px] text-slate-500">شارك إنجازك</span>
          </div>
        )}

        <textarea
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          placeholder={isAdmin ? 'اكتب رسالة تحفيزية لكل العملاء...' : 'إيه اللي عملته اليوم؟ شارك الفريق...'}
          rows={3}
          maxLength={500}
          className="w-full rounded-2xl bg-slate-950/60 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
        />

        {/* Pending media previews */}
        {pending.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square rounded-xl overflow-hidden bg-black border border-white/10"
              >
                {p.type === 'video' ? (
                  <>
                    <video src={p.previewUrl} className="w-full h-full object-cover" muted />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                        <Play size={14} className="text-white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => removePending(p.id)}
                  aria-label="إزالة"
                  className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload progress bar */}
        {uploadProgress !== null && (
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handlePickFiles}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={posting || pending.length >= MAX_MEDIA}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/70 disabled:opacity-40 text-slate-200 text-[12px] font-bold border border-white/5 transition"
              aria-label="إرفاق صورة أو فيديو"
            >
              <ImagePlus size={13} />
              <Video size={13} />
              <span>إرفاق</span>
            </button>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {composerText.length} / 500
            </span>
          </div>
          <button
            onClick={handlePost}
            disabled={(!composerText.trim() && pending.length === 0) || posting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-bold transition shadow-lg shadow-blue-500/30"
          >
            {posting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            نشر
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['all', 'motivation', 'achievement', 'announcement'] as const).map((k) => {
          const active = filter === k;
          const label = k === 'all' ? 'الكل' : KIND_META[k].label;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 px-3 py-1.5 rounded-2xl text-[12px] font-bold border transition ${
                active
                  ? 'bg-blue-600 text-white border-blue-400/30 shadow-lg shadow-blue-500/30'
                  : 'bg-slate-900/50 text-slate-400 border-white/5 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-10 text-center text-slate-500 text-sm">
          <Loader2 className="mx-auto animate-spin mb-2" size={20} />
          جارٍ تحميل المنشورات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/40 p-10 text-center">
          <Crown size={28} className="mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">لسه مفيش منشورات هنا.</p>
          <p className="text-[12px] text-slate-500 mt-1">كن أول واحد يشارك إنجازه.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((post) => {
              const meta = KIND_META[post.kind] || KIND_META.achievement;
              const isMine = post.authorId === profile.uid;
              const liked = post.likes?.includes(profile.uid);
              const likeCount = post.likes?.length || 0;
              const canDelete = isAdmin || isMine;
              const media = post.media || [];
              const commentCount = post.commentCount || 0;
              return (
                <motion.article
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-3xl bg-slate-900/60 border border-white/5 p-4 space-y-3"
                >
                  <header className="flex items-center gap-3">
                    <div
                      className={`shrink-0 w-9 h-9 rounded-2xl overflow-hidden flex items-center justify-center font-black text-sm border ${
                        post.authorRole === 'admin'
                          ? 'bg-blue-500/15 text-blue-300 border-blue-400/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                      }`}
                    >
                      {post.authorPicUrl ? (
                        <img
                          src={post.authorPicUrl}
                          alt={post.authorName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        (post.authorName || '?').slice(0, 1).toUpperCase()
                      )}
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
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${meta.ring} ${meta.tone}`}
                    >
                      {meta.icon} {meta.label}
                    </span>
                  </header>

                  {post.text && (
                    <p
                      className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap cursor-pointer"
                      onClick={() => setOpenPost(post)}
                    >
                      {post.text}
                    </p>
                  )}

                  {/* Media grid (Facebook-style) */}
                  {media.length > 0 && (
                    <div
                      onClick={() => setOpenPost(post)}
                      className={`grid gap-1 cursor-pointer rounded-2xl overflow-hidden ${
                        media.length === 1
                          ? 'grid-cols-1'
                          : media.length === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-2'
                      }`}
                    >
                      {media.slice(0, 4).map((m, i) => {
                        const showOverlay = media.length > 4 && i === 3;
                        const aspect =
                          media.length === 1 ? 'aspect-video' : 'aspect-square';
                        return (
                          <div key={i} className={`relative bg-black ${aspect}`}>
                            {m.type === 'video' ? (
                              <>
                                <video
                                  src={m.url}
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                                    <Play size={20} className="text-white ms-0.5" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <img
                                src={m.url}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}
                            {showOverlay && (
                              <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-2xl font-black">
                                +{media.length - 4}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <footer className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLike(post)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12px] font-bold border transition ${
                          liked
                            ? 'bg-rose-500/15 text-rose-300 border-rose-400/30'
                            : 'bg-slate-900/50 text-slate-400 border-white/5 hover:text-rose-300'
                        }`}
                      >
                        <Heart size={13} fill={liked ? 'currentColor' : 'none'} />
                        <span className="tabular-nums">{likeCount}</span>
                      </button>
                      <button
                        onClick={() => setOpenPost(post)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12px] font-bold border bg-slate-900/50 text-slate-400 border-white/5 hover:text-blue-300 transition"
                      >
                        <MessageCircle size={13} />
                        <span className="tabular-nums">{commentCount}</span>
                      </button>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(post)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        aria-label="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </footer>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {openPost && (
        <FeedPostFull
          post={openPost}
          profile={profile}
          onClose={() => setOpenPost(null)}
        />
      )}
    </div>
  );
}
