# PROJECT_AUDIT.md

## 1. شجرة المشروع كاملة

```text
/workspaces/CoachPro
├── capacitor.config.ts
├── COACHPRO_FULL_BRIEF.md
├── CoachPro_System_Documentation.md
├── CODE_MAP.md
├── components.json
├── firebase-applet-config.json
├── firebase-blueprint.json
├── firestore.rules
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── replit.md
├── replit.nix
├── server.ts
├── storage.rules
├── tsconfig.app.json
├── tsconfig.base.json
├── tsconfig.json
├── vite.config.ts
├── attached_assets/
│   ├── Pasted---1777516621418_1777516621420.txt
│   ├── Pasted--16-Rehab-Tests-Library--1777677004759_1777677004761.txt
│   ├── Pasted--22-AI-Program-Generation-Rules-Rehab-Tests-L-177767702_1777677029994.txt
│   └── Pasted--FULL-SYSTEM-UPDATE-ADD-ON-ONLY-DO-NOT-REPLACE-EXISTING_1777676114242.txt
├── public/
│   ├── manifest.webmanifest
│   └── sw.js
└── src/
    ├── App.tsx
    ├── firebase.ts
    ├── index.css
    ├── main.tsx
    ├── types.ts
    ├── components/
    │   ├── ActivityFeed.tsx
    │   ├── AdminDashboard.tsx
    │   ├── AdminDigest.tsx
    │   ├── AdminMacroCard.tsx
    │   ├── AdminProgressionCard.tsx
    │   ├── AdminRadar.tsx
    │   ├── BadgesPanel.tsx
    │   ├── BodyMap.tsx
    │   ├── BrandLogo.tsx
    │   ├── CelebrationPopup.tsx
    │   ├── ChampionsFeed.tsx
    │   ├── Chat.tsx
    │   ├── ClientDashboard.tsx
    │   ├── ComplianceScores.tsx
    │   ├── DashboardShell.tsx
    │   ├── EMSAttendance.tsx
    │   ├── ErrorBoundary.tsx
    │   ├── FalconEye.tsx
    │   ├── FeedPostFull.tsx
    │   ├── FinancialDashboard.tsx
    │   ├── FridgeScanner.tsx
    │   ├── InstallPrompt.tsx
    │   ├── Lightbox.tsx
    │   ├── Login.tsx
    │   ├── MeasurementUpdate.tsx
    │   ├── MembershipManager.tsx
    │   ├── MoodTrendChart.tsx
    │   ├── PeriodTracker.tsx
    │   ├── PointsBadge.tsx
    │   ├── Profile.tsx
    │   ├── ProgressUpdate.tsx
    │   ├── RecoveryWorkoutModal.tsx
    │   ├── ScientificEngineCard.tsx
    │   ├── SmartMicInbox.tsx
    │   ├── SmartwatchPanel.tsx
    │   ├── SurveyManager.tsx
    │   ├── SystemDocumentationPDF.tsx
    │   ├── surveys/
    │   │   ├── EMSSurvey.tsx
    │   │   ├── GeneralMedicalForm.tsx
    │   │   ├── NutritionSurvey.tsx
    │   │   ├── RehabSurvey.tsx
    │   │   └── WorkoutSurvey.tsx
    │   └── ui/
    │       └── TimePicker.tsx
    ├── lib/
    │   ├── activityLog.ts
    │   ├── aiBlocks.ts
    │   ├── badges.ts
    │   ├── emsProtocol.ts
    │   ├── error-handler.ts
    │   ├── firebaseUtils.ts
    │   ├── gamification.ts
    │   ├── i18n.tsx
    │   ├── imageUtils.ts
    │   ├── macroCalculator.ts
    │   ├── pwa.ts
    │   ├── scientificEngine.ts
    │   ├── smartwatch.ts
    │   ├── sounds.ts
    │   └── theme.tsx
    └── services/
        └── aiMasterEngine.ts
```

---

## 2. جميع الشاشات الموجودة

### الشاشات الرئيسية
- Login
- Onboarding
- SurveyManager
- ClientDashboard
- AdminDashboard
- Profile
- Chat
- FalconEye
- ChampionsFeed
- MeasurementUpdate
- FridgeScanner
- SmartMicInbox
- FinancialDashboard
- EMSAttendance
- MembershipManager
- PeriodTracker
- ProgressUpdate
- RecoveryWorkoutModal
- SystemDocumentationPDF

### الشاشات الفرعية / الأقسام الداخلية
- Today tab
- Weekly tab
- Analysis tab
- Chat tab
- Assessment tab
- Falcon tab
- Feed tab
- Profile tab
- Injury / Rehab assessment views
- Admin overview / management panels

---

