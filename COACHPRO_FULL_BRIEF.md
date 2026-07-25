# كوتش برو (CoachPro) — الدليل الشامل للتطبيق

**نظام إدارة التدريب الرياضي الذكي | Arabic-first RTL PWA**

---

## 1. الهوية والتقنيات

| العنصر | التفاصيل |
|--------|---------|
| الاسم | كوتش برو / CoachPro |
| الوصف | تطبيق ويب تقدمي (PWA) لإدارة الكوتش والعملاء، عربي بالكامل، RTL، تصميم داكن |
| اللغة الأساسية | العربية (دعم الإنجليزية جزئياً) |
| الـ Stack | React 19 + Vite 7 + Tailwind CSS v4 + Express (tsx) |
| الذكاء الاصطناعي | Google Gemini 2.5 Flash عبر `/api/ai-service` (server-side فقط) |
| قاعدة البيانات | Firebase Firestore (named DB: `ai-studio-dd4e7562-111f-4f38-9530-c7cda2527a71`) |
| المصادقة | Firebase Auth (Email + Google OAuth) |
| التخزين | Firebase Storage (اختياري) + fallback inline base64 في Firestore للصور الصغيرة |
| Port | 5000 |
| الخط | Cairo (Google Fonts) |
| Package manager | pnpm |

---

## 2. بنية البيانات في Firestore

### Collections الرئيسية

| Collection | الوصف |
|-----------|-------|
| `users/{uid}` | بروفايل كل مستخدم (admin + clients) |
| `questionnaires/{uid}` | استبيانات العميل (nutrition/workout/rehab/ems) |
| `chats/{chatId}/messages` | رسائل المحادثة |
| `feed` | منشورات مجتمع الأبطال |
| `notifications/{uid}` | إشعارات لكل مستخدم |
| `memberships` | أنواع العضويات |
| `clientMemberships` | عضوية كل عميل |
| `emsSessions` | جلسات EMS (حضور) |

### حقول `users/{uid}` الرئيسية

```
uid, email, name, phone, role (admin|client), gender
profilePicUrl, bio
packages: { workout, nutrition, rehab, ems }
onboardingComplete, questionnaireComplete, isActivated
onboardingData: { height, weight, birthDate, goal, painPoints, inBodyExtracted, manualInBody, inBodyPhoto, images[], voiceTranscript, hasAgreedToWaiver, ... }
inBodyData: { weight, fatPercentage, muscleMass, waterPercentage, protein } ← top-level للاستخدام السريع
measurementHistory: [{ date, weight, fatPercentage, muscleMass, waterPercentage, protein, photos:{front,side,inBody} }]
nutritionSurveyData: NutritionSurveyData
plans: { workout, nutrition, rehab, ems, weeklyPlan, weeklyPlanDraft, weeklyPlanPublishedAt, pdfUrl }
dailyProgress: { [date]: { mealsCompleted[], exercisesCompleted[], moodScore, energyLevel, waterLiters } }
dailyLogs: { [date]: { waterLiters, completedWorkout, notes, watch:{steps,sleepHours,hr,...} } }
brainSummary: { text, generatedAt }
coins, expiryDate, experienceLevel
cycleLog: { lastPeriodStart, cycleLength } ← الإناث فقط
assessmentHistory, voiceTranscript, lastMeasurementSubmittedAt
```

---

## 3. شاشات التطبيق (Routes)

التوجيه يعتمد hash-based: `#/login` | `#/onboarding` | `#/dashboard` | `#/admin`

---

## 4. شاشة تسجيل الدخول `#/login` — `Login.tsx`

- حقل البريد الإلكتروني + كلمة المرور
- زر "تسجيل الدخول بجوجل" (Google OAuth)
- Firebase Auth يقوم بالمصادقة
- بعد الدخول، `App.tsx` يقرر المسار:
  - `admin` ← إذا role == 'admin'
  - `onboarding` ← إذا `onboardingComplete == false`
  - `dashboard` ← إذا `onboardingComplete == true`

---

## 5. الـ Onboarding (التسجيل الأول) `#/onboarding` — `Onboarding.tsx`

### الوصف
معالج تسجيل متعدد الخطوات (5 خطوات) يجمع كل بيانات العميل عند أول دخول.

### الخطوات الخمس

**الخطوة 1 — البيانات الشخصية:**
- الاسم + الجنس + تاريخ الميلاد + الطول + الوزن
- رقم الهاتف (with validation 9-15 digits)
- الصورة الشخصية (avatar): ضغط 600px/0.8 → رفع عبر `/api/upload`
- تسجيل صوتي (MediaRecorder → `/api/transcribe`) يحفظ transcript

