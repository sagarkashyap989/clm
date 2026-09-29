import { useState, useRef, useEffect, useMemo, type FC } from 'react';
import type { ContractComment, TrackedChange } from '@cml/shared';

export type ReviewTab = 'all' | 'comments' | 'changes';

export interface DocumentReviewMarginProps {
  comments: ContractComment[];
  activeCommentId?: string | null;
  onSelectComment: (commentId: string) => void;
  onReplyComment: (commentId: string, content: string) => Promise<void>;
  onResolveComment: (commentId: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onCreateComment: (quoteText: string, content: string) => Promise<void>;
  pendingQuoteText?: string | null;
  onCancelPendingComment?: () => void;

  trackedChanges: TrackedChange[];
  activeChangeId?: string | null;
  onSelectChange: (changeId: string) => void;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAcceptAllChanges: () => void;
  onRejectAllChanges: () => void;

  trackChangesMode: 'editing' | 'suggesting' | 'viewing';
  onChangeTrackChangesMode: (mode: 'editing' | 'suggesting' | 'viewing') => void;

  readOnly?: boolean;
  currentUserId?: string;
  positions?: Record<string, number>; // ID to Y coordinate in document
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatExactDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAuthorInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const DocumentReviewMargin: FC<DocumentReviewMarginProps> = ({
  comments,
  activeCommentId,
  onSelectComment,
  onReplyComment,
  onResolveComment,
  onDeleteComment,
  onCreateComment,
  pendingQuoteText,
  onCancelPendingComment,
  trackedChanges,
  activeChangeId,
  onSelectChange,
  onAcceptChange,
  onRejectChange,
  onAcceptAllChanges,
  onRejectAllChanges,
  trackChangesMode,
  onChangeTrackChangesMode,
  readOnly = false,
  currentUserId: _currentUserId,
  positions: _positions = {},
}) => {
  const [activeTab, setActiveTab] = useState<ReviewTab>('all');
  const [filterResolved, setFilterResolved] = useState<'all' | 'active' | 'resolved'>('all');
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState<string | null>(null);

  // New comment draft state
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const newCommentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (pendingQuoteText && newCommentInputRef.current) {
      newCommentInputRef.current.focus();
    }
  }, [pendingQuoteText]);

  // Filtered comments
  const visibleComments = useMemo(() => {
    return comments.filter((c) => {
      if (filterResolved === 'active') return !c.isResolved;
      if (filterResolved === 'resolved') return c.isResolved;
      return true;
    });
  }, [comments, filterResolved]);

  // Comment Navigation: next / prev
  const currentCommentIndex = useMemo(() => {
    if (!activeCommentId) return -1;
    return visibleComments.findIndex((c) => c.id === activeCommentId);
  }, [visibleComments, activeCommentId]);

  function handleNextComment() {
    if (visibleComments.length === 0) return;
    const nextIdx = (currentCommentIndex + 1) % visibleComments.length;
    onSelectComment(visibleComments[nextIdx].id);
  }

  function handlePrevComment() {
    if (visibleComments.length === 0) return;
    const prevIdx =
      currentCommentIndex <= 0 ? visibleComments.length - 1 : currentCommentIndex - 1;
    onSelectComment(visibleComments[prevIdx].id);
  }

  // Change Navigation: next / prev
  const pendingChanges = useMemo(
    () => trackedChanges.filter((c) => c.status === 'pending'),
    [trackedChanges],
  );

  const currentChangeIndex = useMemo(() => {
    if (!activeChangeId) return -1;
    return pendingChanges.findIndex((c) => c.id === activeChangeId);
  }, [pendingChanges, activeChangeId]);

  function handleNextChange() {
    if (pendingChanges.length === 0) return;
    const nextIdx = (currentChangeIndex + 1) % pendingChanges.length;
    onSelectChange(pendingChanges[nextIdx].id);
  }

  function handlePrevChange() {
    if (pendingChanges.length === 0) return;
    const prevIdx =
      currentChangeIndex <= 0 ? pendingChanges.length - 1 : currentChangeIndex - 1;
    onSelectChange(pendingChanges[prevIdx].id);
  }

  async function handlePostReply(commentId: string) {
    const text = (replyInputs[commentId] || '').trim();
    if (!text) return;
    setIsSubmittingReply(commentId);
    try {
      await onReplyComment(commentId, text);
      setReplyInputs((prev) => ({ ...prev, [commentId]: '' }));
      setReplyingTo(null);
    } finally {
      setIsSubmittingReply(null);
    }
  }

