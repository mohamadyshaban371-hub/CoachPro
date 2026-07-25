# CoachPro (كوتش برو) — Complete System Documentation
**Version:** 5.0 | **Date:** July 2026 | **Stack:** React 19 + Vite 7 + Express + Firebase + Gemini AI

---

## 1. PROJECT OVERVIEW

### 1.1 اسم المشروع وهدفه
**CoachPro (كوتش برو)** — نظام إدارة تدريب رياضي متكامل، عربي-أول، يعمل كـ Progressive Web App (PWA) ويدعم أيضاً Android APK عبر Capacitor.

**الهدف:** تمكين المدرب من إدارة عملاءه (تغذية، تمرين، EMS، تأهيل) بمساعدة ذكاء اصطناعي متقدم (Google Gemini)، مع تتبع التقدم، والتواصل، والتقييم البدني بشكل آلي ومنظم.

### 1.2 أنواع المستخدمين

| النوع | الدور | الوصول |
|-------|-------|--------|
| **Admin / Coach** | المدرب المالك للنظام | لوحة إدارة كاملة: إنشاء عملاء، توليد خطط AI، مالية، رسائل |
| **Client** | العميل المسجّل | لوحة العميل: 9 تبويبات، اطلاع على خطته، تسجيل تقدم، محادثة |
| **System** | Firebase Admin SDK | إنشاء حسابات، ربط بيانات، التحقق من Tokens |

> **ملاحظة:** لا يوجد تسجيل ذاتي للعميل. الأدمن فقط ينشئ الحسابات.

### 1.3 جميع المميزات الموجودة حالياً

#### ميزات الأدمن:
- ✅ إنشاء عملاء + تعيين packages (EMS/Workout/Nutrition/Rehab)
- ✅ توليد خطة AI أسبوعية كاملة (تمرين + تغذية + تأهيل + EMS)
- ✅ عرض نتائج الاختبارات البدنية + المحرك العلمي لكل عميل
- ✅ إدارة الاشتراكات والدفعات (أقساط، حالة الدفع)
- ✅ رسائل مع العملاء + badge عداد الرسائل غير المقروءة
- ✅ ميكروفون ذكي (SmartMicInbox) لتسجيل ملاحظات صوتية
- ✅ FalconEye (تقرير AI شامل لكل عميل)
- ✅ لوحة مالية كاملة (FinancialDashboard)
- ✅ Macro Calculator card لكل عميل
- ✅ Admin Digest (ملخص يومي)
- ✅ Champions Feed (منشورات المجتمع)
- ✅ EMS Attendance تسجيل حضور الجلسات

#### ميزات العميل:
- ✅ **Today Tab:** بروتوكول اليوم (ماء، طاقة، حالة مزاجية، تمارين اليوم)
- ✅ **Weekly Tab:** الخطة الأسبوعية كاملة (7 أيام)
- ✅ **Analysis Tab:** InBody + قياسات + مؤشر تقدم
- ✅ **Chat Tab:** محادثة مع الكوتش + TTS + تسجيل صوتي
- ✅ **Falcon Tab:** تقرير AI شامل
- ✅ **Feed Tab:** منشورات المجتمع
- ✅ **Profile Tab:** بيانات الملف الشخصي
- ✅ **Assessment Tab:** الاختبارات البدنية (بعد إكمال الاستبيان)
- ✅ **Injury Tab:** تقييم الإصابات (Rehab فقط)
- ✅ PWA install prompt
- ✅ نظام XP + رتب + شارات (Gamification)
- ✅ Period Tracker للإناث
- ✅ Smartwatch Panel
- ✅ Fridge Scanner (مسح الثلاجة بالكاميرا)
- ✅ Recovery Workout Modal
- ✅ Body Map (خريطة الجسم التفاعلية)

---

## 2. APPLICATION ARCHITECTURE

### 2.1 هيكل المشروع الكامل

