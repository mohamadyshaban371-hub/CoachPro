import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ClientMembership, Membership, MembershipFinancialTransaction, MembershipPaymentHistoryEntry, PackageConfig, PaymentMethod, PaymentStatus, UserProfile } from '../types';

const getDateOnly = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getRemainingDays = (endDate?: string) => {
  const end = getDateOnly(endDate);
  const today = getDateOnly(new Date().toISOString());
  if (!end || !today) return 0;
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
};

const deriveLifecycleStatus = (membership: ClientMembership) => {
  if (membership.status === 'frozen') return 'frozen';

  const remainingDays = getRemainingDays(membership.endDate);
  if (!membership.endDate) return membership.status === 'active' ? 'active' : membership.status;

  if (remainingDays < 0) return 'expired';
  if (remainingDays === 0) return 'expires_today';
  if (remainingDays <= 3) return 'expiring_3_days';
  if (remainingDays <= 7) return 'expiring_7_days';
  return 'active';
};

const normalizeMembership = (membership: ClientMembership) => {
  const nextStatus = deriveLifecycleStatus(membership);
  const remainingDays = getRemainingDays(membership.endDate);
  return {
    ...membership,
    remainingDays,
    status: nextStatus as ClientMembership['status'],
  };
};

const createHistoryEntry = (
  type: MembershipPaymentHistoryEntry['type'],
  amount: number,
  note: string,
  method?: PaymentMethod,
  paidAt?: string,
  status?: PaymentStatus,
): MembershipPaymentHistoryEntry => ({
  id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  amount,
  method,
  paidAt: paidAt || new Date().toISOString(),
  note,
  status,
});

const createTransactionEntry = (
  type: MembershipFinancialTransaction['type'],
  amount: number,
  description: string,
  method?: PaymentMethod,
  date?: string,
  status?: MembershipFinancialTransaction['status'],
): MembershipFinancialTransaction => ({
  id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  amount,
  description,
  method,
  date: date || new Date().toISOString().slice(0, 10),
  status,
  createdAt: new Date().toISOString(),
});

type MessageState = { text: string; type: 'success' | 'error' } | null;

interface MembershipFormData {
  name: string;
  email: string;
  password: string;
  gender: 'male' | 'female';
  packages: {
    workout: boolean;
    nutrition: boolean;
    rehab: boolean;
    ems: boolean;
  };
  workoutMonths: number;
  nutritionMonths: number;
  rehabMonths: number;
  emsSessions: number;
  emsMembershipId: string;
  workoutMembershipId: string;
  nutritionMembershipId: string;
  rehabMembershipId: string;
}

interface UseMembershipsArgs {
  setLoading: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<MessageState>>;
}

const initialFormData: MembershipFormData = {
  name: '',
  email: '',
  password: '',
  gender: 'male',
  packages: {
    workout: false,
    nutrition: false,
    rehab: false,
    ems: false,
  },
  workoutMonths: 1,
  nutritionMonths: 1,
  rehabMonths: 1,
  emsSessions: 12,
  emsMembershipId: '',
  workoutMembershipId: '',
  nutritionMembershipId: '',
  rehabMembershipId: '',
};

