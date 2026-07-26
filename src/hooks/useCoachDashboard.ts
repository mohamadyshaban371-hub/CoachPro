import { useMemo } from 'react';
import { buildCoachDashboardAnalytics } from '../lib/coachDashboard';
import type { ClientMembership, Membership, UserProfile } from '../types';

interface UseCoachDashboardArgs {
  clients: UserProfile[];
  clientMemberships: ClientMembership[];
  memberships: Membership[];
  loading: boolean;
  error: string | null;
}

export function useCoachDashboard({ clients, clientMemberships, memberships, loading, error }: UseCoachDashboardArgs) {
  return useMemo(() => {
    if (loading) {
      return {
        analytics: null,
        loading,
        error,
      };
    }

    return {
      analytics: buildCoachDashboardAnalytics(clients, clientMemberships, memberships),
      loading,
      error,
    };
  }, [clients, clientMemberships, memberships, loading, error]);
}