```
/
├── server.ts                    ← Express server (API proxy + Vite middleware)
├── src/
│   ├── main.tsx                 ← Entry point (React mount)
│   ├── App.tsx                  ← Router الرئيسي (3-stage gate)
│   ├── firebase.ts              ← Firebase client SDK config
│   ├── types.ts                 ← جميع TypeScript interfaces
│   ├── components/              ← UI Components
│   │   ├── Login.tsx            ← صفحة الدخول (Email/Password + Google)
│   │   ├── Onboarding.tsx       ← تسجيل أولي (InBody OCR, بيانات شخصية)
│   │   ├── SurveyManager.tsx    ← معالج الاستبيانات (4 استبيانات)
│   │   ├── AdminDashboard.tsx   ← لوحة الأدمن الكاملة (4738 سطر)
│   │   ├── ClientDashboard.tsx  ← لوحة العميل الكاملة (3330 سطر)
│   │   ├── DashboardShell.tsx   ← الهيكل الخارجي (nav + sidebar)
│   │   ├── Chat.tsx             ← محادثة نصية + صوتية
│   │   ├── FalconEye.tsx        ← تقرير AI شامل
│   │   ├── Profile.tsx          ← الملف الشخصي
│   │   ├── ActivityFeed.tsx     ← عرض المنشورات
│   │   ├── BadgesPanel.tsx      ← عرض الشارات والرتب
│   │   ├── BodyMap.tsx          ← خريطة الجسم التفاعلية
│   │   ├── CelebrationPopup.tsx ← نافذة الاحتفال عند الترقية
│   │   ├── ChampionsFeed.tsx    ← منشورات المجتمع
│   │   ├── ComplianceScores.tsx ← مؤشرات الالتزام
│   │   ├── EMSAttendance.tsx    ← حضور جلسات EMS
│   │   ├── FinancialDashboard.tsx ← لوحة المالية
│   │   ├── FridgeScanner.tsx    ← مسح الثلاجة بالكاميرا
│   │   ├── Lightbox.tsx         ← عارض الصور الكبيرة
│   │   ├── MeasurementUpdate.tsx ← تحديث القياسات
│   │   ├── MembershipManager.tsx ← إدارة الاشتراكات
│   │   ├── MoodTrendChart.tsx   ← مخطط المزاج
│   │   ├── PeriodTracker.tsx    ← متتبع الدورة الشهرية
│   │   ├── PointsBadge.tsx      ← عرض النقاط
│   │   ├── ProgressUpdate.tsx   ← تحديث التقدم
│   │   ├── RecoveryWorkoutModal.tsx ← جلسة استشفاء طارئة
│   │   ├── ScientificEngineCard.tsx ← عرض نتائج المحرك العلمي
│   │   ├── SmartMicInbox.tsx    ← صندوق الملاحظات الصوتية
│   │   ├── SmartwatchPanel.tsx  ← بيانات الساعة الذكية
│   │   ├── AdminDigest.tsx      ← ملخص الأدمن اليومي
│   │   ├── AdminMacroCard.tsx   ← بطاقة Macros في أدمن
│   │   ├── AdminProgressionCard.tsx ← بطاقة Progression في أدمن
│   │   ├── AdminRadar.tsx       ← مخطط Radar للأدمن
│   │   ├── BrandLogo.tsx        ← شعار التطبيق
│   │   ├── ErrorBoundary.tsx    ← معالج الأخطاء
│   │   ├── InstallPrompt.tsx    ← نافذة تثبيت PWA
│   │   └── surveys/             ← الاستبيانات التفصيلية
│   │       ├── NutritionSurvey.tsx   ← استبيان التغذية
│   │       ├── WorkoutSurvey.tsx     ← استبيان التمرين
│   │       ├── RehabSurvey.tsx       ← استبيان التأهيل
│   │       ├── EMSSurvey.tsx         ← استبيان EMS
│   │       └── GeneralMedicalForm.tsx ← نموذج طبي عام
│   ├── lib/                     ← Business Logic (pure functions)
│   │   ├── scientificEngine.ts  ← المحرك العلمي الحتمي (1659 سطر)
│   │   ├── aiBlocks.ts          ← Hard-rail blocks للـ AI prompts
│   │   ├── macroCalculator.ts   ← حساب BMR/TDEE/Macros
│   │   ├── emsProtocol.ts       ← قواعد EMS الأمنية
│   │   ├── gamification.ts      ← نظام XP + رتب
│   │   ├── badges.ts            ← منطق الشارات
│   │   ├── activityLog.ts       ← سجل الأنشطة
│   │   ├── firebaseUtils.ts     ← Firebase utility helpers
│   │   ├── error-handler.ts     ← معالجة الأخطاء
│   │   ├── i18n.tsx             ← الترجمة (عربي/إنجليزي)
│   │   ├── imageUtils.ts        ← معالجة الصور
│   │   ├── pwa.ts               ← Service Worker helpers
│   │   ├── smartwatch.ts        ← تكامل الساعة الذكية
│   │   ├── sounds.ts            ← أصوات التطبيق
│   │   └── theme.tsx            ← إدارة الـ Dark/Light mode
│   └── services/
│       └── aiMasterEngine.ts    ← محرك الذكاء الاصطناعي المركزي (1725 سطر)
├── firebase-applet-config.json  ← Firebase config (public, client-safe)
├── capacitor.config.ts          ← Capacitor (Android APK)
└── .github/workflows/
    └── build-android.yml        ← CI/CD لبناء APK تلقائياً
```

### 2.2 بوابة الدخول (3-Stage Gate) في App.tsx

```
[Browser] 
    ↓
[Firebase Auth Check]
    ├── لا يوجد مستخدم → <Login />
    └── مستخدم موجود
           ↓
    [قراءة users/{uid} من Firestore]
           ├── role = 'admin' → <AdminDashboard />
           └── role = 'client'
                  ↓
           [onboardingComplete?]
                  ├── No → <Onboarding />
                  └── Yes
                         ↓
                  [questionnaireComplete?]
                         ├── No → <SurveyManager />
                         └── Yes → <ClientDashboard />
```

---

## 3. DATA FLOW ANALYSIS

### 3.1 رحلة البيانات من الإدخال إلى النتيجة

```
المستخدم يدخل بيانات
        ↓
[Onboarding] ← صور InBody + بيانات شخصية + هدف
        ↓ (OCR عبر Gemini Vision)
[users/{uid}] ← onboardingData + inBodyExtracted
        ↓
[SurveyManager] ← 4 استبيانات تفصيلية
        ↓
[questionnaires/{uid}] ← nutrition + workout + rehab + ems
        ↓
[AdminDashboard] ← أدمن يضغط "توليد خطة"
        ↓
[aiMasterEngine.generateTrainingPlan()]
   ├── يقرأ: users/{uid} + questionnaires/{uid}
   ├── يحسب: MacroCalculator (BMR/TDEE/Macros)
   ├── يحسب: ScientificEngine (RPE/1RM/Split/WeakAreas)
   ├── يبني: System Prompt شامل
   └── يرسل إلى: Gemini API (عبر server.ts)
        ↓
[Gemini Response] ← JSON كامل 7 أيام
        ↓
[users/{uid}.plans.weeklyPlan] ← تخزين في Firestore
        ↓
[ClientDashboard] ← عرض الخطة للعميل
```

### 3.2 مصادر البيانات ومكان قراءتها

| البيانة | مصدر التخزين | من يكتبها | من يقرأها |
|---------|-------------|----------|----------|
| بيانات الأونبوردينج | `users/{uid}.onboardingData` | Onboarding.tsx | aiMasterEngine, ScientificEngine |
| InBody OCR | `users/{uid}.onboardingData.inBodyExtracted` | server.ts (Gemini OCR) | macroCalculator, generateNutritionDraft |
| نتائج الاستبيانات | `questionnaires/{uid}` | SurveyManager.tsx | aiMasterEngine.generateTrainingPlan |
| الخطة الأسبوعية | `users/{uid}.plans.weeklyPlan` | aiMasterEngine | ClientDashboard |
| الخطة المسودة | `users/{uid}.plans.draft` | aiMasterEngine | AdminDashboard |
| نتائج الاختبارات البدنية | `users/{uid}.assessmentHistory[]` | ClientDashboard | aiMasterEngine (benchmarks) |
| القياسات | `users/{uid}.measurementHistory[]` | MeasurementUpdate.tsx | macroCalculator, Analysis Tab |
| النقاط (Coins) | `users/{uid}.coins` | gamification.ts | BadgesPanel, ClientDashboard |
| التقدم اليومي | `users/{uid}.dailyProgress.{YYYY-MM-DD}` | ClientDashboard | ScientificEngine (Progression) |
| جلسات EMS | `emsSessions/{id}` | EMSAttendance.tsx | AdminDashboard |
| الاشتراكات | `clientMemberships/{id}` | AdminDashboard | SurveyManager, aiMasterEngine |
| المحادثات | `messages/{uid}/msgs/{id}` | Chat.tsx | Chat.tsx, AdminDashboard |
| منشورات الفيد | `feed/{postId}` | ActivityFeed.tsx | ChampionsFeed |

