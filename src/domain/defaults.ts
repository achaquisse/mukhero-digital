import { PALETTE } from './constants';
import { uid } from './id';
import type { ExpenseCategory, Member, OrgData, Role, Settings, User } from './types';

/** Stand-in identity until a real Google sign-in is wired up. */
export const DEMO_USER: User = {
  id: 'u-carlos',
  name: 'Carlos Machava',
  email: 'carlos@mukhero-digital.co.mz',
  initials: 'CM',
};

export const asMember = (u: User, role: Role): Member => ({
  userId: u.id,
  name: u.name,
  email: u.email,
  initials: u.initials,
  avatarUrl: u.avatarUrl,
  role,
});

const defaultSettings = (margin = 35): Settings => ({ currency: 'MT', fx: 64, margin, minStock: 5 });

export const defaultCategories = (): ExpenseCategory[] =>
  ['Renda', 'Transporte', 'Taxas bancárias', 'Salários', 'Marketing', 'Outros'].map((name, i) => ({
    id: `c${i}`,
    name,
    color: PALETTE[i % PALETTE.length]!,
  }));

export const emptyOrgData = (user: User = DEMO_USER): OrgData => ({
  settings: defaultSettings(),
  types: [{ id: uid(), name: 'Geral' }],
  cats: defaultCategories(),
  products: [],
  lots: [],
  sales: [],
  expenses: [],
  members: [asMember(user, 'Admin')],
  joinReqs: [],
  invites: [],
});
