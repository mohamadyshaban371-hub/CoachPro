import React from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowUpRight, BadgeDollarSign, CalendarClock, ChartColumnBig, CreditCard, Loader2, Users, Wallet, Sparkles, TrendingUp, UserPlus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line, BarChart, Bar } from 'recharts';
import { useCoachDashboard } from '../hooks/useCoachDashboard';
import { ClientMembership, Membership, UserProfile } from '../types';
import { formatCoachCurrency } from '../lib/coachDashboard';

interface CoachDashboardAnalyticsProps {
  clients: UserProfile[];
  clientMemberships: ClientMembership[];
  memberships: Membership[];
  loading: boolean;
  error: string | null;
}

export default function CoachDashboardAnalytics({ clients, clientMemberships, memberships, loading, error }: CoachDashboardAnalyticsProps) {
  const { analytics } = useCoachDashboard({ clients, clientMemberships, memberships, loading, error });

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-8 text-center text-rose-300">
        <p className="font-semibold">تعذر تحميل لوحة القيادة</p>
        <p className="mt-2 text-sm text-rose-200">{error}</p>
      </div>
    );
  }

  if (!analytics) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="إجمالي العملاء" value={analytics.stats.totalClients.toString()} icon={<Users size={16} />} accent="from-blue-500/20 to-blue-600/10" />
        <StatCard title="العضويات النشطة" value={analytics.stats.activeMemberships.toString()} icon={<CreditCard size={16} />} accent="from-emerald-500/20 to-emerald-600/10" />
        <StatCard title="العضويات المنتهية" value={analytics.stats.expiredMemberships.toString()} icon={<CalendarClock size={16} />} accent="from-amber-500/20 to-amber-600/10" />
        <StatCard title="الإيراد الشهري" value={formatCoachCurrency(analytics.stats.monthlyRevenue)} icon={<Wallet size={16} />} accent="from-violet-500/20 to-violet-600/10" />
        <StatCard title="عملاء الجدد هذا الشهر" value={analytics.stats.newClientsThisMonth.toString()} icon={<UserPlus size={16} />} accent="from-pink-500/20 to-pink-600/10" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">نمو العضويات والعملاء</p>
              <p className="text-xs text-slate-400">اتجاه التسجيلات والنمو خلال الأشهر الأخيرة</p>
            </div>
            <div className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">Live</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.growthChart}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Area type="monotone" dataKey="clients" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.2} />
                <Area type="monotone" dataKey="memberships" stroke="#34d399" fill="#34d399" fillOpacity={0.16} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">الإيرادات</p>
              <p className="text-xs text-slate-400">تحليل التدفق الشهري</p>
            </div>
            <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">+12%</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.revenueChart}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">التقدم المتوسط بالوزن</p>
              <p className="text-xs text-slate-400">متوسط التغيّر بين أول وآخر قياس</p>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${analytics.averageWeightProgress <= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
              {analytics.averageWeightProgress > 0 ? '+' : ''}{analytics.averageWeightProgress} كجم
            </div>
          </div>
          <div className="flex items-end gap-3 rounded-2xl bg-slate-950/70 p-4">
            <div className="flex-1 rounded-2xl bg-blue-500/15 p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-400">العملاء المسجلين</p>
              <p className="mt-2 text-2xl font-black text-white">{analytics.registrations}</p>
            </div>
            <div className="flex-1 rounded-2xl bg-emerald-500/15 p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-400">الوزن المجموع</p>
              <p className="mt-2 text-2xl font-black text-white">{analytics.averageWeightProgress} كجم</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">إجراءات سريعة</p>
              <p className="text-xs text-slate-400">أدوات تجارية سريعة</p>
            </div>
            <Sparkles size={16} className="text-blue-400" />
          </div>
          <div className="space-y-2">
            {[
              { label: 'إضافة عميل', hint: 'إنشاء ملف جديد' },
              { label: 'تجديد العضوية', hint: 'تحديث الاشتراكات' },
              { label: 'تحديث التقدم', hint: 'متابعة النتائج' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.hint}</p>
                </div>
                <ArrowUpRight size={16} className="text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">النشاط الأخير</p>
              <p className="text-xs text-slate-400">آخر تغييرات السجل</p>
            </div>
            <Activity size={16} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            {analytics.recentActivity.map((item) => (
              <div key={item.id} className="flex items-start justify-between rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-sm text-slate-400">{item.description}</p>
                </div>
                <span className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleDateString('ar-EG')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">العضويات القريبة من الانتهاء</p>
              <p className="text-xs text-slate-400">تنبيه تجديد مبكر</p>
            </div>
            <BadgeDollarSign size={16} className="text-amber-400" />
          </div>
          {analytics.expiringMemberships.length ? (
            <div className="space-y-3">
              {analytics.expiringMemberships.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{item.clientName}</p>
                      <p className="text-sm text-slate-400">{item.planName}</p>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">{item.daysLeft} يوم</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">المتبقي: {formatCoachCurrency(item.amountRemaining)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">لا توجد عضويات تحتاج متابعة حالياً.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, accent }: { title: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className={`rounded-[2rem] border border-white/10 bg-gradient-to-br ${accent} p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/60 p-2 text-slate-200">{icon}</div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[2rem] border border-white/10 bg-slate-900/60" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="h-72 animate-pulse rounded-[2rem] border border-white/10 bg-slate-900/60" />
        <div className="h-72 animate-pulse rounded-[2rem] border border-white/10 bg-slate-900/60" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[2rem] border border-dashed border-white/10 bg-slate-900/40 p-10 text-center text-slate-400">
      <p className="font-semibold text-white">لا توجد بيانات لعرضها بعد</p>
      <p className="mt-2 text-sm">ابدأ بإضافة عملاء أو عضويات لبدء لوحة القيادة.</p>
    </div>
  );
}