---

## 4. DATABASE DOCUMENTATION

### 4.1 Collections الكاملة

#### `users/{uid}`
```typescript
{
  uid: string                    // Firebase Auth UID
  email: string
  name: string
  role: 'admin' | 'client'
  gender: 'male' | 'female'
  onboardingComplete: boolean
  questionnaireComplete: boolean
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  voiceTranscript: string        // ملاحظات الكوتش الصوتية
  coins: number                  // نقاط الـ Gamification
  
  packages: {
    ems?: boolean
    workout?: boolean
    nutrition?: boolean
    rehab?: boolean
  }
  
  onboardingData: {
    age: number
    height: number               // cm
    weight: number               // kg
    gender: 'male' | 'female'
    goal: 'shape' | 'loss' | 'bulk' | 'fitness' | 'rehab'
    injuryDescription: string
    trainingLocation: 'gym' | 'home' | 'both'
    homeEquipment: string
    workoutDuration: number      // minutes
    likes: string                // أكل محبوب
    dislikes: string             // أكل مرفوض
    inBodyExtracted?: {
      weight: number
      fatPercentage: number
      muscleMass: number
      visceralFat?: number
      bmi?: number
    }
    inBodyPhoto?: string         // URL
    birthDate?: string           // ISO date
    jobNature?: 'desk' | 'active' | 'mixed'
    preferredTime?: string
  }
  
  plans: {
    weeklyPlan: Record<'Saturday'|'Sunday'|...|'Friday', {
      nutrition: Meal[]
      workout: Exercise[]
    }>
    draft?: any                  // مسودة قبل التأكيد
    nutritionDraft?: string      // نص مسودة التغذية
    workoutDraft?: string
    rehabDraft?: string
    emsDraft?: string
  }
  
  assessmentHistory: Array<{
    date: string
    testId: string
    testName: string
    value: number
    score: number                // 0-100 بعد التطبيع بالعمر والجنس
    estimated1RM?: number        // للقوة (Brzycki)
  }>
  
  measurementHistory: Array<{
    date: string
    weight?: number
    chest?: number
    waist?: number
    arm?: number
    hip?: number
    fatPercentage?: number
    muscleMass?: number
    photo?: string
  }>
  
  dailyProgress: {
    [YYYY-MM-DD]: {
      waterIntake: number         // ml
      energyLevel: number         // 1-10
      moodScore: number           // 1-10
      exercisesCompleted: number
      totalExercises: number
      completedWorkout: boolean
      rpe?: number
    }
  }
  
  cycleLog?: {
    lastPeriodStart: string
    cycleLength: number
  }
  
  medicalFlags?: {
    bloodPressure?: boolean
    diabetes?: boolean
    pregnancy?: boolean
    kidneyDisease?: boolean
  }
}
```

#### `questionnaires/{uid}`
```typescript
{
  nutrition: NutritionSurveyData {
    lifestyle: {
      jobNature: 'desk' | 'active' | 'mixed' | ''
      activityLevel: 'sedentary' | 'light' | 'moderate' | 'high'
      wakeHour: string
      sleepHour: string
      sleepHours: number
      stress: number             // 1-10
    }
    preferences: {
      likes: string
      dislikes: string
      allergies: string
      dietType: string           // نباتي، لاحم، إلخ
    }
    medical: {
      bloodPressure: boolean
      diabetes: boolean
      kidneyDisease: boolean
      heartDisease: boolean
      cholesterol: boolean
      digestiveIssues: boolean
    }
    measurements: {
      weight: number
      fatPercentage: number
      muscleMass: number
      visceralFat: number
      chest: number
      waist: number
      arm: number
    }
    habits: {
      mealsPerDay: number
      waterLiters: number
      supplements: string[]
    }
    timeline: {
      targetDate: string
      weeklyCheckIn: boolean
    }
  }
  
  workout: WorkoutSurveyData {
    environment: {
      location: 'gym' | 'home' | 'both'
      homeEquipment: string
      gymDays: string[]
      homeDays: string[]
      availableDays: string[]
      preferredTime: string
    }
    experience: {
      level: 'beginner' | 'intermediate' | 'advanced'
      yearsTraining: number
      previousPrograms: string
    }
    health: {
      injuries: string
      limitations: string
      sleepHours: number
      stress: number
    }
    goals: {
      primary: string
      secondary: string
      targetDate: string
    }
  }
  
  rehab: RehabSurveyData {
    injuryDescription: string
    painPoints: string[]
    painLevel: number            // 0-10
    affectedJoints: string[]
    rehabHistory: string
    doctorClearance: boolean
  }
  
  ems: EMSSurveyData {
    experience: string
    conditions: string[]
    goals: string
    sessionPreferences: string
  }
  
  submittedAt: string
}
```

#### `clientMemberships/{id}`
```typescript
{
  clientId: string               // users/{uid}
  clientName: string
  packageType: string            // اسم الباقة من registry
  startDate: string
  endDate: string
  sessionsTotal: number
  sessionsRemaining: number
  price: number
  paymentStatus: 'paid' | 'partial' | 'pending'
  installments: Array<{
    amount: number
    dueDate: string
    paidDate?: string
    status: 'paid' | 'pending'
  }>
}
```

#### `memberships/{id}` (Packages Registry)
```typescript
{
  name: string                   // اسم الباقة
  type: 'ems' | 'workout' | 'nutrition' | 'rehab'
  price: number
  sessions: number
  durationDays: number
  description: string
}
```

#### `emsSessions/{id}`
```typescript
{
  clientId: string
  membershipId: string
  date: string
  duration: number               // minutes
  intensity: string
  notes: string
  conductedBy: string            // admin uid
}
```

#### `messages/{uid}/msgs/{msgId}`
```typescript
{
  text: string
  sender: 'admin' | 'client'
  timestamp: Timestamp
  read: boolean
  audioUrl?: string
}
```

#### `feed/{postId}`
```typescript
{
  authorId: string
  authorName: string
  content: string
  imageUrl?: string
  timestamp: Timestamp
  likes: string[]                // UIDs
  comments: Array<{ uid, text, timestamp }>
  xpAwarded: boolean
}
```

---

## 5. API & SERVICES DOCUMENTATION

