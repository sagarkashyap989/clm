import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type FC,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  CollaboratorPresence,
  CursorPosition,
  SelectionRange,
  DocumentPatch,
  RoomSyncPayload,
  VersionRestoreBroadcast,
} from '@cml/shared';
import { useAuthStore } from '@/stores/auth';
import type { CollaborationConnectionState } from './CollaborationStatus';

interface CollaborationContextValue {
  status: CollaborationConnectionState;
  activeUsers: CollaboratorPresence[];
  currentSocketId: string | null;
  canEdit: boolean;
  latestRevision: number;
  sendEdit: (content: string) => void;
  sendCursor: (cursor: CursorPosition | null) => void;
  sendSelection: (selection: SelectionRange | null) => void;
  restoreVersion: (versionNumber: number, content: string) => void;
  notifications: Array<{ id: string; message: string; timestamp: number }>;
  dismissNotification: (id: string) => void;
  errorMessage: string | null;
  onRemotePatch?: (patch: DocumentPatch) => void;
  setOnRemotePatch: (handler: ((patch: DocumentPatch) => void) | null) => void;
  onVersionRestored?: (payload: VersionRestoreBroadcast) => void;
  setOnVersionRestored: (handler: ((payload: VersionRestoreBroadcast) => void) | null) => void;
  onInitialSync?: (payload: RoomSyncPayload) => void;
  setOnInitialSync: (handler: ((payload: RoomSyncPayload) => void) | null) => void;
  retryConnection: () => void;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

export function useCollaborationContext() {
  const ctx = useContext(CollaborationContext);
  if (!ctx) {
    throw new Error('useCollaborationContext must be used within a CollaborationProvider');
  }
  return ctx;
}

export const useCollaboration = useCollaborationContext;

interface CollaborationProviderProps {
  contractId: string;
  children: ReactNode;
}

export const CollaborationProvider: FC<CollaborationProviderProps> = ({
  contractId,
  children,
}) => {
  const { user, currentOrg, currentRole } = useAuthStore();
  const [status, setStatus] = useState<CollaborationConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<CollaboratorPresence[]>([]);
  const [currentSocketId, setCurrentSocketId] = useState<string | null>(null);
  const [latestRevision, setLatestRevision] = useState(0);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; message: string; timestamp: number }>
  >([]);

  const socketRef = useRef<Socket | null>(null);
  const remotePatchHandlerRef = useRef<((patch: DocumentPatch) => void) | null>(null);
  const versionRestoredHandlerRef = useRef<((payload: VersionRestoreBroadcast) => void) | null>(
    null,
  );
  const initialSyncHandlerRef = useRef<((payload: RoomSyncPayload) => void) | null>(null);

  const canEdit = currentRole !== 'viewer';