**الخطوة 2 — الحالة الصحية:**
- هل يعاني من ضغط دم / سكري / عمليات جراحية؟
- نقاط الألم وإصابات سابقة (Body Map)

**الخطوة 3 — الأهداف والنشاط:**
- هدف التدريب (بناء عضلي / خسارة دهون / قوة / لياقة / مرونة)
- مستوى الخبرة (مبتدئ / متوسط / متقدم)
- بيئة التدريب المفضلة

**الخطوة 4 — جدول الأوقات:**
- وقت الاستيقاظ / العمل / التمرين / النوم

**الخطوة 5 — الصور والـ InBody:**
- رفع صور التقدم (body photos): ضغط 900px/0.75 → `/api/upload` (fallback 650px/0.65)
- رفع صورة InBody: ضغط 1600px/0.88 → OCR تلقائي بـ Gemini → يملأ الحقول
- حقول InBody يدوية (fallback لو OCR فشل): وزن / دهون / عضلات / ماء / بروتين
- الإقرار الرقمي (digital waiver checkbox مطلوب)

### OCR InBody في Onboarding
1. الضغط فوراً بعد اختيار الصورة (مستقل عن الرفع)
2. يُرسل الصورة لـ Gemini 2.5 Flash كـ inlineData
3. يستخرج JSON: weight, fatPercentage, muscleMass, waterPercentage, protein
4. يملأ `manualInBody` و`inBodyExtracted` تلقائياً
5. الرفع يحاول 1600px/0.88 ثم 850px/0.70 كـ fallback

### الحفظ النهائي
```
updateDoc(users/{uid}, {
  onboardingData: { ...كل البيانات, submittedAt },
  onboardingComplete: true,
  phone, profilePicUrl
})
```

---

## 6. استبيانات العميل (Surveys) — `SurveyManager.tsx`

بعد تفعيل الحساب، يظهر للعميل معالج الاستبيانات.

### الاستبيانات المتاحة (حسب الباقة)
- **التغذية** (`nutrition`): `NutritionSurvey.tsx`
- **التمارين** (`workout`): `WorkoutSurvey.tsx`
- **التأهيل** (`rehab`): `RehabSurvey.tsx`
- **EMS** (`ems`): `EMSSurvey.tsx`

### استبيان التغذية `NutritionSurvey.tsx`
**القسم 1 — المعلومات الأساسية والطبية:**
- التقييم الطبي العام (ضغط / سكري / عمليات)
- الصور الشخصية: أمامية + جانبية + InBody
  - OCR تلقائي للـ InBody بـ Gemini 2.5 Flash
  - رفع عبر `/api/upload` (fallback 650px/0.65)
- القياسات الحيوية: صدر / خصر / ذراع / فخذ / وزن / دهون / عضلات / ماء / بروتين

**القسم 2 — النمط الغذائي:**
- عدد الوجبات / الانتظام / رغبة السكر / أوقات الجوع
- مشاكل الهضم

**القسم 3 — أسلوب الحياة:**
- ساعات النوم / وقت الاستيقاظ / ساعات العمل / طبيعة الوظيفة
- مستوى النشاط اليومي / تكرار التمرين أسبوعياً
- تاريخ عائلي للسمنة / أرق

**القسم 4 — التفضيلات والمكملات:**
- أكل يحبه / يكرهه / حساسية غذائية
- ليترات الماء / المكملات الحالية

**القسم 5 — الجدول اليومي:**
- جدول الوجبات والأنشطة (يمكن إضافة/حذف)

**القسم 6 — ملاحظات إضافية:**
- textarea مفتوح + زر ميكروفون (تسجيل صوتي → نص عربي)

**ربط بيانات InBody من Onboarding:**
`SurveyManager` يسبق بيانات InBody من `onboardingData` تلقائياً إذا لم يكن هناك بيانات محفوظة.

### استبيان التمارين `WorkoutSurvey.tsx`
- مستوى الخبرة الحالي
- بيئة التدريب (جيم / منزل / هجين)
- الأيام المتاحة للجيم / المنزل
- المعدات المتاحة في المنزل
- الوقت المفضل للتمرين
- اختبارات اللياقة المبدئية
- حالة التعافي (readiness sliders: تعب / نوم / ألم / إجهاد)
- الأهداف التدريبية (متعددة الاختيار)

### استبيان التأهيل `RehabSurvey.tsx`
- نقاط الألم المحددة (مسبقاً من Onboarding)
- تفاصيل الإصابة وتاريخها
- رفع وثائق طبية