### 5.1 Server Endpoints (server.ts)

| Endpoint | Method | الوظيفة | المستخدم |
|----------|--------|---------|---------|
| `/api/health` | GET | فحص حالة السيرفر | System |
| `/api/admin/bootstrap` | POST | إنشاء حساب الأدمن الأول | System |
| `/api/admin/create-client` | POST | إنشاء حساب عميل جديد (Firebase Auth + Firestore) | AdminDashboard |
| `/api/admin/activate-client` | POST | تفعيل العميل + تعيين packages | AdminDashboard |
| `/api/admin/delete-client` | POST | حذف العميل نهائياً | AdminDashboard |
| `/api/storage-status` | GET | فحص Firebase Storage | AdminDashboard |
| `/api/ai-service` | POST | Proxy لجميع طلبات Gemini AI | aiMasterEngine |
| `/api/ai-test` | GET | اختبار الاتصال بـ Gemini | System |
| `/api/transcribe` | POST | تحويل صوت إلى نص (Gemini Audio) | Chat.tsx |
| `/api/upload` | POST | رفع ملفات إلى Firebase Storage | Onboarding, surveys |
| `*` | GET | Vite dev middleware (SPA fallback) | Browser |

### 5.2 AI Master Engine — Functions الرئيسية

| الدالة | الوظيفة | المدخلات | المخرجات |
|--------|---------|---------|---------|
| `generateNutritionDraft()` | مسودة خطة تغذية نصية | client + questionnaire | string |
| `generateWorkoutDraft()` | مسودة خطة تمرين نصية | client + questionnaire | string |
| `generateRehabDraft()` | مسودة خطة تأهيل نصية | client + questionnaire | string |
| `generateEMSDraft()` | مسودة خطة EMS نصية | client | string |
| `generateTrainingPlan()` | خطة JSON أسبوعية كاملة | client + questionnaire | WeeklyPlan JSON |
| `generateStructuredPlan()` | دمج المسودات في JSON | 4 draft strings | JSON |
| `extractInBodyData()` | OCR من صورة InBody | base64 image | InBodyExtracted |
| `analyzeMealImage()` | تحليل صورة وجبة | base64 image | Meal analysis |
| `analyzeFridgeContents()` | تحليل صورة ثلاجة | base64 image | Recipe suggestions |
| `generateFalconReport()` | تقرير شامل للعميل | client + questionnaire | Arabic report |
| `transcribeAudio()` | تحويل صوت إلى نص | audio blob | string |

### 5.3 Scientific Engine — Functions الرئيسية

| الدالة | الوظيفة |
|--------|---------|
| `checkReadiness()` | حساب عامل الاستعداد (0.5/0.7/0.85/1.0) |
| `selectTests()` | اختيار الاختبارات حسب الهدف (6 أساسية + 5 هدف) |
| `selectAdaptiveTests()` | اختيار اختبارات بعد فلترة الإصابات والموقع |
| `scoreTest()` | تحويل نتيجة الاختبار إلى 0-100 مع تعديل العمر/الجنس |
| `scoreAllTests()` | تسجيل جميع الاختبارات دفعة واحدة |
| `evaluateScore()` | تحويل الرقم إلى تقييم (ضعيف/مقبول/جيد/جيد جداً/ممتاز) |
| `decideIntensity()` | حساب % of 1RM + RPE + RIR + Split |
| `brzycki1RM()` | تحويل 5RM إلى 1RM (Brzycki Formula) |
| `ageModifierFor()` | معامل العمر (4 تيرات: يافع/ذروة/ماستر/سينيور) |
| `computeScientificPrescription()` | تشغيل الخطوات 0-5 كاملة |
| `computeProgression()` | تحليل 14 يوم + تعديل الحمل (خطوات 6-9) |
| `formatEngineForPrompt()` | تحويل نتائج المحرك لنص يدخل في الـ Prompt |
| `buildAdaptiveContext()` | بناء سياق التقييم التكيفي من بيانات العميل |
| `selectRehabTests()` | اختيار اختبارات التأهيل حسب منطقة الإصابة |

---

## 6. AI LOGIC DOCUMENTATION

### 6.1 كيف يعمل محرك الذكاء الاصطناعي

```
[بيانات العميل الكاملة]
          ↓
┌─────────────────────────────────────┐
│  STEP 1: MacroCalculator (Pure Math) │
│  BMR → TDEE → Calories → Macros     │
│  → يُحسب مرة واحدة، نتيجة ثابتة   │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  STEP 2: ScientificEngine (Pure Math)│
│  Readiness → Intensity% → RPE → Split│
│  WeakAreas → ProgressionAnalysis    │
│  → نتيجة حتمية لا تتغير بين الـ runs│
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  STEP 3: Hard Rails Injection        │
│  engineBlock + progressionBlock +   │
│  CLIENT PROFILE + Body Composition  │
│  + Equipment + Duration + Exclusions│
│  → كل هذا يدخل في System Prompt    │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  STEP 4: Gemini API Call            │
│  Model: gemini-2.5-flash            │
│  Format: responseMimeType=JSON      │
│  → الـ AI لا يستطيع تجاوز الـ Rails │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  STEP 5: Normalize + Validate       │
│  Unwrap nested keys → DAY_KEYS      │
│  Fill missing days → emptyWeek      │
│  Save to Firestore                  │
└─────────────────────────────────────┘
```

### 6.2 ترتيب أولويات مصادر بيانات البرنامج البدني

```
الأولوية 1: questionnaire.workout.environment  (أحدث وأدق)
الأولوية 2: client.onboardingData             (بيانات التسجيل)
الأولوية 3: قيم افتراضية آمنة               (gym, 60 min, intermediate)
```

### 6.3 جميع البيانات التي تصل لـ Gemini في توليد الخطة البدنية

