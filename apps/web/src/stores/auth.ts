import { create } from 'zustand';
import { api } from '@/lib/api';

const CURRENT_ORG_KEY = 'cml.currentOrgId';

function readStoredOrgId(): string | null {
  try {
    return window.localStorage.getItem(CURRENT_ORG_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrgId(orgId: string | null) {
  try {
    if (orgId) {
      window.localStorage.setItem(CURRENT_ORG_KEY, orgId);
    } else {
      window.localStorage.removeItem(CURRENT_ORG_KEY);
    }
  } catch {
    // Ignore storage failures (private mode).
  }
}

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
  switchOrganization: (organizationId: string) => void;
  clearSession: () => void;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
};

function pickMembership(
  memberships: Membership[],
  preferred?: Organization | null,
): Membership | undefined {
  const storedOrgId = readStoredOrgId();
  return (
    memberships.find((m) => preferred && m.organization?.id === preferred.id) ??
    memberships.find((m) => m.organization?.id === storedOrgId) ??
    memberships.find((m) => m.organization) ??
    undefined
  );
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  memberships: [],
  currentOrg: null,
  currentRole: null,
  loading: true,
  setSession: ({ user, organization, role, memberships }) => {
    const nextMemberships = memberships ?? get().memberships;
    const selected = pickMembership(nextMemberships, organization);
    const currentOrg = selected?.organization ?? organization ?? null;
    const currentRole = role ?? selected?.role ?? null;
    writeStoredOrgId(currentOrg?.id ?? null);
    set({
      user,
      memberships: nextMemberships,
      currentOrg,
      currentRole,
      loading: false,
    });
  },
  switchOrganization: (organizationId) => {
    const selected = get().memberships.find((m) => m.organization?.id === organizationId);
    if (!selected?.organization) return;
    writeStoredOrgId(selected.organization.id);
    set({
      currentOrg: selected.organization,
      currentRole: selected.role,
    });
  },
  clearSession: () => {
    writeStoredOrgId(null);
    set({
      user: null,
      memberships: [],
      currentOrg: null,
      currentRole: null,
      loading: false,
    });
  },
  bootstrap: async () => {
    try {
      const data = await api<{
        user: User;
        memberships: Membership[];
      }>('/api/v1/auth/me');
      get().setSession({
        user: data.user,
        memberships: data.memberships,
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
