# ARCHITECTURE.md

# CoachPro Architecture Documentation

## 1. نظرة عامة على النظام

CoachPro هو نظام إدارة تدريب رياضي ذكي يعمل كـ Progressive Web App (PWA) مع دعم Android عبر Capacitor. يهدف إلى ربط ثلاث طبقات أساسية:

- العميل: يتفاعل مع الخطة اليومية والأسبوعية والتقدم والقياسات والتواصل.
- المدرب: يراجع العملاء، يولد الخطط، يراقب التقدم، ويُشغّل التحليلات الذكية.
- الذكاء الاصطناعي: يترجم البيانات الخام إلى توصيات تدريبية وتغذوية وتأهيلية آمنة.

التصميم الحالي يعتمد على:

- React + Vite للواجهة الأمامية
- Express/Node كطبقة خادم خفيفة
- Firebase Auth + Firestore + Storage للبيانات والملفات
- Gemini كطبقة الذكاء الاصطناعي

المشروع مصمم كمنصة عربية أولاً، مع واجهة RTL، وتدفق عملي يركز على إدارة العميل من أول تسجيل إلى توليد البرنامج التدريبي.

---

## 2. Architecture Diagram (ASCII)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           Client / Coach UI                         │
│  Login | Onboarding | SurveyManager | ClientDashboard | AdminDashboard│
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           Application Layer                          │
│  App.tsx -> Route Gate -> Component Orchestrators                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Business Logic Layer                          │
│  Scientific Engine | Nutrition Logic | EMS Logic | Rehab Logic      │
│  AI Master Engine | Macro Calculator | Gamification | Validators    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Integration Layer                             │
│  Firebase Auth | Firestore | Storage | Server API | Gemini API      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Data & Media Stores                           │
│  users/{uid} | questionnaires/{uid} | chats | feed | emsSessions    │
│  Firebase Storage (images/audio/uploads)                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow من أول تسجيل العميل حتى إنشاء البرنامج

### 3.1 رحلة العميل الأساسية

```text
1. تسجيل الدخول
   └─ Login.tsx + Firebase Auth

2. إنشاء ملف المستخدم الأساسي
   └─ users/{uid}

3. Onboarding الأولي
   ├─ البيانات الشخصية
   ├─ الحالة الطبية
   ├─ الأهداف
   ├─ الصور / InBody / التسجيل الصوتي
   └─ تحديث onboardingComplete = true

4. استبيانات العميل
   ├─ NutritionSurvey
   ├─ WorkoutSurvey
   ├─ RehabSurvey
   ├─ EMSSurvey
   └─ تحديث questionnaireComplete = true

5. توليد السياق الذكي
   ├─ استخراج بيانات المستخدم
   ├─ قراءة الاستبيانات
   ├─ قراءة التاريخ البدني والقياسات
   └─ بناء context للذكاء الاصطناعي

6. إنشاء البرنامج
   ├─ AI Master Engine
   ├─ Scientific Engine
   ├─ Macro Calculator
   ├─ EMS / Rehab / Nutrition rules
   └─ كتابة weeklyPlan في Firestore

7. عرض البرنامج للعميل والمدرب
   └─ ClientDashboard + AdminDashboard
```

### 3.2 التدفق التقني

```text
Client -> Auth -> App.tsx -> Firestore profile -> Onboarding -> SurveyManager
-> User profile enriched -> AdminDashboard / AI plan request -> AI Master Engine
-> Gemini API -> normalized JSON -> Firestore plan save -> ClientDashboard render
```

---

## 4. AI Flow (كيف تنتقل البيانات إلى Gemini ثم تعود)

الذكاء الاصطناعي في المشروع ليس نقطة منفصلة بالكامل، بل هو طبقة تشغيلية ترتبط مباشرة بالمنطق التجاري.

### 4.1 المسار الأساسي

```text
User Profile + Survey Data + Measurements + Risk Profile
        │
        ▼
AI Master Engine
        │
        ├─ assembles system prompt
        ├─ injects hard-rail safety blocks
        ├─ includes scientific context
        └─ selects relevant package modules
        │
        ▼
Gemini API
        │
        ▼
Structured JSON Response
        │
        ├─ parse
        ├─ sanitize
        ├─ normalize
        └─ save to Firestore
```

### 4.2 ما الذي يُرسل إلى Gemini