### استبيان EMS `EMSSurvey.tsx`
- إقرار السلامة
- الحالة الصحية للأجهزة الكهربائية
- تفاصيل الجلسة

### الحفظ والإرسال
كل خطوة → `setDoc(questionnaires/{uid}, updatedData)`
النهاية → `updateDoc(users/{uid}, { questionnaireComplete: true, measurementHistory: [...], nutritionSurveyData: ..., inBodyData: ... })`

---

## 7. لوحة تحكم العميل `#/dashboard` — `ClientDashboard.tsx`

### Shell التنقل — `DashboardShell.tsx`
- الشريط الجانبي (desktop) + تبار سفلية 5 (mobile)
- Drawer "المزيد" للتبويبات الإضافية

### التبويبات

**اليوم (`today`):**
- خطة اليوم: وجبات + تمارين
- الانجازات: تسجيل إتمام الوجبات والتمارين
- تسجيل الماء / المزاج / الطاقة
- زر "حدّث قياساتك في أي وقت" → `MeasurementUpdate`
- "تحديث التقدم الشهري" → `ProgressUpdate`
- تحليل المزاج النفسي بالـ AI
- تحليل صورة الوجبة (Meal Scanner) بالـ AI
- بدائل الوجبات الذكية
- مولد قائمة التسوق
- نصيحة الفعاليات الاجتماعية

**الأسبوعي (`weekly`):**
- الخطة الأسبوعية الكاملة (كل يوم: تمارين + وجبات)
- استبدال تمرين بالـ AI (`swapExercise`)
- تحميل الخطة

**التحليل (`analysis`):**
- رسم بياني للوزن والمزاج (`MoodTrendChart`)
- نقاط التوافق (`ComplianceScores`)
- توقع التقدم بالـ AI (`predictProgress`)
- الشارات والنقاط (`BadgesPanel`, `PointsBadge`)

**الدردشة (`chat`):**
- `Chat.tsx` مع الكوتش
- الذكاء الاصطناعي يرد تلقائياً إذا لم يرد الكوتش
- رسائل صوتية + نصية

**التقييم (`assessment`):**
- الاختبارات البدنية التكيفية (Scientific Engine)
- حساب 1RM
- تاريخ الاختبارات

**فالكون آي (`falcon`):**
- `FalconEye.tsx` — تحليل شامل للعميل بالـ AI

**المجتمع (`feed`):**
- `ChampionsFeed.tsx` — نشر إنجازات + صور + فيديو
- الإعجاب والتعليقات

**البروفايل (`profile`):**
- `Profile.tsx` — تعديل البيانات الشخصية + الصورة
- تتبع الدورة الشهرية (إناث) — `PeriodTracker.tsx`
- لوحة الساعة الذكية — `SmartwatchPanel.tsx`
- الماسح الضوئي للثلاجة — `FridgeScanner.tsx`

---

## 8. لوحة تحكم الأدمن `#/admin` — `AdminDashboard.tsx`

### التبويبات الرئيسية
- **نظرة عامة** (`overview`): إحصائيات سريعة
- **العملاء** (`clients`): قائمة العملاء + إدارة
- **النشاط** (`activity`): `ActivityFeed.tsx`
- **حضور EMS** (`ems`): `EMSAttendance.tsx`
- **المالية** (`finance`): `FinancialDashboard.tsx`
- **العضويات** (`memberships`): `MembershipManager.tsx`

### إدارة العملاء
- إضافة عميل جديد → `POST /api/admin/create-client`
- تفعيل/إلغاء تفعيل الحساب → `updateDoc(users/{uid}, { isActivated })`
- حذف عميل → `POST /api/admin/delete-client`
- تعيين الباقات (nutrition/workout/rehab/ems)
- تعيين تاريخ انتهاء العضوية
- عرض بروفايل العميل الكامل

### توليد البرامج بالـ AI
**لكل عميل:**
1. **خطة التغذية** → `aiMasterEngine.generateNutritionDraft(client, questionnaire)`
   - يستخدم: الوزن / الدهون / العضلات / الماء / البروتين / العادات الغذائية / الجدول / أسلوب الحياة / الأهداف
2. **خطة التمارين** → `aiMasterEngine.generateWorkoutDraft(client, questionnaire, false, difficulty, energy)`
   - يستخدم: بيئة التدريب / المستوى / الأهداف / حالة التعافي / الإصابات / بيانات الـ InBody
3. **برنامج EMS** → `generateWorkoutDraft(..., true, ...)`
4. **برنامج التأهيل** → `aiMasterEngine.generateRehabDraft(client, questionnaire)`

