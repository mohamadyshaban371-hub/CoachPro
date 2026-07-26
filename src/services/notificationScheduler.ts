import { collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createNotification } from '../core/services/notifications.service';
import type { AppNotification, ClientMembership, UserProfile } from '../types';

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 15 * 60 * 1000;

type ScheduledProfile = Pick<UserProfile, 'uid' | 'name' | 'onboardingData' | 'measurementHistory' | 'lastMeasurementSubmittedAt' | 'dailyLogs' | 'dailyProgress' | 'expiryDate'>;

type MembershipContext = Pick<ClientMembership, 'status' | 'paymentStatus'>;

async function hasRecentSchedulerNotification(uid: string, schedulerKey: string) {
  if (!uid) return true;

  try {
    const notificationsRef = collection(db, 'users', uid, 'notifications');
    const snapshot = await getDocs(notificationsRef);
    const now = Date.now();

    return snapshot.docs.some((docSnap) => {
      const data = docSnap.data() as Partial<AppNotification> & { metadata?: Record<string, unknown> };
      const meta = data.metadata as Record<string, unknown> | undefined;
      const createdAt = data.createdAt as string | undefined;
      const createdMs = createdAt ? new Date(createdAt).getTime() : 0;
      return meta?.schedulerKey === schedulerKey && now - createdMs < RECENT_WINDOW_MS;
    });
  } catch (error) {
    console.warn('[Scheduler] duplicate check failed:', error);
    return false;
  }
}

async function createScheduledNotification(uid: string, payload: { title: string; body: string; type: AppNotification['type']; priority: AppNotification['priority']; metadata?: Record<string, unknown> }, schedulerKey: string) {
  if (!uid) return null;
  const alreadySent = await hasRecentSchedulerNotification(uid, schedulerKey);
  if (alreadySent) return null;

  return createNotification(uid, {
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      schedulerKey,
      source: 'scheduler',
    },
  });
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export async function scheduleMembershipNotifications(profile: ScheduledProfile, membership?: MembershipContext | null) {
  const uid = profile.uid;
  if (!uid) return [];

  const items: Array<Promise<unknown>> = [];
  const expiryDate = toDate(profile.expiryDate);
  const today = new Date();
  const dayKey = getDateKey(today);

  if (membership?.status === 'frozen') {
    items.push(createScheduledNotification(uid, {
      title: 'اشتراكك مجمد',
      body: 'تم تجميد عضويتك مؤقتًا. راجع الحالة مع المدرب أو الإدارة.',
      type: 'membership',
      priority: 'high',
    }, `membership:frozen:${dayKey}`));
  }

  if (membership?.paymentStatus === 'overdue') {
    items.push(createScheduledNotification(uid, {
      title: 'هناك دفعة متأخرة',
      body: 'يوجد دفعة متأخرة في اشتراكك. يرجي تحديث الحالة قبل انقطاع الخدمة.',
      type: 'membership',
      priority: 'urgent',
    }, `membership:overdue:${dayKey}`));
  }

  if (expiryDate) {
    const diffDays = daysBetween(new Date(today.setHours(0, 0, 0, 0)), expiryDate);
    if (diffDays === 0) {
      items.push(createScheduledNotification(uid, {
        title: 'اشتراكك ينتهي اليوم',
        body: 'ينتهي اشتراكك اليوم. راجع التجديد قبل إيقاف الخدمة.',
        type: 'membership',
        priority: 'urgent',
      }, `membership:expires-today:${dayKey}`));
    } else if (diffDays === 3) {
      items.push(createScheduledNotification(uid, {
        title: 'اشتراكك ينتهي خلال 3 أيام',
        body: 'تبقّى 3 أيام على انتهاء الاشتراك. لا تتأخر في التجديد.',
        type: 'membership',
        priority: 'high',
      }, `membership:expires-3-days:${dayKey}`));
    } else if (diffDays === 7) {
      items.push(createScheduledNotification(uid, {
        title: 'اشتراكك ينتهي خلال 7 أيام',
        body: 'تبقّى 7 أيام على انتهاء الاشتراك. أحضر خطتك للتجديد.',
        type: 'membership',
        priority: 'high',
      }, `membership:expires-7-days:${dayKey}`));
    }
  }

  return Promise.all(items);
}

