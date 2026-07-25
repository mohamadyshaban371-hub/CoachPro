/**
 * SystemDocumentationPDF.tsx
 *
 * Renders the complete CoachPro scientific rules document and exports it
 * as a multi-page A4 PDF using the same html2canvas + jsPDF pipeline
 * used elsewhere in the app (so Arabic glyphs shape correctly via Cairo).
 *
 * Accessible from the Admin Dashboard (Settings / About section).
 */

import React, { useRef, useState } from 'react';
import { Download, Loader2, FileText } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────── */
/* PDF TEMPLATE CONTENT                                                    */
/* ─────────────────────────────────────────────────────────────────────── */

function DocTemplate() {
  const S = {
    page: {
      fontFamily: 'Cairo, "Segoe UI", Tahoma, sans-serif',
      direction: 'rtl' as const,
      backgroundColor: '#ffffff',
      color: '#1e293b',
      padding: '48px 52px',
      maxWidth: '794px',
      margin: '0 auto',
      fontSize: '13px',
      lineHeight: '1.9',
    },
    coverPage: {
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
      color: '#ffffff',
      minHeight: '1123px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px',
      textAlign: 'center' as const,
      pageBreakAfter: 'always' as const,
    },
    logo: {
      width: '90px', height: '90px',
      background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
      borderRadius: '24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 28px',
      fontSize: '40px',
    },
    coverTitle: {
      fontSize: '38px', fontWeight: '900', letterSpacing: '-0.5px',
      marginBottom: '12px', color: '#ffffff',
    },
    coverSub: {
      fontSize: '17px', color: '#94a3b8', marginBottom: '40px',
      fontWeight: '600',
    },
    coverDate: {
      fontSize: '13px', color: '#64748b',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      paddingTop: '20px', marginTop: '40px',
    },
    badge: {
      display: 'inline-block',
      background: 'rgba(59,130,246,0.2)',
      border: '1px solid rgba(59,130,246,0.4)',
      color: '#93c5fd',
      borderRadius: '20px',
      padding: '6px 18px',
      fontSize: '12px',
      fontWeight: '700',
      margin: '4px',
      letterSpacing: '0.05em',
    },
    sectionBreak: { pageBreakBefore: 'always' as const, paddingTop: '16px' },
    h1: {
      fontSize: '26px', fontWeight: '900', color: '#0f172a',
      borderBottom: '3px solid #3b82f6',
      paddingBottom: '10px', marginBottom: '28px', marginTop: '40px',
      letterSpacing: '-0.3px',
    },
    h2: {
      fontSize: '18px', fontWeight: '800', color: '#1e3a5f',
      borderRight: '4px solid #3b82f6',
      paddingRight: '12px', marginBottom: '16px', marginTop: '32px',
    },
    h3: {
      fontSize: '14px', fontWeight: '700', color: '#334155',
      marginBottom: '10px', marginTop: '20px',
    },
    table: {
      width: '100%', borderCollapse: 'collapse' as const,
      marginBottom: '20px', fontSize: '12px',
    },
    th: {
      background: '#1e3a5f', color: '#ffffff',
      padding: '9px 12px', textAlign: 'right' as const,
      fontWeight: '700', fontSize: '12px',
      border: '1px solid #cbd5e1',
    },
    td: {
      padding: '8px 12px', border: '1px solid #e2e8f0',
      textAlign: 'right' as const, verticalAlign: 'top' as const,
    },
    tdAlt: {
      padding: '8px 12px', border: '1px solid #e2e8f0',
      textAlign: 'right' as const, verticalAlign: 'top' as const,
      background: '#f8fafc',
    },
    formula: {
      background: '#f1f5f9', border: '1px solid #e2e8f0',
      borderRight: '4px solid #3b82f6',
      borderRadius: '8px', padding: '14px 16px',
      fontFamily: 'monospace, Cairo', fontSize: '12px',
      lineHeight: '2', marginBottom: '16px', direction: 'ltr' as const,
      textAlign: 'left' as const,
    },
    callout: (color: string) => ({
      background: color === 'red' ? '#fef2f2' : color === 'amber' ? '#fffbeb' :
        color === 'green' ? '#f0fdf4' : color === 'blue' ? '#eff6ff' : '#f8fafc',
      border: `1px solid ${color === 'red' ? '#fecaca' : color === 'amber' ? '#fde68a' :
        color === 'green' ? '#bbf7d0' : color === 'blue' ? '#bfdbfe' : '#e2e8f0'}`,
      borderRight: `4px solid ${color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' :
        color === 'green' ? '#22c55e' : color === 'blue' ? '#3b82f6' : '#94a3b8'}`,
      borderRadius: '8px', padding: '12px 16px',
      marginBottom: '14px', fontSize: '12px', lineHeight: '1.8',
    }),
    pill: (color: string) => ({
      display: 'inline-block',
      background: color === 'red' ? '#fef2f2' : color === 'green' ? '#f0fdf4' :
        color === 'amber' ? '#fffbeb' : color === 'blue' ? '#eff6ff' : '#f1f5f9',
      color: color === 'red' ? '#dc2626' : color === 'green' ? '#16a34a' :
        color === 'amber' ? '#d97706' : color === 'blue' ? '#2563eb' : '#475569',
      border: `1px solid ${color === 'red' ? '#fca5a5' : color === 'green' ? '#86efac' :
        color === 'amber' ? '#fcd34d' : color === 'blue' ? '#93c5fd' : '#cbd5e1'}`,
      borderRadius: '99px', padding: '2px 10px',
      fontSize: '11px', fontWeight: '700', margin: '2px',
    }),
    note: {
      fontSize: '11px', color: '#64748b', fontStyle: 'italic',
      marginTop: '6px', lineHeight: '1.6',
    },
    pageNum: {
      borderTop: '1px solid #e2e8f0', marginTop: '40px',
      paddingTop: '12px', fontSize: '11px', color: '#94a3b8',
      display: 'flex', justifyContent: 'space-between',
    },
  };

  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const Tr = ({ cells, header }: { cells: string[]; header?: boolean }) => (
    <tr>
      {cells.map((c, i) => (
        <td key={i} style={header ? S.th : i === 0 ? S.td : (i % 2 === 0 ? S.tdAlt : S.td)}
          dangerouslySetInnerHTML={{ __html: c }} />
      ))}
    </tr>
  );

  return (
    <div style={S.page}>

      {/* ══════════════════════════════════════════════════════════════
          COVER PAGE
         ══════════════════════════════════════════════════════════════ */}
      <div style={S.coverPage}>
        <div style={S.logo}>⚡</div>
        <div style={S.coverTitle}>CoachPro</div>
        <div style={S.coverSub}>نظام إدارة التدريب الرياضي الذكي</div>
        <div style={{ fontSize: '22px', fontWeight: '800', color: '#e2e8f0', marginBottom: '32px' }}>
          التوثيق الكامل للقواعد والمعادلات العلمية
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', maxWidth: '480px' }}>
          {['المحرك العلمي التدريبي', 'النظام الغذائي', 'بروتوكول EMS', 'التأهيل الوظيفي',
            'الساعة الذكية', 'قواعد الذكاء الاصطناعي'].map(t => (
            <span key={t} style={S.badge}>{t}</span>
          ))}
        </div>
        <div style={S.coverDate}>
          <div style={{ marginBottom: '6px' }}>إصدار: أبريل 2026</div>
          <div>تاريخ التصدير: {today}</div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569' }}>
            هذا المستند يوضّح كل معادلة وقانون وعتبة قرار يستخدمها النظام تلقائيًا
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — SCIENTIFIC ENGINE
         ══════════════════════════════════════════════════════════════ */}
      <div style={S.sectionBreak}>
        <div style={S.h1}>① المحرك العلمي التدريبي — Scientific Engine</div>
        <div style={S.note}>
          محرك حتمي (Deterministic) بالكامل — بدون Firebase أو Gemini. نفس المدخلات تعطي دائمًا نفس النتيجة.
          يعمل في 10 خطوات متتالية قبل أن تصل أي بيانات للذكاء الاصطناعي.
        </div>

        <div style={S.h2}>الخطوة 0 — مصادر بيانات الجاهزية (بالأولوية)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['المدخل', 'المصدر الأول', 'المصدر الثاني', 'الافتراضي']} header />
            <Tr cells={['الإجهاد النفسي (1-10)', 'استبيان التمرين', '—', '4']} />
            <Tr cells={['ساعات النوم', 'استبيان التمرين', 'الساعة الذكية', '7']} />
            <Tr cells={['الألم الجسدي (1-10)', 'استبيان التمرين', 'Onboarding', '0']} />
            <Tr cells={['الإصابات', 'Onboarding (نص حر)', '—', '—']} />
          </tbody>
        </table>

        <div style={S.h2}>الخطوة 1 — فحص الجاهزية (Readiness Check)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الحالة', 'الشرط', 'عامل الشدة', 'الإجراء']} header />
            <Tr cells={['طبيعي', 'لا شيء يُفعَّل', '×1.00', 'برنامج كامل']} />
            <Tr cells={['تخفيف', 'إجهاد &gt; 6 أو نوم &lt; 6س أو ألم &gt; 4', '×0.85', 'تخفيض 15% من الشدة']} />
            <Tr cells={['تخفيف حاد', 'إجهاد &gt; 8 أو نوم &lt; 5س أو ألم &gt; 6', '×0.70', 'تخفيض 30% من الشدة']} />
            <Tr cells={['راحة كاملة', 'مشغّلان حادّان معًا (≥2)', '×0.50', 'يوم استشفاء — Active Rest']} />
          </tbody>
        </table>

        <div style={S.h2}>الخطوات 2+3 — بطارية الاختبارات</div>
        <div style={S.h3}>6 اختبارات أساسية (Core) — إلزامية لكل هدف</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الاختبار', 'الوحدة', 'الحد الأدنى', 'الحد الأقصى', 'معكوس؟']} header />
            <Tr cells={['تمرين الضغط (دقيقة)', 'تكرار', '0', '50', 'لا']} />
            <Tr cells={['القرفصاء حتى 90° (دقيقة)', 'تكرار', '0', '60', 'لا']} />
            <Tr cells={['البلانك', 'ثانية', '0', '180', 'لا']} />
            <Tr cells={['Crunch تمرين البطن (60 ثانية)', 'تكرار', '0', '50', 'لا']} />
            <Tr cells={['الجلوس والوصول (Sit & Reach)', 'سم', '-10', '25', 'لا']} />
            <Tr cells={['الوقوف على رجل واحدة (عيون مغلقة)', 'ثانية', '0', '60', 'لا']} />
            <Tr cells={['نبض الراحة (Resting HR)', 'bpm', '50', '80', '✓ أقل = أفضل']} />
          </tbody>
        </table>

        <div style={S.h3}>اختبارات إضافية بحسب الهدف (حتى 5 اختبارات)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الهدف', 'الاختبارات الإضافية']} header />
            <Tr cells={['<b>Bulk</b> تضخيم', 'بنش بريس 5RM، سكوات 1RM، ديدلفت 1RM، عقلة max']} />
            <Tr cells={['<b>Loss / Fitness</b>', 'ركض في المكان (دقيقة)، جري 1كم، عقلة max']} />
            <Tr cells={['<b>Shape</b> رشاقة', 'محيط الخصر، % الدهون، قفز عمودي']} />
            <Tr cells={['<b>Rehab</b> تأهيل', 'مدى حركة المفصل، مقياس ألم VAS، قوة قبضة اليد، Y-Balance']} />
          </tbody>
        </table>

        <div style={S.h2}>الخطوة 4 — التقييم والتصنيف</div>
        <div style={S.h3}>معادلات تحويل النتيجة الخام إلى 0-100</div>
        <div style={S.formula}>
          {'// اختبار عادي (أعلى = أفضل):\n'}
          {'Score = ((قيمة_المستخدم - الحد_الأدنى) / (الحد_الأقصى - الحد_الأدنى)) × 100\n\n'}
          {'// اختبار معكوس (أقل = أفضل — نبض الراحة، جري 1كم، خصر، دهون، ألم):\n'}
          {'Score = ((الحد_الأقصى - قيمة_المستخدم) / (الحد_الأقصى - الحد_الأدنى)) × 100\n\n'}
          {'// معادلة Brzycki — تحويل 5RM إلى 1RM:\n'}
          {'1RM = الوزن × (36 / (37 - عدد_التكرارات))\n'}
          {'مثال: 80 كجم × 5 تكرارات → 80 × (36/32) = 90 كجم\n\n'}
          {'// تعديل العمر والجنس على النتيجة النهائية:\n'}
          {'نتيجة_نهائية = min(100, نتيجة_خام ÷ (معامل_عمر × معامل_جنس))'}
        </div>

        <div style={S.h3}>معاملات العمر (Age Modifier)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الفئة العمرية', 'المعامل', 'التأثير على الشدة']} header />
            <Tr cells={['أقل من 18 (شباب)', '×0.85', 'تخفيض 15% — الجهاز الهيكلي لا يزال ينمو']} />
            <Tr cells={['18–34 (ذروة)', '×1.00', 'خط الأساس']} />
            <Tr cells={['35–49 (ماستر)', '×0.92', 'تخفيض 8% — Mild Deload']} />
            <Tr cells={['50 فأكثر (سينيور)', '×0.85', 'تخفيض 15% + تركيز على التكنيك']} />
          </tbody>
        </table>
        <div style={S.note}>معامل الجنس: الإناث ×0.90 على التقييم فقط (تعديل مرجعي، ليس عقوبة).</div>

        <div style={S.h3}>جدول التصنيف</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['النقاط', 'التقييم', 'اللون', 'الإجراء']} header />
            <Tr cells={['91–100', 'ممتاز', 'أخضر', 'Progressive Overload — رفع الحمل']} />
            <Tr cells={['81–90', 'جيد جداً', 'أخضر فاتح', 'استمرار مع زيادة تدريجية']} />
            <Tr cells={['61–80', 'جيد', 'أزرق', 'صيانة + تحسين نقاط الضعف']} />
            <Tr cells={['41–60', 'مقبول', 'أصفر', 'تركيز على نقاط الضعف']} />
            <Tr cells={['0–40', '<b>ضعيف — نقطة ضعف</b>', 'أحمر', 'الأولوية الأولى في البرنامج']} />
          </tbody>
        </table>
      </div>

      {/* الخطوة 5 */}
      <div style={S.sectionBreak}>
        <div style={S.h2}>الخطوة 5 — معادلة الشدة النهائية</div>
        <div style={S.formula}>
          {'الشدة_النهائية (%) = شدة_الأساس × عامل_الجاهزية × معامل_العمر × معامل_الدورة_الشهرية\n\n'}
          {'مثال (متوسط، 38 سنة، جاهزية طبيعية، لا دورة):\n'}
          {'65% × 1.00 × 0.92 × 1.00 = 59.8% ≈ 60% من 1RM'}
        </div>

        <div style={S.h3}>شدة الأساس بالمستوى</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['المستوى', 'الشدة الأساسية', 'المنطق']} header />
            <Tr cells={['مبتدئ', '50% من 1RM', 'تطوير التكنيك، تجنب الإجهاد المبكر']} />
            <Tr cells={['متوسط', '65% من 1RM', 'بناء القوة مع الأمان']} />
            <Tr cells={['متقدم', '85% من 1RM', 'حمل عالٍ، تعب عصبي، تعافٍ كافٍ']} />
          </tbody>
        </table>

        <div style={S.h3}>معامل الدورة الشهرية (للإناث فقط)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['المرحلة', 'الأيام', 'المعامل', 'السبب العلمي']} header />
            <Tr cells={['الحيض (Menstrual)', '1–4', '×0.85', 'البروجستيرون منخفض، الإجهاد مرتفع، خطر الإصابة أعلى']} />
            <Tr cells={['الجريب (Follicular)', '5–12', '×1.00', 'استروجين يرتفع، أفضل استجابة للتدريب']} />
            <Tr cells={['التبويض (Ovulation)', '13–15', '×1.00', 'قمة الطاقة والقوة']} />
            <Tr cells={['الجسم الأصفر (Luteal)', '16–28', '×0.95', 'بروجستيرون مرتفع، تعب خفيف، تخفيف طفيف']} />
          </tbody>
        </table>

        <div style={S.h3}>نطاقات التكرار والـ RPE</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الشدة (%)', 'التكرارات', 'النوع', 'RPE المستهدف', 'RIR']} header />
            <Tr cells={['≥85%', '3-5', 'قوة قصوى', 'RPE 8-9', 'RIR 1-2']} />
            <Tr cells={['≥75%', '5-8', 'قوة', 'RPE 7-8', 'RIR 2-3']} />
            <Tr cells={['≥65%', '8-12', 'تضخيم (Hypertrophy)', 'RPE 7-8', 'RIR 2-3']} />
            <Tr cells={['≥55%', '12-15', 'تحمل عضلي', 'RPE 6-7', 'RIR 3-4']} />
            <Tr cells={['&lt;55%', '15-20', 'تحمل / استشفاء', 'RPE 5-6', 'RIR 4-5']} />
            <Tr cells={['أي', '—', '<b>🚫 محظور تمامًا</b>', 'RPE 10', 'RIR 0']} />
          </tbody>
        </table>

        <div style={S.h3}>التقسيمات التدريبية (Workout Splits)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['المستوى', 'الهدف', 'التقسيم', 'أيام/أسبوع']} header />
            <Tr cells={['مبتدئ', 'الكل', 'Full Body', '3']} />
            <Tr cells={['متوسط', 'خسارة / رشاقة', 'Full Body / Upper-Lower', '4']} />
            <Tr cells={['متوسط', 'باقي الأهداف', 'Upper / Lower Split', '4']} />
            <Tr cells={['متقدم', 'تضخيم (Bulk)', 'PPL — Push/Pull/Legs', '6']} />
            <Tr cells={['متقدم', 'باقي الأهداف', 'PPL — Push/Pull/Legs', '5']} />
          </tbody>
        </table>
      </div>

      {/* الخطوات 6-9 */}
      <div style={S.sectionBreak}>
        <div style={S.h2}>الخطوات 6–9 — محرك التقدم التكيّفي (14 يومًا)</div>
        <div style={S.callout('blue')}>
          <b>المبدأ:</b> كل 14 يومًا يُحلّل النظام سجلات التمرين اليومية ويقرر تلقائيًا رفع الحمل، الإبقاء، أو الـ De-load.
          القرار حتمي (Deterministic) — بدون الذكاء الاصطناعي.
        </div>

        <div style={S.h3}>شروط تشخيص الحالة</div>
        <div style={S.callout('red')}>
          <b>🔴 إجهاد (Fatigued) — يُفعَّل عند تحقق أي شرط واحد:</b><br />
          • نسبة إكمال الجلسات &lt; 50%<br />
          • أيام تخطي كاملة ≥ 4 من أصل 14 يومًا<br />
          • متوسط الطاقة المُبلَّغ عنها ≤ 4 / 10<br />
          • متوسط RPE المُبلَّغ عنه ≥ 9 / 10<br />
          • <b>جلسات HR Strain مرتفع من الساعة الذكية ≥ 2 (جديد)</b>
        </div>
        <div style={S.callout('green')}>
          <b>🟢 تحسّن (Improved) — يُفعَّل عند تحقق كل الشروط معًا:</b><br />
          • نسبة إكمال الجلسات ≥ 80%<br />
          • أيام تخطي ≤ 1<br />
          • متوسط الطاقة ≥ 6 أو غير مسجّل<br />
          • متوسط RPE ≤ 7 أو غير مسجّل
        </div>
        <div style={S.callout('amber')}>
          <b>🟡 محايد (Neutral):</b> أي حالة لا تنطبق عليها الحالتان أعلاه.
        </div>

        <div style={S.h3}>قرارات الحمل والحجم</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الحالة', 'الحمل (Load/1RM)', 'الحجم (Volume)', 'المعادلة']} header />
            <Tr cells={['تحسّن', '+2.5% أسبوعيًا', 'بدون تغيير', 'load_new = load_old × 1.025']} />
            <Tr cells={['إجهاد — De-load', '-10%', '-35%', 'volume_new = volume_old × 0.65']} />
            <Tr cells={['محايد', 'بدون تغيير', 'بدون تغيير', 'يستمر على نفس البرنامج']} />
          </tbody>
        </table>
        <div style={S.note}>دورة إعادة التقييم: كل 14 يومًا ثابتة — مبنية على أدلة التكيّف البيولوجي (ACSM Guidelines).</div>

        <div style={S.h2}>قاعدة مناطق الضعف (Weakness Rule)</div>
        <div style={S.callout('amber')}>
          أي اختبار يسجّل <b>أقل من 40/100</b> يُصنَّف كـ <b>نقطة ضعف رئيسية</b>.
          البرنامج يُبنى لمعالجته أولاً قبل الهدف العام لضمان التوازن الحركي وتفادي الإصابات.
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — NUTRITION
         ══════════════════════════════════════════════════════════════ */}
      <div style={S.sectionBreak}>
        <div style={S.h1}>② النظام الغذائي — Nutrition Engine</div>
        <div style={S.note}>
          السعرات والماكروز تُحسب حتميًا قبل Gemini وتُرسَل إليه كـ "سكك حديدية صلبة" — لا يمكن للذكاء الاصطناعي تجاوزها.
        </div>

        <div style={S.h2}>معادلة BMR — Mifflin-St Jeor</div>
        <div style={S.formula}>
          {'للذكر:   BMR = (10 × الوزن_كجم) + (6.25 × الطول_سم) - (5 × العمر) + 5\n'}
          {'للأنثى:  BMR = (10 × الوزن_كجم) + (6.25 × الطول_سم) - (5 × العمر) - 161\n\n'}
          {'TDEE = BMR × معامل_النشاط\n'}
          {'سعرات_الهدف = TDEE × معامل_الهدف'}
        </div>

        <div style={S.h3}>معاملات النشاط اليومي</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['مستوى النشاط', 'المعامل', 'التعديل التلقائي']} header />
            <Tr cells={['خامل (Sedentary)', '×1.200', '→ ×1.375 إذا ≥4 تمارين/أسبوع']} />
            <Tr cells={['خفيف (Light)', '×1.375', '→ ×1.550 إذا ≥5 تمارين/أسبوع']} />
            <Tr cells={['متوسط (Moderate)', '×1.550', '—']} />
            <Tr cells={['عالٍ (High)', '×1.725', '—']} />
          </tbody>
        </table>

        <div style={S.h3}>معاملات الهدف على السعرات</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الهدف', 'معامل TDEE', 'العجز/الفائض', 'الغاية']} header />
            <Tr cells={['خسارة وزن (Loss)', '×0.80', 'عجز 20%', 'إذابة الدهون']} />
            <Tr cells={['رشاقة (Shape)', '×0.90', 'عجز 10%', 'تحسين التركيب الجسمي']} />
            <Tr cells={['لياقة (Fitness)', '×1.00', 'توازن', 'تحسين الأداء']} />
            <Tr cells={['تأهيل (Rehab)', '×1.00', 'توازن', 'دعم الشفاء']} />
            <Tr cells={['تضخيم (Bulk)', '×1.10', 'فائض 10%', 'بناء العضلات']} />
          </tbody>
        </table>

        <div style={S.h2}>التعديلات التلقائية على السعرات</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الحالة', 'التعديل', 'المنطق']} header />
            <Tr cells={['خسارة — وزن ثابت (&lt;0.3كجم/أسبوع)', '-200 kcal', 'كسر الثبات']} />
            <Tr cells={['خسارة — ينزل سريع (&gt;1% من الوزن/أسبوع)', '+200 kcal', 'حماية العضلات']} />
            <Tr cells={['خسارة — ينزل &gt;1كجم/أسبوع', '+150 kcal', 'تباطؤ الفقد لحماية التمثيل الغذائي']} />
            <Tr cells={['تضخيم — يرتفع سريع (&gt;1%/أسبوع)', '-250 kcal', 'تقليل تراكم الدهون']} />
            <Tr cells={['تضخيم — وزن ثابت (&lt;0.2كجم/أسبوع)', '+200 kcal', 'تحريك عجلة البناء']} />
            <Tr cells={['إجهاد نفسي &gt;7/10', '-100 kcal', 'Cortisol مرتفع = احتباس أو تراكم دهون']} />
            <Tr cells={['<b>الحد الأدنى المطلق</b>', '<b>1200 kcal</b>', 'تجنب تباطؤ التمثيل الغذائي']} />
          </tbody>
        </table>
        <div style={S.note}>التقييم كل 14 يومًا بناءً على آخر 4 قياسات وزن مسجّلة.</div>

        <div style={S.h2}>توزيع الماكروز</div>
        <div style={S.h3}>البروتين (g/kg من وزن الجسم)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الهدف / الفئة', 'البروتين', 'السبب']} header />
            <Tr cells={['خسارة / رشاقة', '2.0 جم/كجم', 'الحفاظ على كتلة العضلات أثناء العجز']} />
            <Tr cells={['لياقة / تأهيل', '1.6 جم/كجم', 'صيانة وإصلاح الأنسجة']} />
            <Tr cells={['تضخيم', '2.2 جم/كجم', 'تعظيم بناء البروتين العضلي (MPS)']} />
            <Tr cells={['حامل', '1.1 جم/كجم', 'احتياجات الجنين']} />
            <Tr cells={['مرضعة', '1.3 جم/كجم', 'تعويض نقل البروتين عبر الحليب']} />
            <Tr cells={['مريض / تأهيل مزمن', '1.2 جم/كجم', 'دعم الشفاء بدون إجهاد الكلى']} />
            <Tr cells={['<b>قصور كلوي (قيد طبي)</b>', '≤0.8 جم/كجم', 'تفادي التدهور الكلوي']} />
          </tbody>
        </table>

        <div style={S.h3}>الدهون (% من السعرات الكلية)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الفئة / الهدف', 'نسبة الدهون', 'الغاية']} header />
            <Tr cells={['قياسي (loss/shape/fitness/rehab)', '25%', 'توازن الهرمونات والأحماض الدهنية']} />
            <Tr cells={['رياضي محترف — خسارة', '22%', 'تحسين نسبة العضل/دهون']} />
            <Tr cells={['رياضي محترف — تضخيم/لياقة', '20%', 'أقصى طاقة للكارب']} />
            <Tr cells={['تضخيم قياسي', '22%', 'دعم هرمون التستوستيرون']} />
            <Tr cells={['حامل / مرضعة', '30%', 'DHA/AA لتطور الدماغ والجهاز العصبي']} />
            <Tr cells={['مريض / مزمن', '28%', 'دهون مضادة للالتهاب (أوميجا 3)']} />
          </tbody>
        </table>

        <div style={S.formula}>
          {'دهون (جرام)  = (السعرات × نسبة_الدهون) ÷ 9\n'}
          {'كارب (جرام)  = (السعرات - بروتين×4 - دهون×9) ÷ 4\n'}
          {'ماء (لترات)  = max(2.0, min(4.0, الوزن × 0.035))'}
        </div>

        <div style={S.h2}>الكارب الدوّار (Carb Cycling)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['نوع اليوم', 'نسبة الكارب', 'متى يُطبَّق']} header />
            <Tr cells={['High Carb Day', '50-60% من السعرات', 'يوم تمرين شديد — Strength / HIIT']} />
            <Tr cells={['Moderate Carb Day', '40-50% من السعرات', 'يوم تمرين متوسط']} />
            <Tr cells={['Low Carb Day', '20-30% من السعرات', 'يوم راحة أو كارديو خفيف']} />
          </tbody>
        </table>
        <div style={S.callout('blue')}>
          <b>قاعدة التوقيت:</b> 70% من الكارب اليومي يُركَّز حول التمرين — قبل ساعتين + بعد التمرين مباشرة.<br />
          <b>يوم Low Carb:</b> البروتين يرتفع تعويضيًا إلى ≥2.0 جم/كجم للحفاظ على كتلة العضلات.
        </div>

        <div style={S.h2}>القيود الطبية الغذائية (إلزامية — لا تُتجاوَز)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الحالة', 'التعديل الإلزامي', 'السبب الطبي']} header />
            <Tr cells={['السكري', 'كارب معقد منخفض GI فقط', 'تفادي ارتفاع سكر الدم المفاجئ']} />
            <Tr cells={['ضغط الدم', 'صوديوم &lt;2300 مجم/يوم', 'تقليل احتباس السوائل والضغط على الأوعية']} />
            <Tr cells={['الكوليسترول', 'تقليل دهون مشبعة + زيادة أوميجا 3', 'تحسين نسبة HDL/LDL']} />
            <Tr cells={['قصور الكلى', 'بروتين ≤0.8 جم/كجم', 'تقليل عبء النيتروجين على الكلى']} />
            <Tr cells={['أمراض الكبد', 'تقليل الدهون الكلية', 'تخفيف عبء الأيض الكبدي']} />
            <Tr cells={['اضطرابات الهضم', 'تجنب بهارات حارة وكافيين', 'تهدئة الالتهاب المعوي']} />
            <Tr cells={['الحمل', 'بروتين 1.1 جم/كجم، دهون 30%، تجنب نيئ', 'سلامة الجنين وتغذية مشيمية مثالية']} />
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — EMS
         ══════════════════════════════════════════════════════════════ */}
      <div style={S.sectionBreak}>
        <div style={S.h1}>③ بروتوكول EMS — الكهرباء العضلية</div>

        <div style={S.h2}>نطاقات التردد (Hz Bands)</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['النطاق', 'التردد (Hz)', 'عرض النبضة (μs)', 'الهدف', 'RPE الموصى به']} header />
            <Tr cells={['Recovery (استشفاء)', '1–20 Hz', '200–400 μs', 'استشفاء / تحفيز ليمفاوي / تحسين الدورة الدموية', '3–5']} />
            <Tr cells={['Endurance (تحمل)', '20–50 Hz', '150–300 μs', 'تحمل عضلي / حرق دهون / ضخ استمرارية أعلى', '5–7']} />
            <Tr cells={['Strength (قوة)', '50–100 Hz', '100–200 μs', 'قوة وتضخيم — تقلص عضلي أقصى', '7–9']} />
          </tbody>
        </table>

        <div style={S.callout('red')}>
          <b>🚫 RPE 10 محظور تمامًا في EMS — لا استثناء مهما كان السبب.</b><br />
          السبب: عند RPE 10 يستنزف EMS الجهاز العصبي المركزي ويزيد خطر تلف الأنسجة والرهاب العضلي (Rhabdomyolysis).
        </div>

        <div style={S.h2}>قواعد السلامة الإلزامية</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['القاعدة', 'القيمة', 'ما يحدث عند المخالفة']} header />
            <Tr cells={['RPE أقصى مسموح', '9 / 10', 'يُحظر توليد الخطة']} />
            <Tr cells={['راحة بين الجلسات', '48 ساعة كحد أدنى', 'يُحظر توليد الخطة']} />
            <Tr cells={['جلسات أقصى أسبوعيًا', '2 جلسات', 'يُحظر عند ≥2، تحذير عند الثانية']} />
            <Tr cells={['تردد EMS مقبول', '1–100 Hz فقط', 'يُحظر خارج هذا النطاق']} />
          </tbody>
        </table>

        <div style={S.h2}>بروتوكول ما قبل الجلسة (6 شروط إلزامية)</div>
        <div style={S.callout('green')}>
          ✅ شرب 500–750 مل ماء قبل الجلسة بساعتين<br />
          ✅ وجبة خفيفة قبل 60–90 دقيقة (لا جلسة على معدة فارغة أو ممتلئة)<br />
          ✅ نوم 6 ساعات على الأقل الليلة الماضية<br />
          ✅ لا يوجد ألم حاد أو إصابة جديدة منذ آخر جلسة<br />
          ✅ لم يتناول كحول أو منشطات قلب خلال 24 ساعة<br />
          ✅ مرّت 48 ساعة على الأقل من آخر جلسة EMS
        </div>

        <div style={S.h2}>بوابة الاستشفاء (Recovery Gate) — من بيانات الساعة</div>
        <div style={S.note}>
          يحسب النظام درجة الاستشفاء من بيانات الساعة الذكية ويوصي بالنطاق الآمن قبل أي جلسة EMS.
        </div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الشرط', 'القرار', 'النطاق الآمن', 'RPE أقصى']} header />
            <Tr cells={['استشفاء &lt;30 أو (نوم &lt;5س + HRV &lt;30ms)', '🚫 إلغاء الجلسة موصى به', 'Recovery فقط', '4']} />
            <Tr cells={['استشفاء &lt;50 أو نوم &lt;6س أو HR Strain مرتفع', 'تخفيف شديد', 'Recovery (1-20Hz)', '5']} />
            <Tr cells={['استشفاء &lt;70 أو نوم &lt;7س', 'تخفيف متوسط', 'Endurance (20-50Hz)', '7']} />
            <Tr cells={['استشفاء ≥70 + نوم ≥7س', 'جلسة كاملة', 'Strength (50-100Hz)', '9']} />
          </tbody>
        </table>
        <div style={S.note}>
          ما يراه العميل: خفيف / متوسط / عالٍ — بدون أرقام Hz أو μs (للكوتش فقط).
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — SAFETY / EXCLUSIONS
         ══════════════════════════════════════════════════════════════ */}
      <div style={S.sectionBreak}>
        <div style={S.h1}>④ قواعد السلامة والاستثناءات الإلزامية</div>
        <div style={S.callout('red')}>
          هذه القيود تُحقن في الـ System Prompt للذكاء الاصطناعي <b>قبل</b> توليد أي برنامج.
          Gemini مُلزَم باتباعها ولا يمكنه تجاوزها مهما كان الطلب.
        </div>

        <div style={S.h2}>إصابات الجهاز الحركي</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['منطقة الإصابة', 'التمارين المحظورة']} header />
            <Tr cells={['ظهر / قطني', 'Deadlifts، سكوات بحمل خلفي ثقيل، Good Mornings، Russian Twists، Anchored Sit-ups']} />
            <Tr cells={['الركبة', 'سكوات عميق (&lt;90°)، Pistol Squat، Box Jumps، Burpees، Plyometrics']} />
            <Tr cells={['الكتف', 'ضغط خلف الرقبة، Upright Rows، Overhead Press الثقيل']} />
          </tbody>
        </table>

        <div style={S.h2}>الحالات الطبية الخاصة</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الحالة', 'التمارين المحظورة', 'الحد الأقصى للشدة']} header />
            <Tr cells={['ضغط الدم', 'وضعية مقلوبة، Isometrics ثقيل، Valsalva maneuver', '60% من 1RM']} />
            <Tr cells={['الحمل (الثلث الأول+)', 'استلقاء على الظهر، Olympic Lifts', '50% من 1RM']} />
            <Tr cells={['الحمل (أسبوع 20+)', 'Crunch / Plank، تمارين ضغط البطن العميقة', '50% من 1RM']} />
            <Tr cells={['السكري', 'تمارين شدة عالية بدون مراقبة', '70% من 1RM']} />
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 5 — WEARABLE
         ══════════════════════════════════════════════════════════════ */}
      <div style={S.sectionBreak}>
        <div style={S.h1}>⑤ الساعة الذكية وأثرها على التدريب</div>

        <div style={S.h2}>أولوية مصادر بيانات الجاهزية</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الأولوية', 'المصدر', 'البيانات المستخدمة']} header />
            <Tr cells={['1 (الأعلى)', 'استبيان التمرين', 'إجهاد + نوم + ألم']} />
            <Tr cells={['2', 'الساعة الذكية', 'ساعات النوم، HRV، درجة الاستشفاء، SpO₂']} />
            <Tr cells={['3', 'Onboarding', 'مستوى الألم المزمن']} />
            <Tr cells={['4 (الافتراضي)', 'قيم محايدة', 'نوم: 7س، إجهاد: 4/10']} />
          </tbody>
        </table>

        <div style={S.h2}>المزوّدون المدعومون</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['المزوّد', 'طريقة المزامنة', 'البيانات المتاحة']} header />
            <Tr cells={['إدخال يدوي', 'دائمًا متاح', 'كل الحقول']} />
            <Tr cells={['استيراد JSON', 'دائمًا متاح', 'Garmin / Oura / WHOOP / Fitbit / Samsung / Polar / Suunto / Zepp / COROS / Withings / Huawei']} />
            <Tr cells={['Web Bluetooth GATT', 'Chrome فقط', 'نبض مباشر (Polar, Wahoo, Garmin strap)']} />
            <Tr cells={['Health Connect', 'Android أصلي (مخطط)', 'كل البيانات الصحية']} />
            <Tr cells={['Apple HealthKit', 'iOS أصلي (مخطط)', 'كل البيانات الصحية']} />
          </tbody>
        </table>

        <div style={S.h2}>اشتقاق درجة الاستشفاء محليًا</div>
        <div style={S.formula}>
          {'// عند غياب درجة الاستشفاء من المزوّد، يحسبها النظام محليًا:\n\n'}
          {'مكوّن النوم (0-40 نقطة):     (ساعات_النوم / 8) × 40\n'}
          {'مكوّن HRV    (0-35 نقطة):    (hrv_ms / 80)     × 35   — 80ms = ممتاز\n'}
          {'مكوّن نبض الراحة (0-25 نقطة): ((80 - bpm) / 30) × 25   — 50bpm = ممتاز\n\n'}
          {'المجموع = ما يصل إلى 100 (يحتاج ≥ 2 مكوّنات لتكون النتيجة صالحة)'}
        </div>

        <div style={S.h2}>تأثير بيانات الساعة على محرك التقدم</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['الإشارة', 'العتبة', 'الإجراء التلقائي']} header />
            <Tr cells={['HR Strain مرتفع', '≥2 جلسات في 14 يومًا', 'De-load تلقائي (-10% حمل، -35% حجم)']} />
            <Tr cells={['HRV', '&lt;35ms', 'توصية تخفيف الشدة اليومية']} />
            <Tr cells={['SpO₂', '&lt;92%', 'تحذير طبي — عدم التمرين']} />
            <Tr cells={['درجة استشفاء', '&lt;50', 'جلسة EMS استشفائية فقط']} />
            <Tr cells={['درجة استشفاء', '&lt;30 + نوم &lt;5س', 'إلغاء جلسة EMS موصى به']} />
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 6 — AI RULES
         ══════════════════════════════════════════════════════════════ */}
      <div style={S.sectionBreak}>
        <div style={S.h1}>⑥ قواعد الذكاء الاصطناعي (CORE AI RULES)</div>
        <div style={S.note}>
          هذه القواعد تُحقن في كل استدعاء لـ Gemini. النظام يُولّد البيانات الحتمية أولاً ثم يُقيّد الذكاء الاصطناعي بها.
        </div>

        <div style={S.h2}>المبادئ الأساسية</div>
        <div style={S.callout('blue')}>
          1. لا يُخترع أي رقم — كل قرار يستند إلى البيانات المحسوبة مسبقًا بالمحرك العلمي<br />
          2. لا يخرج عن القواعد مهما كان الطلب من الكوتش أو العميل<br />
          3. لو نقصت بيانات → يطلب المعلومة بدلاً من التخمين<br />
          4. اللغة: عربي أساسًا (الإنجليزي فقط للأسماء العلمية للتمارين)<br />
          5. لا Markdown tables — يستخدم سطور وعلامات شرطة<br />
          6. كل خطة تنتهي بـ ✅ للتحقق
        </div>

        <div style={S.h2}>البيانات الحتمية المُرسَلة لـ Gemini مسبقًا</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['البيانات', 'المصدر الحتمي', 'دور Gemini']} header />
            <Tr cells={['% الشدة من 1RM', 'Scientific Engine (Step 5)', 'لا يمكن تجاوزه']} />
            <Tr cells={['نطاق التكرارات + RPE + RIR', 'Scientific Engine', 'لا يمكن تجاوزه']} />
            <Tr cells={['التقسيم التدريبي + عدد الأيام', 'Scientific Engine (Step 5)', 'لا يمكن تجاوزه']} />
            <Tr cells={['نقاط الضعف (Weakness Rule)', 'Scoring Engine (Step 4)', 'يبني عليها التمارين']} />
            <Tr cells={['التقدم/De-load', '14-Day Progression (Step 7-9)', 'لا يمكن تجاوزه']} />
            <Tr cells={['السعرات + ماكروز', 'Mifflin-St Jeor + Macro Calculator', 'لا يمكن تجاوزه']} />
            <Tr cells={['قيود EMS (RPE، Hz، 48س)', 'EMS Protocol', 'لا يمكن تجاوزه']} />
            <Tr cells={['تمارين محظورة', 'Injury / Medical Exclusions', 'لا يمكن تجاوزه']} />
          </tbody>
        </table>

        <div style={S.h2}>تمارين كل جلسة بحسب المدة</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['مدة الجلسة', 'عدد التمارين']} header />
            <Tr cells={['45 دقيقة', '5–6 تمارين']} />
            <Tr cells={['60 دقيقة', '7–8 تمارين']} />
            <Tr cells={['90 دقيقة', '10–12 تمرين']} />
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SUMMARY — ALL FORMULAS
         ══════════════════════════════════════════════════════════════ */}
      <div style={S.sectionBreak}>
        <div style={S.h1}>⑦ ملخص كل المعادلات الرياضية</div>
        <div style={S.formula}>
          {'/* ─── التدريب ─── */\n'}
          {'Brzycki 1RM      = الوزن × (36 / (37 - التكرارات))\n'}
          {'Max HR (Tanaka)  = 208 - (0.7 × العمر)\n'}
          {'Score (عادي)     = ((قيمة - min) / (max - min)) × 100\n'}
          {'Score (معكوس)    = ((max - قيمة) / (max - min)) × 100\n'}
          {'Score (نهائي)    = min(100, Score_خام ÷ (معامل_عمر × معامل_جنس))\n\n'}
          {'الشدة_النهائية   = شدة_الأساس × جاهزية × معامل_عمر × معامل_دورة\n\n'}
          {'/* ─── التقدم ─── */\n'}
          {'تحسّن:   حمل_جديد = حمل_قديم × 1.025\n'}
          {'De-load: حمل_جديد = حمل_قديم × 0.90, حجم_جديد = حجم_قديم × 0.65\n\n'}
          {'/* ─── التغذية ─── */\n'}
          {'BMR (ذكر)   = 10W + 6.25H - 5A + 5\n'}
          {'BMR (أنثى)  = 10W + 6.25H - 5A - 161\n'}
          {'TDEE        = BMR × معامل_النشاط\n'}
          {'سعرات_هدف  = TDEE × معامل_الهدف (0.80 → 1.10)\n'}
          {'بروتين (جم) = الوزن_كجم × g/kg_بحسب_الهدف\n'}
          {'دهون (جم)   = (سعرات × %دهون) ÷ 9\n'}
          {'كارب (جم)   = (سعرات - بروتين×4 - دهون×9) ÷ 4\n'}
          {'ماء (لتر)   = max(2.0, min(4.0, الوزن × 0.035))\n\n'}
          {'/* ─── الاستشفاء / الساعة ─── */\n'}
          {'Recovery Score = (نوم/8 × 40) + (HRV/80 × 35) + ((80-نبض_راحة)/30 × 25)\n'}
          {'       [يحتاج ≥ 2 مكوّنات — حد أقصى 100 نقطة]'}
        </div>

        <div style={S.h2}>جدول العتبات السريع</div>
        <table style={S.table}>
          <tbody>
            <Tr cells={['المتغيّر', 'عتبة التحذير', 'عتبة الخطر / الحظر']} header />
            <Tr cells={['الإجهاد النفسي', '&gt;6/10 → تخفيض 15%', '&gt;8/10 → تخفيض 30%']} />
            <Tr cells={['ساعات النوم', '&lt;6س → تخفيض 15%', '&lt;5س → تخفيض 30%']} />
            <Tr cells={['الألم الجسدي', '&gt;4/10 → تخفيض 15%', '&gt;6/10 → تخفيض 30%']} />
            <Tr cells={['RPE في EMS', '9/10 → تحذير', '10/10 → محظور تمامًا']} />
            <Tr cells={['HRV', '&lt;40ms → توصية تخفيف', '&lt;35ms → إشارة إجهاد']} />
            <Tr cells={['SpO₂', '&lt;95% → تحذير', '&lt;92% → إيقاف التمرين']} />
            <Tr cells={['درجة استشفاء EMS', '&lt;70 → تخفيف', '&lt;30 → إلغاء الجلسة']} />
            <Tr cells={['السعرات الدنيا', '—', '1200 kcal (مطلق)']} />
          </tbody>
        </table>

        <div style={S.pageNum}>
          <span>CoachPro — التوثيق العلمي الكامل</span>
          <span>إصدار أبريل 2026 · {today}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* EXPORT BUTTON COMPONENT                                                 */
