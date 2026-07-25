import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, Timestamp,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, Trash2, X, Check, Dumbbell, Clock, CreditCard, Users, Zap, Utensils, Heart, Activity } from 'lucide-react';
import { playClick, playSuccess, playError } from '../lib/sounds';
import { Membership } from '../types';

export default function MembershipManager() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '',
    description: '',
    price: 0,
    durationType: 'monthly',
    durationValue: 1,
    totalSessions: 8,
    serviceType: 'all',
    isActive: true,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const q = query(collection(db, 'memberships'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMemberships(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

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
      totalSessions: m.totalSessions,
      serviceType: m.serviceType || 'all',
      isActive: m.isActive,
    });
    setEditingId(m.id);
    setShowForm(true);
  };

  const SERVICE_TYPES: { key: Membership['serviceType']; label: string; color: string }[] = [
    { key: 'ems', label: 'EMS', color: 'purple' },
    { key: 'workout', label: 'تدريب', color: 'blue' },
    { key: 'nutrition', label: 'تغذية', color: 'green' },
    { key: 'rehab', label: 'تأهيل', color: 'red' },
    { key: 'all', label: 'شامل', color: 'yellow' },
  ];

  const serviceLabel = (type: Membership['serviceType']) =>
    SERVICE_TYPES.find(s => s.key === type)?.label || type;

  const serviceColor = (type: Membership['serviceType']) =>
    SERVICE_TYPES.find(s => s.key === type)?.color || 'slate';

  const handleSave = async () => {
    if (!form.name.trim()) { playError(); alert('يرجى إدخال اسم العضوية'); return; }
    if (form.price <= 0) { playError(); alert('يرجى إدخال سعر صحيح'); return; }
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
    await deleteDoc(doc(db, 'memberships', id)).catch((e) =>
      alert('خطأ في الحذف: ' + e.message)
    );
  };

  const durationLabel = (m: Membership) => {
    if (m.durationType === 'package') return `${m.totalSessions} جلسة`;
    if (m.durationType === 'quarterly') return '3 أشهر';
    return `${m.durationValue} شهر`;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">إدارة العضويات</h2>
          <p className="text-slate-400 text-sm mt-1">أنشئ وعدّل باكيدجات EMS والعضويات المتاحة</p>
        </div>
        <button
          onClick={() => { playClick(); openNew(); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold transition-colors"
        >
          <Plus size={18} />
          عضوية جديدة
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">إجمالي العضويات</p>
          <p className="text-2xl font-bold text-white">{memberships.length}</p>
        </div>
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">نشطة</p>
          <p className="text-2xl font-bold text-green-400">{memberships.filter(m => m.isActive).length}</p>
        </div>
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">أعلى سعر</p>
          <p className="text-2xl font-bold text-yellow-400">
            {memberships.length > 0 ? Math.max(...memberships.map(m => m.price)).toLocaleString() : '0'} ج
          </p>
        </div>
      </div>

      {/* Memberships List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
      ) : memberships.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Dumbbell size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">لا توجد عضويات بعد</p>
          <p className="text-sm mt-1">اضغط "عضوية جديدة" لإضافة أول باكيدج</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {memberships.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-slate-800/70 rounded-2xl p-5 border ${m.isActive ? 'border-blue-700/50' : 'border-slate-700/50 opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white text-lg truncate">{m.name}</h3>
                    {!m.isActive && (
                      <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">معطّل</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mb-4 line-clamp-2">{m.description}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(() => {
                      const svc = m.serviceType || 'all';
                      const colorMap: Record<string, string> = {
                        ems: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                        workout: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                        nutrition: 'bg-green-500/20 text-green-300 border-green-500/30',
                        rehab: 'bg-red-500/20 text-red-300 border-red-500/30',
                        all: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                      };
                      const iconMap: Record<string, React.ReactNode> = {
                        ems: <Zap size={11} />, workout: <Dumbbell size={11} />, nutrition: <Utensils size={11} />,
                        rehab: <Heart size={11} />, all: <Activity size={11} />,
                      };
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${colorMap[svc]}`}>
                          {iconMap[svc]} {serviceLabel(svc)}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <CreditCard size={14} className="text-green-400" />
                      <span className="text-green-400 font-bold">{m.price.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock size={14} className="text-blue-400" />
                      <span className="text-slate-300">{durationLabel(m)}</span>
                    </div>
                    {m.totalSessions > 0 && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Dumbbell size={14} className="text-purple-400" />
                        <span className="text-slate-300">{m.totalSessions} جلسة</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => { playClick(); openEdit(m); }}
                    className="p-2 rounded-xl bg-slate-700 hover:bg-blue-700 transition-colors text-slate-300 hover:text-white"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => { playClick(); handleDelete(m.id, m.name); }}
                    className="p-2 rounded-xl bg-slate-700 hover:bg-red-700 transition-colors text-slate-300 hover:text-white"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div
              className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h3 className="text-xl font-bold text-white">
                  {editingId ? 'تعديل العضوية' : 'عضوية جديدة'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">اسم العضوية *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    placeholder="مثال: باكيدج EMS شهري"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">وصف العضوية</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                    placeholder="اذكر ما تشمله العضوية..."
                  />
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">نوع الخدمة *</label>
                  <div className="grid grid-cols-5 gap-2">
                    {SERVICE_TYPES.map(svc => (
                      <button
                        key={svc.key}
                        type="button"
                        onClick={() => { playClick(); setForm(p => ({ ...p, serviceType: svc.key })); }}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                          form.serviceType === svc.key
                            ? svc.key === 'ems' ? 'bg-purple-600 text-white' :
                              svc.key === 'workout' ? 'bg-blue-600 text-white' :
                              svc.key === 'nutrition' ? 'bg-green-600 text-white' :
                              svc.key === 'rehab' ? 'bg-red-600 text-white' :
                              'bg-yellow-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {svc.key === 'ems' ? <Zap size={14} /> : svc.key === 'workout' ? <Dumbbell size={14} /> : svc.key === 'nutrition' ? <Utensils size={14} /> : svc.key === 'rehab' ? <Heart size={14} /> : <Activity size={14} />}
                        {svc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">السعر (جنيه مصري) *</label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    placeholder="0"
                    min={0}
                  />
                </div>

                {/* Duration Type */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">نوع المدة</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['monthly', 'quarterly', 'package'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, durationType: type }))}
                        className={`py-2 rounded-xl text-sm font-semibold transition-colors ${
                          form.durationType === type
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {type === 'monthly' ? 'شهري' : type === 'quarterly' ? '3 أشهر' : 'باكيدج'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration Value (for monthly/quarterly) */}
                {form.durationType === 'monthly' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">عدد الأشهر</label>
                    <input
                      type="number"
                      value={form.durationValue}
                      onChange={e => setForm(p => ({ ...p, durationValue: Number(e.target.value) }))}
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                      min={1} max={12}
                    />
                  </div>
                )}

                {/* EMS Sessions */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">عدد جلسات EMS</label>
                  <input
                    type="number"
                    value={form.totalSessions}
                    onChange={e => setForm(p => ({ ...p, totalSessions: Number(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                    min={0}
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">تفعيل العضوية</span>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                    className={`w-12 h-6 rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-700'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? 'جاري الحفظ...' : (
                    <>
                      <Check size={18} />
                      {editingId ? 'حفظ التعديلات' : 'إضافة العضوية'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