export async function scheduleMeasurementNotifications(profile: ScheduledProfile) {
  const uid = profile.uid;
  if (!uid) return [];

  const items: Array<Promise<unknown>> = [];
  const today = new Date();
  const dayKey = getDateKey(today);
  const history = profile.measurementHistory || [];
  const latest = history[history.length - 1];
  const latestDate = toDate(latest?.date);
  const lastSubmitted = toDate(profile.lastMeasurementSubmittedAt);

  if (!latestDate && !lastSubmitted) {
    items.push(createScheduledNotification(uid, {
      title: 'تذكير بالقياسات الأسبوعية',
      body: 'أضف قياساتك هذا الأسبوع حتى تبقى خطة التدريب دقيقة.',
      type: 'progress',
      priority: 'medium',
    }, `progress:weekly-reminder:${dayKey}`));
  }

  const referenceDate = latestDate || lastSubmitted || new Date();
  const daysSince = Math.floor((today.getTime() - referenceDate.getTime()) / 86400000);

  if (daysSince >= 14) {
    items.push(createScheduledNotification(uid, {
      title: 'لم تُضف قياسات منذ 14 يوم',
      body: 'أرسل آخر قياساتك حتى يُحدث المدرب خطتك.',
      type: 'progress',
      priority: 'high',
    }, `progress:no-measurements:${dayKey}`));
  }

  if (daysSince >= 30) {
    items.push(createScheduledNotification(uid, {
      title: 'تذكير بصور التقدم الشهري',
      body: 'أضف صورة التقدم الشهري لتتبع التقدم بشكل أوضح.',
      type: 'progress',
      priority: 'medium',
    }, `progress:monthly-photo:${dayKey}`));
  }

  if (latest && history.length > 1) {
    const previous = history[history.length - 2];
    const prevWeight = previous.weight;
    const currWeight = latest.weight;
    const weightDelta = prevWeight ? ((currWeight - prevWeight) / prevWeight) * 100 : 0;
    const goal = profile.onboardingData?.goal;

    if ((goal === 'loss' && currWeight <= prevWeight) || (goal === 'bulk' && currWeight >= prevWeight)) {
      items.push(createScheduledNotification(uid, {
        title: 'تم الوصول إلى هدفك',
        body: 'أظهر آخر قياس أنك تتجه نحو الهدف المحدد. تابع التقدم.',
        type: 'progress',
        priority: 'medium',
      }, `progress:goal-reached:${dayKey}`));
    }

    if (Math.abs(weightDelta) < 1) {
      items.push(createScheduledNotification(uid, {
        title: 'تم رصد plateau',
        body: 'أظهرت القياسات اتساقًا قليلًا في الوزن. قد تحتاج إلى تعديل خطة التدريب أو التغذية.',
        type: 'progress',
        priority: 'high',
      }, `progress:plateau:${dayKey}`));
    }
  }

  return Promise.all(items);
}

export async function scheduleWorkoutNotifications(profile: ScheduledProfile) {
  const uid = profile.uid;
  if (!uid) return [];

  const items: Array<Promise<unknown>> = [];
  const today = new Date();
  const dayKey = getDateKey(today);
  const todayLog = profile.dailyLogs?.[dayKey];

  if (!todayLog?.completedWorkout) {
    items.push(createScheduledNotification(uid, {
      title: 'تذكير بالتمرين اليومي',
      body: 'حان وقت جلسة التمرين اليوم. جرّب 15 دقيقة فقط لو كانت شاقة.',
      type: 'workout',
      priority: 'medium',
    }, `workout:daily-reminder:${dayKey}`));
  }

  if (todayLog?.completedWorkout) {
    items.push(createScheduledNotification(uid, {
      title: 'تم إكمال التمرين',
      body: 'تم تسجيل الجلسة اليوم بنجاح. استمر في التقدم.',
      type: 'workout',
      priority: 'low',
    }, `workout:completed:${dayKey}`));
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday);
  const yesterdayLog = profile.dailyLogs?.[yesterdayKey];
  if (!todayLog?.completedWorkout && !yesterdayLog?.completedWorkout) {
    items.push(createScheduledNotification(uid, {
      title: 'تم تفويت جلسة تدريبية',
      body: 'لم تُسجل أي جلسة تدريبية خلال آخر يومين. راجع خطة اليوم.',
      type: 'workout',
      priority: 'high',
    }, `workout:missed:${dayKey}`));
  }

  if (today.getDay() === 0) {
    items.push(createScheduledNotification(uid, {
      title: 'ملخص الالتزام الأسبوعي',
      body: 'راجع عدد الجلسات التي أتممتها هذا الأسبوع لتقييم مستواك.',
      type: 'workout',
      priority: 'medium',
    }, `workout:weekly-adherence:${dayKey}`));
  }

  return Promise.all(items);
}

