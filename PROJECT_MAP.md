# PROJECT_MAP.md

# خريطة كاملة للمشروع CoachPro

## 1. نظرة عامة على المشروع

CoachPro هو نظام إدارة تدريب رياضي ذكي يعمل كـ Progressive Web App (PWA) مع دعم Android عبر Capacitor. المشروع يجمع بين:

- واجهة العميل
- واجهة المدرب/الأدمن
- طبقة ذكاء اصطناعي
- Firebase Auth + Firestore + Storage
- خادم Express للـ API والرفع الصوتي والملفات

الهدف الأساسي هو إدارة العميل من أول تسجيل إلى توليد خطة تدريبية تغذوية وتأهيلية متكاملة.

---

## 2. جميع صفحات التطبيق

### الصفحات الرئيسية (Routes)

البرنامج يعتمد على التوجيه عبر hash URL:

- /login
  - شاشة تسجيل الدخول
- /onboarding
  - شاشة التسجيل الأولي للعميل
- /dashboard
  - لوحة العميل الرئيسية
- /admin
  - لوحة إدارة المدرب/الأدمن

### الصفحات/الأقسام داخل لوحة العميل

داخل لوحة العميل توجد تبويبات رئيسية:

- Today
- Weekly
- Analysis
- Chat
- Assessment
- Falcon
- Feed
- Profile

### الصفحات/الأقسام داخل لوحة الأدمن

داخل لوحة الأدمن توجد أقسام مثل:

- Overview
- Clients
- Activity
- EMS Attendance
- Finance
- Memberships

---

## 3. جميع Components

### 3.1 Components رئيسية

| Component | الوظيفة |
|---|---|
| App.tsx | نقطة الدخول الرئيسية، تحديد المسار حسب Auth و Firestore profile |
| Login.tsx | تسجيل الدخول بالبريد/كلمة المرور أو Google |
| Onboarding.tsx | تسجيل أولي للعميل وتجميع البيانات الأساسية والصحية |
| SurveyManager.tsx | إدارة الاستبيانات التفصيلية للعميل |
| ClientDashboard.tsx | اللوحة الأساسية للعميل |
| DashboardShell.tsx | الهيكل العام للوحة العميل |
| AdminDashboard.tsx | لوحة إدارة المدرب/الأدمن |
| Chat.tsx | دردشة نصية/صوتية مع المدرب |
| SmartMicInbox.tsx | صندوق الملاحظات الصوتية للمدرب |
| FalconEye.tsx | عرض تحليل ذكي شامل للعميل |
| Profile.tsx | إدارة البيانات الشخصية والملف الشخصي |
| ActivityFeed.tsx | عرض سجل الأنشطة |
| BadgesPanel.tsx | عرض الشارات والإنجازات |
| PointsBadge.tsx | عرض النقاط والرتبة |
| BodyMap.tsx | خريطة الجسم لعرض الإصابات أو الألم |
| CelebrationPopup.tsx | نافذة الاحتفال عند الوصول إلى إنجاز |
| ChampionsFeed.tsx | لوحة المجتمع والمنشورات |
| ComplianceScores.tsx | مؤشرات الالتزام والتقدم |
| EMSAttendance.tsx | متابعة حضور جلسات EMS |
| FinancialDashboard.tsx | شاشات مالية وإدارة الاشتراكات |
| FridgeScanner.tsx | تحليل صور الطعام أو الثلاجة |
| Lightbox.tsx | عارض الصور الكبير |
| MeasurementUpdate.tsx | تحديث القياسات والوزن والملفات |
| MembershipManager.tsx | إدارة الباقات والاشتراكات |
| MoodTrendChart.tsx | رسم بياني لحالة المزاج |
| PeriodTracker.tsx | تتبع الدورة الشهرية |
| ProgressUpdate.tsx | تحديث التقدم والتطور |
| RecoveryWorkoutModal.tsx | نافذة استشفاء أو جلسة استرداد |
| ScientificEngineCard.tsx | عرض نتائج المحرك العلمي |
| SmartwatchPanel.tsx | عرض البيانات الصحية أو ساعة ذكية |
| AdminDigest.tsx | ملخص يومي/أو دوري للأدمن |
| AdminMacroCard.tsx | عرض الماكروهات في لوحة الأدمن |
| AdminProgressionCard.tsx | عرض مسار التقدم |
| AdminRadar.tsx | عرض تحليلي مرئي |
| BrandLogo.tsx | العرض البصري للشعار |
| ErrorBoundary.tsx | اعتراض الأخطاء في الواجهة |
| InstallPrompt.tsx | دعوة تثبيت التطبيق كـ PWA |

### 3.2 Components الاستبيانات