/* ─────────────────────────────────────────────────────────────────────── */

interface Props {
  /** Optional CSS class for the trigger button */
  className?: string;
}

export default function SystemDocumentationPDF({ className }: Props) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'fonts' | 'render' | 'pdf'>('idle');

  const statusLabel: Record<typeof state, string> = {
    idle: 'تحميل PDF الكامل',
    fonts: 'تحميل الخطوط...',
    render: 'رسم المستند...',
    pdf: 'إنشاء PDF...',
  };

  const handleExport = async () => {
    const element = templateRef.current;
    if (!element || state !== 'idle') return;

    try {
      setState('fonts');

      // Lazy-load heavy libraries only when user clicks
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
        // Inject Cairo font (same as the plan PDF export)
        (async () => {
          if (!document.getElementById('cairo-pdf-weights')) {
            const link = document.createElement('link');
            link.id = 'cairo-pdf-weights';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap';
            document.head.appendChild(link);
          }
        })(),
      ]);
      const html2canvas = html2canvasMod.default;

      // Wait for Cairo glyphs to be fully shaped before rasterizing
      try {
        const fontsApi = (document as any).fonts;
        if (fontsApi?.ready) await fontsApi.ready;
        if (fontsApi?.load) {
          await Promise.all([
            fontsApi.load('400 14px Cairo'),
            fontsApi.load('700 16px Cairo'),
            fontsApi.load('900 24px Cairo'),
          ]);
        }
      } catch { /* font pre-loading is optional */ }

      // Make the hidden template temporarily visible for html2canvas
      const prev = element.style.cssText;
      element.style.cssText = 'position:fixed;top:0;left:0;width:794px;z-index:-9999;opacity:0;pointer-events:none;';
      document.body.appendChild(element);

      setState('render');
      await new Promise(r => setTimeout(r, 200)); // allow paint

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
      });

      // Restore element
      element.style.cssText = prev;

      setState('pdf');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();   // 210mm
      const pageH = pdf.internal.pageSize.getHeight();  // 297mm
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.93);

      let heightLeft = imgH;
      let pos = 0;
      pdf.addImage(imgData, 'JPEG', 0, pos, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        pos = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, pos, imgW, imgH);
        heightLeft -= pageH;
      }

      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`CoachPro_SystemRules_${date}.pdf`);
    } catch (err) {
      console.error('[SystemDocPDF] export failed:', err);
    } finally {
      setState('idle');
    }
  };

  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        onClick={handleExport}
        disabled={state !== 'idle'}
        className={className ?? [
          'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl',
          'bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
          'text-white text-sm font-bold transition shadow-lg shadow-blue-500/20',
        ].join(' ')}
      >
        {state !== 'idle'
          ? <Loader2 size={16} className="animate-spin" />
          : <Download size={16} />
        }
        {statusLabel[state]}
      </button>

      {/* ── Hidden PDF template (off-screen, rendered only during export) ── */}
      <div
        ref={templateRef}
        style={{
          position: 'absolute',
          top: '-99999px',
          left: 0,
          width: '794px',
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <DocTemplate />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* QUICK ACCESS CARD (can be dropped anywhere)                             */
/* ─────────────────────────────────────────────────────────────────────── */
export function SystemDocCard() {
  return (
    <div className="rounded-[2rem] bg-slate-900 border border-white/5 p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
          <FileText size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white leading-tight mb-1">
            توثيق القواعد والمعادلات العلمية
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
            ملف PDF كامل يضم كل معادلة وقانون وعتبة قرار يستخدمها النظام — التدريب، التغذية، EMS، التأهيل، والساعة الذكية.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {['المحرك العلمي التدريبي', 'النظام الغذائي', 'بروتوكول EMS', 'التأهيل', 'الساعة الذكية', 'قواعد الذكاء الاصطناعي'].map(t => (
              <span key={t} className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-400/20">
                {t}
              </span>
            ))}
          </div>
          <SystemDocumentationPDF />
        </div>
      </div>
    </div>
  );
}
