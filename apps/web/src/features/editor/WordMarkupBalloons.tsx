import { useState, type FormEvent } from 'react';

export interface TrackedChange {
  id: string;
  type: 'insertion' | 'deletion' | 'formatting';
  authorName: string;
  authorEmail?: string;
  authorColor: string;
  timestamp: string; // ISO string
  textSnippet: string;
  details?: string;
  elementId?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface CommentReply {
  id: string;
  authorName: string;
  authorEmail?: string;
  authorColor: string;
  timestamp: string;
  content: string;
}

export interface DocumentComment {
  id: string;
  authorName: string;
  authorEmail?: string;
  authorColor: string;
  timestamp: string;
  quoteText: string;
  content: string;
  isResolved: boolean;
  replies: CommentReply[];
  elementId?: string;
}

interface WordMarkupBalloonsProps {
  changes: TrackedChange[];
  comments: DocumentComment[];
  activeChangeId?: string | null;
  activeCommentId?: string | null;
  onSelectChange: (id: string) => void;
  onSelectComment: (id: string) => void;
  onAcceptChange: (id: string) => void;
  onRejectChange: (id: string) => void;
  onReplyComment: (commentId: string, replyText: string) => void;
  onToggleResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onJumpNextChange: () => void;
  onJumpPrevChange: () => void;
  onJumpNextComment: () => void;
  onJumpPrevComment: () => void;
  currentUserName: string;
  currentUserColor: string;
  readOnly?: boolean;
}

export function formatTimeAgo(isoString: string): string {
  try {
    const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function WordMarkupBalloons({
  changes,
  comments,
  activeChangeId,
  activeCommentId,
  onSelectChange,
  onSelectComment,
  onAcceptChange,
  onRejectChange,
  onReplyComment,
  onToggleResolveComment,
  onDeleteComment,
  onJumpNextChange,
  onJumpPrevChange,
  onJumpNextComment,
  onJumpPrevComment,
  currentUserName,
  currentUserColor,
  readOnly = false,
}: WordMarkupBalloonsProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'changes' | 'comments'>('all');
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState<boolean>(false);

  const pendingChanges = changes.filter((c) => c.status === 'pending');
  const activeComments = comments.filter((c) => (showResolved ? true : !c.isResolved));

  function handleReplySubmit(e: FormEvent, commentId: string) {
    e.preventDefault();
    const text = replyInputs[commentId]?.trim();
    if (!text) return;
    onReplyComment(commentId, text);
    setReplyInputs((prev) => ({ ...prev, [commentId]: '' }));
  }

  return (
    <aside className="w-80 border-l border-slate-300 bg-[#F9FAFB] p-3 text-xs flex flex-col h-full overflow-hidden shrink-0 select-none">
      {/* Top Header: Title & Jump Navigation Controls */}
      <div className="border-b border-slate-200 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <span>Markup Balloons</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {pendingChanges.length + activeComments.length}
            </span>
          </div>

          {/* Jump Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Previous change"
              onClick={onJumpPrevChange}
              disabled={pendingChanges.length === 0}
              className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30"
            >
              ⇦
            </button>
            <button
              type="button"
              title="Next change"
              onClick={onJumpNextChange}
              disabled={pendingChanges.length === 0}
              className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30"
            >
              ⇨
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              title="Previous comment"
              onClick={onJumpPrevComment}
              disabled={activeComments.length === 0}
              className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30"
            >
              💬⇦
            </button>
            <button
              type="button"
              title="Next comment"
              onClick={onJumpNextComment}
              disabled={activeComments.length === 0}
              className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30"
            >
              💬⇨
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                filterMode === 'all'
                  ? 'bg-[#185ABD] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('changes')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                filterMode === 'changes'
                  ? 'bg-[#185ABD] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Changes ({pendingChanges.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('comments')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                filterMode === 'comments'
                  ? 'bg-[#185ABD] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Comments ({activeComments.length})
            </button>
          </div>

          <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-slate-300 text-[#185ABD]"
            />
            <span>Resolved</span>
          </label>
        </div>
      </div>

      {/* Balloon Cards Scroll Container */}
      <div className="flex-1 overflow-y-auto pt-3 space-y-3 pr-1">
        {pendingChanges.length === 0 && activeComments.length === 0 && (
          <div className="p-6 text-center text-slate-400">
            <span className="text-2xl">📝</span>
            <p className="mt-2 text-xs font-semibold text-slate-600">No pending revisions</p>
            <p className="mt-1 text-[11px]">
              Turn on Track Changes or select contract text to add a comment.
            </p>
          </div>
        )}

        {/* 1. Tracked Changes Balloons */}
        {(filterMode === 'all' || filterMode === 'changes') &&
          pendingChanges.map((change) => {
            const isActive = activeChangeId === change.id;
            return (
              <div
                key={change.id}
                onClick={() => onSelectChange(change.id)}
                className={`group rounded-xl border bg-white p-3 shadow-xs transition cursor-pointer ${
                  isActive
                    ? 'border-[#185ABD] ring-2 ring-[#185ABD]/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Author attribution & Action header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: change.authorColor || '#185ABD' }}
                    >
                      {getInitials(change.authorName)}
                    </span>
                    <span className="font-bold text-slate-800 truncate max-w-[120px]">
                      {change.authorName}
                    </span>
                  </div>

                  <span
                    className="text-[10px] text-slate-400"
                    title={new Date(change.timestamp).toLocaleString()}
                  >
                    {formatTimeAgo(change.timestamp)}
                  </span>
                </div>

                {/* Change Action Badge */}
                <div className="mt-2 flex items-center gap-1.5">
                  {change.type === 'insertion' && (
                    <span className="rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[10px] font-bold">
                      Inserted Text
                    </span>
                  )}
                  {change.type === 'deletion' && (
                    <span className="rounded bg-rose-50 text-rose-700 px-1.5 py-0.5 text-[10px] font-bold">
                      Deleted Text
                    </span>
                  )}
                  {change.type === 'formatting' && (
                    <span className="rounded bg-purple-50 text-purple-700 px-1.5 py-0.5 text-[10px] font-bold">
                      Formatting Change
                    </span>
                  )}
                </div>

                {/* Diff Content Preview */}
                <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed">
                  {change.type === 'insertion' && (
                    <p className="text-blue-900 underline decoration-blue-500 font-medium">
                      "{change.textSnippet}"
                    </p>
                  )}
                  {change.type === 'deletion' && (
                    <p className="text-rose-900 line-through decoration-rose-500 font-medium">
                      "{change.textSnippet}"
                    </p>
                  )}
                  {change.type === 'formatting' && (
                    <div>
                      <p className="font-semibold text-purple-900">{change.details || 'Style modified'}</p>
                      <p className="text-slate-600 italic">"{change.textSnippet}"</p>
                    </div>
                  )}
                </div>

                {/* Accept / Reject Action Buttons */}
                {!readOnly && (
                  <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      title="Accept this change"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptChange(change.id);
                      }}
                      className="flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 font-bold text-[11px] shadow-2xs transition"
                    >
                      <span>✓</span>
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      title="Reject this change"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRejectChange(change.id);
                      }}
                      className="flex items-center gap-1 rounded border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 px-2 py-1 font-bold text-[11px] shadow-2xs transition"
                    >
                      <span>✕</span>
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        {/* 2. Threaded Comments Balloons */}
        {(filterMode === 'all' || filterMode === 'comments') &&
          activeComments.map((comment) => {
            const isActive = activeCommentId === comment.id;
            return (
              <div
                key={comment.id}
                onClick={() => onSelectComment(comment.id)}
                className={`group rounded-xl border bg-white p-3 shadow-xs transition cursor-pointer ${
                  comment.isResolved ? 'opacity-60 bg-slate-50/80 border-slate-200' : ''
                } ${
                  isActive
                    ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Author & Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: comment.authorColor || '#D97706' }}
                    >
                      {getInitials(comment.authorName)}
                    </span>
                    <span className="font-bold text-slate-800 truncate max-w-[120px]">
                      {comment.authorName}
                    </span>
                  </div>

                  <span
                    className="text-[10px] text-slate-400"
                    title={new Date(comment.timestamp).toLocaleString()}
                  >
                    {formatTimeAgo(comment.timestamp)}
                  </span>
                </div>

                {/* Quoted Snippet */}
                {comment.quoteText && (
                  <div className="mt-2 rounded border-l-2 border-amber-400 bg-amber-50/60 px-2 py-1 text-[10px] text-amber-900 italic line-clamp-2">
                    "{comment.quoteText}"
                  </div>
                )}

                {/* Comment Content */}
                <p className="mt-2 text-[11px] text-slate-900 leading-relaxed font-normal">
                  {comment.content}
                </p>

                {/* Threaded Replies List */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2 pl-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="border-l-2 border-slate-200 pl-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] text-slate-700">
                            {reply.authorName}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {formatTimeAgo(reply.timestamp)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-800">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Input Form */}
                {!readOnly && (
                  <form
                    onSubmit={(e) => handleReplySubmit(e, comment.id)}
                    className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white shrink-0"
                      style={{ backgroundColor: currentUserColor }}
                      title={`Replying as ${currentUserName}`}
                    >
                      {getInitials(currentUserName)}
                    </span>
                    <input
                      type="text"
                      placeholder={`Reply as ${currentUserName}...`}
                      value={replyInputs[comment.id] || ''}
                      onChange={(e) =>
                        setReplyInputs((prev) => ({ ...prev, [comment.id]: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#185ABD] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!replyInputs[comment.id]?.trim()}
                      className="rounded-lg bg-[#185ABD] px-2 py-1 font-semibold text-[10px] text-white hover:bg-[#103F91] disabled:opacity-40"
                    >
                      Post
                    </button>
                  </form>
                )}

                {/* Bottom Controls: Resolve / Delete */}
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-500">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleResolveComment(comment.id);
                    }}
                    className="font-medium hover:text-[#185ABD] transition"
                  >
                    {comment.isResolved ? '↩ Re-open' : '✓ Mark Resolved'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this comment thread?')) {
                        onDeleteComment(comment.id);
                      }
                    }}
                    className="text-slate-400 hover:text-rose-600 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