| Component | الوظيفة |
|---|---|
| surveys/NutritionSurvey.tsx | استبيان التغذية |
| surveys/WorkoutSurvey.tsx | استبيان التمرين |
| surveys/RehabSurvey.tsx | استبيان التأهيل والإصابات |
| surveys/EMSSurvey.tsx | استبيان EMS والسلامة |
| surveys/GeneralMedicalForm.tsx | نموذج طبي عام |

### 3.3 Components UI صغيرة

| Component | الوظيفة |
|---|---|
| ui/TimePicker.tsx | اختيار الوقت |
| FeedPostFull.tsx | عرض منشور كامل في Feed |
| SystemDocumentationPDF.tsx | توليد/عرض وثائق النظام |

---

## 4. جميع Services

| Service | الوظيفة |
|---|---|
| server.ts | خادم Express للتشغيل العام، API، رفع الملفات، الترجمة الصوتية، التفاعل مع Gemini |
| services/aiMasterEngine.ts | المحرك المركزي للذكاء الاصطناعي، يجمع البيانات ويولد الخطة والتوصيات |

---

## 5. جميع Engines

### 5.1 Scientific Engine

- الملف: src/lib/scientificEngine.ts
- الوظيفة: تقييم البدن، اختيار الاختبارات، تحليل التقدم، تصنيف المخاطر، حساب درجات التقييم

### 5.2 Nutrition Engine

- يظهر عبر: src/lib/macroCalculator.ts + services/aiMasterEngine.ts + NutritionSurvey.tsx
- الوظيفة: حساب الاحتياج الغذائي، بناء سياق تغذوي، توليد وجبات وتوصيات

### 5.3 EMS Engine

- يظهر عبر: src/lib/emsProtocol.ts + services/aiMasterEngine.ts
- الوظيفة: تطبيق قواعد EMS، إدارة الشدة، حماية العميل من التوصيات الخطرة

### 5.4 Rehab Engine

- يظهر عبر: RehabSurvey.tsx + BodyMap.tsx + scientificEngine.ts + aiMasterEngine.ts
- الوظيفة: إدارة الإصابات/النقاط المؤلمة وبناء خطة تأهيل آمنة

### 5.5 AI Master Engine

- الملف: src/services/aiMasterEngine.ts
- الوظيفة: المحرك الرئيسي للذكاء الاصطناعي لعمل خطة شاملة للعميل

---

## 6. جميع Hooks

| Hook | المكان | الوظيفة |
|---|---|---|
| useLightbox | src/components/Lightbox.tsx | إدارة عارض الصور الكامل مع التكبير والانتقال |
| useI18n | src/lib/i18n.tsx | إدارة اللغة العربية/الإنجليزية |
| useTheme | src/lib/theme.tsx | إدارة السمة الداكنة/الفاتحة |

---

## 7. جميع ملفات Firebase

### 7.1 ملفات العميل

| الملف | الوظيفة |
|---|---|
| src/firebase.ts | تهيئة Firebase Auth + Firestore + Storage في الواجهة |
| firebase-applet-config.json | تكوين Firebase المستخدم من قبل العميل والـ server |

### 7.2 ملفات القواعد ذات الصلة

| الملف | الوظيفة |
|---|---|
| firestore.rules | قواعد أمان Firestore |
| storage.rules | قواعد أمان Storage |

---

## 8. جميع API Endpoints

### 8.1 Health و إدارة المستخدم

| Endpoint | الوظيفة |
|---|---|
| GET /api/health | فحص جاهزية الخادم والاتصال بـ Firebase و Gemini |
| POST /api/admin/bootstrap | إنشاء/تحديث الحساب الأدمن الأساسي |
| POST /api/admin/create-client | إنشاء عميل جديد من قبل الأدمن |
| POST /api/admin/activate-client | تفعيل أو تعطيل العميل |
| POST /api/admin/delete-client | حذف عميل مع تنظيف البيانات والملفات |

### 8.2 Storage و AI

| Endpoint | الوظيفة |
|---|---|
| GET /api/storage-status | فحص جاهزية Firebase Storage |
| POST /api/ai-service | استدعاء Gemini عبر الخادم |
| GET /api/ai-test | اختبار الاتصال بـ Gemini |
| POST /api/transcribe | تحويل الصوت إلى نص مع تلخيص اختياري |
| POST /api/upload | رفع ملف/صورة إلى Firebase Storage أو fallback base64 |

---

## 9. جميع Collections في Firestore

### 9.1 Collections رئيسية

| Collection | الاستخدام |
|---|---|
| users | الملف الشخصي للمستخدمين (admin/client) |
| questionnaires | بيانات الاستبيانات التفصيلية للعميل |
| chats | محادثات المستخدمين |
| feed | منشورات المجتمع |
| notifications | الإشعارات الداخلية |
| memberships | أنواع الباقات |
| clientMemberships | الاشتراكات الخاصة بكل عميل |
| emsSessions | جلسات EMS وحضورها |

