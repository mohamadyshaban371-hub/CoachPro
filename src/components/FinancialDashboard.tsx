import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, updateDoc, doc,
  onSnapshot, query, orderBy, where,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  DollarSign, Plus, CheckCircle, AlertCircle, Clock,
  TrendingUp, User, Search, Filter, ChevronDown, X, CreditCard,
} from 'lucide-react';
import { UserProfile, ClientMembership, Membership, PaymentInstallment } from '../types';

interface Props {
  clients: UserProfile[];
}

export default function FinancialDashboard({ clients }: Props) {
  const [clientMemberships, setClientMemberships] = useState<ClientMembership[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'partial' | 'pending'>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<ClientMembership | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Assign membership form
  const [assignForm, setAssignForm] = useState({
    clientId: '',
    membershipId: '',
    amountPaid: '',
    startDate: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    const unsubMemberships = onSnapshot(
      collection(db, 'memberships'),
      snap => setMemberships(snap.docs.map(d => ({ id: d.id, ...d.data() } as Membership)))
    );

    const unsubClientMemberships = onSnapshot(
      query(collection(db, 'clientMemberships'), orderBy('createdAt', 'desc')),
      snap => {
        setClientMemberships(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientMembership)));
        setLoading(false);
      }
    );

    return () => { unsubMemberships(); unsubClientMemberships(); };
  }, []);

  const getClient = (id: string) => clients.find(c => c.uid === id);
  const getMembership = (id: string) => memberships.find(m => m.id === id);

  const totalRevenue = clientMemberships.reduce((s, m) => s + m.amountPaid, 0);
  const totalPending = clientMemberships.reduce((s, m) => s + m.amountRemaining, 0);
  const fullyPaid = clientMemberships.filter(m => m.amountRemaining === 0).length;

  const paymentStatus = (m: ClientMembership) => {
    if (m.amountRemaining === 0) return 'paid';
    if (m.amountPaid > 0) return 'partial';
    return 'pending';
  };

  const filtered = clientMemberships.filter(m => {
    const c = getClient(m.clientId);
    const matchSearch = !search || (c?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || paymentStatus(m) === filter;
    return matchSearch && matchFilter;
  });

  const handleAssign = async () => {
    if (!assignForm.clientId || !assignForm.membershipId) {
      alert('يرجى اختيار العميل والعضوية');
      return;
    }
    const mem = getMembership(assignForm.membershipId);
    if (!mem) return;
    const paid = Number(assignForm.amountPaid) || 0;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      // Calculate end date
      let endDate = new Date(assignForm.startDate);
      if (mem.durationType === 'quarterly') {
        endDate.setMonth(endDate.getMonth() + 3);
      } else if (mem.durationType === 'monthly') {
        endDate.setMonth(endDate.getMonth() + mem.durationValue);
      } else {
        endDate.setMonth(endDate.getMonth() + 1); // package: 1 month default
      }

      const installments: PaymentInstallment[] = paid > 0 ? [{
        id: crypto.randomUUID(),
        amount: paid,
        paidAt: now,
        note: 'دفعة أولى',
      }] : [];

      await addDoc(collection(db, 'clientMemberships'), {
        clientId: assignForm.clientId,
        membershipId: assignForm.membershipId,
        membershipName: mem.name,
        totalPrice: mem.price,
        amountPaid: paid,
        amountRemaining: mem.price - paid,
        totalSessions: mem.totalSessions,
        sessionsUsed: 0,
        sessionsRemaining: mem.totalSessions,
        startDate: assignForm.startDate,
        endDate: endDate.toISOString().slice(0, 10),
        status: 'active',
        paymentInstallments: installments,
        createdAt: now,
        updatedAt: now,
      });

      setShowAssignModal(false);
      setAssignForm({ clientId: '', membershipId: '', amountPaid: '', startDate: new Date().toISOString().slice(0, 10) });
    } catch (err: any) {
      alert('خطأ: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    if (!showPaymentModal) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) { alert('يرجى إدخال مبلغ صحيح'); return; }
    if (amount > showPaymentModal.amountRemaining) {
      alert(`المبلغ أكبر من المتبقي (${showPaymentModal.amountRemaining} ج.م)`);
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const newInstallment: PaymentInstallment = {
        id: crypto.randomUUID(),
        amount,
        paidAt: now,
        note: paymentNote.trim() || '',
      };
      const newPaid = showPaymentModal.amountPaid + amount;
      const newRemaining = showPaymentModal.amountRemaining - amount;

      await updateDoc(doc(db, 'clientMemberships', showPaymentModal.id), {
        amountPaid: newPaid,
        amountRemaining: newRemaining,
        paymentInstallments: [...(showPaymentModal.paymentInstallments || []), newInstallment],
        updatedAt: now,
      });

      setShowPaymentModal(null);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (err: any) {
      alert('خطأ: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">النظام المالي</h2>
          <p className="text-slate-400 text-sm mt-1">متابعة المدفوعات وإسناد العضويات</p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold transition-colors"
        >
          <Plus size={18} />
          إسناد عضوية
        </button>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 rounded-2xl p-4 border border-green-700/30">
          <p className="text-green-400 text-xs mb-1">إجمالي المحصّل</p>
          <p className="text-2xl font-bold text-green-400">{totalRevenue.toLocaleString()}</p>
          <p className="text-green-600 text-xs">ج.م</p>
        </div>
        <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 rounded-2xl p-4 border border-red-700/30">
          <p className="text-red-400 text-xs mb-1">متبقي مستحق</p>
          <p className="text-2xl font-bold text-red-400">{totalPending.toLocaleString()}</p>
          <p className="text-red-600 text-xs">ج.م</p>
        </div>
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">مسدّد بالكامل</p>
          <p className="text-2xl font-bold text-white">{fullyPaid}</p>
          <p className="text-slate-500 text-xs">عميل</p>
        </div>
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">إجمالي الاشتراكات</p>
          <p className="text-2xl font-bold text-white">{clientMemberships.length}</p>
          <p className="text-slate-500 text-xs">اشتراك</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'paid', 'partial', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? 'الكل' : f === 'paid' ? 'مدفوع' : f === 'partial' ? 'جزئي' : 'معلق'}
            </button>
          ))}
        </div>
      </div>

      {/* Client Membership Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
          <p>لا توجد اشتراكات مطابقة</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(m => {
            const client = getClient(m.clientId);
            const status = paymentStatus(m);
            const pct = m.totalPrice > 0 ? (m.amountPaid / m.totalPrice) * 100 : 0;
            const isExpired = new Date(m.endDate) < new Date();

            return (
              <motion.div
                key={m.id}
                layout
                className="bg-slate-800/70 rounded-2xl p-5 border border-slate-700"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    {client?.profilePicUrl ? (
                      <img src={client.profilePicUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
                        {client?.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-white">{client?.name || 'عميل غير موجود'}</p>
                      <p className="text-xs text-slate-400">{m.membershipName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpired && (
                      <span className="text-xs bg-red-900/30 text-red-400 border border-red-700/30 px-2 py-1 rounded-lg">
                        منتهي
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${
                      status === 'paid'
                        ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                        : status === 'partial'
                        ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30'
                        : 'bg-red-900/30 text-red-400 border border-red-700/30'
                    }`}>
                      {status === 'paid' ? '✓ مدفوع' : status === 'partial' ? 'دفع جزئي' : '⚠ معلق'}
                    </span>
                  </div>
                </div>

                {/* Financial Info */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">الإجمالي</p>
                    <p className="font-bold text-white text-sm">{m.totalPrice.toLocaleString()} ج</p>
                  </div>
                  <div className="bg-green-900/20 rounded-xl p-3 border border-green-700/20">
                    <p className="text-xs text-green-400 mb-1">مدفوع</p>
                    <p className="font-bold text-green-400 text-sm">{m.amountPaid.toLocaleString()} ج</p>
                  </div>
                  <div className="bg-red-900/20 rounded-xl p-3 border border-red-700/20">
                    <p className="text-xs text-red-400 mb-1">متبقي</p>
                    <p className="font-bold text-red-400 text-sm">{m.amountRemaining.toLocaleString()} ج</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>نسبة السداد</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Dates + Sessions */}
                <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-4">
                  <span>من: {m.startDate}</span>
                  <span>إلى: {m.endDate}</span>
                  <span>الجلسات: {m.sessionsRemaining}/{m.totalSessions} متبقي</span>
                </div>

                {/* Installments */}
                {(m.paymentInstallments || []).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">سجل الدفعات</p>
                    <div className="space-y-1">
                      {m.paymentInstallments.map(inst => (
                        <div key={inst.id} className="flex justify-between text-xs p-2 bg-slate-700/40 rounded-lg">
                          <span className="text-green-400 font-semibold">{inst.amount.toLocaleString()} ج.م</span>
                          <span className="text-slate-500">
                            {new Date(inst.paidAt).toLocaleDateString('ar-EG')}
                            {inst.note ? ` — ${inst.note}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Payment Button */}
                {m.amountRemaining > 0 && (
                  <button
                    onClick={() => setShowPaymentModal(m)}
                    className="w-full bg-green-700/30 hover:bg-green-700/50 border border-green-600/30 text-green-400 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={15} />
                    إضافة دفعة ({m.amountRemaining.toLocaleString()} ج متبقي)
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Assign Membership Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowAssignModal(false); }}
          >
            <motion.div
              className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-md max-h-[85vh] overflow-y-auto"
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h3 className="text-xl font-bold text-white">إسناد عضوية لعميل</h3>
                <button onClick={() => setShowAssignModal(false)} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">العميل *</label>
                  <select
                    value={assignForm.clientId}
                    onChange={e => setAssignForm(p => ({ ...p, clientId: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">اختر العميل</option>
                    {clients.filter(c => c.role !== 'admin').map(c => (
                      <option key={c.uid} value={c.uid}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">العضوية *</label>
                  <select
                    value={assignForm.membershipId}
                    onChange={e => setAssignForm(p => ({ ...p, membershipId: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">اختر العضوية</option>
                    {memberships.filter(m => m.isActive).map(m => (
                      <option key={m.id} value={m.id}>{m.name} — {m.price.toLocaleString()} ج</option>
                    ))}
                  </select>
                </div>
                {assignForm.membershipId && (() => {
                  const mem = getMembership(assignForm.membershipId);
                  return mem ? (
                    <div className="bg-slate-800/60 rounded-xl p-3 text-sm text-slate-300">
                      <p>{mem.description}</p>
                      <p className="mt-1 text-slate-400">
                        السعر: <span className="text-green-400">{mem.price.toLocaleString()} ج</span> |
                        الجلسات: <span className="text-blue-400">{mem.totalSessions}</span>
                      </p>
                    </div>
                  ) : null;
                })()}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">تاريخ البدء</label>
                  <input
                    type="date"
                    value={assignForm.startDate}
                    onChange={e => setAssignForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">المبلغ المدفوع الآن (ج.م)</label>
                  <input
                    type="number"
                    value={assignForm.amountPaid}
                    onChange={e => setAssignForm(p => ({ ...p, amountPaid: e.target.value }))}
                    placeholder="0 = لم يدفع بعد"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    min={0}
                  />
                </div>
                <button
                  onClick={handleAssign}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  {saving ? 'جاري الإسناد...' : 'إسناد العضوية'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-sm p-6 space-y-5"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">إضافة دفعة</h3>
                <button onClick={() => setShowPaymentModal(null)} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 text-sm">
                <p className="text-slate-300">{getClient(showPaymentModal.clientId)?.name}</p>
                <p className="text-red-400 mt-1">المتبقي: {showPaymentModal.amountRemaining.toLocaleString()} ج.م</p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">المبلغ (ج.م)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                  min={1}
                  max={showPaymentModal.amountRemaining}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">ملاحظة</label>
                <input
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  placeholder="اختياري"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowPaymentModal(null)} className="py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold">
                  إلغاء
                </button>
                <button
                  onClick={handleAddPayment}
                  disabled={saving}
                  className="py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold disabled:opacity-50 transition-colors"
                >
                  {saving ? 'جاري...' : 'تسجيل'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