- بيانات العميل الأساسية
- الأهداف والظروف الصحية
- الصور/القياسات/InBody
- نتائج الاستبيانات
- بيانات التقدم اليومي
- قواعد السلامة وقيود الإصابات
- معلومات الباقات والخطة المطلوبة

### 4.3 ما الذي يعود من Gemini

- خطة أسبوعية للتمرين
- وجبات وتوصيات تغذية
- توصيات EMS
- خطة تأهيل/إصابات
- ملاحظات ذكية للعميل
- ملخصات ذكية أو تحليل صور الطعام

### 4.4 ملاحظات الأمان

الذكاء الاصطناعي لا يعمل بحرية تامة؛ بل يُحمى بـ hard rails وقيود منطقية تشمل:

- قواعد EMS
- منع التوصيات الخطرة
- التقييد حسب الباقة المشتراة
- استخدام البيانات العلمية قبل توليد الخطة

---

## 5. Firebase Flow

Firebase هو قلب التخزين والتشغيل في التطبيق.

### 5.1 Firebase Auth

- تسجيل الدخول عبر البريد وكلمة المرور
- تسجيل الدخول عبر Google
- تحديد دور المستخدم كـ admin أو client
- توجيه المستخدم إلى الشاشة المناسبة عبر App.tsx

### 5.2 Firestore

Firestore يخزن البيانات الأساسية والعلاقات بين المستخدمين والخطط والأنشطة.

### 5.3 Storage

Storage يستخدم لرفع الصور والملفات، مثل:

- صورة البروفايل
- صور التقدم
- صور InBody
- صور الوجبات/الثلاجة
- ملفات الوسائط الخاصة بال feed

### 5.4 التدفق العملي

```text
User action -> Frontend component -> Firebase SDK -> Firestore/Storage
                                    │
                                    └─ real-time listener / onSnapshot
```

---

## 6. Components مع وظيفة كل Component

### 6.1 Components الأساسية

| Component | الوظيفة |
|---|---|
| App.tsx | نقطة الدخول الرئيسية، تحديد المسار بناءً على Auth + Firestore profile |
| Login.tsx | شاشة تسجيل الدخول مع البريد/كلمة المرور والـ Google Sign-In |
| Onboarding.tsx | معالج التسجيل الأولي وتجميع البيانات الصحية والبدنية |
| SurveyManager.tsx | إدارة الاستبيانات التفصيلية للعميل عبر أقسام التغذية/التمرين/التأهيل/EMS |
| ClientDashboard.tsx | المركز الإداري الرئيسي للعميل، ويجمع معظم التبويبات والوظائف |
| DashboardShell.tsx | هيكل التنقل العام للوحة العميل |
| AdminDashboard.tsx | لوحة التحكم الأساسية للمدرب لإدارة العملاء والخطط والمالية والأنشطة |
| Chat.tsx | واجهة المحادثة بين العميل والمدرب |
| SmartMicInbox.tsx | صندوق الملاحظات الصوتية للمدرب مع تلخيص وإدارة |
| FalconEye.tsx | عرض تحليل ذكي شامل لحالة العميل |
| Profile.tsx | إدارة الملف الشخصي، البيانات الأساسية، والقياسات |
| ActivityFeed.tsx | عرض سجل الأنشطة داخل النظام |
| BadgesPanel.tsx | عرض الشارات والإنجازات |
| PointsBadge.tsx | عرض النقاط والرتب |
| BodyMap.tsx | خريطة الجسم التفاعلية لعرض نقاط الألم/الإصابات |
| CelebrationPopup.tsx | نافذة الاحتفال عند الترقية أو الإنجاز |
| ChampionsFeed.tsx | لوحة المجتمع والمنشورات الاجتماعية |
| ComplianceScores.tsx | مؤشرات الالتزام وإحراز التقدم |
| EMSAttendance.tsx | إدارة حضور جلسات EMS |
| FinancialDashboard.tsx | لوحة مالية لإدارة الاشتراكات والدفعات |
| FridgeScanner.tsx | مسح صور الثلاجة لتحليل الأطعمة والوجبات |
| Lightbox.tsx | عارض الصور الكبير |
| MeasurementUpdate.tsx | تحديث القياسات والملفات الشخصية بشكل دوري |
| MembershipManager.tsx | إدارة الباقات والاشتراكات |
| MoodTrendChart.tsx | رسم بياني لحالة المزاج والتقدم |
| PeriodTracker.tsx | تتبع الدورة الشهرية للإناث |
| PointsBadge.tsx | عرض النقاط والرتبة |
| ProgressUpdate.tsx | تحديث التقدم الشهري أو المرحلي |
| RecoveryWorkoutModal.tsx | نافذة جلسات الاستشفاء/الاسترداد |
| ScientificEngineCard.tsx | عرض النتائج المشتقة من المحرك العلمي |
| SmartwatchPanel.tsx | عرض بيانات الساعة الذكية أو البيانات الصحية |
| AdminDigest.tsx | ملخص يومي أو دوري للأدمن |
| AdminMacroCard.tsx | عرض حسابات الماكرو في واجهة الأدمن |
| AdminProgressionCard.tsx | عرض مسار التقدم للأدمن |
| AdminRadar.tsx | عرض تحليلي مرئي لعدة مؤشرات |
| BrandLogo.tsx | عرض الشعار |
| ErrorBoundary.tsx | اعتراض الأخطاء في الواجهة |
| InstallPrompt.tsx | دعوة تثبيت التطبيق كـ PWA |

