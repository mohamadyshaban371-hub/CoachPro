import React from 'react';
import MembershipManagerNew from './MembershipManagerNew';
import type { UserProfile } from '../types';

interface Props {
  clients?: UserProfile[];
}

export default function MembershipManager({ clients = [] }: Props) {
  return <MembershipManagerNew clients={clients} />;
}
