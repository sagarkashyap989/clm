import { useState, useRef, type FormEvent, type DragEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  type ContractType,
} from '@cml/shared';
import { api } from '@/lib/api';

type UploadContractModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function UploadContractModal({
  isOpen,
  onClose,
  onSuccess,
}: UploadContractModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ContractType>('nda');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return api<{ contract: { id: string } }>('/api/v1/contracts', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      resetForm();
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to upload contract');
    },
  });

  if (!isOpen) return null;

  function resetForm() {
    setName('');
    setType('nda');
    setCounterparty('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setTagsInput('');
    setFile(null);
    setErrorMessage('');
  }

  function handleFileSelect(selectedFile: File) {
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      setErrorMessage('Please upload a valid DOCX, PDF, or TXT document.');
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setErrorMessage('File exceeds maximum allowed size of 25MB.');
      return;
    }

    setFile(selectedFile);
    setErrorMessage('');

    // Pre-fill name if not set
    if (!name) {
      const cleanName = selectedFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setName(cleanName);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Contract name is required.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('type', type);
    if (counterparty.trim()) formData.append('counterparty', counterparty.trim());
    if (description.trim()) formData.append('description', description.trim());
    if (startDate) formData.append('startDate', startDate);
    if (endDate) formData.append('endDate', endDate);
    if (tags.length) formData.append('tags', JSON.stringify(tags));
    if (file) formData.append('file', file);

    createMutation.mutate(formData);
  }

  return (
    <div
      id="upload-contract-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="upload-contract-modal-dialog"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-ink-100 bg-white p-6 shadow-xl md:p-7"
      >
        <div className="flex items-center justify-between border-b border-ink-100 pb-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-950">
              Upload Contract
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              PDF, Word (.docx), or text. Word content is imported into the editor. Max 25 MB.
            </p>
          </div>
          <button
            type="button"
            id="close-upload-modal-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-slate-100 hover:text-ink-900"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Drag and drop upload zone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700">
              Document File (DOCX, PDF, TXT)
            </label>
            <div
              id="contract-dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition ${
                isDragging
                  ? 'border-accent bg-accent-soft/30'
                  : file
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-ink-100 bg-slate-50 hover:bg-slate-100/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
              />
              {file ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
                    {file.name.endsWith('.pdf') ? 'PDF' : 'DOC'}
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-ink-900">{file.name}</p>
                    <p className="text-xs text-ink-500">
                      {(file.size / 1024).toFixed(1)} KB • Ready to upload
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="ml-3 text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-ink-900">
                    Click to browse or drag and drop document
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    DOCX, PDF, or TXT up to 25MB
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Contract Name */}
          <div>
            <label
              htmlFor="contract-name-input"
              className="block text-xs font-semibold text-ink-700"
            >
              Contract Name <span className="text-red-500">*</span>
            </label>
            <input
              id="contract-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Master Services Agreement 2026"
              className="mt-1.5 w-full rounded-xl border border-ink-100 px-3.5 py-2 text-sm text-ink-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Type & Counterparty */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contract-type-select"
                className="block text-xs font-semibold text-ink-700"
              >
                Contract Type <span className="text-red-500">*</span>
              </label>
              <select
                id="contract-type-select"
                value={type}
                onChange={(e) => setType(e.target.value as ContractType)}
                className="mt-1.5 w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2 text-sm text-ink-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONTRACT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="contract-counterparty-input"
                className="block text-xs font-semibold text-ink-700"
              >
                Counterparty / Partner
              </label>
              <input
                id="contract-counterparty-input"
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="e.g. Gilded Records, Acme Corp"
                className="mt-1.5 w-full rounded-xl border border-ink-100 px-3.5 py-2 text-sm text-ink-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Start Date & End Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contract-start-date"
                className="block text-xs font-semibold text-ink-700"
              >
                Start / Effective Date
              </label>
              <input
                id="contract-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-100 px-3.5 py-2 text-sm text-ink-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label
                htmlFor="contract-end-date"
                className="block text-xs font-semibold text-ink-700"
              >
                Expiration / Renewal Date
              </label>
              <input
                id="contract-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-100 px-3.5 py-2 text-sm text-ink-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="contract-tags-input"
              className="block text-xs font-semibold text-ink-700"
            >
              Tags (comma separated)
            </label>
            <input
              id="contract-tags-input"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Vendor, Q1, High Priority, Legal"
              className="mt-1.5 w-full rounded-xl border border-ink-100 px-3.5 py-2 text-sm text-ink-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="contract-description-input"
              className="block text-xs font-semibold text-ink-700"
            >
              Description & Notes
            </label>
            <textarea
              id="contract-description-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of key clauses, obligations, or special covenants..."
              className="mt-1.5 w-full rounded-xl border border-ink-100 px-3.5 py-2 text-sm text-ink-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
            <button
              type="button"
              id="cancel-upload-btn"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="rounded-xl border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-contract-btn"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving Contract...
                </>
              ) : (
                'Upload & Create Contract'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
