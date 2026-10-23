import { createContext, useContext } from 'react';
import type { Analytics } from '../domain/analytics';
import type { Derived } from '../domain/derive';
import type { Org, OrgData } from '../domain/types';

export interface OrgDataValue {
  org: Org;
  db: OrgData;
  derived: Derived;
  analytics: Analytics;
}

export const OrgDataContext = createContext<OrgDataValue | null>(null);

export function useOrgData(): OrgDataValue {
  const v = useContext(OrgDataContext);
  if (!v) throw new Error('useOrgData() must be used inside <OrgDataProvider>');
  return v;
}