export function useMemberships({ setLoading, setMessage }: UseMembershipsArgs) {
  const [membershipsRegistry, setMembershipsRegistry] = useState<Membership[]>([]);
  const [clientMemberships, setClientMemberships] = useState<ClientMembership[]>([]);
  const [formData, setFormData] = useState<MembershipFormData>(initialFormData);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isActivating, setIsActivating] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'memberships'), (snap) => {
      setMembershipsRegistry(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Membership)));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'clientMemberships'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientMembership));
      const normalized = next.map((entry) => normalizeMembership(entry));
      setClientMemberships(normalized);
    });

    return () => unsub();
  }, []);

  const handleRenew = useCallback(async (uid: string, newPackages: PackageConfig) => {
    try {
      setLoading(true);
      const userRef = doc(db, 'users', uid);

      let maxMonths = 0;
      if (newPackages.workout) maxMonths = Math.max(maxMonths, newPackages.workout.months);
      if (newPackages.nutrition) maxMonths = Math.max(maxMonths, newPackages.nutrition.months);
      if (newPackages.rehab) maxMonths = Math.max(maxMonths, newPackages.rehab.months);

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + (maxMonths || 1));

      await updateDoc(userRef, {
        packages: newPackages,
        expiryDate: expiryDate.toISOString(),
        isActivated: true,
        questionnaireComplete: false,
      });

      setMessage({ text: 'تم تجديد الاشتراك بنجاح ✅', type: 'success' });
      setIsRenewing(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ text: 'خطأ في التجديد: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [setLoading, setMessage]);

  const createClientMembership = useCallback(async (payload: Omit<ClientMembership, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const normalized = normalizeMembership({
      id: '',
      createdAt: now,
      updatedAt: now,
      paymentHistory: [],
      financialTransactions: [],
      ...payload,
    } as ClientMembership);
    await addDoc(collection(db, 'clientMemberships'), {
      ...normalized,
      createdAt: now,
      updatedAt: now,
      membershipPrice: normalized.membershipPrice ?? normalized.totalPrice,
      amountRemaining: Math.max(0, (normalized.totalPrice || 0) - (normalized.amountPaid || 0) - (normalized.discount || 0)),
      remainingDays: normalized.remainingDays ?? 0,
      paymentHistory: normalized.paymentHistory ?? [],
      financialTransactions: normalized.financialTransactions ?? [],
    });
  }, []);

  const updateClientMembership = useCallback(async (id: string, updates: Partial<ClientMembership>) => {
    const current = clientMemberships.find((entry) => entry.id === id);
    const merged = {
      ...(current || {}),
      ...updates,
      amountPaid: updates.amountPaid ?? current?.amountPaid ?? 0,
      discount: updates.discount ?? current?.discount ?? 0,
      totalPrice: updates.totalPrice ?? current?.totalPrice ?? current?.membershipPrice ?? 0,
    } as ClientMembership;
    const normalized = normalizeMembership(merged);
    await updateDoc(doc(db, 'clientMemberships', id), {
      ...normalized,
      membershipPrice: normalized.membershipPrice ?? normalized.totalPrice,
      amountRemaining: Math.max(0, (normalized.totalPrice || 0) - (normalized.amountPaid || 0) - (normalized.discount || 0)),
      updatedAt: new Date().toISOString(),
    });
  }, [clientMemberships]);

  const recordPayment = useCallback(async (membershipId: string, input: { amountPaid: number; discount: number; paymentMethod?: PaymentMethod; paymentStatus?: PaymentStatus; paymentDate?: string; note?: string }) => {
    const current = clientMemberships.find((entry) => entry.id === membershipId);
    if (!current) throw new Error('Membership not found');

    const totalPrice = current.totalPrice || current.membershipPrice || 0;
    const nextAmountPaid = Math.min(totalPrice, Math.max(0, input.amountPaid || current.amountPaid || 0));
    const nextDiscount = Math.min(Math.max(0, totalPrice - nextAmountPaid), Math.max(0, input.discount ?? current.discount ?? 0));
    const nextPaymentDate = input.paymentDate || new Date().toISOString().slice(0, 10);
    const nextStatus = nextAmountPaid >= totalPrice - nextDiscount ? 'active' : (input.paymentStatus || 'partial');

    const paymentHistory = [
      ...(current.paymentHistory || []),
      createHistoryEntry('payment', Math.max(0, nextAmountPaid - (current.amountPaid || 0)), input.note || 'دفعة جديدة', input.paymentMethod, nextPaymentDate, input.paymentStatus || 'paid'),
    ];
    const financialTransactions = [
      ...(current.financialTransactions || []),
      createTransactionEntry('payment', Math.max(0, nextAmountPaid - (current.amountPaid || 0)), 'دفعة عضوية', input.paymentMethod, nextPaymentDate, input.paymentStatus || 'paid'),
    ];

    if ((input.discount ?? 0) > 0) {
      paymentHistory.push(createHistoryEntry('discount', nextDiscount, 'خصم مسجل', input.paymentMethod, nextPaymentDate, input.paymentStatus || 'paid'));
      financialTransactions.push(createTransactionEntry('discount', nextDiscount, 'خصم مسجل', input.paymentMethod, nextPaymentDate, input.paymentStatus || 'paid'));
    }

    const merged = {
      ...current,
      amountPaid: nextAmountPaid,
      discount: nextDiscount,
      amountRemaining: Math.max(0, totalPrice - nextAmountPaid - nextDiscount),
      paymentMethod: input.paymentMethod || current.paymentMethod || 'cash',
      paymentStatus: input.paymentStatus || (nextAmountPaid >= totalPrice - nextDiscount ? 'paid' : 'partial'),
      paymentDate: nextPaymentDate,
      paymentHistory,
      financialTransactions,
      status: nextStatus === 'active' ? 'active' : current.status === 'frozen' ? 'frozen' : current.status,
      updatedAt: new Date().toISOString(),
    } as ClientMembership;

    const normalized = normalizeMembership(merged);
    await updateDoc(doc(db, 'clientMemberships', membershipId), {
      ...normalized,
      membershipPrice: normalized.membershipPrice ?? normalized.totalPrice,
      amountRemaining: Math.max(0, (normalized.totalPrice || 0) - (normalized.amountPaid || 0) - (normalized.discount || 0)),
      updatedAt: new Date().toISOString(),
    });
    setMessage({ text: 'تم حفظ الدفع والرصيد المالي بنجاح ✅', type: 'success' });
    setTimeout(() => setMessage(null), 2500);
  }, [clientMemberships, setMessage]);

  const renewMembership = useCallback(async (membershipId: string, input: { paymentAmount?: number; paymentMethod?: PaymentMethod; paymentStatus?: PaymentStatus; paymentDate?: string; note?: string }) => {
    const current = clientMemberships.find((entry) => entry.id === membershipId);
    if (!current) throw new Error('Membership not found');

    const today = new Date();
    const endDate = new Date(current.endDate || today.toISOString());
    if (endDate < today) {
      endDate.setTime(today.getTime());
    }
    endDate.setDate(endDate.getDate() + (current.durationDays || 30));

    const paymentAmount = Math.max(0, input.paymentAmount ?? current.amountPaid ?? 0);
    const paymentHistory = [
      ...(current.paymentHistory || []),
      createHistoryEntry('renewal', paymentAmount, input.note || 'تجديد اشتراك', input.paymentMethod, input.paymentDate || today.toISOString().slice(0, 10), input.paymentStatus || 'paid'),
    ];
    const financialTransactions = [
      ...(current.financialTransactions || []),
      createTransactionEntry('renewal', paymentAmount, 'تجديد الاشتراك', input.paymentMethod, input.paymentDate || today.toISOString().slice(0, 10), input.paymentStatus || 'paid'),
    ];

    const merged = {
      ...current,
      endDate: endDate.toISOString().slice(0, 10),
      amountPaid: paymentAmount,
      amountRemaining: Math.max(0, (current.totalPrice || current.membershipPrice || 0) - paymentAmount - (current.discount || 0)),
      paymentMethod: input.paymentMethod || current.paymentMethod || 'cash',
      paymentStatus: input.paymentStatus || 'paid',
      paymentDate: input.paymentDate || today.toISOString().slice(0, 10),
      paymentHistory,
      financialTransactions,
      status: 'active',
      updatedAt: new Date().toISOString(),
    } as ClientMembership;

    const normalized = normalizeMembership(merged);
    await updateDoc(doc(db, 'clientMemberships', membershipId), {
      ...normalized,
      membershipPrice: normalized.membershipPrice ?? normalized.totalPrice,
      amountRemaining: Math.max(0, (normalized.totalPrice || 0) - (normalized.amountPaid || 0) - (normalized.discount || 0)),
      updatedAt: new Date().toISOString(),
    });
    setMessage({ text: 'تم تجديد الاشتراك بنجاح ✅', type: 'success' });
    setTimeout(() => setMessage(null), 2500);
  }, [clientMemberships, setMessage]);

  const freezeMembership = useCallback(async (membershipId: string, note: string) => {
    const current = clientMemberships.find((entry) => entry.id === membershipId);
    if (!current) throw new Error('Membership not found');

    const paymentHistory = [
      ...(current.paymentHistory || []),
      createHistoryEntry('freeze', 0, note || 'تجميد الاشتراك', current.paymentMethod, new Date().toISOString().slice(0, 10), current.paymentStatus || 'pending'),
    ];
    const financialTransactions = [
      ...(current.financialTransactions || []),
      createTransactionEntry('freeze', 0, 'تجميد الاشتراك', current.paymentMethod, new Date().toISOString().slice(0, 10), current.paymentStatus || 'pending'),
    ];

    const merged = {
      ...current,
      status: 'frozen',
      paymentHistory,
      financialTransactions,
      updatedAt: new Date().toISOString(),
    } as ClientMembership;

    const normalized = normalizeMembership(merged);
    await updateDoc(doc(db, 'clientMemberships', membershipId), {
      ...normalized,
      membershipPrice: normalized.membershipPrice ?? normalized.totalPrice,
      amountRemaining: Math.max(0, (normalized.totalPrice || 0) - (normalized.amountPaid || 0) - (normalized.discount || 0)),
      updatedAt: new Date().toISOString(),
    });
    setMessage({ text: 'تم تجميد الاشتراك ✅', type: 'success' });
    setTimeout(() => setMessage(null), 2500);
  }, [clientMemberships, setMessage]);

  const resumeMembership = useCallback(async (membershipId: string, note: string) => {
    const current = clientMemberships.find((entry) => entry.id === membershipId);
    if (!current) throw new Error('Membership not found');

    const paymentHistory = [
      ...(current.paymentHistory || []),
      createHistoryEntry('resume', 0, note || 'استئناف الاشتراك', current.paymentMethod, new Date().toISOString().slice(0, 10), current.paymentStatus || 'paid'),
    ];
    const financialTransactions = [
      ...(current.financialTransactions || []),
      createTransactionEntry('resume', 0, 'استئناف الاشتراك', current.paymentMethod, new Date().toISOString().slice(0, 10), current.paymentStatus || 'paid'),
    ];

    const merged = {
      ...current,
      status: 'active',
      paymentHistory,
      financialTransactions,
      updatedAt: new Date().toISOString(),
    } as ClientMembership;

    const normalized = normalizeMembership(merged);
    await updateDoc(doc(db, 'clientMemberships', membershipId), {
      ...normalized,
      membershipPrice: normalized.membershipPrice ?? normalized.totalPrice,
      amountRemaining: Math.max(0, (normalized.totalPrice || 0) - (normalized.amountPaid || 0) - (normalized.discount || 0)),
      updatedAt: new Date().toISOString(),
    });
    setMessage({ text: 'تم استئناف الاشتراك ✅', type: 'success' });
    setTimeout(() => setMessage(null), 2500);
  }, [clientMemberships, setMessage]);

  const deleteClientMembership = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'clientMemberships', id));
  }, []);

  const summaries = useMemo(() => {
    const active = clientMemberships.filter((m) => ['active', 'expiring_7_days', 'expiring_3_days', 'expires_today'].includes(m.status)).length;
    const expired = clientMemberships.filter((m) => m.status === 'expired').length;
    const frozen = clientMemberships.filter((m) => m.status === 'frozen').length;
    const expiringSoon = clientMemberships.filter((m) => ['expiring_7_days', 'expiring_3_days', 'expires_today'].includes(m.status)).length;
    const expiring3Days = clientMemberships.filter((m) => m.status === 'expiring_3_days').length;
    const expiresToday = clientMemberships.filter((m) => m.status === 'expires_today').length;
    return { active, expired, frozen, expiringSoon, expiring3Days, expiresToday };
  }, [clientMemberships]);

  return {
    membershipsRegistry,
    clientMemberships,
    formData,
    setFormData,
    isRenewing,
    setIsRenewing,
    isActivating,
    setIsActivating,
    handleRenew,
    createClientMembership,
    updateClientMembership,
    deleteClientMembership,
    recordPayment,
    renewMembership,
    freezeMembership,
    resumeMembership,
    summaries,
  };
}