## 3. جميع المكونات Components

### مكونات واجهة المستخدم الأساسية
- ActivityFeed
- AdminDashboard
- AdminDigest
- AdminMacroCard
- AdminProgressionCard
- AdminRadar
- BadgesPanel
- BodyMap
- BrandLogo
- CelebrationPopup
- ChampionsFeed
- Chat
- ClientDashboard
- ComplianceScores
- DashboardShell
- EMSAttendance
- ErrorBoundary
- FalconEye
- FeedPostFull
- FinancialDashboard
- FridgeScanner
- InstallPrompt
- Lightbox
- Login
- MeasurementUpdate
- MembershipManager
- MoodTrendChart
- Onboarding
- PeriodTracker
- PointsBadge
- Profile
- ProgressUpdate
- RecoveryWorkoutModal
- ScientificEngineCard
- SmartMicInbox
- SmartwatchPanel
- SurveyManager
- SystemDocumentationPDF

### مكونات الاستبيانات
- surveys/NutritionSurvey
- surveys/WorkoutSurvey
- surveys/RehabSurvey
- surveys/EMSSurvey
- surveys/GeneralMedicalForm

### مكونات UI صغيرة
- ui/TimePicker

---

## 4. جميع الخدمات Services

### الخدمة الأساسية
- src/services/aiMasterEngine.ts

### دور هذه الخدمة
- توليد الخطط التدريبية
- تحليل صور الطعام
- توليد الردود الذكية
- إدارة التقييمات التكيفية
- إدارة التحسينات الذكية للخطط

---

## 5. جميع ملفات الذكاء الاصطناعي

- src/services/aiMasterEngine.ts
- src/lib/aiBlocks.ts
- src/lib/scientificEngine.ts
- src/lib/macroCalculator.ts
- src/lib/emsProtocol.ts

### دور كل ملف
- aiMasterEngine: المحرك المركزي للذكاء الاصطناعي
- aiBlocks: الحواجز الأمنية والهيكلية للـ prompts
- scientificEngine: منطق التقييم والاختبارات الذكية
- macroCalculator: حساب الاحتياجات التغذوية
- emsProtocol: قواعد EMS الآمنة

---

## 6. جميع ملفات Firebase

### ملفات العميل
- src/firebase.ts
- firebase-applet-config.json
- firebase-blueprint.json

### ملفات السحابة / القواعد
- firestore.rules
- storage.rules

### الاستخدامات الرئيسية
- Auth: تسجيل الدخول / Google OAuth
- Firestore: تخزين المستخدمين، الخطط، الاستبيانات، الرسائل، Feed
- Storage: رفع الصور والملفات

---

## 7. جميع المتغيرات البيئية المطلوبة

### متغيرات أساسية
- GEMINI_API_KEY
- GEMINI_API_KEY_2 (اختياري للنسخ الاحتياطي)
- VITE_GEMINI_API_KEY
- FIREBASE_SERVICE_ACCOUNT_KEY
- FIREBASE_SERVICE_ACCOUNT_JSON
- FIREBASE_STORAGE_BUCKET
- OWNER_EMAIL
- PORT

### ملاحظات
- server.ts يعتمد على هذه المتغيرات لتشغيل الذكاء الاصطناعي والخدمات الخلفية.
- بعض المتغيرات اختيارية حسب بيئة التطوير أو النشر.

---

## 8. جميع الـ APIs المستخدمة

### APIs داخل الخادم
- GET /api/health
- POST /api/admin/bootstrap
- POST /api/admin/create-client
- POST /api/admin/activate-client
- POST /api/admin/delete-client
- GET /api/storage-status
- POST /api/ai-service
- GET /api/ai-test
- POST /api/transcribe
- POST /api/upload

### APIs الخارجية / الخدمات الخارجية
- Firebase Auth API
- Firebase Firestore API
- Firebase Storage API
- Google Gemini API

### ملاحظات
- الخادم يعمل كـ proxy/bridge بين الواجهة والـ AI والخدمات الخلفية.

---

## 9. جميع قواعد Firestore المستخدمة

### المجموعات الأساسية
- users
- questionnaires
- client_uploads
- chats
- feedPosts
- memberships
- clientMemberships
- emsSessions
- client_photos

### Subcollections المستخدمة
- users/{uid}/notifications
- users/{uid}/clientActivity
- users/{uid}/assessments
- users/{uid}/adaptiveAssessments
- users/{uid}/rehabAssessments
- feedPosts/{postId}/comments
- chats/{chatId}/messages

### السمات المهمة داخل المستندات
- users/{uid}: role, onboardingComplete, questionnaireComplete, isActivated, plans, dailyProgress, measurementHistory, assessmentHistory, coins
- questionnaires/{uid}: nutrition, workout, rehab, ems
- feedPosts/{postId}: authorId, text, media, likes, commentCount