### 6.2 Components الاستبيانات

| Component | الوظيفة |
|---|---|
| surveys/NutritionSurvey.tsx | استبيان تغذية مفصل |
| surveys/WorkoutSurvey.tsx | استبيان تمرين وتقييم مستوى النشاط |
| surveys/RehabSurvey.tsx | استبيان تأهيل وإصابات |
| surveys/EMSSurvey.tsx | استبيان EMS والسلامة |
| surveys/GeneralMedicalForm.tsx | نموذج طبي عام |

---

## 7. Services مع وظيفة كل Service

### 7.1 Server Service

| Service | الوظيفة |
|---|---|
| server.ts | خادم Express يدير الصحة، رفع الملفات، الترجمة الصوتية، وواجهة API خفيفة |

### 7.2 AI Service

| Service | الوظيفة |
|---|---|
| services/aiMasterEngine.ts | المحرك المركزي للذكاء الاصطناعي، يجمع البيانات، يجهز prompts، وينفذ توليد الخطة والتوصيات |

---

## 8. Libraries الداخلية

| Library | الوظيفة |
|---|---|
| lib/aiBlocks.ts | كتل جاهزة من القواعد والقيود التي تُحقن في prompts |
| lib/scientificEngine.ts | المنطق العلمي للتقييم، اختيار الاختبارات، تحليل التقدم، وتصنيف المخاطر |
| lib/macroCalculator.ts | حساب BMR/TDEE والماكروهات بناءً على الهدف والبيانات البدنية |
| lib/emsProtocol.ts | قواعد EMS، حدود السلامة، تحويلات العرض للعميل |
| lib/gamification.ts | نظام النقاط والرتب والإنجازات |
| lib/badges.ts | منطق الشارات والتمكين بناءً على السلوك |
| lib/activityLog.ts | تسجيل الأنشطة الخاصة بالعميل داخل النظام |
| lib/firebaseUtils.ts | مساعدات Firebase وإدارة الاتصال |
| lib/error-handler.ts | معالجة الأخطاء بشكل موحد |
| lib/i18n.tsx | النظام المحلي للترجمة العربية/الإنجليزية |
| lib/imageUtils.ts | معالجة الصور، الضغط والتحميل |
| lib/pwa.ts | دعم التثبيت كـ PWA |
| lib/smartwatch.ts | تكامل البيانات الصحية والساعة الذكية |
| lib/sounds.ts | الأصوات التفاعلية داخل التطبيق |
| lib/theme.tsx | إدارة السمات والتصميم |

---

## 9. Engines

### 9.1 Scientific Engine

الموقع: lib/scientificEngine.ts

الوظيفة:
- اختيار الاختبارات التكيفية بناءً على مستوى المخاطر والهدف
- تقييم الأداء البدني والتقدم
- تحليل التقدم عبر الزمن
- حساب درجات التقييم والاعتبارات العلمية

المخرجات:
- نتائج الاختبارات
- تقييم المخاطر
- توصيات التقدم
- بيانات تُستخدم لاحقًا في الخطة الذكية

### 9.2 Nutrition Engine

لا يوجد ملف منفصل باسم Nutrition Engine، لكنه يظهر كطبقة منطقية مدمجة في:
- macroCalculator.ts
- aiMasterEngine.ts
- NutritionSurvey.tsx

