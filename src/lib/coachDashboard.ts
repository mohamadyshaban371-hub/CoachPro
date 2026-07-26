import { ClientMembership, Membership, MeasurementHistory, UserProfile } from '../types';

export interface CoachDashboardStats {
  totalClients: number;
  activeMemberships: number;
  expiredMemberships: number;
  monthlyRevenue: number;
  newClientsThisMonth: number;
}

export interface CoachDashboardChartPoint {
  month: string;
  label: string;
  clients: number;
  memberships: number;
}

export interface CoachDashboardRevenuePoint {
  month: string;
  label: string;
  revenue: number;
}

export interface CoachDashboardActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  kind: 'client' | 'membership' | 'progress';
}

export interface CoachDashboardExpiringMembership {
  id: string;
  clientName: string;
  daysLeft: number;
  planName: string;
  amountRemaining: number;
}

export interface CoachDashboardAnalytics {
  stats: CoachDashboardStats;
  growthChart: CoachDashboardChartPoint[];
  revenueChart: CoachDashboardRevenuePoint[];
  registrations: number;
  averageWeightProgress: number;
  recentActivity: CoachDashboardActivityItem[];
  expiringMemberships: CoachDashboardExpiringMembership[];
}

const MONTHS = 6;

function getMonthKey(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  const parsed = new Date(year, month - 1, 1);
  return parsed.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthKeys(count = MONTHS) {
  const keys: string[] = [];
  const today = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function getWeightDelta(entry: MeasurementHistory | undefined, previous: MeasurementHistory | undefined) {
  if (!entry || !previous) return 0;
  return Number((entry.weight - previous.weight).toFixed(1));
}

function getPaymentValue(membership: ClientMembership) {
  const financialTransactions = membership.financialTransactions || [];
  const paymentHistory = membership.paymentHistory || [];
  const entries = [...financialTransactions, ...paymentHistory];
  const seen = new Set<string>();
  let total = 0;

  entries.forEach((entry: any) => {
    if (!entry || !entry.id) return;
    if (seen.has(entry.id)) return;
    seen.add(entry.id);
    const type = entry.type || entry.kind;
    if (type === 'payment' || type === 'renewal' || type === 'adjustment' || type === 'manual') {
      total += Number(entry.amount || 0);
    }
  });

  return total;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildCoachDashboardAnalytics(
  clients: UserProfile[],
  clientMemberships: ClientMembership[],
  memberships: Membership[] = []
): CoachDashboardAnalytics {
  const activeStatuses = new Set(['active', 'expiring_7_days', 'expiring_3_days', 'expires_today']);
  const expiredStatuses = new Set(['expired', 'cancelled']);

  const currentMonthKey = getCurrentMonthKey();
  const monthKeys = getMonthKeys();

  const growthChart: CoachDashboardChartPoint[] = monthKeys.map((month) => ({
    month,
    label: getMonthLabel(month),
    clients: clients.filter((client) => getMonthKey(client.createdAt) === month).length,
    memberships: clientMemberships.filter((membership) => getMonthKey(membership.createdAt) === month).length,
  }));

  const revenueChart: CoachDashboardRevenuePoint[] = monthKeys.map((month) => {
    const revenue = clientMemberships.reduce((sum, membership) => {
      const transactions = membership.financialTransactions || [];
      const paymentEntries = transactions.filter((entry: any) => {
        const entryMonth = getMonthKey(entry.date || entry.createdAt || membership.createdAt);
        return entryMonth === month && ['payment', 'renewal', 'adjustment', 'manual'].includes(entry.type || 'payment');
      });
      return sum + paymentEntries.reduce((innerSum: number, entry: any) => innerSum + Number(entry.amount || 0), 0);
    }, 0);
    return { month, label: getMonthLabel(month), revenue };
  });

  const stats: CoachDashboardStats = {
    totalClients: clients.length,
    activeMemberships: clientMemberships.filter((membership) => activeStatuses.has(membership.status)).length,
    expiredMemberships: clientMemberships.filter((membership) => expiredStatuses.has(membership.status)).length,
    monthlyRevenue: clientMemberships.reduce((sum, membership) => {
      const transactions = membership.financialTransactions || [];
      const paymentEntries = transactions.filter((entry: any) => {
        const entryMonth = getMonthKey(entry.date || entry.createdAt || membership.createdAt);
        return entryMonth === currentMonthKey && ['payment', 'renewal', 'adjustment', 'manual'].includes(entry.type || 'payment');
      });
      return sum + paymentEntries.reduce((innerSum: number, entry: any) => innerSum + Number(entry.amount || 0), 0);
    }, 0),
    newClientsThisMonth: clients.filter((client) => getMonthKey(client.createdAt) === currentMonthKey).length,
  };

  const registrations = clients.length;

  const weightProgress = clients
    .map((client) => {
      const history = [...(client.measurementHistory || [])].sort((left, right) => left.date.localeCompare(right.date));
      if (history.length < 2) return 0;
      return getWeightDelta(history[history.length - 1], history[0]);
    })
    .filter((delta) => Number.isFinite(delta));

  const averageWeightProgress = weightProgress.length
    ? Number((weightProgress.reduce((sum, value) => sum + value, 0) / weightProgress.length).toFixed(1))
    : 0;

  const recentActivity: CoachDashboardActivityItem[] = [
    ...clients.map((client) => ({
      id: `client-${client.uid}`,
      title: 'عميل جديد',
      description: `${client.name || 'عميل'} أُضيف إلى النظام`,
      timestamp: client.createdAt || new Date().toISOString(),
      kind: 'client' as const,
    })),
    ...clientMemberships.map((membership) => ({
      id: `membership-${membership.id}`,
      title: 'عضوية مُحدثة',
      description: `${membership.membershipName || 'عضوية'} • ${membership.status}`,
      timestamp: membership.updatedAt || membership.createdAt || new Date().toISOString(),
      kind: 'membership' as const,
    })),
    ...clients.flatMap((client) => {
      const history = [...(client.measurementHistory || [])].sort((left, right) => left.date.localeCompare(right.date));
      const latest = history[history.length - 1];
      if (!latest) return [] as CoachDashboardActivityItem[];
      return [{
        id: `progress-${client.uid}`,
        title: 'تحديث قياس',
        description: `${client.name || 'عميل'} • ${latest.weight} كجم`,
        timestamp: latest.date,
        kind: 'progress' as const,
      }];
    }),
  ]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 8);

  const expiringMemberships: CoachDashboardExpiringMembership[] = clientMemberships
    .filter((membership) => ['expiring_7_days', 'expiring_3_days', 'expires_today', 'expired'].includes(membership.status))
    .map((membership) => ({
      id: membership.id,
      clientName: clients.find((client) => client.uid === membership.clientId)?.name || 'عميل',
      daysLeft: membership.remainingDays ?? 0,
      planName: membership.membershipName || 'عضوية',
      amountRemaining: Number((membership.amountRemaining || 0).toFixed(0)),
    }))
    .sort((left, right) => left.daysLeft - right.daysLeft)
    .slice(0, 5);

  return {
    stats,
    growthChart,
    revenueChart,
    registrations,
    averageWeightProgress,
    recentActivity,
    expiringMemberships,
  };
}

export function formatCoachCurrency(value: number) {
  return formatCurrency(value);
}
