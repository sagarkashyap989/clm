import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, updateProfileSchema } from '@cml/shared';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { Field, buttonClass, inputClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type ProfileForm = z.infer<typeof updateProfileSchema>;
type PasswordForm = z.infer<typeof changePasswordSchema>;

export function ProfilePage() {
  const { user, setSession, currentOrg, currentRole, memberships, clearSession } =
    useAuthStore();
  const navigate = useNavigate();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(updateProfileSchema),
    values: { name: user?.name ?? '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-950">Profile</h1>
        <p className="mt-2 text-ink-500">Update your account details.</p>
      </div>

      <section className="max-w-md">
        <h2 className="text-lg font-semibold">Name</h2>
        <form
          className="mt-4"
          onSubmit={profileForm.handleSubmit(async (values) => {
            try {
              const data = await api<{ user: NonNullable<typeof user> }>(
                '/api/v1/auth/profile',
                { method: 'PATCH', body: JSON.stringify(values) },
              );
              setSession({
                user: data.user,
                organization: currentOrg,
                role: currentRole,
                memberships,
              });
            } catch (error) {
              profileForm.setError('root', {
                message:
                  error instanceof ApiClientError ? error.message : 'Update failed',
              });
            }
          })}
        >
          <Field label="Full name" error={profileForm.formState.errors.name?.message}>
            <input className={inputClass} {...profileForm.register('name')} />
          </Field>
          {profileForm.formState.errors.root?.message ? (
            <p className="mb-3 text-sm text-red-600">
              {profileForm.formState.errors.root.message}
            </p>
          ) : null}
          <button className={`${buttonClass} w-auto`} type="submit">
            Save profile
          </button>
        </form>
      </section>

      <section className="max-w-md">
        <h2 className="text-lg font-semibold">Change password</h2>
        <form
          className="mt-4"
          onSubmit={passwordForm.handleSubmit(async (values) => {
            try {
              await api('/api/v1/auth/change-password', {
                method: 'POST',
                body: JSON.stringify(values),
              });
              clearSession();
              navigate('/login');
            } catch (error) {
              passwordForm.setError('root', {
                message:
                  error instanceof ApiClientError
                    ? error.message
                    : 'Password change failed',
              });
            }
          })}
        >
          <Field
            label="Current password"
            error={passwordForm.formState.errors.currentPassword?.message}
          >
            <input
              className={inputClass}
              type="password"
              {...passwordForm.register('currentPassword')}
            />
          </Field>
          <Field
            label="New password"
            error={passwordForm.formState.errors.newPassword?.message}
          >
            <input
              className={inputClass}
              type="password"
              {...passwordForm.register('newPassword')}
            />
          </Field>
          {passwordForm.formState.errors.root?.message ? (
            <p className="mb-3 text-sm text-red-600">
              {passwordForm.formState.errors.root.message}
            </p>
          ) : null}
          <button className={`${buttonClass} w-auto`} type="submit">
            Update password
          </button>
        </form>
      </section>
    </div>
  );
}