الوظيفة:
- حساب الاحتياج الغذائي
- تحويل بيانات الاستبيان إلى سياق تغذوي
- توليد وجبات وتوصيات غذائية مناسبة

### 9.3 EMS Engine

المواقع: lib/emsProtocol.ts + services/aiMasterEngine.ts

الوظيفة:
- تطبيق قواعد السلامة الخاصة بالـ EMS
- توزيع الشدة على مستويات آمنة
- منع التوصيات الخطرة أو غير المناسبة
- تحويل القيم التقنية إلى لغة مبسطة للعميل

### 9.4 Rehab Engine

يظهر عبر عدة طبقات:
- RehabSurvey.tsx
- BodyMap.tsx
- scientificEngine.ts
- aiMasterEngine.ts

الوظيفة:
- إدارة نقاط الألم والإصابات
- إنشاء فهم لحالة التأهيل
- بناء خطة علاجية أو تأهيلية آمنة
- ربط الحالة الصحية مع التقدم والتوصيات

### 9.5 AI Master Engine

الموقع: services/aiMasterEngine.ts

الوظيفة:
- المحرك المركزي للذكاء الاصطناعي
- ينسق جميع التوصيات عبر التدريب والتغذية والـ EMS والتأهيل
- يقرأ بيانات المستخدم ويولد خطة أسبوعية أو ملاحظات ذكية
- يربط منطق التقييم العلمي مع اللغة الذكية التي تُعرض للعميل

---

## 10. علاقة كل Engine بالآخر

العلاقة بين المحركات ليست مستقلة، بل مترابطة:

```text
Scientific Engine
   └─ يوفر تقييمات المخاطر والاختبارات البدنية

Nutrition Engine
   └─ يعتمد على البيانات البدنية وهدف العميل

EMS Engine
   └─ يعتمد على السلامة والتقييم العلمي والباقة

Rehab Engine
   └─ يعتمد على بيانات الإصابات وScientific Engine

AI Master Engine
   └─ يجمع جميع هذه الطبقات في خطة واحدة متكاملة
```

الترابط العملي:
- Scientific Engine يجهز السياق العلمي.
- Nutrition Engine يضيف الاحتياج الغذائي.
- EMS و Rehab Engines يضيفان قيوداً خاصة بالسلامة.
- AI Master Engine يجمع كل هذا ويولد الناتج النهائي.

---

## 11. دورة حياة العميل داخل التطبيق (Client Journey)

```text
1. تسجيل الدخول
2. إنشاء ملف المستخدم
3. اكمال Onboarding
4. إكمال الاستبيانات
5. تفعيل الوضع التفاعلي داخل لوحة العميل
6. متابعة اليوم والبرنامج
7. تحديث القياسات والتقدم
8. تلقي توصيات ذكية
9. التفاعل مع المدرب أو النظام
10. التقدم إلى مراحل جديدة من الخطة
```

### 11.1 النقطة الأساسية في الرحلة

العميل لا يدخل التطبيق كـ مستخدم عادي فقط؛ بل يدخل ككيان ذكي له:
- ملف شخصي
- بيانات صحية
- اختبارات وتقييمات
- خطة أسبوعية
- سجل تقدم
- نقاط وشارات

---

## 12. دورة حياة المدرب داخل التطبيق (Coach Journey)

```text
1. تسجيل الدخول كـ admin/coach
2. مشاهدة قائمة العملاء
3. مراجعة البيانات الشخصية والاستبيانات
4. مراجعة التقدم والاختبارات
5. توليد أو مراجعة خطة العميل
6. نشر الخطة أو تعديلها
7. متابعة التواصل الصوتي والنصّي
8. مراقبة الالتزام والإنجازات
9. إدارة الاشتراكات والمالية
10. اتخاذ القرار بناءً على التحليلات الذكية
```

المدرب ليس مجرد شاشة عرض؛ بل نقطة تحكم مركزية تتفاعل مع الواجهة والذكاء الاصطناعي والبيانات.

---

## 13. أماكن حفظ البيانات في Firestore

### 13.1 البيانات الرئيسية

| المكان | المحتوى |
|---|---|
| users/{uid} | الملف الشخصي الأساسي للمستخدم |
| questionnaires/{uid} | بيانات الاستبيانات التفصيلية |
| chats/{chatId}/messages | الرسائل بين العميل والمدرب |
| feed | منشورات المجتمع |
| notifications/{uid} | الإشعارات الداخلية |
| memberships | أنواع الباقات |
| clientMemberships | اشتراكات العملاء |
| emsSessions | جلسات EMS وحضورها |

