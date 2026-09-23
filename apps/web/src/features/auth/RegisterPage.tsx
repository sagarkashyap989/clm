import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@cml/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout, Field, buttonClass, inputClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, type Organization, type User } from '@/stores/auth';

type FormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('token') ?? undefined;
  const setSession = useAuthStore((s) => s.setSession);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      inviteToken,
      organizationName: inviteToken ? undefined : '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await api<{
        user: User;
        organization: Organization;
        role: string;
      }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      const me = await api<{
        user: User;
        memberships: { id: string; role: string; organization: Organization | null }[];
      }>('/api/v1/auth/me');
      setSession({
        user: me.user,
        memberships: me.memberships,
        organization: data.organization,
        role: data.role,
      });
      navigate('/dashboard');
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : 'Registration failed';
      setError('root', { message });
    }
  });

  return (
    <AuthLayout
      title={inviteToken ? 'Join organization' : 'Create account'}
      subtitle={
        inviteToken
          ? 'Accept your invitation and set up your account.'
          : 'Start a new organization workspace.'
      }
    >
      <form onSubmit={onSubmit}>
        <Field label="Full name" error={errors.name?.message}>
          <input className={inputClass} {...register('name')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input className={inputClass} type="email" {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input className={inputClass} type="password" {...register('password')} />
        </Field>
        {!inviteToken ? (
          <Field label="Organization name" error={errors.organizationName?.message}>
            <input className={inputClass} {...register('organizationName')} />
          </Field>
        ) : (
          <>
            <input type="hidden" {...register('inviteToken')} />
            <p className="mb-4 text-sm text-ink-500">
              Use the same email that received the invitation.
            </p>
          </>
        )}
        {errors.root?.message ? (
          <p className="mb-4 text-sm text-red-600">{errors.root.message}</p>
        ) : null}
        <button className={buttonClass} disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Creating…' : inviteToken ? 'Accept & join' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
