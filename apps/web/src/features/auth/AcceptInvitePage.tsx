import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout, buttonClass } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, type Organization } from '@/stores/auth';

type InvitePreview = {
  email: string;
  role: string;
  organization: { id: string; name: string } | null;
};

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, logout, setSession } = useAuthStore();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

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

  const emailMatches = Boolean(
    user && invite && user.email.toLowerCase() === invite.email.toLowerCase(),
  );

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const data = await api<{ organization: Organization; role: string }>(
        '/api/v1/organizations/invitations/accept',
        { method: 'POST', body: JSON.stringify({ token }) },
      );
      const me = await api<{
        user: NonNullable<typeof user>;
        memberships: {
          id: string;
          role: string;
          organization: Organization | null;
        }[];
      }>('/api/v1/auth/me');
      setSession({
        user: me.user,
        memberships: me.memberships,
        organization: data.organization,
        role: data.role,
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not accept invitation');
    } finally {
      setAccepting(false);
    }
  }

  async function handleCreateAccount() {
    if (user) {
      await logout();
    }
    navigate(`/register?token=${encodeURIComponent(token)}`);
  }

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
          {error ? <p className="text-red-600">{error}</p> : null}

          {emailMatches ? (
            <button className={buttonClass} type="button" disabled={accepting} onClick={() => void handleAccept()}>
              {accepting ? 'Joining…' : 'Accept invitation'}
            </button>
          ) : user ? (
            <>
              <p>
                You are signed in as <strong>{user.email}</strong>, which does not match this
                invitation. Sign out, then sign in as {invite.email}.
              </p>
              <button
                className={buttonClass}
                type="button"
                onClick={() => {
                  void logout().then(() =>
                    navigate(`/login?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`),
                  );
                }}
              >
                Sign out and continue
              </button>
            </>
          ) : (
            <>
              <button className={buttonClass} type="button" onClick={() => void handleCreateAccount()}>
                Create account & accept
              </button>
              <p>
                Already have an account?{' '}
                <Link
                  to={`/login?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
                  className="text-accent hover:underline"
                >
                  Sign in to accept
                </Link>
              </p>
            </>
          )}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </AuthLayout>
  );
}
