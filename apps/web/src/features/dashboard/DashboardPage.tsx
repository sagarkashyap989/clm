import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { CONTRACT_STATUS_LABELS } from '@cml/shared';
import { getStatusBadgeClass, type ContractItem } from '../contracts/ContractsPage';
import { UploadContractModal } from '../contracts/UploadContractModal';

type DashboardSummaryData = {
  metrics: {
    totalContracts: number;
    pendingReview: number;
    recentlyUpdated: number;
    sharedWithMe: number;
  };
  recentContracts: ContractItem[];
  pendingContracts: ContractItem[];
};

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string } | null;
};

export function DashboardPage() {
  const { user, currentOrg, currentRole } = useAuthStore();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'recent' | 'pending' | 'shared'>('recent');

  const summaryQuery = useQuery({
    queryKey: ['contract-summary', currentOrg?.id],
    enabled: Boolean(currentOrg?.id),
    queryFn: () => api<DashboardSummaryData>('/api/v1/contracts/dashboard-summary'),
  });

  const sharedQuery = useQuery({
    queryKey: ['contracts-shared-with-me', currentOrg?.id],
    enabled: Boolean(currentOrg?.id),
    queryFn: () =>
      api<{ contracts: (ContractItem & { myPermission?: string; sharedAt?: string })[] }>(
        '/api/v1/contracts/shared-with-me',
      ),
  });

  const membersQuery = useQuery({
    queryKey: ['members', currentOrg?.id],
    enabled: Boolean(currentOrg?.id),
    queryFn: () =>
      api<{ members: Member[] }>(`/api/v1/organizations/${currentOrg!.id}/members`),
  });

  const metrics = summaryQuery.data?.metrics ?? {
    totalContracts: 0,
    pendingReview: 0,
    recentlyUpdated: 0,
    sharedWithMe: 0,
  };

  const recentContracts = summaryQuery.data?.recentContracts ?? [];
  const pendingContracts = summaryQuery.data?.pendingContracts ?? [];
  const sharedContracts = sharedQuery.data?.contracts ?? [];

  return (
    <div className="space-y-8">
      {/* Top Greeting & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-950">
            Welcome back, {user?.name?.split(' ')[0] ?? 'User'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Contract workspace for{' '}
            <strong className="text-ink-700">{currentOrg?.name ?? 'Organization'}</strong> • Role:{' '}
            <span className="capitalize text-accent font-semibold">{currentRole}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/contracts"
            className="rounded-xl border border-ink-100 bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 shadow-sm transition hover:bg-slate-50"
          >
            View Repository
          </Link>
          <button
            type="button"
            id="dashboard-upload-btn"
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Upload Contract
          </button>
        </div>
      </div>

      {/* 4 Spec Overview Metric Cards (Spec §7, §69) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Total Contracts
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-accent font-bold text-sm">
              📄
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-ink-950">
            {metrics.totalContracts}
          </p>
          <p className="mt-1 text-xs text-ink-500">Active repository documents</p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Pending Review
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-bold text-sm">
              ⏳
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-amber-600">
            {metrics.pendingReview}
          </p>
          <p className="mt-1 text-xs text-ink-500">Requires review or approval</p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Recently Updated
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 font-bold text-sm">
              ⚡
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-sky-600">
            {metrics.recentlyUpdated}
          </p>
          <p className="mt-1 text-xs text-ink-500">Updated within past 7 days</p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Shared With Me
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 font-bold text-sm">
              👥
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-purple-600">
            {metrics.sharedWithMe}
          </p>
          <p className="mt-1 text-xs text-ink-500">Accessible collaborations</p>
        </div>
      </div>

      {/* Main Dashboard Layout: Recent Contracts & Pending Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2/3): Interactive Tabs Table */}
        <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('recent')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === 'recent'
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-600 hover:bg-slate-100'
                }`}
              >
                Recent Contracts ({recentContracts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'text-ink-600 hover:bg-slate-100'
                }`}
              >
                Pending Review ({pendingContracts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('shared')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === 'shared'
                    ? 'bg-purple-600 text-white'
                    : 'text-ink-600 hover:bg-slate-100'
                }`}
              >
                Shared With Me ({sharedContracts.length})
              </button>
            </div>

            <Link
              to="/contracts"
              className="text-xs font-semibold text-accent hover:underline"
            >
              View Repository →
            </Link>
          </div>

          {activeTab === 'recent' && (
            recentContracts.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-500">
                No contracts found in repository. Upload your first document!
              </div>
            ) : (
              <div className="divide-y divide-ink-100">
                {recentContracts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-3.5 transition hover:bg-slate-50/50"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <Link
                        to={`/contracts/${c.id}`}
                        className="truncate font-semibold text-ink-900 hover:text-accent hover:underline block text-sm"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-500">
                        <span>{c.counterparty || 'No counterparty'}</span>
                        <span>•</span>
                        <span>Owner: {c.owner?.name ?? 'User'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                          c.status,
                        )}`}
                      >
                        {CONTRACT_STATUS_LABELS[c.status]}
                      </span>
                      <Link
                        to={`/contracts/${c.id}`}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-slate-200"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'pending' && (
            pendingContracts.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-500">
                No pending contracts requiring review.
              </div>
            ) : (
              <div className="divide-y divide-ink-100">
                {pendingContracts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-3.5 transition hover:bg-slate-50/50"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <Link
                        to={`/contracts/${c.id}`}
                        className="truncate font-semibold text-ink-900 hover:text-accent hover:underline block text-sm"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-500">
                        <span>{c.counterparty || 'No counterparty'}</span>
                        <span>•</span>
                        <span className="text-amber-700 font-medium">Awaiting Review/Sign-off</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                          c.status,
                        )}`}
                      >
                        {CONTRACT_STATUS_LABELS[c.status]}
                      </span>
                      <Link
                        to={`/contracts/${c.id}`}
                        className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'shared' && (
            sharedContracts.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-500">
                No contracts shared with you yet.
              </div>
            ) : (
              <div className="divide-y divide-ink-100">
                {sharedContracts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-3.5 transition hover:bg-slate-50/50"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/contracts/${c.id}`}
                          className="truncate font-semibold text-ink-900 hover:text-accent hover:underline block text-sm"
                        >
                          {c.name}
                        </Link>
                        {c.myPermission && (
                          <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase">
                            {c.myPermission}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-500">
                        <span>Counterparty: {c.counterparty || 'Not specified'}</span>
                        <span>•</span>
                        <span>Owner: {c.owner?.name ?? 'User'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                          c.status,
                        )}`}
                      >
                        {CONTRACT_STATUS_LABELS[c.status]}
                      </span>
                      <Link
                        to={`/contracts/${c.id}`}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-slate-200"
                      >
                        Collaborate
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </section>

        {/* Right Column (1/3): Pending Actions & Team Overview */}
        <div className="space-y-6">
          {/* Pending Actions */}
          <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-ink-950">
              Pending Actions
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">Contracts requiring review or signature</p>

            {pendingContracts.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-ink-100 p-4 text-center text-xs text-ink-500">
                All caught up! No urgent review actions needed.
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {pendingContracts.map((c) => (
                  <Link
                    key={c.id}
                    to={`/contracts/${c.id}`}
                    className="block rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 transition hover:bg-amber-50"
                  >
                    <p className="truncate text-xs font-bold text-ink-950">{c.name}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800">
                      <span className="capitalize">{CONTRACT_STATUS_LABELS[c.status]}</span>
                      <span>Review →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Members list preview */}
          <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink-950">
                Workspace Team
              </h2>
              <Link to="/settings" className="text-xs font-semibold text-accent hover:underline">
                Manage
              </Link>
            </div>
            {membersQuery.isLoading ? (
              <p className="mt-3 text-xs text-ink-500">Loading team...</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-100 text-xs">
                {(membersQuery.data?.members ?? []).slice(0, 4).map((member) => (
                  <li key={member.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-semibold text-ink-900">{member.user?.name ?? 'User'}</p>
                      <p className="text-[11px] text-ink-500">{member.user?.email}</p>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium capitalize text-ink-700 text-[10px]">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <UploadContractModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          summaryQuery.refetch();
        }}
      />
    </div>
  );
}
