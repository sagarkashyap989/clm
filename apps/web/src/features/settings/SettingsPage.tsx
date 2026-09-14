import { zodResolver } from '@hookform/resolvers/zod';
import { inviteMemberSchema, ORG_ROLES, updateOrganizationSchema } from '@cml/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Field, buttonClass, inputClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string } | null;
};

type OrgForm = z.infer<typeof updateOrganizationSchema>;
type InviteForm = z.infer<typeof inviteMemberSchema>;

export function SettingsPage() {
  const { currentOrg, currentRole, setSession, user, memberships } = useAuthStore();
  const isAdmin = currentRole === 'admin';
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ['members', currentOrg?.id],
    enabled: Boolean(currentOrg?.id),
    queryFn: () =>
      api<{ members: Member[] }>(`/api/v1/organizations/${currentOrg!.id}/members`),
  });

  const orgForm = useForm<OrgForm>({
    resolver: zodResolver(updateOrganizationSchema),
    values: { name: currentOrg?.name ?? '' },
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'member' },
  });

  const updateOrg = useMutation({
    mutationFn: (values: OrgForm) =>
      api<{ organization: { id: string; name: string } }>(
        `/api/v1/organizations/${currentOrg!.id}`,
        { method: 'PATCH', body: JSON.stringify(values) },
      ),
    onSuccess: (data) => {
      if (user) {
        setSession({
          user,
          organization: data.organization,
          role: currentRole,
          memberships: memberships.map((m) =>
            m.organization?.id === data.organization.id
              ? { ...m, organization: data.organization }
              : m,
          ),
        });
      }
    },
  });

  const inviteMember = useMutation({
    mutationFn: (values: InviteForm) =>
      api(`/api/v1/organizations/${currentOrg!.id}/members/invite`, {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      inviteForm.reset({ email: '', role: 'member' });
      void queryClient.invalidateQueries({ queryKey: ['members', currentOrg?.id] });
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api(`/api/v1/organizations/${currentOrg!.id}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', currentOrg?.id] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      api(`/api/v1/organizations/${currentOrg!.id}/members/${memberId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', currentOrg?.id] });
    },
  });

  if (!currentOrg) {
    return <p className="text-ink-500">No organization selected.</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-950">Organization</h1>
        <p className="mt-2 text-ink-500">Manage workspace settings and members.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Settings</h2>
        {isAdmin ? (
          <form
            className="mt-4 max-w-md"
            onSubmit={orgForm.handleSubmit((values) => updateOrg.mutate(values))}
          >
            <Field label="Organization name" error={orgForm.formState.errors.name?.message}>
              <input className={inputClass} {...orgForm.register('name')} />
            </Field>
            {updateOrg.error ? (
              <p className="mb-3 text-sm text-red-600">
                {updateOrg.error instanceof ApiClientError
                  ? updateOrg.error.message
                  : 'Update failed'}
              </p>
            ) : null}
            <button className={`${buttonClass} w-auto`} disabled={updateOrg.isPending}>
              Save name
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-ink-500">
            Only admins can update organization settings.
          </p>
        )}
      </section>

      {isAdmin ? (
        <section>
          <h2 className="text-lg font-semibold">Invite member</h2>
          <form
            className="mt-4 grid max-w-xl gap-3 sm:grid-cols-[1fr_140px_auto]"
            onSubmit={inviteForm.handleSubmit((values) => inviteMember.mutate(values))}
          >
            <input
              className={inputClass}
              placeholder="Email"
              type="email"
              {...inviteForm.register('email')}
            />
            <select className={inputClass} {...inviteForm.register('role')}>
              {ORG_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button className={`${buttonClass} w-auto`} disabled={inviteMember.isPending}>
              Invite
            </button>
          </form>
          {inviteMember.isSuccess ? (
            <p className="mt-2 text-sm text-accent">Invitation sent (check Mailhog).</p>
          ) : null}
          {inviteMember.error ? (
            <p className="mt-2 text-sm text-red-600">
              {inviteMember.error instanceof ApiClientError
                ? inviteMember.error.message
                : 'Invite failed'}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">Members</h2>
        {membersQuery.isLoading ? (
          <p className="mt-3 text-sm text-ink-500">Loading…</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
            {membersQuery.data?.members.map((member) => (
              <li
                key={member.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{member.user?.name}</p>
                  <p className="text-sm text-ink-500">{member.user?.email}</p>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <select
                      className={inputClass}
                      value={member.role}
                      onChange={(event) =>
                        updateRole.mutate({
                          memberId: member.id,
                          role: event.target.value,
                        })
                      }
                    >
                      {ORG_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    {member.user?.id !== user?.id ? (
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700"
                        onClick={() => {
                          if (window.confirm('Remove this member?')) {
                            removeMember.mutate(member.id);
                          }
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span className="capitalize text-sm text-ink-500">{member.role}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