  const addNotification = useCallback((message: string) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setNotifications((prev) => [...prev.slice(-3), { id, message, timestamp: Date.now() }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const setOnRemotePatch = useCallback((handler: ((patch: DocumentPatch) => void) | null) => {
    remotePatchHandlerRef.current = handler;
  }, []);

  const setOnVersionRestored = useCallback(
    (handler: ((payload: VersionRestoreBroadcast) => void) | null) => {
      versionRestoredHandlerRef.current = handler;
    },
    [],
  );

  const setOnInitialSync = useCallback(
    (handler: ((payload: RoomSyncPayload) => void) | null) => {
      initialSyncHandlerRef.current = handler;
    },
    [],
  );

  const connectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setStatus('connecting');

    const authPayload = {
      contractId,
      organizationId: currentOrg?.id || 'org_demo',
      user: {
        id: user?.id || 'usr_demo',
        name: user?.name || 'Administrator',
        email: user?.email || 'admin@example.com',
        role: currentRole || 'admin',
      },
    };

    const socketBase =
      (import.meta.env.VITE_SOCKET_URL as string) ||
      (import.meta.env.VITE_API_URL as string) ||
      undefined;

    const socket = io(socketBase, {
      path: '/socket.io/',
      auth: authPayload,
      query: { contractId },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      setErrorMessage(null);
      setCurrentSocketId(socket.id || null);
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        setStatus('disconnected');
      } else {
        setStatus('reconnecting');
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[Collaboration Connection Error]', err?.message || err);
      setErrorMessage(err?.message || 'WebSocket connection error');
      if (socket.active) {
        setStatus('reconnecting');
      } else {
        setStatus('disconnected');
      }
    });

    socket.io.on('reconnect_failed', () => {
      setErrorMessage('Reconnection failed. The collaboration server may not be reachable.');
      setStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      setStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      setStatus('connected');
      setErrorMessage(null);
    });

    socket.on('error', (err: any) => {
      console.warn('[Collaboration Server Error]', err?.message || err);
      const msg = err?.message || 'Collaboration error';
      setErrorMessage(msg);
      if (
        msg.includes('FORBIDDEN') ||
        msg.includes('MISMATCH') ||
        msg.includes('AUTHENTICATION') ||
        err?.code === 'JOIN_ERROR'
      ) {
        setStatus('disconnected');
        socket.disconnect();
      }
    });

    socket.on('doc:sync_init', (payload: RoomSyncPayload) => {
      setLatestRevision(payload.revision);
      setActiveUsers(payload.activeUsers || []);
      initialSyncHandlerRef.current?.(payload);
    });

    socket.on('doc:patch', (patch: DocumentPatch) => {
      setLatestRevision(patch.revision);
      remotePatchHandlerRef.current?.(patch);
    });

    socket.on('presence:join', (presence: CollaboratorPresence) => {
      addNotification(`${presence.user.name} joined the document`);
    });

    socket.on('presence:leave', (payload: { userId: string; userName: string }) => {
      addNotification(`${payload.userName} left the document`);
    });

    socket.on('presence:update', (users: CollaboratorPresence[]) => {
      setActiveUsers(users || []);
    });

    socket.on('awareness:cursor', (payload: { socketId: string; cursor: CursorPosition }) => {
      setActiveUsers((prev) =>
        prev.map((item) =>
          item.socketId === payload.socketId ? { ...item, cursor: payload.cursor } : item,
        ),
      );
    });

    socket.on(
      'awareness:selection',
      (payload: { socketId: string; selection: SelectionRange }) => {
        setActiveUsers((prev) =>
          prev.map((item) =>
            item.socketId === payload.socketId
              ? { ...item, selection: payload.selection }
              : item,
          ),
        );
      },
    );

    socket.on('doc:version_restored', (broadcast: VersionRestoreBroadcast) => {
      setLatestRevision((r) => r + 1);
      addNotification(
        `${broadcast.restoredBy.name} restored Version ${broadcast.versionNumber}.0`,
      );
      versionRestoredHandlerRef.current?.(broadcast);
    });

    return () => {
      socket.disconnect();
    };
  }, [contractId, currentOrg?.id, currentRole, user?.id, user?.name, user?.email, addNotification]);

  useEffect(() => {
    const cleanup = connectSocket();
    return () => {
      cleanup();
    };
  }, [connectSocket]);

  const sendEdit = useCallback((content: string) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('doc:edit', { content });
  }, []);

  const sendCursor = useCallback((cursor: CursorPosition | null) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('awareness:cursor', cursor);
  }, []);

  const sendSelection = useCallback((selection: SelectionRange | null) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('awareness:selection', selection);
  }, []);

  const restoreVersion = useCallback((versionNumber: number, content: string) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('doc:restore', { versionNumber, content });
  }, []);

  const retryConnection = useCallback(() => {
    connectSocket();
  }, [connectSocket]);

  return (
    <CollaborationContext.Provider
      value={{
        status,
        activeUsers,
        currentSocketId,
        canEdit,
        latestRevision,
        sendEdit,
        sendCursor,
        sendSelection,
        restoreVersion,
        notifications,
        dismissNotification,
        errorMessage,
        setOnRemotePatch,
        setOnVersionRestored,
        setOnInitialSync,
        retryConnection,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
};
