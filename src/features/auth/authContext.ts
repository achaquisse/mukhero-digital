import { createContext, useContext } from 'react';
import type { User } from '../../domain/types';

export interface AuthState {
  /** undefined while the session is being restored. */
  user: User | null | undefined;
}

export const AuthContext = createContext<AuthState>({ user: undefined });

export const useAuth = () => useContext(AuthContext);

/** The signed-in user. Only use below the RequireUser guard. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser() called without a signed-in user');
  return user;
}
