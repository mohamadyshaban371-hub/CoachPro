import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Camera, Save, Loader2, User as UserIcon, Phone, Mail, ShieldCheck, Sparkles, Crown, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { uploadWithRetry } from '../lib/firebaseUtils';
import { compressImage } from '../lib/imageUtils';
import { UserProfile } from '../types';
import BadgesPanel from './BadgesPanel';

interface ProfileProps {
  profile: UserProfile;
}

/**
 * User profile editor.
 *
 * Lets the client (or coach) update their public-facing identity:
 *   - Avatar (uploaded via /api/upload to Firebase Storage)
 *   - Display name
 *   - Phone number
 *   - Short bio
 *
 * The avatar is also surfaced on the Champions Feed so posts feel personal
 * instead of showing the generic letter circle.
 */
export default function Profile({ profile }: ProfileProps) {
  const [name, setName] = useState(profile.name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.profilePicUrl || null);
  const [pendingAvatar, setPendingAvatar] = useState<Blob | File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = profile.role === 'admin';

  const handlePickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار صورة صالحة.');
      return;
    }
    setError('');
    try {
      // 600px square is plenty for an avatar; 0.8 quality keeps faces sharp.
      const compressed = await compressImage(file, 600, 0.8);
      setPendingAvatar(compressed);
      setAvatarPreview(URL.createObjectURL(compressed));
    } catch (err: any) {
      console.error('[Profile] compress failed:', err);
      setError('تعذر معالجة الصورة. حاول مرة أخرى.');
    }
  };

  const handleClearAvatar = () => {
    setPendingAvatar(null);
    setAvatarPreview(null);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const updates: Record<string, any> = {
        name: name.trim() || profile.name,
        phone: phone.trim(),
        bio: bio.trim(),
      };

      // If the user picked a new avatar, upload it first.
      if (pendingAvatar) {
        const path = `avatars/${profile.uid}/${Date.now()}.jpg`;
        const ref = storageRef(storage, path);
        const result = await uploadWithRetry(ref, pendingAvatar);
        updates.profilePicUrl = result.url;
      } else if (avatarPreview === null && profile.profilePicUrl) {
        // User cleared an existing avatar.
        updates.profilePicUrl = '';
      }

      await updateDoc(doc(db, 'users', profile.uid), updates);
      setPendingAvatar(null);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (err: any) {
      console.error('[Profile] save failed:', err);
      setError(err?.message || 'تعذر حفظ التعديلات. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || profile.name || '?').slice(0, 1).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
          <UserIcon size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white leading-tight">ملفي الشخصي</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">My Profile</p>
        </div>
      </div>

      {/* Avatar card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-slate-900/60 border border-white/5 p-6 flex flex-col sm:flex-row items-center gap-6"
      >
        <div className="relative">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-xl">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-4xl font-black text-white">{initial}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 border-2 border-slate-900 transition"
            title="تغيير الصورة"
          >
            <Camera size={16} />
          </button>
          {avatarPreview && (
            <button
              type="button"
              onClick={handleClearAvatar}
              className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center border border-white/10 transition"
              title="إزالة الصورة"
            >
              <X size={12} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handlePickAvatar}
            className="hidden"
          />
        </div>

        <div className="flex-1 text-center sm:text-right space-y-2">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h3 className="text-xl font-bold text-white">{name || profile.name || 'مستخدم'}</h3>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-400/30 text-[10px] text-blue-300 font-bold">
                <ShieldCheck size={11} /> الكوتش
              </span>
            )}
            {!isAdmin && profile.isActivated && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[10px] text-emerald-300 font-bold">
                <Sparkles size={11} /> حساب مفعّل
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 ltr">{profile.email}</p>
          {(profile.coins ?? 0) > 0 && (
            <p className="text-[12px] text-amber-300 font-bold inline-flex items-center gap-1.5">
              <Crown size={13} /> {profile.coins} نقطة
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            صورتك بتظهر في حائط الأبطال جنب أي منشور بتشاركه.
          </p>
        </div>
      </motion.section>

      {/* Form card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-3xl bg-slate-900/60 border border-white/5 p-6 space-y-5"
      >
        <div className="space-y-2">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <UserIcon size={12} /> الاسم الكامل
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اكتب اسمك"
            maxLength={60}
            className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Phone size={12} /> رقم الموبايل
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
            placeholder="01XXXXXXXXX"
            dir="ltr"
            className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3 text-white text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <p className="text-[10px] text-slate-500">يستخدمه الكوتش للتواصل عبر واتساب فقط.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Mail size={12} /> البريد الإلكتروني
          </label>
          <input
            type="email"
            value={profile.email}
            disabled
            dir="ltr"
            className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-4 py-3 text-slate-500 text-left cursor-not-allowed"
          />
          <p className="text-[10px] text-slate-600">لا يمكن تعديل البريد بعد التسجيل.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
            نبذة قصيرة
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="اكتب جملة قصيرة عن نفسك أو هدفك (هتظهر في حائط الأبطال)..."
            className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
          />
          <div className="flex justify-end text-[10px] text-slate-500 tabular-nums">{bio.length} / 200</div>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-slate-500">
            {savedAt ? '✓ تم الحفظ' : 'التعديلات تُحفظ مباشرة على ملفك.'}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            حفظ التعديلات
          </button>
        </div>
      </motion.section>

      {/* Achievements grid — pure derivation from the profile snapshot. */}
      {!isAdmin && <BadgesPanel profile={profile} />}

      {/* Sign out helper */}
      <div className="text-center pb-6">
        <button
          onClick={() => auth.signOut()}
          className="text-xs text-slate-500 hover:text-rose-400 transition"
        >
          تسجيل الخروج من الحساب
        </button>
      </div>
    </div>
  );
}