| البيانة | المصدر |
|---------|--------|
| الاسم | `client.name` |
| الجنس | `onboardingData.gender` أو `client.gender` |
| العمر | `onboardingData.age` أو من `birthDate` |
| الهدف | `onboardingData.goal` |
| المستوى | `client.experienceLevel` |
| طبيعة الشغل | `questionnaire.nutrition.lifestyle.jobNature` |
| وقت الاستيقاظ | `questionnaire.nutrition.lifestyle.wakeHour` |
| وقت التمرين المفضل | `questionnaire.workout.environment.preferredTime` |
| الوزن/الطول/BMI | InBody + Measurements + OnboardingData |
| نسبة الدهون | InBody → قياسات الاستبيان |
| الكتلة العضلية | InBody → قياسات الاستبيان |
| الدهون الحشوية | InBody → قياسات الاستبيان |
| تاريخ الإصابات | `onboardingData.injuryDescription` |
| نتائج الاختبارات | `client.assessmentHistory` (آخر 8) |
| نقاط الضعف | ScientificEngine → `weakAreas[]` |
| الشدة المقررة (% 1RM) | ScientificEngine → `intensityPercent` |
| RPE/RIR | ScientificEngine → الخطوة 5 |
| تقسيم البرنامج | ScientificEngine → `workoutSplit` |
| الموقع (جيم/بيت/كلاهما) | `questionnaire.workout.environment.location` |
| المعدات المتاحة | `questionnaire.workout.environment.homeEquipment` |
| أيام الجيم/البيت | `gymDays[]` + `homeDays[]` |
| أيام التمرين | `availableDays[]` |
| مدة الجلسة | `onboardingData.workoutDuration` (دقيقة) |
| عدد التمارين/جلسة | 45د→5-6 / 60د→7-8 / 90د→10-12 |
| أكل محبوب | onboarding.likes + questionnaire.nutrition.preferences.likes |
| أكل مرفوض | onboarding.dislikes + questionnaire.nutrition.preferences.dislikes |
| طاقة اليوم | `dailyProgress[today].energyLevel` |
| المرحلة الهرمونية (إناث) | `cycleLog.lastPeriodStart` + حساب اليوم |
| flags الطبية | bloodPressure / diabetes / pregnancy |
| ملاحظات الكوتش | `client.voiceTranscript` |
| تحليل التقدم 14 يوم | ScientificEngine → ProgressionAnalysis |
| قواعد الجنس | Female: hip-dominant + TDEE أقل / Male: pushing + protein |
| توجيه الدهون | فوق 30%: حرق / 20-30%: recomp / أقل 20%: أداء |
| توجيه الشغل | مكتبي: تمارين وضعية إجبارية / حركي: تقليل حجم 15% |

---

## 7. NUTRITION ENGINE RULES

### 7.1 معادلات BMR و TDEE

```
BMR (ذكر)   = 10×W + 6.25×H − 5×A + 5
BMR (أنثى)  = 10×W + 6.25×H − 5×A − 161
  (W=وزن كجم، H=طول سم، A=عمر سنة — Mifflin-St Jeor)

TDEE = BMR × معامل النشاط:
  sedentary  → ×1.2   (مكتبي)
  light      → ×1.375 (نشاط خفيف)
  moderate   → ×1.55  (نشاط متوسط)
  high       → ×1.725 (نشاط عالي)

Auto-nudge:
  مكتبي + 4+ جلسات/أسبوع → ترفع تلقائياً لـ light
  خفيف  + 5+ جلسات/أسبوع → ترفع تلقائياً لـ moderate
```

### 7.2 أهداف السعرات

| الهدف | معامل | المعنى |
|-------|-------|--------|
| fat loss | ×0.80 | عجز 20% (≈ −500 kcal) |
| shape | ×0.90 | عجز معتدل 10% |
| fitness | ×1.00 | صيانة |
| rehab | ×1.00 | صيانة |
| bulk | ×1.10 | فائض 10% (≈ +250 kcal) |

### 7.3 حساب الماكروز

```
بروتين (g/kg):
  loss/shape → 2.0 g/kg
  bulk       → 2.2 g/kg
  fitness    → 1.6 g/kg
  rehab      → 1.6 g/kg

دهون = 25% من السعرات الكلية ÷ 9
كربوهيدرات = الباقي بعد البروتين والدهون
ماء = 35 ml/kg (min 2L، max 4L)
```

### 7.4 Carb Cycling (حسب نوع اليوم)

```
High Carb  → يوم تمرين شديد (Strength/HIIT) → كارب 50-60%
Moderate   → يوم تمرين متوسط               → كارب 40-50%
Low Carb   → يوم راحة أو كارديو خفيف       → كارب 20-30%
```

### 7.5 التعديل التلقائي بناءً على اتجاه الوزن (14 يوم)

```
إذا الهدف إنقاص:
  الوزن ثابت (<0.3 كجم/أسبوع)      → تخفيض −200 kcal
  الوزن ينزل بسرعة (>1%/أسبوع)    → رفع +200 kcal (حماية عضل)
  ينزل أسرع من المطلوب (>1 كجم/أسبوع) → رفع +150 kcal

إذا الهدف Bulk:
  يرتفع بسرعة (>1%/أسبوع)          → تخفيض −250 kcal
  ثابت (<0.2 كجم/أسبوع)            → رفع +200 kcal

ضغط نفسي مرتفع (>7/10)             → خصم −100 kcal إضافي
```

### 7.6 قواعد الحالات المرضية في التغذية

| الحالة | القاعدة |
|--------|---------|
| سكري | كارب معقد منخفض GI فقط |
| ضغط دم | صوديوم < 2300 ملجم/يوم |
| كوليسترول | تقليل دهون مشبعة + زيادة أوميجا-3 |
| كلى | بروتين ≤ 0.8 g/kg |
| كبد | تقليل الدهون الكلية |
| هضم | تجنب المهيجات (بهارات، كافيين) |
| حمل | تجنب أوضاع الاستلقاء بعد الثلث الأول |

---

## 8. TRAINING ENGINE RULES (Scientific Engine)

### 8.1 خطوات المحرك العلمي (Steps 0-5)