**بعد التوليد:**
- معاينة Draft للأدمن
- نشر → `updateDoc(users/{uid}, { plans.weeklyPlanDraft })`
- "نشر للعميل" → ينقل Draft إلى weeklyPlan

### تحليلات الأدمن
- **Brain Summary** (Gemini): ملخص شامل للعميل من الصوت + InBody + طبي
- **Vision InBody Analysis** (Gemini Vision): تحليل صورة InBody بالنص
- **AdminRadar** (`AdminRadar.tsx`): رسم راداري لأداء العميل
- **AdminMacroCard** (`AdminMacroCard.tsx`): عرض الماكرو المحسوب
- **AdminProgressionCard** (`AdminProgressionCard.tsx`): تقدم القياسات
- **SmartMicInbox** (`SmartMicInbox.tsx`): رسائل صوتية للأدمن
- **AdminDigest** (`AdminDigest.tsx`): ملخص يومي بالـ AI

### التواصل
- محادثة مباشرة مع العميل (`Chat.tsx`)
- إشعارات مخصصة → `addDoc(users/{targetUid}/notifications, ...)`

---

## 9. مزايا الذكاء الاصطناعي (AI Features)

### `aiMasterEngine.ts` — المحرك المركزي

| الوظيفة | الوصف |
|---------|-------|
| `generateNutritionDraft` | توليد خطة تغذية كاملة |
| `generateWorkoutDraft` | توليد خطة تمارين (جيم / منزل / EMS) |
| `generateRehabDraft` | توليد برنامج تأهيل |
| `getPsychologicalAdjustment` | تحليل المزاج والطاقة |
| `generateBudgetSubstitutes` | بدائل الوجبات الاقتصادية |
| `predictProgress` | توقع التقدم |
| `getSocialEventAdvice` | نصيحة الفعاليات الاجتماعية |
| `analyzeMealImage` | تحليل صورة الوجبة |
| `generateSmartSubstitutes` | بدائل تمارين ذكية |
| `generateGroceryList` | قائمة تسوق أسبوعية |
| `getQuickReply` | ردود سريعة في الدردشة |
| `swapExercise` | استبدال تمرين |
| `calculate1RM` | حساب أقصى وزن |

### المحركات الداعمة
- `scientificEngine.ts` — محرك العلوم الرياضية (اختبارات تكيفية، readiness scoring)
- `macroCalculator.ts` — حساب الماكرو بناءً على القياسات
- `aiBlocks.ts` — قوالب prompt بـ anti-hallucination rails

---

## 10. API Endpoints (server.ts)

| Endpoint | الوصف |
|---------|-------|
| `POST /api/ai-service` | بروكسي Gemini (model fallback تلقائي) |
| `POST /api/transcribe` | تحويل الصوت إلى نص (Gemini multimodal) |
| `POST /api/upload` | رفع صور (Storage أو base64 fallback) |
| `GET /api/storage-status` | حالة Firebase Storage |
| `POST /api/admin/create-client` | إنشاء عميل جديد |
| `POST /api/admin/delete-client` | حذف عميل |
| `POST /api/admin/bootstrap` | إنشاء أكاونت الأدمن |
| `GET /api/health` | فحص صحة السيرفر |

### نموذج Gemini المستخدم (server-side auto-fallback)
الترتيب: `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.0-flash-001` → `gemini-2.0-flash-lite` → ...

---

## 11. رفع الصور — تدفق العمل

### السيناريو الطبيعي (Firebase Storage مفعّل)
```
Client → compressImage() → FileReader (base64) → POST /api/upload
→ server: Firebase Storage → returns storage URL
→ stored in Firestore as URL string (صغير)
```

### Fallback (Firebase Storage غير مفعّل — Spark plan)
```
Client → compressImage() → FileReader (base64) → POST /api/upload
→ server: Storage fails → if allowBase64Fallback && size < 400KB → returns base64 data URL
→ stored in Firestore as data URL
If size > 400KB → second attempt with smaller compression
If both fail → use local blob URL (temporary, not persisted)
```

### ضغط الصور حسب النوع
| نوع الصورة | الضغط الأول | الضغط الثاني |
|----------|------------|-------------|
| Avatar | 600px / 0.80 | — |
| InBody (OCR) | 1600px / 0.88 | 850px / 0.70 |
| صور التقدم | 900px / 0.75 | 650px / 0.65 |
| صور الجسم (Survey) | 900px / 0.75 | 650px / 0.65 |

---

## 12. تدفق بيانات العميل الكامل

