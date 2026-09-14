import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string } | null;
};

export function DashboardPage() {
  const { user, currentOrg, currentRole } = useAuthStore();

  const membersQuery = useQuery({
    queryKey: ['members', currentOrg?.id],
    enabled: Boolean(currentOrg?.id),
    queryFn: () =>
      api<{ members: Member[] }>(`/api/v1/organizations/${currentOrg!.id}/members`),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink-950">Dashboard</h1>
      <p className="mt-2 text-ink-500">
        Phase 1 workspace overview for {currentOrg?.name ?? 'your organization'}.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-100 bg-slate-50 p-4">
          <p className="text-sm text-ink-500">Signed in as</p>
          <p className="mt-1 font-semibold">{user?.name}</p>
          <p className="text-sm text-ink-500">{user?.email}</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-slate-50 p-4">
          <p className="text-sm text-ink-500">Organization</p>
          <p className="mt-1 font-semibold">{currentOrg?.name ?? '—'}</p>
          <p className="capitalize text-sm text-ink-500">{currentRole ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-slate-50 p-4">
          <p className="text-sm text-ink-500">Email status</p>
          <p className="mt-1 font-semibold">
            {user?.emailVerified ? 'Verified' : 'Pending verification'}
          </p>
          {!user?.emailVerified ? (
            <p className="mt-1 text-sm text-ink-500">
              Check Mailhog at http://localhost:8025
            </p>
          ) : null}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Members</h2>
        {membersQuery.isLoading ? (
          <p className="mt-3 text-sm text-ink-500">Loading members…</p>
        ) : membersQuery.isError ? (
          <p className="mt-3 text-sm text-red-600">Could not load members.</p>
        ) : membersQuery.data?.members.length ? (
          <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
            {membersQuery.data.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{member.user?.name ?? 'Unknown'}</p>
                  <p className="text-sm text-ink-500">{member.user?.email}</p>
                </div>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold capitalize text-accent">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-500">No members found.</p>
        )}
      </section>
    </div>
  );
}
