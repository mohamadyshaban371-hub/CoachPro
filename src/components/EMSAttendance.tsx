import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, updateDoc, doc,
  onSnapshot, query, orderBy, where, getDocs,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, CheckCircle2, Clock, AlertTriangle, Search,
  Calendar, User, ChevronDown, X,
} from 'lucide-react';
import { UserProfile, ClientMembership, EMSSession } from '../types';

interface Props {
  clients: UserProfile[];
}

export default function EMSAttendance({ clients }: Props) {
  const [sessions, setSessions] = useState<EMSSession[]>([]);
  const [clientMemberships, setClientMemberships] = useState<ClientMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'low' | 'expired'>('all');
  const [selectedSession, setSelectedSession] = useState<{ clientId: string; name: string } | null>(null);
  const [sessionNote, setSessionNote] = useState('');

  useEffect(() => {
    const qSessions = query(
      collection(db, 'emsSessions'),
      orderBy('checkedInAt', 'desc')
    );
    const unsubSessions = onSnapshot(qSessions, snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as EMSSession)));
    });

    const qMemberships = query(
      collection(db, 'clientMemberships'),
      where('status', '==', 'active')
    );
    const unsubMemberships = onSnapshot(qMemberships, snap => {
      setClientMemberships(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientMembership)));
      setLoading(false);
    });

    return () => { unsubSessions(); unsubMemberships(); };
  }, []);

  const getMembership = (clientId: string) =>
    clientMemberships.find(m => m.clientId === clientId);

  const getClient = (clientId: string) =>
    clients.find(c => c.uid === clientId);

  const handleCheckIn = async () => {
    if (!selectedSession) return;
    const membership = getMembership(selectedSession.clientId);
    if (!membership) {
      alert('لا توجد عضوية نشطة لهذا العميل');
      setSelectedSession(null);
      return;
    }
    if (membership.sessionsRemaining <= 0) {
      alert('انتهت جلسات هذا العميل! يرجى تجديد العضوية.');
      setSelectedSession(null);
      return;
    }

    setCheckingIn(selectedSession.clientId);
    try {
      const now = new Date().toISOString();

      // Add session record
      await addDoc(collection(db, 'emsSessions'), {
        clientId: selectedSession.clientId,
        clientName: selectedSession.name,
        clientMembershipId: membership.id,
        checkedInAt: now,
        notes: sessionNote.trim() || '',
      });

      // Update membership: decrement sessionsRemaining
      const newUsed = membership.sessionsUsed + 1;
      const newRemaining = Math.max(0, membership.totalSessions - newUsed);
      await updateDoc(doc(db, 'clientMemberships', membership.id), {
        sessionsUsed: newUsed,
        sessionsRemaining: newRemaining,
        updatedAt: now,
        ...(newRemaining === 0 ? { status: 'expired' } : {}),
      });

      setSelectedSession(null);
      setSessionNote('');
    } catch (err: any) {
      alert('خطأ في تسجيل الحضور: ' + (err.message || String(err)));
    } finally {
      setCheckingIn(null);
    }
  };

  // Filter clients with active memberships
  const emsClients = clients.filter(c => {
    const m = getMembership(c.uid);
    if (!m) return false;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'low') return m.sessionsRemaining <= 2;
    if (filter === 'expired') return m.sessionsRemaining === 0;
    if (filter === 'active') return m.sessionsRemaining > 0;
    return true;
  });

  const todaySessions = sessions.filter(
    s => s.checkedInAt.startsWith(new Date().toISOString().slice(0, 10))
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">حضور EMS</h2>
        <p className="text-slate-400 text-sm mt-1">تسجيل الجلسات ومتابعة الحضور</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">جلسات اليوم</p>
          <p className="text-2xl font-bold text-blue-400">{todaySessions.length}</p>
        </div>
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">عملاء نشطون</p>
          <p className="text-2xl font-bold text-green-400">
            {clientMemberships.filter(m => m.sessionsRemaining > 0).length}
          </p>
        </div>
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">جلسات منخفضة</p>
          <p className="text-2xl font-bold text-yellow-400">
            {clientMemberships.filter(m => m.sessionsRemaining > 0 && m.sessionsRemaining <= 2).length}
          </p>
        </div>
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">منتهي الجلسات</p>
          <p className="text-2xl font-bold text-red-400">
            {clientMemberships.filter(m => m.sessionsRemaining === 0).length}
          </p>
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
          {(['all', 'active', 'low', 'expired'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? 'الكل' : f === 'active' ? 'نشط' : f === 'low' ? 'منخفض' : 'منتهي'}
            </button>
          ))}
        </div>
      </div>

      {/* Client Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
      ) : emsClients.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Zap size={48} className="mx-auto mb-4 opacity-30" />
          <p>لا يوجد عملاء EMS مطابقون</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {emsClients.map(client => {
            const m = getMembership(client.uid)!;
            const remaining = m.sessionsRemaining;
            const pct = m.totalSessions > 0 ? (remaining / m.totalSessions) * 100 : 0;
            const status = remaining === 0 ? 'expired' : remaining <= 2 ? 'low' : 'active';
            const statusColor = { expired: 'red', low: 'yellow', active: 'green' }[status];
            const todayCount = todaySessions.filter(s => s.clientId === client.uid).length;

            return (
              <motion.div
                key={client.uid}
                layout
                className={`bg-slate-800/70 rounded-2xl p-5 border ${
                  status === 'expired' ? 'border-red-700/40' :
                  status === 'low' ? 'border-yellow-700/40' : 'border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  {client.profilePicUrl ? (
                    <img src={client.profilePicUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
                      {client.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{client.name}</p>
                    <p className="text-xs text-slate-400 truncate">{m.membershipName}</p>
                  </div>
                  {todayCount > 0 && (
                    <span className="text-xs bg-green-600/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-lg">
                      حضر اليوم
                    </span>
                  )}
                </div>

                {/* Sessions bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">الجلسات المتبقية</span>
                    <span className={`font-bold text-${statusColor}-400`}>{remaining} / {m.totalSessions}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-${statusColor}-500 transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {status === 'expired' ? (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 rounded-xl p-3">
                    <AlertTriangle size={16} />
                    انتهت الجلسات — يحتاج تجديد
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedSession({ clientId: client.uid, name: client.name })}
                    disabled={checkingIn === client.uid}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {checkingIn === client.uid ? 'جاري التسجيل...' : (
                      <>
                        <CheckCircle2 size={16} />
                        تسجيل جلسة
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Today's Sessions Log */}
      {todaySessions.length > 0 && (
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-blue-400" />
            سجل جلسات اليوم ({todaySessions.length})
          </h3>
          <div className="space-y-2">
            {todaySessions.map(s => {
              const c = getClient(s.clientId);
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-400">
                    <Zap size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">{s.clientName}</p>
                    {s.notes && <p className="text-slate-400 text-xs truncate">{s.notes}</p>}
                  </div>
                  <span className="text-slate-500 text-xs flex-shrink-0">
                    {new Date(s.checkedInAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Check-in Confirmation Modal */}
      <AnimatePresence>
        {selectedSession && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-sm p-6 space-y-5"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap size={32} className="text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white">تسجيل جلسة EMS</h3>
                <p className="text-slate-400 mt-1">{selectedSession.name}</p>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">ملاحظات (اختياري)</label>
                <input
                  value={sessionNote}
                  onChange={e => setSessionNote(e.target.value)}
                  placeholder="مثال: تمرين كامل، ضغط متوسط..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setSelectedSession(null); setSessionNote(''); }}
                  className="py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleCheckIn}
                  disabled={!!checkingIn}
                  className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {checkingIn ? 'جاري...' : 'تأكيد'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
