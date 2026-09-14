import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@cml/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout, Field, buttonClass, inputClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, type Organization, type User } from '@/stores/auth';

type FormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await api<{
        user: User;
        organization: Organization | null;
        role: string | null;
      }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setSession({
        user: data.user,
        organization: data.organization,
        role: data.role,
      });
      navigate('/dashboard');
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : 'Login failed';
      setError('root', { message });
    }
  });

  return (
    <AuthLayout title="Sign in" subtitle="Access your contract workspace.">
      <form onSubmit={onSubmit}>
        <Field label="Email" error={errors.email?.message}>
          <input className={inputClass} type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
        </Field>
        {errors.root?.message ? (
          <p className="mb-4 text-sm text-red-600">{errors.root.message}</p>
        ) : null}
        <button className={buttonClass} disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm text-ink-500">
        <Link to="/forgot-password" className="text-accent hover:underline">
          Forgot password?
        </Link>
        <Link to="/register" className="text-accent hover:underline">
          Create account
        </Link>
      </div>
    </AuthLayout>
  );
}
