import { useEffect, useRef, useCallback } from 'react';
import { useCollaboration } from './useCollaboration';
import type { DocumentPatch, RoomSyncPayload, VersionRestoreBroadcast } from '@cml/shared';

interface UseCollaborativeDocumentProps {
  onRemoteUpdate: (content: string, patch: DocumentPatch) => void;
  onInitialSync?: (content: string, payload: RoomSyncPayload) => void;
  onVersionRestored?: (content: string, payload: VersionRestoreBroadcast) => void;
}

export function useCollaborativeDocument({
  onRemoteUpdate,
  onInitialSync,
  onVersionRestored,
}: UseCollaborativeDocumentProps) {
  const {
    status,
    canEdit,
    sendEdit,
    sendCursor,
    sendSelection,
    setOnRemotePatch,
    setOnInitialSync,
    setOnVersionRestored,
  } = useCollaboration();

  const editDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set up listeners with collaboration provider
  useEffect(() => {
    setOnInitialSync((payload) => {
      if (payload.content) {
        onInitialSync?.(payload.content, payload);
      }
    });

    setOnRemotePatch((patch) => {
      onRemoteUpdate(patch.content, patch);
    });

    setOnVersionRestored((broadcast) => {
      onVersionRestored?.(broadcast.content, broadcast);
    });

    return () => {
      setOnInitialSync(null);
      setOnRemotePatch(null);
      setOnVersionRestored(null);
    };
  }, [
    setOnInitialSync,
    setOnRemotePatch,
    setOnVersionRestored,
    onInitialSync,
    onRemoteUpdate,
    onVersionRestored,
  ]);

  const broadcastLocalEdit = useCallback(
    (newContent: string) => {
      if (!canEdit) return;

      if (editDebounceTimerRef.current) {
        clearTimeout(editDebounceTimerRef.current);
      }

      // 60ms debounce for rapid keystrokes to ensure smooth operational updates without saturating socket
      editDebounceTimerRef.current = setTimeout(() => {
        sendEdit(newContent);
      }, 60);
    },
    [canEdit, sendEdit],
  );

  return {
    status,
    canEdit,
    broadcastLocalEdit,
    broadcastCursor: sendCursor,
    broadcastSelection: sendSelection,
  };
}