---

## 10. نقاط القوة

### قوة هندسية
- بنية واضحة ومقسمة بين UI و Logic و Services
- استخدام TypeScript يجعل المشروع أكثر قابلية للصيانة
- وجود وثائق معمّقة ومفصلة داخل المشروع
- فصل منطق الذكاء الاصطناعي عن الواجهة
- وجود نظام Firebase متكامل للأمان والبيانات
- دعم PWA و Capacitor يجعل المشروع قابل للنشر على ويب وموبايل

### قوة تشغيلية
- دعم تسجيل الدخول عبر Google و Email
- إدارة العملاء والأدوار (Admin/Client)
- نظام خطط AI متقدم
- نظام تقييم بدني وتدريب آمن
- نظام gamification و badges
- دعم صور وإرسال ملاحظات صوتية

---

## 11. نقاط الضعف

### فنية
- ملفات مكونات كبيرة جدًا مثل ClientDashboard و AdminDashboard
- الاعتماد الكبير على منطق معقد داخل المكونات، مما يقلل من الت modularity
- وجود احتمال تكرار المنطق بين المكونات والخدمات
- الاعتماد على Firebase و Gemini قد يرفع تعقيد الصيانة

### أمان واستقرار
- بعض قواعد Firestore قد تكون واسعة أو معقدة للغاية
- الحاجة إلى إعدادات بيئية دقيقة قبل التشغيل الكامل
- الاعتماد على مفاتيح خارجية مثل Gemini قد يسبب التوقف عند نقص الإعداد

### جودة التطوير
- يوجد خطأ برمجي مكتشف في ClientDashboard
- قد توجد مشاكل أخرى مخفية بسبب حجم المشروع الكبير

---

## 12. جميع الأخطاء البرمجية المكتشفة

### خطأ مؤكد
- خطأ TypeScript في [src/components/ClientDashboard.tsx](src/components/ClientDashboard.tsx)
- موقع الخطأ تقريبًا في منطقة Tooltip / labelFormatter داخل AreaChart
- سبب محتمل: تمرير نوع غير متوافق إلى new Date(str)

### نتيجة الفحص
- تم تشغيل الأمر التالي:
  - pnpm typecheck
- النتيجة:
  - فشل البناء بسبب خطأ واحد على الأقل

### ملاحظات إضافية
- لا يوجد خطأ في server.ts بناءً على الفحص الحالي
- لكن المشروع يعتمد على إعدادات خارجية قد تسبب مشاكل runtime عند التشغيل الفعلي

---

## 13. اقتراح ترتيب مراحل تطوير المشروع من الإصدار V1 حتى V10

### V1 — الإطلاق الأساسي
- تسجيل الدخول
- إدارة المستخدمين الأساسية
- صفحة لوحة العميل الأساسية
- لوحة الأدمن الأساسية

### V2 — إدارة البيانات الأساسية
- Onboarding
- Surveys
- تخزين Firestore مبسط
- Profile management

### V3 — الخطط الذكية
- توليد خطط تدريبية أولية
- دعم التغذية الأساسية
- عرض الخطط أسبوعيًا

### V4 — الذكاء الاصطناعي المتقدم
- تحسين prompts
- تحليل الصور
- توليد نصوص الذكاء الاصطناعي
- تحسين جودة التوصيات

### V5 — التقييم والاختبارات
- الاختبارات التكيفية
- Scientific Engine
- تقييمات الإصابات
- تحليل الأداء

### V6 — التفاعل والاتصال
- Chat
- Smart Mic
- الإشعارات
- النشاطات اليومية

### V7 — المجتمع والإنجازات
- Champions Feed
- Gamification
- Badges
- Points / leaderboard

### V8 — المراقبة والقياسات المتقدمة
- Smartwatch integration
- MeasurementUpdate
- تتبع التقدم والقياسات

### V9 — النشر المؤسسي والهوية
- تحسين تجربة المستخدم
- PWA polish
- Capacitor Android optimization
- الاستقرار والأداء

### V10 — التوسع والتحسينات التجارية
- إدارة مالية متقدمة
- تقارير شاملة
- تجربة مهنية جاهزة للتوسع
- دعم أكثر من فئة مستخدم

---

## الخلاصة

هذا المشروع يتمتع بهندسة قوية ومجموعة كبيرة من المميزات، لكنه يحتاج إلى:
- تصحيح الأخطاء البرمجية المكتشفة
- تحسين التنظيم الداخلي للمكونات الكبيرة
- توثيق بيئة التشغيل بشكل أوضح
- تحسين الاستقرار قبل التوسع