export async function scheduleNutritionNotifications(profile: ScheduledProfile) {
  const uid = profile.uid;
  if (!uid) return [];

  const items: Array<Promise<unknown>> = [];
  const today = new Date();
  const dayKey = getDateKey(today);
  const todayProgress = profile.dailyProgress?.[dayKey];
  const nowHour = today.getHours();

  if (nowHour >= 13 && (!todayProgress || (todayProgress.totalMeals || 0) < 2)) {
    items.push(createScheduledNotification(uid, {
      title: 'تذكير بالوجبة',
      body: 'يبدو أنك لم تسجل وجباتك بعد. احرص على تناول وجبة متوازنة.',
      type: 'nutrition',
      priority: 'medium',
    }, `nutrition:meal-reminder:${dayKey}`));
  }

  if (nowHour >= 16) {
    const waterLiters = profile.dailyLogs?.[dayKey]?.waterLiters || 0;
    if (waterLiters < 2.5) {
      items.push(createScheduledNotification(uid, {
        title: 'تذكير بالمياه',
        body: 'لديك حاجة إلى شرب المزيد من الماء اليوم.',
        type: 'nutrition',
        priority: 'medium',
      }, `nutrition:water-reminder:${dayKey}`));
    }
  }

  const latestMeasurement = profile.measurementHistory?.[profile.measurementHistory.length - 1];
  const weight = latestMeasurement?.weight || profile.onboardingData?.manualInBody?.weight || profile.onboardingData?.weight;
  const proteinTarget = weight ? Math.max(120, Math.round(weight * 1.6)) : 160;
  if (latestMeasurement && latestMeasurement.protein < proteinTarget - 10) {
    items.push(createScheduledNotification(uid, {
      title: 'تم تفويت هدف البروتين',
      body: 'يبدو أن بروتينك أقل من الهدف اليومي. أضف مصدرًا غنيًا بالبروتين.',
      type: 'nutrition',
      priority: 'high',
    }, `nutrition:protein-target:${dayKey}`));
  }

  if ((todayProgress?.totalMeals || 0) > 4) {
    items.push(createScheduledNotification(uid, {
      title: 'تم تجاوز السعرات',
      body: 'تبدو الوجبات مرتفعة السعرات اليوم. راجع التوازن الغذائي.',
      type: 'nutrition',
      priority: 'medium',
    }, `nutrition:calories-exceeded:${dayKey}`));
  }

  return Promise.all(items);
}

export async function scheduleAISchedulerNotifications(profile: ScheduledProfile, kind: 'workout' | 'meal' | 'prediction' | 'calorie' | 'cardio', body: string) {
  const uid = profile.uid;
  if (!uid) return null;

  const dayKey = getDateKey(new Date());
  const titleByKind = {
    workout: 'تم توليد خطة تمرين جديدة',
    meal: 'تم توليد خطة غذائية جديدة',
    prediction: 'تنبؤ بالتقدم جاهز',
    calorie: 'توصية بتعديل السعرات',
    cardio: 'توصية بتعديل الكارديو',
  } as const;

  return createScheduledNotification(uid, {
    title: titleByKind[kind],
    body,
    type: 'coach',
    priority: 'medium',
    metadata: { source: 'ai-scheduler', kind },
  }, `ai:${kind}:${dayKey}`);
}

export function startNotificationScheduler(profile: ScheduledProfile | null, membership?: MembershipContext | null) {
  if (!profile?.uid) return () => undefined;

  const run = async () => {
    await Promise.all([
      scheduleMembershipNotifications(profile, membership),
      scheduleMeasurementNotifications(profile),
      scheduleWorkoutNotifications(profile),
      scheduleNutritionNotifications(profile),
    ]);
  };

  void run();
  const intervalId = window.setInterval(() => {
    void run();
  }, POLL_INTERVAL_MS);

  return () => window.clearInterval(intervalId);
}
