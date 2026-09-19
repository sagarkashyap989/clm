import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContractComment } from '@cml/shared';
import { api } from '@/lib/api';

type ContractCommentsPanelProps = {
  contractId: string;
  currentVersionNumber?: number;
  readOnly?: boolean;
};

export function ContractCommentsPanel({
  contractId,
  currentVersionNumber = 1,
  readOnly = false,
}: ContractCommentsPanelProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [quoteSnippet, setQuoteSnippet] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Fetch comments
  const { data, isLoading } = useQuery({
    queryKey: ['contract-comments', contractId],
    enabled: Boolean(contractId),
    queryFn: () => api<{ comments: ContractComment[] }>(`/api/v1/contracts/${contractId}/comments`),
  });

  const comments = data?.comments || [];

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (payload: {
      content: string;
      quoteText?: string;
      versionNumber?: number;
    }) => {
      return api(`/api/v1/contracts/${contractId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setNewCommentContent('');
      setQuoteSnippet('');
      queryClient.invalidateQueries({ queryKey: ['contract-comments', contractId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      return api(`/api/v1/contracts/${contractId}/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      setReplyingToId(null);
      setReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['contract-comments', contractId] });
    },
  });

  // Resolve / Reopen mutation
  const resolveMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return api(`/api/v1/contracts/${contractId}/comments/${commentId}/resolve`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-comments', contractId] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return api(`/api/v1/contracts/${contractId}/comments/${commentId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-comments', contractId] });
    },
  });

  const filteredComments = comments.filter((c) => {
    if (filter === 'active') return !c.isResolved;
    if (filter === 'resolved') return c.isResolved;
    return true;
  });

  function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newCommentContent.trim() || readOnly) return;
    createCommentMutation.mutate({
      content: newCommentContent.trim(),
      quoteText: quoteSnippet.trim() || undefined,
      versionNumber: currentVersionNumber,
    });
  }

  function handlePostReply(commentId: string) {
    if (!replyContent.trim() || readOnly) return;
    replyMutation.mutate({ commentId, content: replyContent.trim() });
  }

  return (
    <div id="contract-comments-panel" className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
        <div>
          <h3 className="font-serif text-base font-bold text-ink-950">Clause Comments & Feedback</h3>
          <p className="text-xs text-ink-500">
            Collaborative annotations and legal review threads.
          </p>
        </div>

        <div className="flex rounded-lg border border-ink-200 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`rounded px-2.5 py-1 font-semibold transition ${
              filter === 'active' ? 'bg-accent text-white' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            Active ({comments.filter((c) => !c.isResolved).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('resolved')}
            className={`rounded px-2.5 py-1 font-semibold transition ${
              filter === 'resolved' ? 'bg-accent text-white' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            Resolved ({comments.filter((c) => c.isResolved).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded px-2.5 py-1 font-semibold transition ${
              filter === 'all' ? 'bg-accent text-white' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            All ({comments.length})
          </button>
        </div>
      </div>

      {/* New Comment Box */}
      {!readOnly && (
        <form
          onSubmit={handlePostComment}
          className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <span className="text-xs font-bold text-ink-800">Add a Comment</span>
            {quoteSnippet ? (
              <button
                type="button"
                onClick={() => setQuoteSnippet('')}
                className="text-[11px] text-rose-600 hover:underline"
              >
                Clear Quote
              </button>
            ) : null}
          </div>

          {quoteSnippet && (
            <div className="mb-2 rounded-lg border-l-2 border-accent bg-accent/5 p-2 text-xs italic text-ink-700">
              &ldquo;{quoteSnippet}&rdquo;
            </div>
          )}

          <textarea
            rows={2}
            required
            placeholder="Type your feedback, legal question, or approval note..."
            value={newCommentContent}
            onChange={(e) => setNewCommentContent(e.target.value)}
            className="w-full rounded-lg border border-ink-100 p-2.5 text-xs text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
          />

          <div className="mt-2 flex items-center justify-between">
            <input
              type="text"
              placeholder="Optional: paste clause quote to reference"
              value={quoteSnippet}
              onChange={(e) => setQuoteSnippet(e.target.value)}
              className="max-w-xs rounded-lg border border-ink-100 px-2.5 py-1 text-[11px] text-ink-700 placeholder:text-ink-400 focus:border-accent focus:outline-none"
            />

            <button
              type="submit"
              disabled={createCommentMutation.isPending || !newCommentContent.trim()}
              className="rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-ink-400">Loading comments...</div>
      ) : filteredComments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 p-8 text-center text-xs text-ink-400">
          {filter === 'active'
            ? 'No open comments! All contractual points have been resolved.'
            : filter === 'resolved'
              ? 'No resolved comments found.'
              : 'No comments recorded for this agreement yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredComments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl border p-4 transition ${
                comment.isResolved
                  ? 'border-ink-100 bg-slate-50/70 opacity-80'
                  : 'border-ink-200 bg-white shadow-xs'
              }`}
            >
              {/* Quoted Text if any */}
              {comment.quoteText && (
                <div className="mb-3 rounded-lg border-l-2 border-accent bg-accent/5 p-2 text-xs italic text-ink-700">
                  &ldquo;{comment.quoteText}&rdquo;
                </div>
              )}

              {/* Comment Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    {comment.author.name[0]}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-ink-900">{comment.author.name}</span>
                    <span className="ml-2 text-[11px] text-ink-400">
                      {new Date(comment.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {comment.isResolved && (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      ✓ Resolved by {comment.resolvedBy?.name || 'Authorized User'}
                    </span>
                  )}

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => resolveMutation.mutate(comment.id)}
                      className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                        comment.isResolved
                          ? 'bg-slate-100 text-ink-600 hover:bg-slate-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {comment.isResolved ? 'Reopen' : '✓ Resolve'}
                    </button>
                  )}

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(comment.id)}
                      className="text-ink-400 hover:text-rose-600 text-xs"
                      title="Delete comment"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Body */}
              <p className="mt-2.5 text-xs text-ink-900 leading-relaxed">{comment.content}</p>

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-ink-100/60 pt-2.5 pl-4">
                  {comment.replies.map((rep) => (
                    <div key={rep.id} className="rounded-lg bg-slate-50 p-2.5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-ink-900">{rep.author.name}</span>
                        <span className="text-ink-400">
                          {new Date(rep.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-ink-800">{rep.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Box Action */}
              {!readOnly && (
                <div className="mt-3 border-t border-ink-100/60 pt-2">
                  {replyingToId === comment.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Write a reply..."
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handlePostReply(comment.id);
                          }
                        }}
                        className="flex-1 rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handlePostReply(comment.id)}
                        disabled={replyMutation.isPending || !replyContent.trim()}
                        className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(null);
                          setReplyContent('');
                        }}
                        className="rounded-lg border border-ink-200 px-2 py-1.5 text-xs font-semibold text-ink-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingToId(comment.id);
                        setReplyContent('');
                      }}
                      className="text-[11px] font-semibold text-accent hover:underline"
                    >
                      ↩ Reply to thread
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
