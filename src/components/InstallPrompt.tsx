import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Bell, Share, Plus } from 'lucide-react';
import {
  getInstallPrompt,
  onInstallPromptChange,
  isStandalone,
  isIOS,
  requestNotificationPermission,
} from '../lib/pwa';

const DISMISS_KEY = 'coachpro:install-dismissed-at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export default function InstallPrompt() {
  const [hasPrompt, setHasPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (isStandalone()) {
      setDismissed(true);
      return;
    }
    const lastDismiss = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    const cooled = Date.now() - lastDismiss > COOLDOWN_MS;
    setDismissed(!cooled);

    const off = onInstallPromptChange((e) => setHasPrompt(!!e));
    return off;
  }, []);

  // On iOS we never get beforeinstallprompt; show banner if not installed and not dismissed
  const shouldShow = !dismissed && !isStandalone() && (hasPrompt || isIOS());

  const handleInstall = async () => {
    if (isIOS() && !hasPrompt) {
      setShowIOSHelp(true);
      return;
    }
    const evt = getInstallPrompt();
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') {
        setHasPrompt(false);
        setDismissed(true);
      }
    } catch (err) {
      console.warn('[InstallPrompt] prompt failed:', err);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    setNotifPerm(result);
  };

  return (
    <>
      <AnimatePresence>
        {shouldShow && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-[200]"
            dir="rtl"
          >
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-500/20 shadow-2xl shadow-blue-500/10 p-4 backdrop-blur" role="dialog" aria-live="polite" aria-label="تثبيت التطبيق">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg ring-1 ring-white/10">
                  <Download size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-white">ضيف كوتش برو لشاشتك</h3>
                  <p className="text-[12px] text-slate-400 leading-relaxed mt-0.5">
                    اشتغل على التطبيق زيّ أي تطبيق على موبايلك، من غير ما تفتح المتصفح.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleInstall}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold shadow-lg shadow-blue-500/30 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      تثبيت الآن
                    </button>
                    {notifPerm !== 'granted' && notifPerm !== 'denied' && (
                      <button
                        onClick={handleEnableNotifications}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[12px] font-bold border border-white/5 transition flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <Bell size={12} /> تفعيل التنبيهات
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="shrink-0 -mt-1 -me-1 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIOSHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
            onClick={() => setShowIOSHelp(false)}
            dir="rtl"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-slate-950 border border-white/10 shadow-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
                  <Download size={18} className="text-white" />
                </div>
                <h3 className="text-lg font-black text-white">إضافة لشاشة الـ iPhone</h3>
              </div>
              <ol className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-black text-xs">1</span>
                  <div className="flex items-center gap-2">
                    اضغط على زر المشاركة <Share size={16} className="inline text-blue-400" />
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-black text-xs">2</span>
                  <div className="flex items-center gap-2">
                    اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong> <Plus size={14} className="inline text-blue-400" />
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-black text-xs">3</span>
                  <div>اضغط <strong>"إضافة"</strong>، وهتلاقي أيقونة كوتش برو على شاشتك.</div>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSHelp(false)}
                className="mt-5 w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                تمام
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
