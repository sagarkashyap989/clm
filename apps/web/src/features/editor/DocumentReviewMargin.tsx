import { useState, useRef, useEffect, useMemo, type FC, type RefObject } from 'react';
import type { ContractComment, TrackedChange } from '@cml/shared';

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

  trackChangesMode: 'editing' | 'suggesting' | 'viewing';
  onChangeTrackChangesMode: (mode: 'editing' | 'suggesting' | 'viewing') => void;

  readOnly?: boolean;
  changePositions?: Record<string, number>;
  commentPositions?: Record<string, number>;
  badgeContainerRef?: RefObject<HTMLDivElement>;
  onBadgeScroll?: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatExactDate(dateString: string): string {
  const d = new Date(dateString);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'long' });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${month} ${year} at ${time}`;
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
  trackChangesMode,
  onChangeTrackChangesMode,
  readOnly = false,
  changePositions = {},
  badgeContainerRef,
  onBadgeScroll,
}) => {
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState<string | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Record<string, boolean>>({});
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(null);

  // New comment draft state
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const newCommentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pendingQuoteText && newCommentInputRef.current) {
      newCommentInputRef.current.focus();
    }
  }, [pendingQuoteText]);

  // When activeCommentId changes, smoothly scroll the comment card into view and center it
  useEffect(() => {
    if (!activeCommentId) return;
    const cardEl = document.getElementById(`comment-card-${activeCommentId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeCommentId]);

  // When activeChangeId changes, smoothly scroll the markup detail badge into view
  useEffect(() => {
    if (!activeChangeId) return;
    const badgeEl = document.getElementById(`change-card-${activeChangeId}`);
    if (badgeEl) {
      badgeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeChangeId]);

  // Issue 1: Compute non-overlapping vertical positions for Markup & Formatting badges
  // so each detail badge sits horizontally aligned directly next to its formatted text in the document
  const resolvedBadgePositions = useMemo(() => {
    const sorted = [...trackedChanges].sort(
      (a, b) => (changePositions[a.id] ?? 0) - (changePositions[b.id] ?? 0),
    );
    let lastY = 8;
    const posMap: Record<string, number> = {};
    sorted.forEach((ch) => {
      const rawY = changePositions[ch.id];
      const targetY = typeof rawY === 'number' && rawY > 0 ? rawY : lastY;
      const finalY = Math.max(targetY, lastY);
      posMap[ch.id] = finalY;
      lastY = finalY + 46; // minimum clearance so adjacent badges don't collide
    });
    return posMap;
  }, [trackedChanges, changePositions]);

  // Total container height so the markup column matches the document length
  const maxBadgeHeight = useMemo(() => {
    const vals = Object.values(resolvedBadgePositions);
    if (vals.length === 0) return 600;
    return Math.max(600, Math.max(...vals) + 140);
  }, [resolvedBadgePositions]);

  // Comment Navigation: next / prev
  const currentCommentIndex = useMemo(() => {
    if (!activeCommentId) return -1;
    return comments.findIndex((c) => c.id === activeCommentId);
  }, [comments, activeCommentId]);

  function handleNextComment() {
    if (comments.length === 0) return;
    const nextIdx = (currentCommentIndex + 1) % comments.length;
    onSelectComment(comments[nextIdx].id);
  }

  function handlePrevComment() {
    if (comments.length === 0) return;
    const prevIdx =
      currentCommentIndex <= 0 ? comments.length - 1 : currentCommentIndex - 1;
    onSelectComment(comments[prevIdx].id);
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

  function toggleExpand(commentId: string) {
    setExpandedCommentIds((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  }

  return (
    <aside
      id="document-review-rail"
      aria-label="Document Review and Markup Rail"
      className="flex flex-col lg:flex-row w-full lg:w-[540px] xl:w-[580px] shrink-0 bg-[#09090b] text-zinc-100 select-text overflow-hidden border-l border-zinc-800"
    >
      {/* SECTION 1: Markup & Formatting Stream Column (Middle Column from Word screenshot) */}
      <div className="w-full lg:w-[220px] xl:w-[240px] shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-[#121215] flex flex-col">
        {/* Header for Markup */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-2 text-[11px] font-semibold text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span>Markup & Formatting</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
              {trackedChanges.length}
            </span>
          </div>

          <select
            aria-label="Track changes mode"
            value={trackChangesMode}
            disabled={readOnly}
            onChange={(e) =>
              onChangeTrackChangesMode(e.target.value as 'editing' | 'suggesting' | 'viewing')
            }
            className="rounded bg-zinc-800 text-[10px] text-zinc-300 border border-zinc-700 px-1.5 py-0.5 focus:outline-none"
          >
            <option value="suggesting">⚡ Redline</option>
            <option value="editing">Direct Edit</option>
            <option value="viewing">Viewing</option>
          </select>
        </div>

        {/* ISSUE 1: Vertically positioned badges sitting directly next to the formatted text in the document */}
        <div
          ref={badgeContainerRef}
          onScroll={onBadgeScroll}
          className="relative flex-1 overflow-y-auto p-2 font-sans text-xs scrollbar-thin"
          style={{ minHeight: `${maxBadgeHeight}px` }}
        >
          {trackedChanges.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-zinc-500">
              No formatting or text revisions recorded.
            </div>
          ) : (
            trackedChanges.map((change) => {
              const isActive = change.id === activeChangeId;
              const top = resolvedBadgePositions[change.id] ?? 8;
              const authorColor = change.author.color || '#ef4444';

              return (
                <div
                  key={change.id}
                  id={`change-card-${change.id}`}
                  onClick={() => onSelectChange(change.id)}
                  style={{
                    top: `${top}px`,
                    borderLeftColor: authorColor,
                  }}
                  className={`absolute left-2 right-2 pl-2.5 pr-2 py-1.5 border-l-4 cursor-pointer transition-all duration-150 rounded-r shadow-xs ${
                    isActive
                      ? 'bg-zinc-800/90 text-white ring-2 ring-blue-500 shadow-md z-20'
                      : 'bg-[#18181c] hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {/* Author Name in Author Color */}
                  <div className="flex items-center justify-between">
                    <div
                      className="font-bold text-[11px] leading-tight"
                      style={{ color: authorColor }}
                    >
                      {change.author.name || 'Author'}
                    </div>
                    <span className="text-[9px] text-zinc-500">
                      {formatRelativeTime(change.timestamp)}
                    </span>
                  </div>

                  {/* Markup Detail line */}
                  <div className="text-[10px] leading-snug text-zinc-400 mt-0.5">
                    {change.type === 'format' ? (
                      <>
                        <strong className="text-zinc-200 font-semibold">Formatted:</strong>{' '}
                        {change.formatDetail || 'Font: Bold'}
                      </>
                    ) : change.type === 'insert' ? (
                      <>
                        <strong className="font-semibold" style={{ color: authorColor }}>
                          Inserted:
                        </strong>{' '}
                        “
                        {change.text.length > 32 ? change.text.slice(0, 32) + '…' : change.text}”
                      </>
                    ) : (
                      <>
                        <strong className="text-red-400 font-semibold">Deleted:</strong> “
                        {change.text.length > 32 ? change.text.slice(0, 32) + '…' : change.text}”
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 2: Modern Comments Stream Column (Rightmost Column from Word screenshot) */}
      <div className="flex-1 flex flex-col bg-[#0c0c0e]">
        {/* Comments Header Bar with navigation */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-200">Comments</span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
              {comments.filter((c) => !c.isResolved).length} open
            </span>
          </div>

          {/* Navigation Controls */}
          {comments.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span>
                {currentCommentIndex >= 0 ? `${currentCommentIndex + 1} of ` : ''}
                {comments.length}
              </span>
              <button
                type="button"
                onClick={handlePrevComment}
                title="Previous comment"
                className="rounded p-1 hover:bg-zinc-800 hover:text-white"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={handleNextComment}
                title="Next comment"
                className="rounded p-1 hover:bg-zinc-800 hover:text-white"
              >
                ▼
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Comments List */}
        <div
          ref={commentsContainerRef}
          className="flex-1 overflow-y-auto p-3 space-y-3"
        >
          {/* Active Pending Comment Card (when text is highlighted) */}
          {pendingQuoteText && (
            <div
              id="new-comment-anchor-card"
              className="rounded-xl border border-blue-500/80 bg-[#18181b] p-3.5 shadow-xl animate-in fade-in"
            >
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span className="font-bold text-blue-400">Comment on selection</span>
                <button
                  type="button"
                  onClick={onCancelPendingComment}
                  className="text-zinc-400 hover:text-zinc-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="mb-2.5 rounded-lg border-l-2 border-blue-400 bg-blue-950/30 p-2 text-xs italic text-blue-200 line-clamp-2">
                “{pendingQuoteText}”
              </div>
              <textarea
                ref={newCommentInputRef}
                rows={3}
                placeholder="Type your comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
              />
              <div className="mt-2.5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelPendingComment}
                  className="rounded-lg px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingComment || !newCommentText.trim()}
                  onClick={handlePostNewComment}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {isSubmittingComment ? 'Posting…' : 'Comment'}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {comments.length === 0 && !pendingQuoteText && (
            <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              <p className="font-semibold text-zinc-400">No Comments Yet</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Select text in the contract and click <strong>Add Comment</strong> (or press{' '}
                <kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[10px] text-zinc-300">
                  Ctrl+M
                </kbd>
                ).
              </p>
            </div>
          )}

          {/* FEAT 2: Comment Cards with striking highlight when comment icon is clicked */}
          {comments.map((comment) => {
            const isActive = comment.id === activeCommentId;
            const isReplying = replyingTo === comment.id;
            const isExpanded = Boolean(expandedCommentIds[comment.id]);
            const isLong = comment.content.length > 130;
            const isMenuOpen = openMenuCommentId === comment.id;

            return (
              <div
                key={comment.id}
                id={`comment-card-${comment.id}`}
                onClick={() => onSelectComment(comment.id)}
                className={`relative rounded-2xl border p-3.5 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-blue-400 bg-blue-950/40 ring-2 ring-blue-500 shadow-2xl scale-[1.01] z-20'
                    : 'border-zinc-800/90 bg-[#18181b] hover:border-zinc-700 hover:bg-[#1c1c20]'
                }`}
              >
                {/* Header: Avatar, Name, Timestamp, Active Badge, Menu */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Circle avatar with user silhouette */}
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-zinc-100 leading-tight">
                        {comment.author.name}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {formatExactDate(comment.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* FEAT 2: Prominent Active Comment Badge when selected */}
                    {isActive && (
                      <span className="rounded-full bg-blue-500/20 border border-blue-400/60 px-2 py-0.5 text-[9px] font-bold text-blue-300 uppercase tracking-wider">
                        Active
                      </span>
                    )}

                    {/* Three-dots menu button */}
                    <div className="relative">
                      <button
                        type="button"
                        title="Comment options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuCommentId(isMenuOpen ? null : comment.id);
                        }}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                      </button>

                      {/* Dropdown menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-6 z-30 w-36 rounded-xl border border-zinc-700 bg-zinc-800 py-1 text-xs shadow-xl"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuCommentId(null);
                              onResolveComment(comment.id);
                            }}
                            className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-700"
                          >
                            {comment.isResolved ? 'Reopen thread' : 'Resolve thread'}
                          </button>
                          {!readOnly && onDeleteComment && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuCommentId(null);
                                if (window.confirm('Delete this comment?')) {
                                  onDeleteComment(comment.id);
                                }
                              }}
                              className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-zinc-700"
                            >
                              Delete comment
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Comment Content */}
                <div className="mt-2.5 text-xs text-zinc-300 leading-relaxed font-sans">
                  {isLong && !isExpanded ? (
                    <>
                      {comment.content.slice(0, 130)}…
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(comment.id);
                        }}
                        className="ml-1 font-semibold text-zinc-400 hover:text-zinc-200 underline"
                      >
                        See more
                      </button>
                    </>
                  ) : (
                    <>
                      {comment.content}
                      {isLong && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(comment.id);
                          }}
                          className="ml-1 font-semibold text-zinc-400 hover:text-zinc-200 underline"
                        >
                          See less
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Threaded Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-zinc-800 pt-2.5">
                    {comment.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-lg bg-zinc-900/80 p-2 text-xs border border-zinc-800/60"
                      >
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span className="font-bold text-zinc-200">{reply.author.name}</span>
                          <span>{formatRelativeTime(reply.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-zinc-300 leading-normal">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply bar */}
                {!readOnly && (
                  <div className="mt-2.5 pt-1.5 flex items-center justify-between text-xs text-zinc-400">
                    {!isReplying ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyingTo(comment.id);
                        }}
                        className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                      >
                        <span>↩</span> Reply
                      </button>
                    ) : (
                      <div
                        className="w-full space-y-2 pt-1"
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
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-400 focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800"
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
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                          >
                            {isSubmittingReply === comment.id ? 'Sending…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    )}

                    {comment.isResolved && (
                      <span className="text-[10px] text-zinc-500 italic">Resolved</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