### 13.2 البيانات الفرعية داخل المستخدم

| المكان | المحتوى |
|---|---|
| users/{uid}.onboardingData | بيانات التسجيل الأولي |
| users/{uid}.plans.weeklyPlan | الخطة الأسبوعية المنشورة |
| users/{uid}.plans.weeklyPlanDraft | المسودة قبل النشر |
| users/{uid}.measurementHistory | سجل القياسات |
| users/{uid}.assessmentHistory | نتائج الاختبارات |
| users/{uid}.dailyProgress | سجل التقدم اليومي |
| users/{uid}.dailyLogs | السجلات اليومية والبيانات الصحية |
| users/{uid}.nutritionSurveyData | البيانات الغذائية |

---

## 14. أماكن استخدام Storage

Storage يُستخدم للملفات الوسيطة والوسائط التي تتجاوز طبيعة الحقول النصية.

### 14.1 الاستخدامات الحالية

- صور البروفايل
- صور التقدم الجسماني
- صور InBody
- صور الثلاجة أو الطعام
- ملفات الرفع العامة من المستخدم
- الوسائط المرتبطة بالـ feed والمحتوى الاجتماعي

### 14.2 الأسلوب العملي

الرفع يتم عبر طبقة خادم خفيفة، ثم يخزن الملف في Firebase Storage، وتُحفظ القيمة المرجعية في Firestore أو في بيانات المستخدم.

---

## 15. نقاط القوة المعمارية

- فصل واضح بين UI و Logic و Data Layer
- استخدام Firebase كحل جاهز لتخزين المستخدمين والملفات
- وجود طبقة ذكاء اصطناعي مركزة ومحددة بشكل واضح
- وجود قواعد سلامة وقيود على EMS والتأهيل
- إمكانية التوسع مع إضافة تبويبات جديدة أو محركات جديدة
- تصميم مناسب لواجهة PWA وعرض سريع

---

## 16. نقاط الضعف المعمارية

- بعض منطق الأعمال ما زال مدمجاً داخل المكونات
- الذكاء الاصطناعي يعتمد على منطق متنوع ومشتت عبر عدة طبقات
- بعض التبعيات الإدارية والواجهة مركّزة داخل Dashboard كبير
- هناك حاجة إلى طبقة API موحدة أكثر وضوحاً
- لا يوجد فصل كامل بين domain model و UI model في جميع الحالات
- الاعتماد على Firebase مباشرة من الواجهة قد يصبح معقداً مع نمو المشروع

---

## 17. اقتراحات لتحسين Architecture مستقبلاً

### 17.1 تحسينات فورية

- نقل كل استدعاءات Gemini إلى طبقة خادم موحدة
- فصل Domain Layer عن Presentation Layer بشكل أعمق
- إنشاء API service layer داخل التطبيق
- تقسيم ClientDashboard إلى مكونات أصغر وأكثر تركيزاً
- توحيد نمط التخزين بين Firestore و Storage

### 17.2 تحسينات متوسطة

- بناء module-based architecture لكل مجال: training / nutrition / rehab / ems
- اعتماد Event-Driven أو Command-Query patterns
- إضافة Cache layer و offline-first behavior
- تحسين إدارة الحالة عبر Zustand أو Redux Toolkit إذا نمت الوظائف

### 17.3 تحسينات مستقبلية

- فصل AI orchestrator إلى خدمات مستقلة لكل مجال
- بناء Microservice أو Backend API مركزي للمنطق الحيوي
- إضافة observability / logging / tracing
- تطوير نظام صلاحيات أقوى ومفصل بين admin و client و coach roles

---

## 18. الخلاصة الهندسية

CoachPro بنية قوية ومناسبة لمنتج عملي، خاصة في المرحلة الحالية التي تجمع بين إدارة العملاء، التتبع، الذكاء الاصطناعي، والبيانات الطبية/البدنية. ومع ذلك، فإن النمو المستقبلي يتطلب مزيداً من الفصل بين الطبقات، وتقليص الاعتماد المباشر على الواجهة في المنطق المعقد، وإعادة هيكلة الأجزاء المركزية مثل Dashboard والـ AI Engine لتصبح أكثر مرونة وقابلية للصيانة.
