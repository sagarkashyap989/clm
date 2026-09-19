import { useState, type FormEvent } from 'react';

type SaveVersionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  nextVersionNumber: number;
  contractName: string;
  onSave: (changeDescription: string) => Promise<void>;
};

export function SaveVersionModal({
  isOpen,
  onClose,
  nextVersionNumber,
  contractName,
  onSave,
}: SaveVersionModalProps) {
  const [changeDescription, setChangeDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!changeDescription.trim()) {
      setError('Please provide a brief description of the changes made.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSave(changeDescription.trim());
      setChangeDescription('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save version. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      id="save-version-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-ink-100 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-ink-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
                Version {nextVersionNumber}.0
              </span>
              <h2 className="font-serif text-lg font-bold text-ink-950">Save New Version</h2>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Create an immutable snapshot of {contractName} in version history.
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
          )}

          <div>
            <label
              htmlFor="version-change-desc"
              className="block text-xs font-bold uppercase tracking-wider text-ink-700"
            >
              Summary of Changes / Change Log <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="version-change-desc"
              rows={3}
              required
              placeholder="e.g. Updated Section 3.2 liability cap to $500,000 and extended term by 1 year..."
              value={changeDescription}
              onChange={(e) => setChangeDescription(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-ink-200 p-3 text-xs text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900">
            <strong>Audit & Traceability:</strong> Once committed, this version is permanently archived
            with your user signature, timestamp, and word diff audit history.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Version...' : `Save as Version ${nextVersionNumber}.0`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
