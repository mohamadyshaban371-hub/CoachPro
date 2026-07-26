import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Dumbbell,
  Clock,
  CreditCard,
  Users,
  Zap,
  Utensils,
  Heart,
  Activity,
  CalendarDays,
  AlertTriangle,
  DollarSign,
  ReceiptText,
  Snowflake,
  RotateCcw,
  BadgeCheck,
} from 'lucide-react';
import { playClick, playSuccess, playError } from '../lib/sounds';
import { Membership, ClientMembership, UserProfile, PaymentMethod, PaymentStatus } from '../types';
import { useMemberships } from '../hooks/useMemberships';

interface Props {
  clients?: UserProfile[];
}

interface PaymentFormState {
  [membershipId: string]: {
    amountPaid: string;
    discount: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentDate: string;
    note: string;
  };
}

export default function MembershipManager({ clients = [] }: Props) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({
    clientId: '',
    membershipId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    status: 'active' as ClientMembership['status'],
    notes: '',
    amountPaid: '0',
    discount: '0',
    paymentMethod: 'cash' as PaymentMethod,
    paymentStatus: 'paid' as PaymentStatus,
    paymentDate: new Date().toISOString().slice(0, 10),
  });
  const [paymentForms, setPaymentForms] = useState<PaymentFormState>({});

  const {
    clientMemberships,
    summaries,
    createClientMembership,
    updateClientMembership,
    deleteClientMembership,
    recordPayment,
    renewMembership,
    freezeMembership,
    resumeMembership,
  } = useMemberships({ setLoading, setMessage });

  const emptyForm: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '',
    description: '',
    price: 0,
    durationType: 'monthly',
    durationValue: 1,
    durationDays: 30,
    totalSessions: 8,
    serviceType: 'all',
    isActive: true,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const q = query(collection(db, 'memberships'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!assignForm.membershipId || !assignForm.startDate) return;
    const selected = memberships.find((m) => m.id === assignForm.membershipId);
    if (!selected) return;
    const days = selected.durationDays || (selected.durationType === 'quarterly' ? 90 : selected.durationType === 'monthly' ? 30 : 30);
    const suggestedEnd = new Date(assignForm.startDate);
    suggestedEnd.setDate(suggestedEnd.getDate() + days);
    const suggestedValue = suggestedEnd.toISOString().slice(0, 10);
    setAssignForm((prev) => (prev.endDate ? prev : { ...prev, endDate: suggestedValue }));
  }, [assignForm.membershipId, assignForm.startDate, memberships]);

  useEffect(() => {
    const nextState = clientMemberships.reduce<PaymentFormState>((acc, entry) => {
      acc[entry.id] = {
        amountPaid: String(entry.amountPaid ?? 0),
        discount: String(entry.discount ?? 0),
        paymentMethod: entry.paymentMethod ?? 'cash',
        paymentStatus: entry.paymentStatus ?? 'paid',
        paymentDate: entry.paymentDate ?? new Date().toISOString().slice(0, 10),
        note: '',
      };
      return acc;
    }, {});
    setPaymentForms((prev) => ({ ...prev, ...nextState }));
  }, [clientMemberships]);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (m: Membership) => {
    setForm({
      name: m.name,
      description: m.description,
      price: m.price,
      durationType: m.durationType,
      durationValue: m.durationValue,
      durationDays: m.durationDays ?? 30,
      totalSessions: m.totalSessions,
      serviceType: m.serviceType || 'all',
      isActive: m.isActive,
    });
    setEditingId(m.id);
    setShowForm(true);
  };

  const SERVICE_TYPES: { key: Membership['serviceType']; label: string }[] = [
    { key: 'ems', label: 'EMS' },
    { key: 'workout', label: 'تدريب' },
    { key: 'nutrition', label: 'تغذية' },
    { key: 'rehab', label: 'تأهيل' },
    { key: 'all', label: 'شامل' },
  ];

  const serviceLabel = (type: Membership['serviceType']) => SERVICE_TYPES.find((s) => s.key === type)?.label || type;
  const durationLabel = (m: Membership) => {
    if (m.durationType === 'package') return `${m.totalSessions} جلسة`;
    if (m.durationType === 'quarterly') return '3 أشهر';
    return `${m.durationValue} شهر`;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      playError();
      alert('يرجى إدخال اسم العضوية');
      return;
    }
    if (form.price <= 0) {
      playError();
      alert('يرجى إدخال سعر صحيح');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editingId) {
        await updateDoc(doc(db, 'memberships', editingId), {
          ...form,
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, 'memberships'), {
          ...form,
          createdAt: now,
          updatedAt: now,
        });
      }
      playSuccess();
      setShowForm(false);
    } catch (err: any) {
      alert('خطأ في الحفظ: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف عضوية "${name}"؟`)) return;
    await deleteDoc(doc(db, 'memberships', id)).catch((e) => alert('خطأ في الحذف: ' + e.message));
  };

  const resolveClientName = (clientId: string) => clients.find((client) => client.uid === clientId)?.name || 'عميل غير محدد';

  const handleAssignMembership = async () => {
    if (!assignForm.clientId || !assignForm.membershipId) {
      alert('يرجى اختيار العميل والعضوية');
      return;
    }
    const selectedPlan = memberships.find((p) => p.id === assignForm.membershipId);
    if (!selectedPlan) return;

    setAssigning(true);
    try {
      const startDate = new Date(assignForm.startDate);
      const endDate = new Date(assignForm.endDate);
      const today = new Date();
      const derivedStatus = assignForm.status === 'frozen' ? 'frozen' : endDate < today ? 'expired' : 'active';
      const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86400000));
      const amountPaid = Number(assignForm.amountPaid || 0);
      const discount = Number(assignForm.discount || 0);

      await createClientMembership({
        clientId: assignForm.clientId,
        membershipId: selectedPlan.id,
        membershipName: selectedPlan.name,
        membershipPlanId: selectedPlan.id,
        membershipPrice: selectedPlan.price,
        totalPrice: selectedPlan.price,
        amountPaid,
        amountRemaining: Math.max(0, selectedPlan.price - amountPaid - discount),
        totalSessions: selectedPlan.totalSessions,
        sessionsUsed: 0,
        sessionsRemaining: selectedPlan.totalSessions,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        durationDays: selectedPlan.durationDays || 30,
        remainingDays,
        status: derivedStatus,
        discount,
        paymentMethod: assignForm.paymentMethod,
        paymentDate: assignForm.paymentDate,
        paymentStatus: assignForm.paymentStatus,
        paymentInstallments: [],
        notes: assignForm.notes.trim(),
      });

      setAssignForm({
        clientId: '',
        membershipId: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        status: 'active',
        notes: '',
        amountPaid: '0',
        discount: '0',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      playSuccess();
    } catch (err: any) {
      alert('خطأ في حفظ الاشتراك: ' + (err.message || String(err)));
    } finally {
      setAssigning(false);
    }
  };

  const handleSavePayment = async (membership: ClientMembership) => {
    const form = paymentForms[membership.id];
    if (!form) return;
    await recordPayment(membership.id, {
      amountPaid: Number(form.amountPaid || 0),
      discount: Number(form.discount || 0),
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentStatus,
      paymentDate: form.paymentDate,
      note: form.note,
    });
    playSuccess();
  };

  const handleRenew = async (membership: ClientMembership) => {
    await renewMembership(membership.id, {
      paymentAmount: membership.amountPaid ?? 0,
      paymentMethod: membership.paymentMethod ?? 'cash',
      paymentStatus: membership.paymentStatus ?? 'paid',
      paymentDate: new Date().toISOString().slice(0, 10),
      note: 'تجديد تلقائي من لوحة الإدارة',
    });
    playSuccess();
  };

  const handleToggleFreeze = async (membership: ClientMembership) => {
    if (membership.status === 'frozen') {
      await resumeMembership(membership.id, 'استئناف الاشتراك من لوحة الإدارة');
    } else {
      await freezeMembership(membership.id, 'تجميد الاشتراك من لوحة الإدارة');
    }
    playSuccess();
  };

  const expiringSoon = useMemo(() => clientMemberships.filter((m) => ['expiring_7_days', 'expiring_3_days', 'expires_today'].includes(m.status)), [clientMemberships]);
  const expired = useMemo(() => clientMemberships.filter((m) => m.status === 'expired'), [clientMemberships]);
  const frozen = useMemo(() => clientMemberships.filter((m) => m.status === 'frozen'), [clientMemberships]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">إدارة العضويات</h2>
          <p className="text-slate-400 text-sm mt-1">الخطط والاشتراكات والمالية والحالة</p>
        </div>
        <button
          onClick={() => {
            playClick();
            openNew();
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold transition-colors"
        >
          <Plus size={18} />
          عضوية جديدة
        </button>
      </div>

      {message && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${message.type === 'success' ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-red-900/30 border-red-700 text-red-300'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/70 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">إجمالي الخطط</p>
          <p className="text-2xl font-bold text-white">{memberships.length}</p>
        </div>
        <div className="bg-slate-800/70 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">اشتراكات نشطة</p>
          <p className="text-2xl font-bold text-emerald-400">{summaries.active}</p>
        </div>
        <div className="bg-slate-800/70 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">منتهية</p>
          <p className="text-2xl font-bold text-red-400">{summaries.expired}</p>
        </div>
        <div className="bg-slate-800/70 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">تنتهي قريبًا</p>
          <p className="text-2xl font-bold text-amber-400">{summaries.expiringSoon}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-slate-900/70 rounded-[2rem] border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-blue-400" />
            <h3 className="text-lg font-bold text-white">خطط العضويات</h3>
          </div>
          {loading ? (
            <div className="text-center py-8 text-slate-400">جاري التحميل...</div>
          ) : memberships.length === 0 ? (
            <div className="text-center py-10 text-slate-500">لا توجد خطط حتى الآن</div>
          ) : (
            <div className="space-y-3">
              {memberships.map((m) => (
                <div key={m.id} className={`rounded-2xl border p-4 ${m.isActive ? 'border-slate-700 bg-slate-800/70' : 'border-slate-700/50 bg-slate-800/40 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-white">{m.name}</h4>
                        {!m.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">معطل</span>}
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2">{m.description || 'لا يوجد وصف'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { playClick(); openEdit(m); }} className="p-2 rounded-xl bg-slate-700 hover:bg-blue-700 text-slate-300">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => { playClick(); handleDelete(m.id, m.name); }} className="p-2 rounded-xl bg-slate-700 hover:bg-red-700 text-slate-300">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-blue-500/15 text-blue-300">{m.price.toLocaleString()} ج.م</span>
                    <span className="px-2 py-1 rounded-full bg-violet-500/15 text-violet-300">{m.durationDays ? `${m.durationDays} يوم` : durationLabel(m)}</span>
                    <span className="px-2 py-1 rounded-full bg-slate-700 text-slate-300">{serviceLabel(m.serviceType || 'all')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-slate-900/70 rounded-[2rem] border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-violet-400" />
            <h3 className="text-lg font-bold text-white">إسناد اشتراك عميل</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">العميل</label>
              <select
                value={assignForm.clientId}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, clientId: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
              >
                <option value="">اختر عميل</option>
                {clients.map((client) => (
                  <option key={client.uid} value={client.uid}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">الخطة</label>
              <select
                value={assignForm.membershipId}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, membershipId: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
              >
                <option value="">اختر خطة</option>
                {memberships.filter((m) => m.isActive).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">تاريخ البداية</label>
                <input type="date" value={assignForm.startDate} onChange={(e) => setAssignForm((prev) => ({ ...prev, startDate: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">تاريخ النهاية</label>
                <input type="date" value={assignForm.endDate} onChange={(e) => setAssignForm((prev) => ({ ...prev, endDate: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">الدفعة الأولية</label>
                <input type="number" value={assignForm.amountPaid} onChange={(e) => setAssignForm((prev) => ({ ...prev, amountPaid: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">الخصم</label>
                <input type="number" value={assignForm.discount} onChange={(e) => setAssignForm((prev) => ({ ...prev, discount: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">طريقة الدفع</label>
                <select value={assignForm.paymentMethod} onChange={(e) => setAssignForm((prev) => ({ ...prev, paymentMethod: e.target.value as PaymentMethod }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                  <option value="cash">نقدي</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="card">بطاقة</option>
                  <option value="online">أونلاين</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">حالة الدفع</label>
                <select value={assignForm.paymentStatus} onChange={(e) => setAssignForm((prev) => ({ ...prev, paymentStatus: e.target.value as PaymentStatus }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                  <option value="paid">مدفوع</option>
                  <option value="partial">جزئي</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="overdue">متأخر</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">تاريخ الدفع</label>
              <input type="date" value={assignForm.paymentDate} onChange={(e) => setAssignForm((prev) => ({ ...prev, paymentDate: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">الحالة</label>
              <select value={assignForm.status} onChange={(e) => setAssignForm((prev) => ({ ...prev, status: e.target.value as ClientMembership['status'] }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                <option value="active">نشط</option>
                <option value="expired">منتهي</option>
                <option value="frozen">مجمّد</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">ملاحظات</label>
              <textarea value={assignForm.notes} onChange={(e) => setAssignForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white" placeholder="مثال: دفعة أولى أو ملاحظات إدارية" />
            </div>
            <button onClick={handleAssignMembership} disabled={assigning} className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-colors">
              {assigning ? 'جاري الحفظ...' : 'حفظ الاشتراك'}
            </button>
          </div>
        </section>
      </div>

      <section className="bg-slate-900/70 rounded-[2rem] border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={18} className="text-emerald-400" />
          <h3 className="text-lg font-bold text-white">اشتراكات العملاء والتقارير المالية</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
            <p className="text-slate-400 text-xs">نشط</p>
            <p className="text-xl font-bold text-emerald-400">{summaries.active}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
            <p className="text-slate-400 text-xs">منتهي</p>
            <p className="text-xl font-bold text-red-400">{expired.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
            <p className="text-slate-400 text-xs">مجمّد</p>
            <p className="text-xl font-bold text-amber-400">{frozen.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
            <p className="text-slate-400 text-xs">تنتهي قريبًا</p>
            <p className="text-xl font-bold text-amber-400">{summaries.expiringSoon}</p>
          </div>
        </div>
        <div className="space-y-3">
          {clientMemberships.length === 0 ? (
            <div className="text-center py-8 text-slate-500">لا توجد اشتراكات حتى الآن</div>
          ) : clientMemberships.map((entry) => {
            const balance = Math.max(0, ((entry.membershipPrice ?? entry.totalPrice ?? 0) - (entry.amountPaid ?? 0) - (entry.discount ?? 0)));
            const form = paymentForms[entry.id] || {
              amountPaid: String(entry.amountPaid ?? 0),
              discount: String(entry.discount ?? 0),
              paymentMethod: entry.paymentMethod ?? 'cash',
              paymentStatus: entry.paymentStatus ?? 'paid',
              paymentDate: entry.paymentDate ?? new Date().toISOString().slice(0, 10),
              note: '',
            };
            return (
              <div key={entry.id} className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{resolveClientName(entry.clientId)}</p>
                    <p className="text-sm text-slate-400">{entry.membershipName}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${entry.status === 'active' || entry.status === 'expiring_7_days' || entry.status === 'expiring_3_days' || entry.status === 'expires_today' ? 'bg-emerald-500/20 text-emerald-300' : entry.status === 'frozen' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                      {entry.status === 'active' ? 'نشط' : entry.status === 'frozen' ? 'مجمّد' : entry.status === 'expiring_7_days' ? 'تنتهي خلال 7 أيام' : entry.status === 'expiring_3_days' ? 'تنتهي خلال 3 أيام' : entry.status === 'expires_today' ? 'تنتهي اليوم' : 'منتهي'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300">{entry.remainingDays ?? 0} يوم متبقي</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm text-slate-300">
                  <div className="rounded-xl bg-slate-900/60 p-3"><span className="text-slate-400 block text-[11px]">بداية</span>{entry.startDate}</div>
                  <div className="rounded-xl bg-slate-900/60 p-3"><span className="text-slate-400 block text-[11px]">نهاية</span>{entry.endDate}</div>
                  <div className="rounded-xl bg-slate-900/60 p-3"><span className="text-slate-400 block text-[11px]">المتبقي</span>{balance.toLocaleString()} ج.م</div>
                  <div className="rounded-xl bg-slate-900/60 p-3"><span className="text-slate-400 block text-[11px]">الحالة المالية</span>{entry.paymentStatus ?? 'paid'}</div>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-3">
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">السعر</label>
                        <input type="number" value={form.amountPaid} onChange={(e) => setPaymentForms((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], amountPaid: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">الخصم</label>
                        <input type="number" value={form.discount} onChange={(e) => setPaymentForms((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], discount: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">طريقة الدفع</label>
                        <select value={form.paymentMethod} onChange={(e) => setPaymentForms((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], paymentMethod: e.target.value as PaymentMethod } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-sm">
                          <option value="cash">نقدي</option>
                          <option value="bank_transfer">تحويل</option>
                          <option value="card">بطاقة</option>
                          <option value="online">أونلاين</option>
                          <option value="other">أخرى</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">حالة الدفع</label>
                        <select value={form.paymentStatus} onChange={(e) => setPaymentForms((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], paymentStatus: e.target.value as PaymentStatus } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-sm">
                          <option value="paid">مدفوع</option>
                          <option value="partial">جزئي</option>
                          <option value="pending">قيد الانتظار</option>
                          <option value="overdue">متأخر</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">تاريخ الدفع</label>
                        <input type="date" value={form.paymentDate} onChange={(e) => setPaymentForms((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], paymentDate: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">ملاحظة</label>
                        <input value={form.note} onChange={(e) => setPaymentForms((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], note: e.target.value } }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-sm" placeholder="ملاحظة" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { playClick(); handleSavePayment(entry); }} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">
                        <DollarSign size={14} />
                        حفظ مالية
                      </button>
                      <button onClick={() => { playClick(); handleRenew(entry); }} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">
                        <RotateCcw size={14} />
                        تجديد
                      </button>
                      <button onClick={() => { playClick(); handleToggleFreeze(entry); }} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-white ${entry.status === 'frozen' ? 'bg-amber-500' : 'bg-slate-700'}`}>
                        {entry.status === 'frozen' ? <BadgeCheck size={14} /> : <Snowflake size={14} />}
                        {entry.status === 'frozen' ? 'استئناف' : 'تجميد'}
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm">
                      <div className="flex items-center gap-2 mb-2 text-slate-300">
                        <ReceiptText size={14} />
                        سجل مالي
                      </div>
                      {(entry.paymentHistory || []).slice(-3).reverse().map((item) => (
                        <div key={item.id} className="mb-2 border-b border-slate-800 pb-2 text-xs text-slate-400">
                          <div className="flex items-center justify-between">
                            <span>{item.type === 'payment' ? 'دفعة' : item.type === 'renewal' ? 'تجديد' : item.type === 'freeze' ? 'تجميد' : 'إجراء'}</span>
                            <span>{item.amount.toLocaleString()} ج.م</span>
                          </div>
                          <div className="text-[11px] mt-1">{item.note || item.paidAt}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <AnimatePresence>
        {showForm && (
          <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <motion.div className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}>
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h3 className="text-xl font-bold text-white">{editingId ? 'تعديل العضوية' : 'عضوية جديدة'}</h3>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400"><X size={20} /></button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">اسم العضوية *</label>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" placeholder="مثال: باكيدج EMS شهري" />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">وصف العضوية</label>
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none" placeholder="اذكر ما تشمله العضوية..." />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">نوع الخدمة *</label>
                  <div className="grid grid-cols-5 gap-2">
                    {SERVICE_TYPES.map((svc) => (
                      <button key={svc.key} type="button" onClick={() => { playClick(); setForm((p) => ({ ...p, serviceType: svc.key })); }} className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${form.serviceType === svc.key ? (svc.key === 'ems' ? 'bg-purple-600 text-white' : svc.key === 'workout' ? 'bg-blue-600 text-white' : svc.key === 'nutrition' ? 'bg-green-600 text-white' : svc.key === 'rehab' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white') : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                        {svc.key === 'ems' ? <Zap size={14} /> : svc.key === 'workout' ? <Dumbbell size={14} /> : svc.key === 'nutrition' ? <Utensils size={14} /> : svc.key === 'rehab' ? <Heart size={14} /> : <Activity size={14} />}
                        {svc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">السعر (جنيه مصري) *</label>
                  <input type="number" value={form.price || ''} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))} className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none" placeholder="0" min={0} />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">نوع المدة</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['monthly', 'quarterly', 'package'] as const).map((type) => (
                      <button key={type} type="button" onClick={() => setForm((p) => ({ ...p, durationType: type }))} className={`py-2 rounded-xl text-sm font-semibold transition-colors ${form.durationType === type ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                        {type === 'monthly' ? 'شهري' : type === 'quarterly' ? '3 أشهر' : 'باكيدج'}
                      </button>
                    ))}
                  </div>
                </div>

                {form.durationType !== 'package' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">المدة بالأيام</label>
                    <input type="number" value={form.durationDays || ''} onChange={(e) => setForm((p) => ({ ...p, durationDays: Number(e.target.value) }))} className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" min={1} />
                  </div>
                )}

                {form.durationType === 'monthly' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">عدد الأشهر</label>
                    <input type="number" value={form.durationValue} onChange={(e) => setForm((p) => ({ ...p, durationValue: Number(e.target.value) }))} className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" min={1} max={12} />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">عدد جلسات EMS</label>
                  <input type="number" value={form.totalSessions} onChange={(e) => setForm((p) => ({ ...p, totalSessions: Number(e.target.value) }))} className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" min={0} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">تفعيل العضوية</span>
                  <button type="button" onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))} className={`w-12 h-6 rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                  {saving ? 'جاري الحفظ...' : <><Check size={18} />{editingId ? 'حفظ التعديلات' : 'إضافة العضوية'}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
