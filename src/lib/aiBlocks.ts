/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  AI Hard-Rail BLOCKS  (CoachPro Master Spec)
 * ─────────────────────────────────────────────────────────────────────────────
 *  These are the named, deterministic rule blocks that get injected into
 *  every Gemini system prompt. They encode the user-supplied scientific
 *  constraints so the model cannot drift, hallucinate, or "improvise"
 *  outside of the system.
 *
 *  Order of injection in a system prompt:
 *    [FITNESS_ASSESSMENT_BLOCK]
 *    [TRAINING_BLOCK]   or   [EMS_BLOCK]
 *    [NUTRITION_BLOCK]  +    [CARB_CYCLING_BLOCK]
 *    [CORE_AI_RULES]
 *
 *  All numerical thresholds match the spec the user provided.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const FITNESS_ASSESSMENT_BLOCK = `🟢 FITNESS ASSESSMENT BLOCK (إلزامي)
- الاختبارات مقسّمة إلى 5 فئات: Strength / Endurance / Cardio / Mobility / Balance.
- كل اختبار له اسم عربي + إنجليزي + وصف + طريقة تنفيذ + نوع قياس.
- التقييم العددي: Score = (User Result ÷ Reference) × 100.
- التصنيف بالعربي:
    0–40   ضعيف
    41–60  مقبول
    61–80  جيد
    81–90  جيد جداً
    91–100 ممتاز
- يجب حساب 5 مؤشرات: Strength Index, Cardio Index, Endurance Index, Mobility, Balance.
- Weak Point = أقل مؤشر بين الخمسة → البرنامج يُبنى عليه أولاً.
- إعادة التقييم كل 14 يوم (دورة تكيّف ثابتة).
- Progression: +5% عند التحسّن، -10% عند الإجهاد.`;

export const NUTRITION_BLOCK = `🟡 NUTRITION BLOCK (إلزامي)
- السعرات: حساب Mifflin-St Jeor فقط (BMR = 10·W + 6.25·H − 5·A + S).
- تعديل الهدف:
    Fat Loss      → −20% من TDEE
    Muscle Gain   → +10% من TDEE
    Maintenance   →  0%
- الماكروز:
    Protein  → حسب الهدف (1.6–2.2 جم/كجم).
    Fat      → 20–30% من السعرات الكلية.
    Carbs    → الباقي.
- الحالات المرضية (CRITICAL — لا تتجاهل أبداً):
    سكر          → كارب معقد منخفض GI.
    ضغط          → تقليل الصوديوم (<2300 ملجم/يوم).
    كوليسترول    → تقليل الدهون المشبعة، زيادة الأوميجا 3.
    كلى          → تقليل البروتين (≤0.8 جم/كجم).
    كبد          → تقليل الدهون الكلية.
    هضم          → تقليل المهيجات (بهارات حارة، كافيين).
- 3–5 وجبات يومياً.
- بروتين في كل وجبة.
- إعادة تقييم كل 14 يوم وتعديل السعرات إذا التغيير <0.5 كجم/أسبوع.`;

export const CARB_CYCLING_BLOCK = `🟠 CARB CYCLING BLOCK (إلزامي)
- تقسيم الأيام حسب شدة التمرين:
    High Carb Day      → يوم تمرين شديد (Strength/HIIT)  → كارب 50–60%.
    Moderate Carb Day  → يوم تمرين متوسط                  → كارب 40–50%.
    Low  Carb Day      → يوم راحة أو كارديو خفيف         → كارب 20–30%.
- 70% من الكارب اليومي حول التمرين (قبل بساعتين + بعد مباشرة).
- الربط الإلزامي: أي تعديل في خطة التمرين يجب أن ينعكس فوراً على نوع اليوم (High/Mod/Low).
- يوم Low Carb = زيادة البروتين تعويضياً (≥2.0 جم/كجم) للحفاظ على العضلات.`;

