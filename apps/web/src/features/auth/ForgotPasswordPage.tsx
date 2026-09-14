import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@cml/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout, Field, buttonClass, inputClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setDone(true);
    } catch (error) {
      setError('root', {
        message: error instanceof ApiClientError ? error.message : 'Request failed',
      });
    }
  });

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll email you a reset link if the account exists."
    >
      {done ? (
        <p className="text-sm text-ink-700">
          If an account exists for that email, a reset link has been sent. Check Mailhog
          at <code>http://localhost:8025</code> in development.
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <Field label="Email" error={errors.email?.message}>
            <input className={inputClass} type="email" {...register('email')} />
          </Field>
          {errors.root?.message ? (
            <p className="mb-4 text-sm text-red-600">{errors.root.message}</p>
          ) : null}
          <button className={buttonClass} disabled={isSubmitting} type="submit">
            Send reset link
          </button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link to="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