```
Step 0: INPUT → age, gender, goal, location, level, readiness, cyclePhase

Step 1: READINESS CHECK
  stress > 8 أو sleep < 5 أو pain > 6 → severe
  severe واحدة   → status='reduce', factor=0.70
  severe اثنتان+ → status='rest',   factor=0.50
  moderate فقط  → status='reduce', factor=0.85
  طبيعي         → status='normal', factor=1.00

Step 2: TEST SELECTION
  6 اختبارات أساسية (core) دائماً
  + حتى 5 اختبارات حسب الهدف
  + فلترة حسب الموقع (بيت → حذف اختبارات الجيم)
  + فلترة حسب الإصابات (Adaptive Risk Assessment)

Step 3: TEST EXECUTION (يؤديها العميل فعلياً)

Step 4: SCORING
  score = (نتيجة - min) / (max - min) × 100
  للمقاييس المعكوسة: score = (max - نتيجة) / (max - min) × 100
  تعديل العمر × تعديل الجنس:
    عمر < 18 أو > 50  → ÷ 0.85
    عمر 35-49          → ÷ 0.92
    أنثى               → ÷ 0.90 (مضاف فوق تعديل العمر)
  تصنيف:
    0-40   → ضعيف
    41-60  → مقبول
    61-80  → جيد
    81-90  → جيد جداً
    91-100 → ممتاز

Step 5: DECISION ENGINE
  Base Intensity:
    beginner     → 50% of 1RM
    intermediate → 65% of 1RM
    advanced     → 85% of 1RM
  
  Final = Base × readinessFactor × ageMod × cycleMod
  
  cycleMod (إناث):
    menstrual → ×0.85
    luteal    → ×0.95
    others    → ×1.00
  
  WeakAreas = اختبارات score < 40
  → يجب أن تكون أول 1-2 تمارين في كل يوم تدريبي
```

### 8.2 حساب 1RM (Brzycki Formula)

```
1RM = weight × (36 / (37 - reps))
مثال: 80kg × 5 reps → 1RM = 80 × (36/32) = 90 kg
```

### 8.3 مقياس الشدة وعدد التكرارات

| الشدة (% 1RM) | نطاق التكرار | الهدف |
|---------------|-------------|-------|
| 85%+ | 3-5 تكرار | قوة قصوى |
| 75-84% | 5-8 تكرار | قوة |
| 65-74% | 8-12 تكرار | تضخيم |
| 55-64% | 12-15 تكرار | تحمل عضلي |
| < 55% | 15-20 تكرار | تحمل / استشفاء |

### 8.4 RPE و RIR

| المستوى | الشدة ≤50% | Beginner | Intermediate | Advanced |
|---------|-----------|----------|-------------|---------|
| RPE | 5-6 | 6-7 | 7-8 | 8-9 |
| RIR | 4-5 | 3-4 | 2-3 | 1-2 |

### 8.5 تقسيم البرنامج حسب المستوى

| المستوى | التقسيم | الأيام |
|---------|---------|--------|
| Beginner | Full Body | 3 أيام |
| Intermediate (loss/shape) | Upper/Lower + Cardio | 4 أيام |
| Intermediate (bulk/fitness) | Upper/Lower Split | 4 أيام |
| Advanced (bulk) | PPL | 6 أيام |
| Advanced (أي هدف آخر) | PPL | 5 أيام |

### 8.6 Progressive Overload و Deload (Steps 6-9)

```
الدورة = 14 يوم (Rolling Window)

تحليل الـ 14 يوم:
  completionRate ≥ 80% + avgEnergy ≥ 7 → 'improved'
    → رفع الحمل +5%

  completionRate < 50% أو avgEnergy ≤ 4 أو avgRPE ≥ 9 → 'fatigued'
    → خفض الحمل −10%

  بينهما → 'neutral' → لا تغيير

Deload كل 4-6 أسابيع:
  تخفيض الحمل −10% + حجم −35%
```

### 8.7 فلترة التمارين حسب الإصابات

| منطقة الإصابة | تمارين محظورة |
|---------------|--------------|
| ظهر / قطني / ديسك | Deadlift, Heavy Squat, Good Morning, Russian Twist, Sit-ups |
| ركبة / ACL / منيسكس | Deep Squat, Pistol Squat, Box Jump, Burpees, Plyometrics |
| كتف / Rotator Cuff | Behind-Neck Press, Behind-Neck Pulldown, Heavy OH Press, Upright Row |
| رقبة / عنق | Heavy Shrugs, Behind-Neck Press, Bar-on-Traps Squat |
| رسغ | Heavy BB Bench, Flat Push-ups, Snatch/Clean |
| ورك | Wide-stance Deadlift, Heavy Hip Thrust, Sprint |
| كاحل | Box Jumps, Skipping Rope, Sprinting |
| ضغط دم مرتفع | Inverted positions, Heavy isometrics, Valsalva straining |
| حمل | Supine after T1, Crunch/Plank after 20wks, Olympic lifts, Plyometrics |

### 8.8 فلترة الاختبارات البدنية حسب الموقع

| الاختبار | يتطلب جيم | متاح للبيت |
|---------|----------|----------|
| Bench Press 5RM | ✅ | ❌ |
| Deadlift 1RM | ✅ | ❌ |
| Pull-up Max | ✅ | ❌ |
| Shoulder Press | ✅ | ❌ |
| Push-up (1 min) | ❌ | ✅ |
| Squat (1 min) | ❌ | ✅ |
| Plank Hold | ❌ | ✅ |
| Sit & Reach | ❌ | ✅ |
| Single-Leg Stand | ❌ | ✅ |
| Resting HR | ❌ | ✅ |
| High Knees (1 min) | ❌ | ✅ |
| 1 km Run | ❌ | ✅ |
| Crunches (60s) | ❌ | ✅ |

---

## 9. EMS RULES

### 9.1 نطاقات التردد

| النطاق | Hz | عرض النبضة (µs) | RPE الموصى | الهدف |
|--------|----|----|----|----|
| Recovery | 1-20 Hz | 200-400 µs | 3-5 | استشفاء / تحفيز ليمفاوي |
| Endurance | 20-50 Hz | 150-300 µs | 5-7 | تحمل عضلي / حرق دهون |
| Strength | 50-100 Hz | 100-200 µs | 7-9 | قوة وتضخيم |

### 9.2 قواعد الأمان الصارمة

```
❌ RPE 10 محظور تماماً (الحد الأقصى المطلق = RPE 9)
❌ أقل من 48 ساعة استشفاء بين جلستين → BLOCKER
❌ أكثر من 2 جلسة/أسبوع → BLOCKER
⚠️ RPE 9 → WARNING (تأكد من النوم والتغذية)
⚠️ الجلسة الثانية في الأسبوع → WARNING (لا تتجاوزها)
```

### 9.3 قائمة التحقق قبل كل جلسة EMS

1. 500-750 مل ماء قبل 2 ساعة
2. وجبة خفيفة قبل 60-90 دقيقة
3. نوم ≥ 6 ساعات الليلة السابقة
4. لا ألم حاد أو إصابة جديدة
5. لا كحول أو منشطات قلب منذ 24 ساعة
6. مر 48 ساعة على الأقل من آخر جلسة EMS

### 9.4 Layer الخصوصية (للعميل)

