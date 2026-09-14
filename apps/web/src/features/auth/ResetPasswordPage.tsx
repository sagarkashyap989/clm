import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@cml/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout, Field, buttonClass, inputClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

type FormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      navigate('/login');
    } catch (error) {
      setError('root', {
        message: error instanceof ApiClientError ? error.message : 'Reset failed',
      });
    }
  });

  return (
    <AuthLayout title="Reset password" subtitle="Choose a new password for your account.">
      <form onSubmit={onSubmit}>
        <input type="hidden" {...register('token')} />
        <Field label="New password" error={errors.password?.message}>
          <input className={inputClass} type="password" {...register('password')} />
        </Field>
        {errors.root?.message ? (
          <p className="mb-4 text-sm text-red-600">{errors.root.message}</p>
        ) : null}
        <button className={buttonClass} disabled={isSubmitting || !token} type="submit">
          Update password
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
