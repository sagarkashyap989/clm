import { create } from 'zustand';
import { api } from '@/lib/api';

export type User = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type Organization = {
  id: string;
  name: string;
};

export type Membership = {
  id: string;
  role: string;
  organization: Organization | null;
};

type AuthState = {
  user: User | null;
  memberships: Membership[];
  currentOrg: Organization | null;
  currentRole: string | null;
  loading: boolean;
  setSession: (payload: {
    user: User;
    organization?: Organization | null;
    role?: string | null;
    memberships?: Membership[];
  }) => void;
  clearSession: () => void;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  memberships: [],
  currentOrg: null,
  currentRole: null,
  loading: true,
  setSession: ({ user, organization, role, memberships }) => {
    const nextMemberships = memberships ?? get().memberships;
    const currentOrg =
      organization ??
      nextMemberships.find((m) => m.organization)?.organization ??
      null;
    const currentRole =
      role ??
      nextMemberships.find((m) => m.organization?.id === currentOrg?.id)?.role ??
      null;
    set({
      user,
      memberships: nextMemberships,
      currentOrg,
      currentRole,
      loading: false,
    });
  },
  clearSession: () =>
    set({
      user: null,
      memberships: [],
      currentOrg: null,
      currentRole: null,
      loading: false,
    }),
  bootstrap: async () => {
    try {
      const data = await api<{
        user: User;
        memberships: Membership[];
      }>('/api/v1/auth/me');
      get().setSession({
        user: data.user,
        memberships: data.memberships,
        organization: data.memberships[0]?.organization ?? null,
        role: data.memberships[0]?.role ?? null,
      });
    } catch {
      get().clearSession();
    }
  },
  logout: async () => {
    try {
      await api('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      get().clearSession();
    }
  },
}));