يُعرض للعميل فقط: **خفيفة / متوسطة / عالية** (بدون Hz أو µs)
— لمنع محاولة ضبط الجهاز يدوياً.

### 9.5 البرمجة في الخطة الأسبوعية

```
- 1-2 جلسة EMS/أسبوع كحد أقصى
- المسافة بين الجلستين: 72 ساعة على الأقل
- "sets" = دورات التحفيز (مثل: "4×4 cycle")
- "reps" = مدة الجلسة الكلية (مثل: "20 دقيقة")
- pulseIntensity مطلوب لكل تمرين EMS
```

---

## 10. USER JOURNEY

### 10.1 رحلة العميل خطوة بخطوة

```
1. الأدمن ينشئ حساب العميل (email + password) عبر لوحته
        ↓
2. العميل يفتح التطبيق ويسجّل الدخول
        ↓
3. [Onboarding — 6 خطوات]:
   a. بيانات شخصية: اسم، عمر، جنس، طول، وزن
   b. الهدف (إنقاص/تضخيم/رياضة/تأهيل)
   c. صورة InBody (اختياري) → OCR Gemini
   d. تاريخ إصابات وموانع
   e. موقع التمرين + المعدات
   f. مدة الجلسة + الأيام المتاحة
        ↓ (حفظ في users/{uid}.onboardingData)
4. [SurveyManager — استبيان حسب الباقات]:
   a. Welcome Card
   b. استبيان التغذية (إن كان له nutrition package)
   c. استبيان التمرين (إن كان له workout/ems package)
   d. استبيان التأهيل (إن كان له rehab package)
   e. استبيان EMS (إن كان له ems package)
        ↓ (حفظ في questionnaires/{uid})
5. [ClientDashboard — 9 تبويبات]:
   - يرى خطته الأسبوعية (إن ولّدها الأدمن)
   - يسجل تقدمه يومياً
   - يتواصل مع الكوتش
   - يُجري الاختبارات البدنية
        ↓
6. [الأدمن يولّد خطة AI]:
   - يضغط "توليد خطة" في لوحة الأدمن
   - aiMasterEngine يجمع كل البيانات
   - Gemini يبني الخطة الأسبوعية
   - تُحفظ في users/{uid}.plans.weeklyPlan
   - العميل يراها فوراً في Today/Weekly tabs
        ↓
7. [دورة 14 يوم]:
   - العميل يكمّل تمارينه ويسجّل الطاقة/الألم
   - المحرك العلمي يحلل الـ 14 يوم
   - يعدّل الحمل تلقائياً (+5% أو -10%)
   - الأدمن يجدّد الخطة كل 2-4 أسابيع
```

---

## 11. SECURITY & VALIDATION

### 11.1 Firebase Security Rules (المتوقعة)

```
users/{uid}: read/write if auth.uid == uid OR isAdmin()
questionnaires/{uid}: read/write if auth.uid == uid OR isAdmin()
memberships/*: read if authenticated; write if isAdmin()
emsSessions/*: write if isAdmin(); read if isAdmin() OR ownerClient()
messages/{uid}/*: read/write if auth.uid == uid OR isAdmin()
```

### 11.2 Server-side Validation (server.ts)

```typescript
// كل طلب /api/admin/* يتحقق من Firebase ID Token
const decodedToken = await adminAuth.verifyIdToken(token);
// ثم يتحقق من role == 'admin' في Firestore
```

### 11.3 EMS Safety Validation (emsProtocol.ts)

```
validateEMSSession(rpe, hz, hoursSinceLast, sessionsThisWeek)
  → BLOCKERS: RPE ≥ 10 | Hz خارج 1-100 | < 48h | > 2/week
  → WARNINGS: RPE = 9 | الجلسة الثانية في الأسبوع
```

### 11.4 الـ Anti-Hallucination Rails (AI Safety)

```
- NEVER prescribe equipment the client did NOT list
- NEVER include a disliked food/move
- NEVER exceed prescribed exercise count per session
- NEVER override Scientific Engine intensity %
- NEVER schedule EMS > 2x/week or < 72h apart
```

### 11.5 Gemini Key Failover

```
Primary key quota exceeded → automatic rotation → Backup key
Model: 2.5-flash → 2.0-flash → flash-lite (fallback chain)
```

---

## 12. MISSING DOCUMENTATION / GAPS

### 12.1 ميزات موجودة وغير موثّقة بالكامل

| الميزة | الملف | حالتها |
|--------|-------|--------|
| SmartwatchPanel | `smartwatch.ts` | موجود لكن Integration حقيقية غير مكتملة |
| Karvonen Heart Rate | `scientificEngine.ts` | مُحسب لكن غير ظاهر للعميل في الـ UI |
| PeriodTracker | `PeriodTracker.tsx` | موجود وكامل لكن غير موثّق |
| AdminDigest | `AdminDigest.tsx` | يُنتج ملخص AI للأدمن - غير موثّق |
| Progression Steps 6-9 | `scientificEngine.ts` | مُطبَّق لكن لا يوجد UI واضح يعرضه للعميل |
| Carb Cycling Logic | `aiBlocks.ts` | hard-rail موجود لكن لا يوجد UI منفصل |
| Sound System | `sounds.ts` | أصوات للـ bell/refresh/messages (غير موثّقة) |
| i18n System | `i18n.tsx` | عربي/إنجليزي - تبديل من الـ header |

### 12.2 نقاط تحتاج تطوير

1. **Firebase Security Rules:** لم تُكتب ولا تُوجد في الكود — مطلوبة للإنتاج
2. **Assessment → Plan Feedback Loop:** نتائج الاختبارات تصل للبرنامج عبر `benchmarksSummary` لكن نقاط الضعف التفصيلية (الدرجات الفعلية) لا تُرسل بالكامل
3. **EMS Pre-session Checklist UI:** القائمة موجودة في الكود لكن تطبيقها في الـ UI يحتاج تحقق
4. **Smartwatch Real Integration:** الـ API موجود لكن بدون وصلة حقيقية لبيانات ساعة فعلية
5. **Admin Reports Export:** لا يوجد تصدير PDF أو Excel للتقارير

---

## 13. FILE-FUNCTION TABLE

