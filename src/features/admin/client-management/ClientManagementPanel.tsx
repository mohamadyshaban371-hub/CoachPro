import React from 'react';

interface ClientManagementPanelProps {
  children?: React.ReactNode;
}

export default function ClientManagementPanel({ children }: ClientManagementPanelProps) {
  return <>{children}</>;
}
