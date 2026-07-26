import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Locale = 'ar' | 'en';

type Dict = Record<string, string>;

const ar: Dict = {
  // Brand & shell
  'brand.name': 'كوتش برو',
  'brand.tagline': 'نظام إدارة التدريب الرياضي الذكي',
  'brand.engine': 'المحرك الذكي يعمل',

  // Auth
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.signIn': 'دخول للنظام',
  'auth.google': 'تسجيل الدخول بجوجل',
  'auth.or': 'أو عبر',
  'auth.invalid': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'auth.copyright': 'جميع الحقوق محفوظة © كوتش برو',

  // Tabs
  'tab.today': 'خطة اليوم',
  'tab.weekly': 'الجدول الأسبوعي',
  'tab.analysis': 'التحليل',
  'tab.assessment': 'التقييم البدني',
  'tab.falcon': 'عين الصقر',
  'tab.feed': 'الأبطال',
  'tab.chat': 'المحادثة',
  'tab.profile': 'ملفي',

  // Header actions
  'action.scanner': 'ماسح الثلاجة',
  'action.notifications': 'الإشعارات',
  'action.signOut': 'تسجيل الخروج',
  'action.theme.dark': 'الوضع الداكن',
  'action.theme.light': 'الوضع الفاتح',
  'action.lang.toggle': 'English',

  // Sidebar
  'shell.menu': 'القائمة',
  'shell.settings': 'الإعدادات',

  // PDF
  'pdf.generating': 'جاري إنشاء الملف...',

  // Dashboard greetings
  'dashboard.welcome': 'أهلاً بك',
  'dashboard.commitment': 'التزامك النهاردة',
  'dashboard.todayAchievement': 'إنجاز اليوم',
  'dashboard.currentWeight': 'الوزن الحالي',
  'dashboard.aiChat': 'تحدث مع المساعد الذكي',
  'dashboard.aiChatDesc': 'اسأل الكوتش الذكي أي سؤال عن تدريبك أو تغذيتك',
  'dashboard.askAI': 'اسأل الكوتش الذكي',
  'dashboard.askPlaceholder': 'اكتب سؤالك هنا...',

  // Wellness
  'wellness.title': 'كيف حالك اليوم يا بطل؟',
  'wellness.energy': 'مستوى الطاقة',
  'wellness.mood': 'الحالة النفسية',

  // Plan
  'plan.myPlan': 'الخطة المخصصة لك',
  'plan.viewFull': 'عرض الخطة كاملة',
  'plan.workout': 'جدول التمارين',
  'plan.nutrition': 'نظام التغذية',
  'plan.exportPdf': 'تصدير PDF',
  'plan.generating': 'جاري التوليد...',
  'plan.todayMeals': 'وجبات النهاردة',
  'plan.todayWorkout': 'تمارين النهاردة',
  'plan.noData': 'لم يتم إعداد الخطة بعد',

  // Water
  'water.goal': 'هدف المياه اليومي',
  'water.liters': 'لتر',

  // Days
  'day.Saturday': 'السبت',
  'day.Sunday': 'الأحد',
  'day.Monday': 'الاثنين',
  'day.Tuesday': 'الثلاثاء',
  'day.Wednesday': 'الأربعاء',
  'day.Thursday': 'الخميس',
  'day.Friday': 'الجمعة',

  // Celebration
  'celebration.hero': 'بطل اليوم!',
  'celebration.login': 'أهلاً بعودتك! استعد لتحقيق أهدافك.',
  'celebration.complete': 'ممتاز! أنهيت مهامك اليوم!',
};

const en: Dict = {
  'brand.name': 'CoachPro',
  'brand.tagline': 'Smart Fitness Coaching Platform',
  'brand.engine': 'Smart Engine Active',

  'auth.email': 'Email Address',
  'auth.password': 'Password',
  'auth.signIn': 'Sign In',
  'auth.google': 'Sign in with Google',
  'auth.or': 'or continue with',
  'auth.invalid': 'Invalid email or password',
  'auth.copyright': 'All rights reserved © CoachPro',

  'tab.today': "Today's Plan",
  'tab.weekly': 'Weekly Schedule',
  'tab.analysis': 'Analysis',
  'tab.assessment': 'Assessment',
  'tab.falcon': 'Falcon Eye',
  'tab.feed': 'Champions',
  'tab.chat': 'Chat',
  'tab.profile': 'My Profile',

  'action.scanner': 'Fridge Scanner',
  'action.notifications': 'Notifications',
  'action.signOut': 'Sign Out',
  'action.theme.dark': 'Dark Mode',
  'action.theme.light': 'Light Mode',
  'action.lang.toggle': 'العربية',

  'shell.menu': 'Menu',
  'shell.settings': 'Settings',

  'pdf.generating': 'Generating file...',

  'dashboard.welcome': 'Welcome back',
  'dashboard.commitment': 'Today\'s commitment',
  'dashboard.todayAchievement': 'Today\'s Progress',
  'dashboard.currentWeight': 'Current Weight',
  'dashboard.aiChat': 'Chat with AI Assistant',
  'dashboard.aiChatDesc': 'Ask your AI coach anything about training or nutrition',
  'dashboard.askAI': 'Ask AI Coach',
  'dashboard.askPlaceholder': 'Type your question here...',

  'wellness.title': 'How are you feeling today?',
  'wellness.energy': 'Energy Level',
  'wellness.mood': 'Mood Score',

  'plan.myPlan': 'Your Personalized Plan',
  'plan.viewFull': 'View Full Plan',
  'plan.workout': 'Workout Schedule',
  'plan.nutrition': 'Nutrition Plan',
  'plan.exportPdf': 'Export PDF',
  'plan.generating': 'Generating...',
  'plan.todayMeals': 'Today\'s Meals',
  'plan.todayWorkout': 'Today\'s Workout',
  'plan.noData': 'Plan not ready yet',

  'water.goal': 'Daily Water Goal',
  'water.liters': 'liters',

  'day.Saturday': 'Saturday',
  'day.Sunday': 'Sunday',
  'day.Monday': 'Monday',
  'day.Tuesday': 'Tuesday',
  'day.Wednesday': 'Wednesday',
  'day.Thursday': 'Thursday',
  'day.Friday': 'Friday',

  'celebration.hero': 'Hero of the Day!',
  'celebration.login': 'Welcome back! Ready to crush your goals.',
  'celebration.complete': 'Amazing! You completed all your tasks today!',
};

const dictionaries: Record<Locale, Dict> = { ar, en };

interface I18nContextValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  setLocale: (l: Locale) => void;
  toggle: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'coachpro:locale';

function readInitial(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch (error) {
    console.warn('[i18n] unable to read locale preference:', error);
  }
  return 'ar';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitial);

  const dir: 'rtl' | 'ltr' = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
  }, [locale, dir]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const toggle = useCallback(() => setLocaleState((l) => (l === 'ar' ? 'en' : 'ar')), []);

  const t = useCallback(
    (key: string) => dictionaries[locale][key] ?? dictionaries.en[key] ?? key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, dir, t, setLocale, toggle }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
