import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContractChatMessage } from '@cml/shared';
import { api } from '@/lib/api';

type ContractChatPanelProps = {
  contractId: string;
  contractName: string;
  readOnly?: boolean;
};

export function ContractChatPanel({
  contractId,
  contractName,
  readOnly = false,
}: ContractChatPanelProps) {
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const { data, isLoading } = useQuery({
    queryKey: ['contract-chat', contractId],
    enabled: Boolean(contractId),
    queryFn: () => api<{ messages: ContractChatMessage[] }>(`/api/v1/contracts/${contractId}/chat`),
    refetchInterval: 5000, // Poll every 5s for collaborative chat updates
  });

  const messages = data?.messages || [];

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return api(`/api/v1/contracts/${contractId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['contract-chat', contractId] });
    },
  });

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageText.trim() || readOnly) return;
    sendMutation.mutate(messageText.trim());
  }

  return (
    <div id="contract-chat-panel" className="flex h-[600px] flex-col rounded-2xl border border-ink-100 bg-white shadow-sm">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="font-serif text-sm font-bold text-ink-950">Contract Discussion</h3>
          </div>
          <p className="text-[11px] text-ink-500">
            Real-time collaboration for {contractName}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-ink-700">
          {messages.length} Messages
        </span>
      </div>

      {/* Message Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-ink-400">Loading chat history...</div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg">
              💬
            </div>
            <p className="mt-2 text-xs font-semibold text-ink-700">No discussion yet</p>
            <p className="mt-0.5 text-[11px] text-ink-400">
              Start the conversation regarding terms, review timelines, or approvals.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex items-center justify-center gap-2 my-2">
                  <span className="h-px flex-1 bg-ink-100" />
                  <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-medium text-ink-600">
                    ℹ️ {msg.content}
                  </span>
                  <span className="h-px flex-1 bg-ink-100" />
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                  {msg.sender.name[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-ink-900">{msg.sender.name}</span>
                    <span className="text-[10px] text-ink-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="mt-1 inline-block rounded-xl bg-slate-100 px-3.5 py-2 text-xs text-ink-900 leading-relaxed max-w-lg">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Box */}
      {!readOnly && (
        <form onSubmit={handleSendMessage} className="border-t border-ink-100 p-3 bg-slate-50">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Send message to contract reviewers... (Enter to send)"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="flex-1 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={sendMutation.isPending || !messageText.trim()}
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