  async function handlePostNewComment() {
    if (!pendingQuoteText || !newCommentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await onCreateComment(pendingQuoteText, newCommentText.trim());
      setNewCommentText('');
      onCancelPendingComment?.();
    } finally {
      setIsSubmittingComment(false);
    }
  }

  return (
    <aside
      id="document-review-rail"
      aria-label="Document Review and Collaboration Rail"
      className="flex flex-col w-full lg:w-[370px] shrink-0 border-l border-ink-100 bg-slate-50/90 select-text overflow-hidden"
    >
      {/* Top Review Header & Mode Switcher */}
      <div className="border-b border-ink-100 bg-white p-3.5 shadow-2xs space-y-3">
        {/* Mode & Navigation Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Track Changes Mode Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
              Mode:
            </span>
            <div className="relative inline-block">
              <select
                aria-label="Document editing mode"
                value={trackChangesMode}
                disabled={readOnly}
                onChange={(e) =>
                  onChangeTrackChangesMode(e.target.value as 'editing' | 'suggesting' | 'viewing')
                }
                className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition focus:outline-none ${
                  trackChangesMode === 'suggesting'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : trackChangesMode === 'viewing'
                    ? 'border-slate-300 bg-slate-100 text-slate-700'
                    : 'border-ink-200 bg-white text-ink-900'
                }`}
              >
                <option value="editing">✎ Editing (Direct)</option>
                <option value="suggesting">⚡ Suggesting (Track Changes)</option>
                <option value="viewing">👁 Viewing (Read-only)</option>
              </select>
            </div>
          </div>

          {/* Track Changes Status Pill */}
          {trackChangesMode === 'suggesting' && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Tracking Active
            </span>
          )}
        </div>

