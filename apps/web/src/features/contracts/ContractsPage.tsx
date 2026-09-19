import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
} from '@cml/shared';
import { api } from '@/lib/api';
import { UploadContractModal } from './UploadContractModal';

export type ContractItem = {
  id: string;
  name: string;
  type: string;
  status: ContractStatus;
  counterparty?: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  tags?: string[];
  originalFile?: {
    fileName: string;
    mimeType: string;
    size: number;
    uploadedAt?: string;
  } | null;
  currentVersionNumber?: number;
  owner?: { id: string; name: string; email: string };
  createdBy?: { id: string; name: string; email: string };
  createdAt?: string;
  updatedAt: string;
};

export function getStatusBadgeClass(status: ContractStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'in_review':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'changes_requested':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'pending_signature':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'completed':
      return 'bg-teal-50 text-teal-800 border-teal-200';
    case 'archived':
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function ContractsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updatedAt_desc');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const queryParams = new URLSearchParams();
  if (searchTerm) queryParams.set('search', searchTerm);
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (typeFilter !== 'all') queryParams.set('type', typeFilter);
  if (sortBy) queryParams.set('sort', sortBy);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contracts', searchTerm, statusFilter, typeFilter, sortBy],
    queryFn: () =>
      api<{ contracts: ContractItem[]; pagination: { total: number } }>(
        `/api/v1/contracts?${queryParams.toString()}`,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return api(`/api/v1/contracts/${contractId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-summary'] });
    },
  });

  const statusUpdateMutation = useMutation({
    mutationFn: async ({
      contractId,
      newStatus,
    }: {
      contractId: string;
      newStatus: ContractStatus;
    }) => {
      return api(`/api/v1/contracts/${contractId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-summary'] });
    },
  });

  const contracts = data?.contracts ?? [];

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-950">
            Contract Repository
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage, search, and track your organization contracts and agreements
          </p>
        </div>
        <button
          type="button"
          id="open-upload-modal-btn"
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Upload Contract
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-3 h-4 w-4 text-ink-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              id="search-contracts-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by contract name, counterparty, description, or tag..."
              className="w-full rounded-xl border border-ink-100 bg-slate-50/50 py-2 pl-10 pr-9 text-sm text-ink-900 placeholder:text-ink-500 focus:border-accent focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-ink-500 hover:text-ink-900"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-ink-700">Type:</span>
              <select
                id="filter-type-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 shadow-sm focus:border-accent focus:outline-none"
              >
                <option value="all">All Types</option>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONTRACT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-ink-700">Sort:</span>
              <select
                id="sort-contracts-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 shadow-sm focus:border-accent focus:outline-none"
              >
                <option value="updatedAt_desc">Recently Updated</option>
                <option value="createdAt_desc">Recently Created</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="endDate_asc">Expiration Date</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3">
          <span className="mr-1 text-xs font-semibold text-ink-700">Status:</span>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === 'all'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-slate-100 text-ink-700 hover:bg-slate-200/70'
            }`}
          >
            All ({data?.pagination.total ?? 0})
          </button>
          {CONTRACT_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === st
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-slate-100 text-ink-700 hover:bg-slate-200/70'
              }`}
            >
              {CONTRACT_STATUS_LABELS[st]}
            </button>
          ))}
        </div>
      </div>

      {/* Contracts Table */}
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="mt-3 text-sm text-ink-500">Loading contracts repository...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-red-600">Failed to load contracts.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-lg bg-slate-100 px-4 py-1.5 text-xs font-medium text-ink-900 hover:bg-slate-200"
            >
              Retry
            </button>
          </div>
        ) : contracts.length === 0 ? (
          <div id="contracts-empty-state" className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-ink-500">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mt-3 text-base font-semibold text-ink-950">No contracts found</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-500">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'No documents matched your search criteria. Try clearing filters.'
                : 'Upload your first DOCX or PDF contract to start building your organization repository.'}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                  className="rounded-xl border border-ink-100 px-4 py-2 text-xs font-medium text-ink-700 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700"
              >
                Upload Contract
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3.5">Contract Name</th>
                  <th className="px-4 py-3.5">Counterparty</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">File</th>
                  <th className="px-4 py-3.5">Updated</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <Link
                        to={`/contracts/${c.id}`}
                        className="font-semibold text-ink-950 hover:text-accent hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.description && (
                        <p className="mt-0.5 line-clamp-1 max-w-sm text-xs text-ink-500">
                          {c.description}
                        </p>
                      )}
                      {c.tags && c.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-ink-700"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 text-xs font-medium text-ink-700">
                      {c.counterparty ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          {c.counterparty}
                        </span>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <select
                        aria-label={`Change status for ${c.name}`}
                        value={c.status}
                        onChange={(e) =>
                          statusUpdateMutation.mutate({
                            contractId: c.id,
                            newStatus: e.target.value as ContractStatus,
                          })
                        }
                        className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold transition focus:outline-none ${getStatusBadgeClass(
                          c.status,
                        )}`}
                      >
                        {CONTRACT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {CONTRACT_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-ink-700">
                        {CONTRACT_TYPE_LABELS[c.type as keyof typeof CONTRACT_TYPE_LABELS] || c.type}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {c.originalFile ? (
                        <span
                          title={c.originalFile.fileName}
                          className="inline-flex items-center gap-1 text-xs text-ink-700"
                        >
                          <span className="font-mono text-[10px] font-bold text-accent">
                            {c.originalFile.fileName.endsWith('.pdf') ? 'PDF' : 'DOC'}
                          </span>
                          <span className="max-w-[100px] truncate">
                            {c.originalFile.fileName}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-xs text-ink-500">
                      {new Date(c.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/contracts/${c.id}`}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-900 transition hover:bg-slate-200"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete "${c.name}"?`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                          className="rounded-lg p-1 text-ink-500 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete contract"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UploadContractModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['contracts'] });
          queryClient.invalidateQueries({ queryKey: ['contract-summary'] });
        }}
      />
    </div>
  );
}