export const TRAINING_BLOCK = `🔵 TRAINING BLOCK (إلزامي)
- البرنامج يُبنى على ثلاث ركائز معاً:
    1) Goal (الهدف)
    2) Weakness (نقطة الضعف من Fitness Assessment)
    3) Level (المستوى)
- التقسيم حسب المستوى:
    Beginner      → Full Body × 3 أيام/أسبوع.
    Intermediate  → Upper / Lower (4 أيام).
    Advanced      → Split (Push/Pull/Legs أو Bro Split — 5–6 أيام).
- كل تمرين يجب أن يحتوي على:
    اسم عربي + إنجليزي
    Sets × Reps × Rest
    RPE
- مقياس الشدة (RPE):
    3–4  خفيف
    5–7  متوسط
    8–9  عالي
    🚫 RPE 10 ممنوع نهائياً.
- ربط مباشر بين كل تمرين والـ Weak Point (مثلاً: Cardio Index منخفض → إضافة جلسة Zone 2).
- التقدم: +5% حمل أو حجم كل 14 يوم عند تحقّق شروط Progression.`;

export const EMS_BLOCK = `🟣 EMS BLOCK (إلزامي)
- الشدة تُقاس بالـ RPE فقط:
    Light     RPE 3–4
    Moderate  RPE 5–7
    High      RPE 8–9
    🚫 RPE 10 ممنوع نهائياً.
- التردد (Hz):
    Low Hz       1–20  Hz   → استشفاء / دورة دموية.
    Moderate Hz  20–50 Hz   → تحمل عضلي.
    High Hz      50–100 Hz  → قوة وبناء عضلي.
- قواعد السلامة (إجبارية):
    • ممنوع جلستين متتاليتين في يومين متتاليين.
    • راحة 48 ساعة كحد أدنى بين الجلسات.
    • أقصى 2 جلسة/أسبوع للمبتدئين، 3 جلسات للمتقدمين.
- كل تمرين EMS يجب أن يحتوي على:
    اسم التمرين + المدة (ثواني تحت التحفيز) + الراحة + الشدة (RPE) + التردد (Hz).`;

export const CORE_AI_RULES = `🛑 CORE AI RULES (لا تتعدّاها):
1. لا تخترع بيانات. كل قرار يجب أن يستند إلى الـ Blocks أعلاه.
2. لا تخرج عن قواعد الـ Blocks مهما كان الطلب.
3. لو نقصت بيانات، اطلبها بدلاً من التخمين.
4. اللغة: عربي فقط (الإنجليزي مسموح فقط داخل [IMG: ...] أو أسماء تمارين علمية).
5. لا تستخدم Markdown tables — استخدم سطور وعلامات شرطة.
6. كل خطة يجب أن تنتهي بسطر التحقق المطلوب ("✅ نهاية الخطة" / "✅ نهاية البرنامج").`;

/**
 * Build the full hard-rail header for a NUTRITION generator.
 * Always pairs NUTRITION + CARB_CYCLING (they are scientifically linked).
 */
export function nutritionRailHeader(): string {
  return [NUTRITION_BLOCK, CARB_CYCLING_BLOCK, CORE_AI_RULES].join('\n\n');
}

/**
 * Build the full hard-rail header for a TRAINING generator.
 * Always prepends FITNESS_ASSESSMENT (training depends on Weak Point),
 * then the TRAINING_BLOCK, then CORE_AI_RULES.
 */
export function trainingRailHeader(): string {
  return [FITNESS_ASSESSMENT_BLOCK, TRAINING_BLOCK, CORE_AI_RULES].join('\n\n');
}

/**
 * Build the full hard-rail header for an EMS generator.
 * EMS has its own assessment dependency too.
 */
export function emsRailHeader(): string {
  return [FITNESS_ASSESSMENT_BLOCK, EMS_BLOCK, CORE_AI_RULES].join('\n\n');
}