        {/* Navigation & Batch Actions Header */}
        <div className="space-y-2 pt-1 border-t border-ink-100/70">
          {/* Comment Navigation */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-ink-700">
              <span>💬 Comments</span>
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] text-ink-800">
                {comments.filter((c) => !c.isResolved).length} open
              </span>
            </div>
            {visibleComments.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-ink-500 font-medium mr-1">
                  {currentCommentIndex >= 0 ? `${currentCommentIndex + 1} of ` : ''}
                  {visibleComments.length}
                </span>
                <button
                  type="button"
                  onClick={handlePrevComment}
                  title="Previous Comment"
                  className="rounded p-1 hover:bg-slate-200 text-ink-700 font-bold"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={handleNextComment}
                  title="Next Comment"
                  className="rounded p-1 hover:bg-slate-200 text-ink-700 font-bold"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* Change Navigation & Batch Accept/Reject */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-ink-700">
              <span>⚡ Changes</span>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] text-emerald-800 font-bold">
                {pendingChanges.length} pending
              </span>
            </div>
            {pendingChanges.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-ink-500 font-medium mr-1">
                  {currentChangeIndex >= 0 ? `${currentChangeIndex + 1} of ` : ''}
                  {pendingChanges.length}
                </span>
                <button
                  type="button"
                  onClick={handlePrevChange}
                  title="Previous Change"
                  className="rounded p-1 hover:bg-slate-200 text-ink-700 font-bold"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={handleNextChange}
                  title="Next Change"
                  className="rounded p-1 hover:bg-slate-200 text-ink-700 font-bold"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* Batch Accept / Reject Controls */}
          {pendingChanges.length > 0 && !readOnly && (
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={onAcceptAllChanges}
                className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              >
                Accept All ({pendingChanges.length})
              </button>
              <button
                type="button"
                onClick={onRejectAllChanges}
                className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200 hover:bg-rose-100"
              >
                Reject All
              </button>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between border-t border-ink-100 pt-2 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-md px-2 py-1 font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-accent text-white shadow-2xs'
                  : 'text-ink-600 hover:bg-slate-100'
              }`}
            >
              All ({comments.length + trackedChanges.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`rounded-md px-2 py-1 font-semibold transition ${
                activeTab === 'comments'
                  ? 'bg-accent text-white shadow-2xs'
                  : 'text-ink-600 hover:bg-slate-100'
              }`}
            >
              Comments ({comments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('changes')}
              className={`rounded-md px-2 py-1 font-semibold transition ${
                activeTab === 'changes'
                  ? 'bg-accent text-white shadow-2xs'
                  : 'text-ink-600 hover:bg-slate-100'
              }`}
            >
              Changes ({trackedChanges.length})
            </button>
          </div>

          {activeTab !== 'changes' && (
            <select
              aria-label="Filter comments status"
              value={filterResolved}
              onChange={(e) => setFilterResolved(e.target.value as any)}
              className="rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[11px] text-ink-700"
            >
              <option value="all">All status</option>
              <option value="active">Active only</option>
              <option value="resolved">Resolved only</option>
            </select>
          )}
        </div>
      </div>

      {/* Scrollable Margin Cards Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Active Pending Comment Card (When user selects text in document) */}
        {pendingQuoteText && (
          <div
            id="new-comment-anchor-card"
            className="rounded-xl border-2 border-accent bg-white p-3 shadow-lg animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
              <span className="font-bold text-accent">New Comment on Selected Text</span>
              <button
                type="button"
                onClick={onCancelPendingComment}
                className="text-ink-400 hover:text-ink-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="mb-2.5 rounded-lg border-l-3 border-accent bg-amber-50/60 p-2 text-xs italic text-ink-800 line-clamp-3">
              “{pendingQuoteText}”
            </div>
            <textarea
              ref={newCommentInputRef}
              rows={3}
              placeholder="Write a comment or mention team members..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="w-full rounded-lg border border-ink-200 p-2 text-xs text-ink-900 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            />
            <div className="mt-2.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelPendingComment}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-ink-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingComment || !newCommentText.trim()}
                onClick={handlePostNewComment}
                className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 disabled:opacity-50"
              >
                {isSubmittingComment ? 'Posting…' : 'Comment'}
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {visibleComments.length === 0 && trackedChanges.length === 0 && !pendingQuoteText && (
          <div className="rounded-xl border border-dashed border-ink-200 bg-white/60 p-6 text-center text-xs text-ink-500">
            <p className="font-semibold text-ink-700">No Comments or Changes</p>
            <p className="mt-1 text-[11px] text-ink-400">
              Select any text in the document and click <strong>Comment</strong> (or press{' '}
              <kbd className="px-1 py-0.5 rounded bg-slate-200 font-mono text-[10px]">Ctrl+M</kbd>)
              to start a discussion.
            </p>
            <p className="mt-2 text-[11px] text-ink-400">
              Toggle <strong>Suggesting Mode</strong> to track insertions, deletions, and formatting.
            </p>
          </div>
        )}

        {/* Combined or Tabbed List */}
        {/* 1. Tracked Changes Cards */}
        {(activeTab === 'all' || activeTab === 'changes') &&
          trackedChanges.map((change) => {
            const isChangeActive = change.id === activeChangeId;
            return (
              <div
                key={change.id}
                id={`change-card-${change.id}`}
                onClick={() => onSelectChange(change.id)}
                className={`group relative rounded-xl border bg-white p-3 shadow-2xs transition-all duration-150 cursor-pointer ${
                  isChangeActive
                    ? 'border-accent ring-2 ring-accent/30 shadow-md'
                    : 'border-ink-150 hover:border-ink-300'
                }`}
              >
                {/* Header: Author & Type & Timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Author Avatar with color */}
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: change.author.color || '#3b82f6' }}
                    >
                      {getAuthorInitials(change.author.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-ink-900 leading-tight">
                          {change.author.name}
                        </span>
                        {/* Change Type Badge */}
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                            change.type === 'insert'
                              ? 'bg-emerald-100 text-emerald-800'
                              : change.type === 'delete'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {change.type === 'insert'
                            ? '+ Insert'
                            : change.type === 'delete'
                            ? '- Delete'
                            : '✎ Format'}
                        </span>
                      </div>
                      <span
                        className="text-[10px] text-ink-400 block"
                        title={formatExactDateTime(change.timestamp)}
                      >
                        {formatRelativeTime(change.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Pending Status Tag */}
                  {change.status === 'pending' ? (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
                      Proposed
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-ink-600">
                      {change.status}
                    </span>
                  )}
                </div>

                {/* Change Snippet */}
                <div className="mt-2.5 rounded-lg border border-ink-100 bg-slate-50/70 p-2 text-xs">
                  {change.type === 'format' ? (
                    <div>
                      <span className="font-semibold text-purple-800">
                        {change.formatDetail || 'Formatted'}:
                      </span>{' '}
                      <span className="italic text-ink-800">“{change.text}”</span>
                    </div>
                  ) : change.type === 'insert' ? (
                    <div className="text-emerald-800">
                      <span className="font-semibold">Inserted: </span>
                      <span className="underline decoration-emerald-500 font-medium">
                        “{change.text}”
                      </span>
                    </div>
                  ) : (
                    <div className="text-rose-800">
                      <span className="font-semibold">Deleted: </span>
                      <span className="line-through decoration-rose-500 font-medium">
                        “{change.text}”
                      </span>
                    </div>
                  )}
                </div>

                {/* Accept / Reject Action Buttons */}
                {!readOnly && change.status === 'pending' && (
                  <div className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-ink-100 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptChange(change.id);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition"
                    >
                      <span>✓</span>
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRejectChange(change.id);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                    >
                      <span>✕</span>
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        {/* 2. Comments Cards */}
        {(activeTab === 'all' || activeTab === 'comments') &&
          visibleComments.map((comment) => {
            const isCommentActive = comment.id === activeCommentId;
            const isReplying = replyingTo === comment.id;

            return (
              <div
                key={comment.id}
                id={`comment-card-${comment.id}`}
                onClick={() => onSelectComment(comment.id)}
                className={`group relative rounded-xl border bg-white p-3.5 shadow-2xs transition-all duration-150 cursor-pointer ${
                  isCommentActive
                    ? 'border-orange-400 ring-2 ring-orange-400/30 shadow-md'
                    : comment.isResolved
                    ? 'border-ink-100 bg-slate-50/60 opacity-80'
                    : 'border-ink-150 hover:border-ink-300'
                }`}
              >
                {/* Header: Author & Timestamp & Resolution */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-2xs"
                      title={comment.author.email}
                    >
                      {getAuthorInitials(comment.author.name)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-ink-900 block leading-tight">
                        {comment.author.name}
                      </span>
                      <span
                        className="text-[10px] text-ink-400 block"
                        title={formatExactDateTime(comment.createdAt)}
                      >
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Resolution badge / toggle button */}
                  <button
                    type="button"
                    title={comment.isResolved ? 'Reopen discussion' : 'Mark as resolved'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onResolveComment(comment.id);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                      comment.isResolved
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    {comment.isResolved ? '✓ Resolved' : 'Resolve'}
                  </button>
                </div>

                {/* Quoted Snippet Anchor */}
                {comment.quoteText && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComment(comment.id);
                    }}
                    className="mt-2 rounded-lg border-l-2 border-amber-400 bg-amber-50/80 px-2 py-1 text-[11px] italic text-ink-800 line-clamp-3 hover:bg-amber-100 transition"
                    title="Click to jump to quote in document"
                  >
                    “{comment.quoteText}”
                  </div>
                )}

                {/* Comment Content */}
                <div className="mt-2 text-xs leading-relaxed text-ink-800 whitespace-pre-wrap">
                  {comment.content}
                </div>

                {/* Threaded Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-ink-100 pt-2.5">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-ink-900">{reply.author.name}</span>
                          <span
                            className="text-[10px] text-ink-400"
                            title={formatExactDateTime(reply.createdAt)}
                          >
                            {formatRelativeTime(reply.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-ink-700 leading-normal">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Composer */}
                {!readOnly && (
                  <div className="mt-3 border-t border-ink-100/70 pt-2">
                    {!isReplying ? (
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplyingTo(comment.id);
                          }}
                          className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                        >
                          <span>↩</span> Reply...
                        </button>

                        {onDeleteComment && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Delete this comment?')) {
                                onDeleteComment(comment.id);
                              }
                            }}
                            className="text-[10px] text-ink-400 hover:text-rose-600"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        className="space-y-2 pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <textarea
                          rows={2}
                          autoFocus
                          placeholder="Write a reply..."
                          value={replyInputs[comment.id] || ''}
                          onChange={(e) =>
                            setReplyInputs((prev) => ({
                              ...prev,
                              [comment.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-ink-200 p-2 text-xs text-ink-900 focus:border-accent focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="rounded px-2 py-0.5 text-xs text-ink-500 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              isSubmittingReply === comment.id ||
                              !(replyInputs[comment.id] || '').trim()
                            }
                            onClick={() => handlePostReply(comment.id)}
                            className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {isSubmittingReply === comment.id ? 'Sending…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </aside>
  );
};
