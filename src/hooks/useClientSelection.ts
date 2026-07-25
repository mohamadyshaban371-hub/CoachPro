import { useCallback, useState } from 'react';
import type { UserProfile } from '../types';

export function useClientSelection() {
  const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const handleSelectClient = useCallback((client: UserProfile | null) => {
    setSelectedClient(client);
    if (!client) {
      setExpandedClient(null);
    }
  }, []);

  const toggleClientDetails = useCallback((clientId: string | null) => {
    setExpandedClient((prev) => (prev === clientId ? null : clientId));
  }, []);

  return {
    selectedClient,
    setSelectedClient: handleSelectClient,
    expandedClient,
    setExpandedClient: toggleClientDetails,
  };
}
