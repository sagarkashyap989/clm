import { useState } from 'react';
import type { DocumentVersion } from '@cml/shared';

type VersionHistoryDrawerProps = {
  versions: DocumentVersion[];
  currentVersionNumber: number;
  onSelectVersion: (version: DocumentVersion) => void;
  onRestoreVersion: (versionId: string, versionNumber: number) => Promise<void>;
  onCompareWithCurrent: (versionId: string) => void;
  readOnly?: boolean;
};

export function VersionHistoryDrawer({
  versions,
  currentVersionNumber,
  onSelectVersion,
  onRestoreVersion,
  onCompareWithCurrent,
  readOnly = false,
}: VersionHistoryDrawerProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleRestore(versionId: string, versionNumber: number) {
    if (readOnly) return;
    const confirm = window.confirm(
      `Are you sure you want to restore Version ${versionNumber}.0? This will create a new Version ${currentVersionNumber + 1}.0 with this version's content.`,
    );
    if (!confirm) return;

    setRestoringId(versionId);
    try {
      await onRestoreVersion(versionId, versionNumber);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div id="version-history-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-base font-bold text-ink-950">Version Timeline</h3>
          <p className="text-xs text-ink-500">
            Audit-grade history tracking every modification, upload, and restoration.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-ink-700">
          {versions.length} Version{versions.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-3">
        {versions.map((v) => {
          const isCurrent = v.versionNumber === currentVersionNumber;
          return (
            <div
              key={v.id}
              className={`rounded-xl border p-4 transition ${
                isCurrent
                  ? 'border-accent bg-accent/5 shadow-xs'
                  : 'border-ink-100 bg-white hover:border-ink-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                      isCurrent
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 text-ink-800'
                    }`}
                  >
                    v{v.versionNumber}.0
                  </span>
                  {isCurrent && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      CURRENT
                    </span>
                  )}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-600">
                    {v.source}
                  </span>
                </div>

                <span className="text-[11px] text-ink-400">
                  {new Date(v.createdAt).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              {/* Commit / Change summary */}
              <p className="mt-2 text-xs font-medium text-ink-900">
                {v.changeDescription || 'No description recorded'}
              </p>

              {/* Author & File details */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                <span>By {v.createdBy?.name || 'Authorized Member'}</span>
                {v.file && (
                  <span className="flex items-center gap-1 text-accent">
                    📄 {v.file.fileName} ({Math.round((v.file.size || 0) / 1024)} KB)
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-3 flex items-center gap-2 border-t border-ink-100/60 pt-2.5">
                <button
                  type="button"
                  onClick={() => onSelectVersion(v)}
                  className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-slate-50"
                >
                  Load in Canvas
                </button>

                {!isCurrent && (
                  <>
                    <button
                      type="button"
                      onClick={() => onCompareWithCurrent(v.id)}
                      className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-slate-50"
                    >
                      Compare with v{currentVersionNumber}.0
                    </button>

                    {!readOnly && (
                      <button
                        type="button"
                        disabled={restoringId === v.id}
                        onClick={() => handleRestore(v.id, v.versionNumber)}
                        className="rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
                      >
                        {restoringId === v.id ? 'Restoring...' : 'Restore Version'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
