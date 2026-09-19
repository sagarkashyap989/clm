import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
  type DocumentVersion,
} from '@cml/shared';
import { api } from '@/lib/api';
import { getStatusBadgeClass, type ContractItem } from './ContractsPage';
import { DocumentEditorCanvas } from '../editor/DocumentEditorCanvas';
import { PdfDocumentViewer } from '../editor/PdfDocumentViewer';
import { VersionHistoryDrawer } from '../editor/VersionHistoryDrawer';
import { SaveVersionModal } from '../editor/SaveVersionModal';
import { VersionCompareModal } from '../editor/VersionCompareModal';
import { ShareContractModal } from '../collaboration/ShareContractModal';
import { ContractCommentsPanel } from '../collaboration/ContractCommentsPanel';
import { ContractChatPanel } from '../collaboration/ContractChatPanel';
import type { ContractComment, ContractChatMessage } from '@cml/shared';

type TabType = 'workspace' | 'comments' | 'chat' | 'versions' | 'details';

export function ContractDetailPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('workspace');
  const [editorContent, setEditorContent] = useState<string>('');
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'pdf'>('editor');

  // Modals state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareVersionAId, setCompareVersionAId] = useState<string | undefined>();
  const [compareVersionBId, setCompareVersionBId] = useState<string | undefined>();

  // Metadata Edit state
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string>('nda');
  const [editDescription, setEditDescription] = useState('');
  const [editCounterparty, setEditCounterparty] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  // Autosave timer ref
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch Contract Data
  const {
    data: contractData,
    isLoading: isContractLoading,
    isError: isContractError,
  } = useQuery({
    queryKey: ['contract', contractId],
    enabled: Boolean(contractId),
    queryFn: () => api<{ contract: ContractItem }>(`/api/v1/contracts/${contractId}`),
  });

  const contract = contractData?.contract;

  // 2. Fetch Version History
  const { data: versionsData, isLoading: isVersionsLoading } = useQuery({
    queryKey: ['contract-versions', contractId],
    enabled: Boolean(contractId),
    queryFn: () => api<{ versions: DocumentVersion[] }>(`/api/v1/contracts/${contractId}/versions`),
  });

  const versions = useMemo(() => versionsData?.versions || [], [versionsData]);

  // 3. Fetch current Draft (if any)
  const { data: draftData } = useQuery({
    queryKey: ['contract-draft', contractId],
    enabled: Boolean(contractId),
    queryFn: () => api<{ draftContent: string | null }>(`/api/v1/contracts/${contractId}/draft`),
  });

  // 4. Fetch comments & chat counts for real-time collaborative indicators
  const { data: commentsData } = useQuery({
    queryKey: ['contract-comments', contractId],
    enabled: Boolean(contractId),
    queryFn: () => api<{ comments: ContractComment[] }>(`/api/v1/contracts/${contractId}/comments`),
  });

  const { data: chatData } = useQuery({
    queryKey: ['contract-chat', contractId],
    enabled: Boolean(contractId),
    queryFn: () => api<{ messages: ContractChatMessage[] }>(`/api/v1/contracts/${contractId}/chat`),
  });

  const activeCommentsCount = commentsData?.comments?.filter((c) => !c.isResolved).length ?? 0;
  const messagesCount = chatData?.messages?.length ?? 0;

  // Decide initial editor content: draft content > latest version content > fallback template
  useEffect(() => {
    if (contract) {
      if (contract.originalFile?.fileName.endsWith('.pdf')) {
        setViewMode('pdf');
      } else {
        setViewMode('editor');
      }
    }
  }, [contract]);

  useEffect(() => {
    if (draftData?.draftContent) {
      setEditorContent(draftData.draftContent);
      setAutosaveStatus('saved');
    } else if (versions.length > 0 && versions[0].editorContent) {
      setEditorContent(versions[0].editorContent);
      setAutosaveStatus('saved');
    } else if (contract) {
      // Default fallback template
      setEditorContent(`<h2>${contract.name.toUpperCase()}</h2>
<p>This Agreement is executed between <strong>Acme Contracts Corp</strong> and <strong>${contract.counterparty || 'Counterparty'}</strong>.</p>
<h3>1. PURPOSE AND SCOPE</h3>
<p>${contract.description || 'Standard contractual covenants, service definitions, and regulatory obligations.'}</p>
<h3>2. TERM AND TERMINATION</h3>
<p>This agreement shall commence on ${contract.startDate ? new Date(contract.startDate).toLocaleDateString() : 'execution date'} and expire on ${contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'perpetual term'}.</p>
<h3>3. CONFIDENTIALITY AND GOVERNING LAW</h3>
<p>All disclosed proprietary materials shall remain confidential for a duration of no less than three (3) years. Governed by the laws of the State of Delaware.</p>`);
      setAutosaveStatus('saved');
    }
  }, [draftData, versions, contract]);

  // Autosave draft mutation
  const draftMutation = useMutation({
    mutationFn: async (content: string) => {
      return api(`/api/v1/contracts/${contractId}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ editorContent: content }),
      });
    },
    onSuccess: () => {
      setAutosaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
    },
    onError: () => {
      setAutosaveStatus('unsaved');
    },
  });

  // Handle Editor Content Change with Debounced Autosave
  function handleContentChange(newHtml: string) {
    setEditorContent(newHtml);
    setAutosaveStatus('unsaved');

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      setAutosaveStatus('saving');
      draftMutation.mutate(newHtml);
    }, 2500);
  }

  // Contract Metadata Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<ContractItem>) => {
      return api(`/api/v1/contracts/${contractId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setIsEditingMetadata(false);
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-summary'] });
    },
  });

  // Contract Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return api(`/api/v1/contracts/${contractId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-summary'] });
      navigate('/contracts');
    },
  });

  // Save Version Mutation
  const saveVersionMutation = useMutation({
    mutationFn: async (changeDescription: string) => {
      return api(`/api/v1/contracts/${contractId}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          editorContent,
          changeDescription,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-versions', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      setAutosaveStatus('saved');
    },
  });

  // Restore Version Mutation
  const restoreVersionMutation = useMutation({
    mutationFn: async ({
      versionId,
      versionNumber,
    }: {
      versionId: string;
      versionNumber: number;
    }) => {
      return api(`/api/v1/contracts/${contractId}/versions/${versionId}/restore`, {
        method: 'POST',
        body: JSON.stringify({
          changeDescription: `Restored from Version ${versionNumber}.0`,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-versions', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      setActiveTab('workspace');
    },
  });

  function startEditMetadata() {
    if (!contract) return;
    setEditName(contract.name);
    setEditType(contract.type || 'nda');
    setEditDescription(contract.description || '');
    setEditCounterparty(contract.counterparty || '');
    setEditStartDate(contract.startDate ? contract.startDate.slice(0, 10) : '');
    setEditEndDate(contract.endDate ? contract.endDate.slice(0, 10) : '');
    setIsEditingMetadata(true);
  }

  function saveEditMetadata() {
    updateMutation.mutate({
      name: editName,
      type: editType,
      description: editDescription,
      counterparty: editCounterparty,
      startDate: editStartDate || null,
      endDate: editEndDate || null,
    });
  }

  function handleOpenCompare(versionA?: string, versionB?: string) {
    setCompareVersionAId(versionA);
    setCompareVersionBId(versionB);
    setIsCompareModalOpen(true);
  }

  if (isContractLoading || isVersionsLoading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-xs font-semibold text-ink-600">Loading document workspace...</span>
        </div>
      </div>
    );
  }

  if (isContractError || !contract) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <h2 className="text-base font-semibold text-red-800">Contract Not Found</h2>
        <p className="mt-1 text-xs text-red-600">
          The requested contract could not be located in the repository.
        </p>
        <Link
          to="/contracts"
          className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white"
        >
          Return to Repository
        </Link>
      </div>
    );
  }

  const currentVersionNumber = contract.currentVersionNumber || 1;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
        <div className="flex items-center gap-2">
          <Link to="/contracts" className="hover:text-accent">
            Contracts
          </Link>
          <span>/</span>
          <span className="font-semibold text-ink-900">{contract.name}</span>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenCompare()}
            disabled={versions.length < 2}
            className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-xs hover:bg-slate-50 disabled:opacity-40"
            title={versions.length < 2 ? 'At least 2 versions required to compare' : 'Compare versions'}
          >
            Compare Versions ({versions.length})
          </button>

          <button
            type="button"
            onClick={() => setIsSaveModalOpen(true)}
            className="rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
          >
            Save New Version (v{currentVersionNumber + 1}.0)
          </button>
        </div>
      </div>

      {/* Contract Header & Status Bar */}
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-ink-950 md:text-3xl">
                {contract.name}
              </h1>

              {/* Status Pill */}
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                  contract.status,
                )}`}
              >
                {CONTRACT_STATUS_LABELS[contract.status]}
              </span>

              {/* Version Pill */}
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-ink-800">
                v{currentVersionNumber}.0
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-500">
              {contract.counterparty && (
                <span>
                  Counterparty:{' '}
                  <strong className="text-ink-700">{contract.counterparty}</strong>
                </span>
              )}
              <span>
                Owner:{' '}
                <strong className="text-ink-700">{contract.owner?.name ?? 'Unassigned'}</strong>
              </span>
              <span>
                Updated:{' '}
                <strong className="text-ink-700">
                  {new Date(contract.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
              </span>
              {contract.originalFile && (
                <span className="flex items-center gap-1 font-medium text-ink-600">
                  📎 {contract.originalFile.fileName} (
                  {Math.round(contract.originalFile.size / 1024)} KB)
                </span>
              )}
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Share Contract Button */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
            >
              <span>👥</span>
              <span>Share Contract</span>
            </button>

            {/* Status Change Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-ink-700">Status:</span>
              <select
                aria-label="Contract status"
                value={contract.status}
                onChange={(e) =>
                  updateMutation.mutate({ status: e.target.value as ContractStatus })
                }
                className="rounded-xl border border-ink-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-ink-900 shadow-sm focus:border-accent focus:outline-none"
              >
                {CONTRACT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {CONTRACT_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={startEditMetadata}
              className="rounded-xl border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Edit Metadata
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete "${contract.name}"?`)) {
                  deleteMutation.mutate();
                }
              }}
              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Edit Metadata Modal Drawer */}
        {isEditingMetadata && (
          <div className="mt-6 rounded-xl border border-accent/30 bg-accent-soft/20 p-5">
            <h3 className="text-sm font-bold text-ink-950">Edit Contract Metadata</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink-700">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs text-ink-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700">Contract Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs text-ink-900"
                >
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CONTRACT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700">Counterparty</label>
                <input
                  type="text"
                  value={editCounterparty}
                  onChange={(e) => setEditCounterparty(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs text-ink-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700">Effective Date</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs text-ink-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700">Expiration Date</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs text-ink-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink-700">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs text-ink-900"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingMetadata(false)}
                className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditMetadata}
                disabled={updateMutation.isPending}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center justify-between border-b border-ink-100 pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'workspace'
                ? 'border-b-2 border-accent bg-white text-accent'
                : 'text-ink-600 hover:text-ink-950'
            }`}
          >
            <span>Document Workspace</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-ink-700">
              v{currentVersionNumber}.0
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'comments'
                ? 'border-b-2 border-accent bg-white text-accent'
                : 'text-ink-600 hover:text-ink-950'
            }`}
          >
            <span>Comments</span>
            {activeCommentsCount > 0 ? (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeCommentsCount}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-ink-600">
                0
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'chat'
                ? 'border-b-2 border-accent bg-white text-accent'
                : 'text-ink-600 hover:text-ink-950'
            }`}
          >
            <span>Discussion Chat</span>
            {messagesCount > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-700">
                {messagesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('versions')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'versions'
                ? 'border-b-2 border-accent bg-white text-accent'
                : 'text-ink-600 hover:text-ink-950'
            }`}
          >
            <span>Version History</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-ink-700">
              {versions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'details'
                ? 'border-b-2 border-accent bg-white text-accent'
                : 'text-ink-600 hover:text-ink-950'
            }`}
          >
            <span>Contract Details & Audit</span>
          </button>
        </div>

        {/* View mode toggle (if PDF) */}
        {activeTab === 'workspace' && contract.originalFile?.fileName.endsWith('.pdf') && (
          <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                viewMode === 'pdf' ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              PDF Viewer
            </button>
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                viewMode === 'editor' ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              Clause Editor
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: Document Workspace */}
      {activeTab === 'workspace' && (
        <div>
          {viewMode === 'pdf' ? (
            <PdfDocumentViewer
              contractName={contract.name}
              counterparty={contract.counterparty || 'External Party'}
              file={contract.originalFile}
              onSwitchToEditor={() => setViewMode('editor')}
            />
          ) : (
            <DocumentEditorCanvas
              initialContent={editorContent}
              onContentChange={handleContentChange}
              onTriggerSaveVersion={() => setIsSaveModalOpen(true)}
              autosaveStatus={autosaveStatus}
              lastSavedAt={lastSavedAt}
            />
          )}
        </div>
      )}

      {/* TAB 2: Version History */}
      {activeTab === 'versions' && (
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <VersionHistoryDrawer
            versions={versions}
            currentVersionNumber={currentVersionNumber}
            onSelectVersion={(v) => {
              setEditorContent(v.editorContent);
              setActiveTab('workspace');
              setViewMode('editor');
            }}
            onRestoreVersion={async (versionId, versionNumber) => {
              await restoreVersionMutation.mutateAsync({ versionId, versionNumber });
            }}
            onCompareWithCurrent={(versionId) => {
              handleOpenCompare(versionId, versions[0]?.id);
            }}
          />
        </div>
      )}

      {/* TAB 3: Details & Audit Trail */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-lg font-bold text-ink-950">Contract Specifications</h2>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-ink-100 bg-slate-50/60 p-3.5">
                  <dt className="text-xs font-semibold text-ink-500">Document Classification</dt>
                  <dd className="mt-1 font-semibold text-ink-900">
                    {CONTRACT_TYPE_LABELS[contract.type as keyof typeof CONTRACT_TYPE_LABELS] ||
                      contract.type}
                  </dd>
                </div>

                <div className="rounded-xl border border-ink-100 bg-slate-50/60 p-3.5">
                  <dt className="text-xs font-semibold text-ink-500">Counterparty Entity</dt>
                  <dd className="mt-1 font-semibold text-ink-900">
                    {contract.counterparty || 'Not specified'}
                  </dd>
                </div>

                <div className="rounded-xl border border-ink-100 bg-slate-50/60 p-3.5">
                  <dt className="text-xs font-semibold text-ink-500">Effective Start Date</dt>
                  <dd className="mt-1 font-semibold text-ink-900">
                    {contract.startDate
                      ? new Date(contract.startDate).toLocaleDateString(undefined, {
                          dateStyle: 'medium',
                        })
                      : 'Immediately upon signing'}
                  </dd>
                </div>

                <div className="rounded-xl border border-ink-100 bg-slate-50/60 p-3.5">
                  <dt className="text-xs font-semibold text-ink-500">Expiration / Term Date</dt>
                  <dd className="mt-1 font-semibold text-ink-900">
                    {contract.endDate
                      ? new Date(contract.endDate).toLocaleDateString(undefined, {
                          dateStyle: 'medium',
                        })
                      : 'Perpetual / Not specified'}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-ink-100 pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Summary & Scope
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">
                  {contract.description ||
                    'No detailed description or clause summary provided yet for this document.'}
                </p>
              </div>

              {contract.tags && contract.tags.length > 0 && (
                <div className="mt-5 border-t border-ink-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Tags
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {contract.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Audit Trail */}
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-lg font-bold text-ink-950">Audit & Activity Log</h2>
              <div className="mt-4 space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                      ✓
                    </div>
                    <div className="h-full w-0.5 bg-ink-100" />
                  </div>
                  <div className="pb-4">
                    <p className="text-xs font-semibold text-ink-900">Contract Created</p>
                    <p className="text-[11px] text-ink-500">
                      Uploaded by {contract.createdBy?.name || 'User'} on{' '}
                      {new Date(contract.createdAt || contract.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs text-ink-700">
                      •
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-900">
                      Current Version:{' '}
                      <span className="font-bold text-accent">v{currentVersionNumber}.0</span>
                    </p>
                    <p className="text-[11px] text-ink-500">
                      Last updated on {new Date(contract.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Original Uploaded File */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-lg font-bold text-ink-950">Original File</h2>
              {contract.originalFile ? (
                <div className="mt-4 rounded-xl border border-ink-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white shadow-sm">
                      {contract.originalFile.fileName.endsWith('.pdf') ? 'PDF' : 'DOC'}
                    </div>
                    <div className="overflow-hidden">
                      <p
                        className="truncate text-xs font-bold text-ink-900"
                        title={contract.originalFile.fileName}
                      >
                        {contract.originalFile.fileName}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {(contract.originalFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <a
                      href={`data:application/octet-stream;charset=utf-8,${encodeURIComponent(
                        `Contract: ${contract.name}\nType: ${contract.type}\nStatus: ${contract.status}\nCounterparty: ${contract.counterparty}`,
                      )}`}
                      download={contract.originalFile.fileName}
                      className="flex-1 rounded-xl bg-accent px-3 py-2 text-center text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      Download File
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-ink-100 p-6 text-center text-xs text-ink-500">
                  No physical file attached yet to this record.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Comments and Annotation Panel */}
      {activeTab === 'comments' && (
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <ContractCommentsPanel
            contractId={contract.id}
            currentVersionNumber={currentVersionNumber}
          />
        </div>
      )}

      {/* Tab 5: Discussion Chat Panel */}
      {activeTab === 'chat' && (
        <ContractChatPanel
          contractId={contract.id}
          contractName={contract.name}
        />
      )}

      {/* Share Contract Modal */}
      <ShareContractModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        contractId={contract.id}
        contractName={contract.name}
      />

      {/* Save Version Modal */}
      <SaveVersionModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        contractName={contract.name}
        nextVersionNumber={currentVersionNumber + 1}
        onSave={async (desc) => {
          await saveVersionMutation.mutateAsync(desc);
        }}
      />

      {/* Compare Versions Redline Modal */}
      <VersionCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        versions={versions}
        initialVersionAId={compareVersionAId}
        initialVersionBId={compareVersionBId}
      />
    </div>
  );
}
