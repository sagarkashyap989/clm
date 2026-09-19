import { useState, useMemo } from 'react';
import type { DocumentVersion } from '@cml/shared';
import { computeTextDiff, stripHtml, type DiffMode } from '../../lib/diff';

type VersionCompareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  versions: DocumentVersion[];
  initialVersionAId?: string;
  initialVersionBId?: string;
};

export function VersionCompareModal({
  isOpen,
  onClose,
  versions,
  initialVersionAId,
  initialVersionBId,
}: VersionCompareModalProps) {
  const [versionAId, setVersionAId] = useState<string>(
    initialVersionAId || (versions.length > 1 ? versions[1].id : versions[0]?.id || ''),
  );
  const [versionBId, setVersionBId] = useState<string>(
    initialVersionBId || versions[0]?.id || '',
  );
  const [diffMode, setDiffMode] = useState<DiffMode>('words');
  const [viewLayout, setViewLayout] = useState<'unified' | 'split'>('unified');

  const versionA = useMemo(() => versions.find((v) => v.id === versionAId), [versions, versionAId]);
  const versionB = useMemo(() => versions.find((v) => v.id === versionBId), [versions, versionBId]);

  const diffResult = useMemo(() => {
    if (!versionA || !versionB) return null;
    const textA = stripHtml(versionA.editorContent || '');
    const textB = stripHtml(versionB.editorContent || '');
    return computeTextDiff(textA, textB, diffMode);
  }, [versionA, versionB, diffMode]);

  if (!isOpen) return null;

  return (
    <div
      id="version-compare-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-ink-100 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                Diff & Redline
              </span>
              <h2 className="font-serif text-lg font-bold text-ink-950">
                Compare Document Versions
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-ink-500">
              Inspect additions, deletions, and contractual clause redlines between versions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-ink-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewLayout('unified')}
                className={`rounded px-2.5 py-1 font-semibold transition ${
                  viewLayout === 'unified'
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Unified Redline
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('split')}
                className={`rounded px-2.5 py-1 font-semibold transition ${
                  viewLayout === 'split'
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Side-by-Side
              </button>
            </div>

            {/* Granularity Toggle */}
            <div className="flex rounded-lg border border-ink-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDiffMode('words')}
                className={`rounded px-2 py-1 font-semibold transition ${
                  diffMode === 'words' ? 'bg-accent text-white' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Word Diff
              </button>
              <button
                type="button"
                onClick={() => setDiffMode('lines')}
                className={`rounded px-2 py-1 font-semibold transition ${
                  diffMode === 'lines' ? 'bg-accent text-white' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Line Diff
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-slate-100 hover:text-ink-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Version Pickers & Stat Metrics */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 bg-slate-50 px-6 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* Base Version (A) */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink-600">Base (Old):</span>
              <select
                aria-label="Select base old version"
                value={versionAId}
                onChange={(e) => setVersionAId(e.target.value)}
                className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-900"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber}.0 — {v.changeDescription.slice(0, 30)} (
                    {new Date(v.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-ink-400">vs.</span>

            {/* Target Version (B) */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink-600">Compare (New):</span>
              <select
                aria-label="Select compare new version"
                value={versionBId}
                onChange={(e) => setVersionBId(e.target.value)}
                className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-900"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber}.0 — {v.changeDescription.slice(0, 30)} (
                    {new Date(v.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Diff Metrics */}
          {diffResult && (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                +{diffResult.addedCount} additions
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                -{diffResult.removedCount} deletions
              </span>
            </div>
          )}
        </div>

        {/* Diff Canvas Content */}
        <div className="flex-1 overflow-auto bg-slate-100/70 p-6">
          {viewLayout === 'unified' ? (
            /* Unified Diff View */
            <div className="mx-auto max-w-4xl rounded-xl border border-ink-200 bg-white p-8 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-ink-100 pb-2 text-[11px] text-ink-400">
                <span>
                  Comparing v{versionA?.versionNumber}.0 → v{versionB?.versionNumber}.0
                </span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Added text
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> Removed text
                  </span>
                </span>
              </div>

              <div
                id="unified-diff-view"
                className="font-serif text-sm leading-relaxed text-ink-900 whitespace-pre-wrap"
              >
                {diffResult?.changes.map((part, index) => {
                  if (part.added) {
                    return (
                      <span
                        key={index}
                        className="rounded bg-emerald-100 px-1 py-0.5 font-sans font-semibold text-emerald-950 underline decoration-emerald-500"
                      >
                        {part.value}
                      </span>
                    );
                  }
                  if (part.removed) {
                    return (
                      <span
                        key={index}
                        className="rounded bg-rose-100 px-1 py-0.5 font-sans text-rose-900 line-through opacity-80"
                      >
                        {part.value}
                      </span>
                    );
                  }
                  return <span key={index}>{part.value}</span>;
                })}
              </div>
            </div>
          ) : (
            /* Side-by-Side Split View */
            <div className="grid grid-cols-2 gap-4">
              {/* Version A Box */}
              <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between border-b border-ink-100 pb-2">
                  <span className="font-serif text-xs font-bold text-ink-900">
                    Version {versionA?.versionNumber}.0 (Base)
                  </span>
                  <span className="text-[11px] text-ink-500">
                    {versionA?.createdAt ? new Date(versionA.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <div className="font-serif text-xs leading-relaxed text-ink-800 whitespace-pre-wrap">
                  {stripHtml(versionA?.editorContent || '')}
                </div>
              </div>

              {/* Version B Box */}
              <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between border-b border-ink-100 pb-2">
                  <span className="font-serif text-xs font-bold text-ink-900">
                    Version {versionB?.versionNumber}.0 (Compare)
                  </span>
                  <span className="text-[11px] text-ink-500">
                    {versionB?.createdAt ? new Date(versionB.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <div className="font-serif text-xs leading-relaxed text-ink-800 whitespace-pre-wrap">
                  {stripHtml(versionB?.editorContent || '')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-ink-100 bg-slate-50 px-6 py-3 text-xs">
          <div className="text-ink-500">
            Base: <span className="font-semibold text-ink-800">{versionA?.changeDescription}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-ink-900 px-5 py-2 text-xs font-semibold text-white hover:bg-ink-800"
          >
            Close Redline View
          </button>
        </div>
      </div>
    </div>
  );
}