```
1. التسجيل (Onboarding)
   ↓
   users/{uid}.onboardingData = { height, weight, InBody, photos, voiceTranscript }
   users/{uid}.onboardingComplete = true
   ↓
2. الأدمن يُفعّل الحساب + يعيّن الباقات
   ↓
   users/{uid}.isActivated = true
   users/{uid}.packages = { nutrition, workout, ... }
   ↓
3. الاستبيانات (Surveys)
   ↓
   questionnaires/{uid} = { nutrition, workout, rehab, ems }
   users/{uid}.measurementHistory = [initialMeasurement]
   users/{uid}.inBodyData = { extracted InBody values }
   users/{uid}.questionnaireComplete = true
   ↓
4. الأدمن يولّد البرامج
   ↓
   aiMasterEngine.generate*(client, questionnaire)
   users/{uid}.plans.weeklyPlanDraft = {...}
   ↓
5. الأدمن ينشر للعميل
   ↓
   users/{uid}.plans.weeklyPlan = {...}
   users/{uid}.plans.weeklyPlanPublishedAt = ISO timestamp
   ↓
6. العميل يتابع يومياً
   ↓
   users/{uid}.dailyProgress[date] = { meals, exercises, mood, water }
   users/{uid}.dailyLogs[date] = { waterLiters, notes }
   ↓
7. التحديثات الشهرية
   ↓
   users/{uid}.measurementHistory = arrayUnion(newMeasurement)
   users/{uid}.lastMeasurementSubmittedAt = ISO timestamp
```

---

## 13. مزايا خاصة

### الدورة الشهرية (إناث) — `PeriodTracker.tsx`
- تسجيل آخر دورة + طول الدورة
- الـ AI يعدّل RPE وكثافة التمرين في مرحلة الدورة
- نصائح تغذوية مخصصة

### الساعة الذكية — `SmartwatchPanel.tsx`
- إدخال بيانات يدوياً: خطوات / نوم / ضربات القلب
- تُؤثر على توصيات الكوتش AI

### الماسح — `FridgeScanner.tsx`
- تصوير الثلاجة → Gemini يحلل المكونات → يقترح وجبات

### فالكون آي — `FalconEye.tsx`
- تحليل شامل لأداء العميل بالـ AI

### Champions Feed — `ChampionsFeed.tsx`
- نشر إنجازات مع صور/فيديو
- إعجاب + تعليقات
- الصور عبر `/api/upload` فقط (بدون base64 fallback لمنع overflow)

---

## 14. إدارة العضويات والمالية

### `MembershipManager.tsx`
- إنشاء أنواع عضويات (شهري / ربع سنوي / باقة / EMS)
- `memberships` collection في Firestore

### `FinancialDashboard.tsx`
- تعيين عضوية لعميل
- تتبع المبلغ المدفوع / المتبقي
- أقساط الدفع
- `clientMemberships` collection في Firestore

### `EMSAttendance.tsx`
- تسجيل حضور جلسات EMS
- عداد الجلسات المتبقية
- تنبيهات "جلسات منخفضة"
- `emsSessions` collection في Firestore

---

## 15. المشاكل المعروفة والحلول

### Firebase Storage غير مفعّل
**السبب:** المشروع على خطة Spark (مجانية) — Storage يتطلب ترقية لـ Blaze.
**الحل المؤقت:** base64 fallback للصور الصغيرة (< 400KB).
**الحل الدائم:** ترقية الخطة من Firebase Console → Storage → Get Started.

### ملاحظات مهمة
- `FIREBASE_SERVICE_ACCOUNT_KEY` + `GEMINI_API_KEY` مطلوبان في Secrets
- الأدمن: `lotfyshaban2211@gmail.com` (hard-coded في App.tsx للـ bootstrap)
- الـ Firestore DB ID: `ai-studio-dd4e7562-111f-4f38-9530-c7cda2527a71`

---

## 16. قاموس المصطلحات

| مصطلح | المعنى |
|-------|-------|
| InBody | تقرير تحليل تكوين الجسم |
| OCR | استخراج النص/الأرقام من الصور بالـ AI |
| Onboarding | التسجيل الأول للعميل |
| Questionnaire | الاستبيان التفصيلي بعد التفعيل |
| Draft | مسودة البرنامج قبل النشر |
| Weekly Plan | الخطة الأسبوعية المنشورة للعميل |
| EMS | التحفيز الكهربائي للعضلات |
| RTL | Right-to-Left (اليمين لليسار) |
| PWA | Progressive Web App |
| Fallback | الخيار البديل عند فشل الخيار الأساسي |
| Brain Summary | ملخص الكوتش AI عن العميل |
| readiness | مؤشرات التعافي اليومية |

---

*آخر تحديث: مايو 2026 — الإصدار الخامس من الإصلاحات*
