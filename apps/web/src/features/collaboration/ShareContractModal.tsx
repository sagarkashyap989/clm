import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type ContractShare,
  type SharePermission,
  SHARE_PERMISSION_LABELS,
} from '@cml/shared';
import { api } from '@/lib/api';

type ShareContractModalProps = {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  contractName: string;
};

export function ShareContractModal({
  isOpen,
  onClose,
  contractId,
  contractName,
}: ShareContractModalProps) {
  const queryClient = useQueryClient();
  const [shareType, setShareType] = useState<'internal' | 'external_link'>('internal');
  const [userEmail, setUserEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('reviewer');
  const [expiresInDays, setExpiresInDays] = useState<number>(14);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Fetch current shares
  const { data, isLoading } = useQuery({
    queryKey: ['contract-shares', contractId],
    enabled: isOpen && Boolean(contractId),
    queryFn: () => api<{ shares: ContractShare[] }>(`/api/v1/contracts/${contractId}/shares`),
  });

  const shares = data?.shares || [];

  // Create share mutation
  const createShareMutation = useMutation({
    mutationFn: async (payload: {
      type: 'internal' | 'external_link';
      permission: SharePermission;
      userEmail?: string;
      expiresInDays?: number;
    }) => {
      return api(`/api/v1/contracts/${contractId}/shares`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setUserEmail('');
      queryClient.invalidateQueries({ queryKey: ['contract-shares', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts-shared-with-me'] });
    },
  });

  // Revoke share mutation
  const revokeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      return api(`/api/v1/contracts/${contractId}/shares/${shareId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-shares', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts-shared-with-me'] });
    },
  });

  if (!isOpen) return null;

  function handleAddInternalShare(e: React.FormEvent) {
    e.preventDefault();
    if (!userEmail.trim()) return;
    createShareMutation.mutate({
      type: 'internal',
      permission,
      userEmail: userEmail.trim(),
    });
  }

  function handleCreateExternalLink() {
    createShareMutation.mutate({
      type: 'external_link',
      permission,
      expiresInDays: expiresInDays > 0 ? expiresInDays : undefined,
    });
  }

  function handleCopy(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  return (
    <div
      id="share-contract-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-ink-100 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-ink-100 p-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
                Collaboration
              </span>
              <h2 className="font-serif text-lg font-bold text-ink-950">Share Contract</h2>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Manage permissioned team access and external review links for{' '}
              <strong className="text-ink-800">{contractName}</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-400 hover:bg-slate-100 hover:text-ink-700"
          >
            ✕
          </button>
        </div>

        {/* Share Mode Tabs */}
        <div className="flex border-b border-ink-100 bg-slate-50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setShareType('internal')}
            className={`border-b-2 px-4 py-2 text-xs font-bold transition ${
              shareType === 'internal'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            Team Members
          </button>
          <button
            type="button"
            onClick={() => setShareType('external_link')}
            className={`border-b-2 px-4 py-2 text-xs font-bold transition ${
              shareType === 'external_link'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            External Share Links
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {shareType === 'internal' ? (
            /* Tab 1: Internal Share Form */
            <form onSubmit={handleAddInternalShare} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-700">
                  Invite Colleague by Email
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="sarah@example.com or colleague@company.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="flex-1 rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
                  />
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value as SharePermission)}
                    className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-800"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="editor">Editor</option>
                    <option value="approver">Approver</option>
                  </select>
                  <button
                    type="submit"
                    disabled={createShareMutation.isPending}
                    className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {createShareMutation.isPending ? 'Inviting...' : 'Invite'}
                  </button>
                </div>
              </div>

              {/* Quick suggestions */}
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <span>Quick add:</span>
                <button
                  type="button"
                  onClick={() => setUserEmail('sarah@example.com')}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-ink-700 hover:bg-slate-200"
                >
                  Sarah Connor
                </button>
                <button
                  type="button"
                  onClick={() => setUserEmail('john@example.com')}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-ink-700 hover:bg-slate-200"
                >
                  John Doe
                </button>
              </div>
            </form>
          ) : (
            /* Tab 2: External Link Generator */
            <div className="space-y-4">
              <div className="rounded-xl border border-ink-100 bg-slate-50 p-4">
                <h4 className="text-xs font-bold text-ink-900">Generate Secure Preview Link</h4>
                <p className="mt-1 text-[11px] text-ink-500">
                  Allow external counsel or counterparties to view or review this agreement securely
                  without an account.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-ink-700">Role:</span>
                    <select
                      value={permission}
                      onChange={(e) => setPermission(e.target.value as SharePermission)}
                      className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-800"
                    >
                      <option value="viewer">Viewer (Read-only)</option>
                      <option value="reviewer">Reviewer (Can comment)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-ink-700">Expires:</span>
                    <select
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-800"
                    >
                      <option value={7}>In 7 days</option>
                      <option value={14}>In 14 days</option>
                      <option value={30}>In 30 days</option>
                      <option value={0}>No expiration</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateExternalLink}
                    disabled={createShareMutation.isPending}
                    className="rounded-lg bg-ink-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
                  >
                    Generate Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Shares List */}
          <div className="border-t border-ink-100 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700">
              Active Collaborators & Shared Links ({shares.length})
            </h4>

            {isLoading ? (
              <div className="py-4 text-center text-xs text-ink-400">Loading active shares...</div>
            ) : shares.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-ink-200 p-6 text-center text-xs text-ink-400">
                No active shares. Invite members or create an external link above.
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {shares.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-ink-700">
                        {s.type === 'external_link' ? '🔗' : (s.sharedWithUser?.name?.[0] || 'U')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ink-900">
                            {s.type === 'external_link'
                              ? 'Public Review Link'
                              : s.sharedWithUser?.name || 'Authorized Member'}
                          </span>
                          <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                            {SHARE_PERMISSION_LABELS[s.permission]}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-500">
                          {s.type === 'external_link'
                            ? `Expires ${s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : 'Never'}`
                            : s.sharedWithUser?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {s.shareUrl && (
                        <button
                          type="button"
                          onClick={() => handleCopy(s.shareUrl!, s.id)}
                          className="rounded-lg border border-ink-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-slate-100"
                        >
                          {copiedToken === s.id ? '✓ Copied' : 'Copy Link'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => revokeShareMutation.mutate(s.id)}
                        disabled={revokeShareMutation.isPending}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-ink-100 bg-slate-50 px-6 py-3 text-xs">
          <span className="text-[11px] text-ink-500">
            Permissioned members see this agreement in their &ldquo;Shared With Me&rdquo; dashboard.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-ink-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-ink-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
