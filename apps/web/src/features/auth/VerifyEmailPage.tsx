import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout, buttonClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    void api('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => {
        setStatus('ok');
        setMessage('Email verified. You can continue to your workspace.');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(
          error instanceof ApiClientError ? error.message : 'Verification failed',
        );
      });
  }, [token]);

  return (
    <AuthLayout title="Email verification" subtitle={message}>
      {status !== 'loading' ? (
        <Link to="/dashboard" className={buttonClass}>
          Continue
        </Link>
      ) : null}
    </AuthLayout>
  );
}