| الملف | الوظيفة | الحجم |
|-------|---------|-------|
| `server.ts` | Express API + Firebase Admin + Gemini Proxy + Vite | 828 ل |
| `src/App.tsx` | Router رئيسي + Auth gate | صغير |
| `src/firebase.ts` | Firebase client config | صغير |
| `src/types.ts` | جميع TypeScript interfaces | 548 ل |
| `src/services/aiMasterEngine.ts` | محرك AI المركزي (كل توليد خطط) | 1725 ل |
| `src/lib/scientificEngine.ts` | المحرك العلمي الحتمي (Steps 0-9) | 1659 ل |
| `src/lib/macroCalculator.ts` | BMR/TDEE/Macros (Mifflin-St Jeor) | 210 ل |
| `src/lib/emsProtocol.ts` | قواعد EMS الأمنية | 171 ل |
| `src/lib/aiBlocks.ts` | Hard-rail blocks للـ Gemini Prompts | 135 ل |
| `src/lib/gamification.ts` | XP/Coins/Ranks | 53 ل |
| `src/lib/badges.ts` | منطق 12 شارة | متوسط |
| `src/lib/activityLog.ts` | سجل الأنشطة | صغير |
| `src/lib/firebaseUtils.ts` | Firebase helper functions | صغير |
| `src/lib/imageUtils.ts` | معالجة + ضغط الصور | صغير |
| `src/lib/sounds.ts` | أصوات التطبيق (bell/notify) | صغير |
| `src/lib/i18n.tsx` | الترجمة عربي/إنجليزي | متوسط |
| `src/lib/theme.tsx` | Dark/Light mode | صغير |
| `src/components/AdminDashboard.tsx` | لوحة الأدمن الكاملة | 4738 ل |
| `src/components/ClientDashboard.tsx` | لوحة العميل الكاملة | 3330 ل |
| `src/components/SurveyManager.tsx` | معالج الاستبيانات | كبير |
| `src/components/Onboarding.tsx` | تسجيل أولي + InBody OCR | كبير |
| `src/components/Chat.tsx` | محادثة نصية + صوتية | متوسط |
| `src/components/FalconEye.tsx` | تقرير AI شامل | متوسط |
| `src/components/FinancialDashboard.tsx` | لوحة مالية | كبير |
| `src/components/ScientificEngineCard.tsx` | عرض نتائج المحرك | متوسط |
| `src/components/surveys/NutritionSurvey.tsx` | استبيان تغذية تفصيلي | كبير |
| `src/components/surveys/WorkoutSurvey.tsx` | استبيان تمرين تفصيلي | كبير |
| `src/components/surveys/RehabSurvey.tsx` | استبيان تأهيل + إصابات | متوسط |
| `src/components/surveys/EMSSurvey.tsx` | استبيان EMS | متوسط |

---

## 14. DATA FLOW DIAGRAM (نصي)

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                            │
│                                                                  │
│  Onboarding ─→ SurveyManager ─→ ClientDashboard                 │
│      │              │                │                           │
│      ↓              ↓                ↓                           │
│  [InBody Photo]  [4 Surveys]   [Daily Progress]                 │
└──────┬──────────────┬───────────────┬─────────────────────────────┘
       │              │               │
       ↓              ↓               ↓
┌──────────────────────────────────────────────────────────────────┐
│                      FIREBASE FIRESTORE                          │
│                                                                  │
│  users/{uid}          questionnaires/{uid}    clientMemberships  │
│  ├─ onboardingData    ├─ nutrition             ├─ packageType    │
│  ├─ plans.weeklyPlan  ├─ workout               ├─ sessions       │
│  ├─ assessmentHistory ├─ rehab                 └─ installments   │
│  ├─ measurementHistory└─ ems                                     │
│  └─ dailyProgress                                                │
│                                                                  │
│  messages/{uid}/msgs   feed/{postId}    emsSessions/{id}         │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ↓
┌──────────────────────────────────────────────────────────────────┐
│                     EXPRESS SERVER (server.ts)                   │
│                                                                  │
│  /api/admin/*  ←── Firebase Admin SDK Verification              │
│  /api/ai-service ←── Gemini API Proxy (key failover)            │
│  /api/transcribe ←── Gemini Audio → Text                        │
│  /api/upload    ←── Firebase Storage Upload                     │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ↓
┌──────────────────────────────────────────────────────────────────┐
│                   AI MASTER ENGINE                               │
│                                                                  │
│  MacroCalculator (Pure Math) ──→ BMR/TDEE/Macros (ثابت)        │
│  ScientificEngine (Pure Math) ─→ RPE/1RM/Split/WeakAreas (ثابت)│
│       ↓                                                          │
│  [Hard Rails Block = Scientific + Progression + Client Profile]  │
│       ↓                                                          │
│  Gemini 2.5-Flash ──→ 7-Day JSON Plan                           │
│       ↓                                                          │
│  Normalize → Validate → Save to users/{uid}.plans.weeklyPlan    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 15. DATABASE SCHEMA DIAGRAM (نصي)

```
users (Collection)
├── {uid} (Document)
│   ├── uid: string
│   ├── role: 'admin' | 'client'
│   ├── onboardingData: { age, height, weight, gender, goal, ... }
│   ├── plans: { weeklyPlan: {Sat..Fri: {nutrition[], workout[]}}, draft }
│   ├── assessmentHistory: [{testId, value, score, date}]
│   ├── measurementHistory: [{date, weight, fatPct, ...}]
│   ├── dailyProgress: {YYYY-MM-DD: {water, energy, mood, ...}}
│   └── coins: number

questionnaires (Collection)
└── {uid} (Document)
    ├── nutrition: { lifestyle, preferences, medical, measurements }
    ├── workout: { environment, experience, health, goals }
    ├── rehab: { injuryDescription, painPoints, painLevel }
    └── ems: { experience, conditions, goals }

clientMemberships (Collection)
└── {id} (Document)
    ├── clientId: string  ──→ refs users/{uid}
    ├── packageType: string
    ├── sessions: {total, remaining}
    └── installments: [{amount, dueDate, status}]

memberships (Collection = Packages Registry)
└── {id}: {name, type, price, sessions, durationDays}

emsSessions (Collection)
└── {id}: {clientId, membershipId, date, duration, intensity}

messages (Collection)
└── {uid} (Document)
    └── msgs (Subcollection)
        └── {msgId}: {text, sender, timestamp, read, audioUrl?}

feed (Collection)
└── {postId}: {authorId, content, imageUrl, timestamp, likes[], comments[]}
```

---

*آخر تحديث: يوليو 2026 — تم إنشاؤه بواسطة فحص كامل للكود المصدري*
