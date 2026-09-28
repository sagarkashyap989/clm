import type { FC } from 'react';

export type CollaborationConnectionState =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected';

interface CollaborationStatusProps {
  status: CollaborationConnectionState;
  onRetry?: () => void;
  errorMessage?: string | null;
}

export const CollaborationStatus: FC<CollaborationStatusProps> = ({
  status,
  onRetry,
  errorMessage,
}) => {
  return (
    <div className="flex items-center gap-2">
      {status === 'connected' && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20"
          title="Real-time multi-user document synchronization is active"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
          <span>✓ Live</span>
        </span>
      )}

      {status === 'connecting' && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20"
          title="Connecting to collaboration room..."
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
          <span>◌ Connecting...</span>
        </span>
      )}

      {status === 'reconnecting' && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/20"
          title="Connection interrupted. Attempting automatic reconnection; local edits are safely preserved."
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
          <span>↻ Reconnecting...</span>
        </span>
      )}

      {status === 'disconnected' && (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-600/20"
            title={
              errorMessage
                ? `Disconnected from live collaboration (${errorMessage}). Local drafts still autosave via REST.`
                : 'Disconnected from live collaboration. Local changes are preserved.'
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>⚠ Offline</span>
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
};