### 9.2 Subcollections والبيانات الفرعية

| المكان | الاستخدام |
|---|---|
| users/{uid}/adaptiveAssessments | نتائج الاختبارات التكيفية |
| users/{uid}/voiceNotes | ملاحظات صوتية للعميل |
| users/{uid}/activity | سجل الأنشطة |
| users/{uid}/notifications | إشعارات خاصة بكل مستخدم |
| feed/posts/{id}/comments | التعليقات على المنشورات |
| feed/posts/{id}/likes | الإعجابات على المنشورات |
| coachReplies | ردود المدرب على الملاحظات الصوتية |

---

## 10. جميع أنواع المستخدمين

### 10.1 Admin / Coach

- دور: admin
- الاستخدام: إدارة العملاء، توليد الخطط، إدارة الاشتراكات، مراجعة التقدم، إدارة المحتوى، المال، EMS، والتواصل
- في الواقع: المشروع يضع المدرب في نفس الفئة الأساسية كـ admin

### 10.2 Client

- دور: client
- الاستخدام: التفاعل مع الخطة، إكمال الاستبيانات، تحديث القياسات، التواصل مع المدرب، عرض التقدم

### 10.3 System

- ليس مستخدمًا بشريًا، بل طبقة تشغيلية تعتمد على Firebase Admin SDK و Gemini API

---

## 11. كيف تنتقل البيانات بين كل جزء والآخر

### 11.1 من Login إلى Profile

```text
Login.tsx -> Firebase Auth -> App.tsx -> Firestore users/{uid} -> resolve role
```

### 11.2 من Onboarding إلى User Profile

```text
Onboarding.tsx -> collect data -> update users/{uid}.onboardingData -> set onboardingComplete
```

### 11.3 من Survey إلى AI Context

```text
SurveyManager.tsx -> questionnaires/{uid} -> aiMasterEngine -> build plan context
```

### 11.4 من Client Dashboard إلى Firestore

```text
ClientDashboard.tsx -> updates profile / dailyProgress / measurementHistory -> Firestore
```

### 11.5 من Admin Dashboard إلى Client

```text
AdminDashboard.tsx -> plan generation / activation / notifications -> Firestore -> ClientDashboard
```

### 11.6 من AI إلى خطة تدريبية

```text
User data + surveys + scientific context -> aiMasterEngine -> Gemini -> JSON -> Firestore weeklyPlan
```

### 11.7 من Storage إلى UI

```text
Upload / camera / voice -> server.ts / Firebase Storage -> public URL -> UI component -> render image/audio
```

---

## 12. خريطة رحلة البيانات من تسجيل العميل حتى إنشاء البرنامج التدريبي

```text
[1] تسجيل العميل
    ↓
[2] Login.tsx + Firebase Auth
    ↓
[3] إنشاء ملف المستخدم في Firestore
    └─ users/{uid}

[4] Onboarding.tsx
    ├─ بيانات شخصية
    ├─ بيانات صحية
    ├─ أهداف
    ├─ صور / InBody / صوت
    └─ تحديث onboardingComplete

[5] SurveyManager.tsx
    ├─ NutritionSurvey
    ├─ WorkoutSurvey
    ├─ RehabSurvey
    └─ EMSSurvey
    ↓
[6] حفظ البيانات في questionnaires/{uid}
    ↓
[7] بناء سياق العميل
    ├─ onboardingData
    ├─ questionnaire data
    ├─ measurementHistory
    ├─ assessmentHistory
    └─ packages / role / goals

[8] AI Master Engine
    ├─ Scientific Engine
    ├─ Macro Calculator
    ├─ EMS rules
    ├─ Rehab rules
    └─ AI prompt assembly
    ↓
[9] Gemini API
    ↓
[10] استجابة منطقية من Gemini
    ├─ workout plan
    ├─ nutrition plan
    ├─ rehab guidance
    └─ EMS recommendations

[11] حفظ البرنامج في Firestore
    └─ users/{uid}.plans.weeklyPlan

[12] عرض البرنامج للعميل والمدرب
    ├─ ClientDashboard.tsx
    └─ AdminDashboard.tsx
```

---

## 13. الخلاصة المختصرة

المشروع مبني على نموذج واضح:

- UI Components تتعامل مع المستخدم
- Logic Libraries تحتوي المنطق العلمي والاقتصادي واللياقة
- Services تتعامل مع الذكاء الاصطناعي والـ API
- Firebase يخزن البيانات والملفات
- Firestore هو مصدر الحقيقة الأساسية للتقدم والبرامج والخطط

وهذا يجعل المشروع مناسبًا لإدارة العميل من البداية حتى إنشاء الخطة التدريبية الذكية.
