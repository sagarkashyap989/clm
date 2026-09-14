import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout, buttonClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

type InvitePreview = {
  email: string;
  role: string;
  organization: { id: string; name: string } | null;
};

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token.');
      return;
    }
    void api<{ invitation: InvitePreview }>(
      `/api/v1/organizations/invitations/preview?token=${encodeURIComponent(token)}`,
    )
      .then((data) => setInvite(data.invitation))
      .catch((err: unknown) => {
        setError(err instanceof ApiClientError ? err.message : 'Invalid invitation');
      });
  }, [token]);

  return (
    <AuthLayout
      title="Organization invitation"
      subtitle={
        invite
          ? `Join ${invite.organization?.name ?? 'the organization'} as ${invite.role}.`
          : error ?? 'Loading invitation…'
      }
    >
      {invite ? (
        <div className="space-y-3 text-sm text-ink-700">
          <p>
            Invited email: <strong>{invite.email}</strong>
          </p>
          <Link
            to={`/register?token=${encodeURIComponent(token)}`}
            className={buttonClass}
          >
            Create account & accept
          </Link>
          <p>
            Already registered?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Sign in
            </Link>{' '}
            then ask an admin to re-invite if needed.
          </p>
        </div>
      ) : null}
    </AuthLayout>
  );
}
