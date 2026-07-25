import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogIn, Mail, Lock, Chrome, Sun, Moon, Languages } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import BrandLogo from './BrandLogo';

export default function Login() {
  const { t, toggle: toggleLocale, locale } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError('');
    
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      const isAdmin = user.email?.toLowerCase() === 'lotfyshaban2211@gmail.com';
      
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          name: user.displayName || 'مستخدم جديد',
          role: isAdmin ? 'admin' : 'client',
          packages: {},
          isActivated: isAdmin,
          onboardingComplete: false,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          coins: 0,
        });
      } else {
        const existingData = userDoc.data();
        if (isAdmin && existingData?.role !== 'admin') {
          await setDoc(doc(db, 'users', user.uid), { role: 'admin', isActivated: true }, { merge: true });
        }
        await setDoc(doc(db, 'users', user.uid), { lastLoginAt: new Date().toISOString() }, { merge: true });
      }
    } catch (error: any) {
      console.error("Google Login Error Details:", error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        setError(`هذا النطاق (${domain}) غير مصرح به. يرجى إضافته في إعدادات Firebase Console > Authentication > Settings > Authorized domains.`);
      } else if (error.code === 'auth/popup-blocked') {
        setError('تم حظر النافذة المنبثقة. يرجى السماح بالمنبثقات لهذا المتصفح.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Safe to ignore or just reset
        console.warn("Cancelled popup request - one was already open.");
      } else if (error.code !== 'auth/popup-closed-by-user') {
        setError(`خطأ (كود: ${error.code}): ${error.message}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setError(t('auth.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center app-bg overflow-hidden">
      {/* Cinematic Background */}
      <div
        className="absolute inset-0 z-0 opacity-20 dark:opacity-30 scale-110 blur-sm"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white dark:from-slate-950/80 dark:via-slate-950/60 dark:to-slate-950 z-1" />

      {/* Floating theme + lang toggles (corner) */}
      <div className="absolute top-4 end-4 z-20 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border app-border bg-white/70 dark:bg-slate-900/60 backdrop-blur app-text-muted hover:app-text transition-all"
          title={theme === 'dark' ? t('action.theme.light') : t('action.theme.dark')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={toggleLocale}
          className="px-3 py-2.5 rounded-xl border app-border bg-white/70 dark:bg-slate-900/60 backdrop-blur app-text-muted hover:app-text transition-all flex items-center gap-1.5 text-xs font-bold"
          title={t('action.lang.toggle')}
        >
          <Languages size={16} />
          <span>{locale === 'ar' ? 'EN' : 'عربي'}</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md w-full mx-4"
      >
        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border app-border rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="mb-4"
            >
              <BrandLogo size={72} />
            </motion.div>
            <h1 className="text-3xl font-bold app-text tracking-tight">{t('brand.name')}</h1>
            <p className="app-text-muted mt-2 text-sm">{t('brand.tagline')}</p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div className="relative group">
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full bg-slate-100 dark:bg-slate-800/50 border app-border rounded-xl px-4 pt-6 pb-2 app-text outline-none focus:border-blue-500 transition-all peer ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
              />
              <label className="absolute end-4 top-4 app-text-muted text-sm transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-blue-500 pointer-events-none">
                {t('auth.email')}
              </label>
              <Mail className="absolute start-4 top-4 app-text-muted opacity-60" size={20} />
            </div>

            <div className="relative group">
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full bg-slate-100 dark:bg-slate-800/50 border app-border rounded-xl px-4 pt-6 pb-2 app-text outline-none focus:border-blue-500 transition-all peer ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
              />
              <label className="absolute end-4 top-4 app-text-muted text-sm transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-blue-500 pointer-events-none">
                {t('auth.password')}
              </label>
              <Lock className="absolute start-4 top-4 app-text-muted opacity-60" size={20} />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 dark:text-red-400 text-sm text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  <span>{t('auth.signIn')}</span>
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t app-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/80 dark:bg-slate-900/40 px-2 app-text-muted">{t('auth.or')}</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border app-border app-text font-medium py-4 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Chrome size={20} />
            <span>{t('auth.google')}</span>
          </button>
        </div>

        <p className="text-center mt-8 app-text-muted text-xs">
          {t('auth.copyright')} {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
