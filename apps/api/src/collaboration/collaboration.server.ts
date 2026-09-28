import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';
import { roomManager } from './collaboration.rooms.js';
import { authenticateCollaborationSocket } from './collaboration.auth.js';
import type { CollaborationSocket } from './collaboration.types.js';
import type {
  CursorPosition,
  SelectionRange,
  RoomSyncPayload,
  VersionRestoreBroadcast,
} from '@cml/shared';

export function initCollaborationServer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io/',
    cors: {
      origin: '*',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const session = await authenticateCollaborationSocket(socket);
      (socket as CollaborationSocket).data = session;
      next();
    } catch (err: any) {
      next(new Error(err?.message || 'AUTHENTICATION_FAILED'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as CollaborationSocket;
    const { user, organizationId, contractId, canEdit } = socket.data;
    const roomKey = `contract:${contractId}`;

    try {
      const { room, presence } = roomManager.joinRoom(
        contractId,
        organizationId,
        socket.id,
        user,
      );

      socket.join(roomKey);

      // Send initial sync payload to the joining user
      const syncPayload: RoomSyncPayload = {
        contractId,
        content: room.content,
        revision: room.revision,
        activeUsers: roomManager.getRoomPresences(contractId),
      };
      socket.emit('doc:sync_init', syncPayload);

      // Broadcast new presence to all other peers in the room
      socket.to(roomKey).emit('presence:join', presence);
      io.to(roomKey).emit('presence:update', roomManager.getRoomPresences(contractId));

      // Handle real-time content edits
      socket.on('doc:edit', (payload: { content: string; revision?: number }) => {
        if (!canEdit) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'You have read-only access to this contract' });
          return;
        }

        try {
          const result = roomManager.applyPatch(contractId, payload.content);

          // Broadcast to everyone else in the room
          socket.to(roomKey).emit('doc:patch', {
            id: `patch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            revision: result.revision,
            authorId: user.id,
            authorName: user.name,
            content: result.content,
            timestamp: result.timestamp,
          });
        } catch (err: any) {
          socket.emit('error', { code: 'PATCH_ERROR', message: err?.message || 'Failed to apply patch' });
        }
      });

      // Handle cursor movement
      socket.on('awareness:cursor', (cursor: CursorPosition | null) => {
        const updated = roomManager.updateCursor(contractId, socket.id, cursor);
        if (updated) {
          socket.to(roomKey).emit('awareness:cursor', {
            socketId: socket.id,
            userId: user.id,
            userName: user.name,
            userColor: updated.user.color,
            cursor,
          });
        }
      });

      // Handle text selection
      socket.on('awareness:selection', (selection: SelectionRange | null) => {
        const updated = roomManager.updateSelection(contractId, socket.id, selection);
        if (updated) {
          socket.to(roomKey).emit('awareness:selection', {
            socketId: socket.id,
            userId: user.id,
            userName: user.name,
            userColor: updated.user.color,
            selection,
          });
        }
      });

      // Handle version restoration broadcast
      socket.on('doc:restore', (payload: { versionNumber: number; content: string }) => {
        if (!canEdit) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'Permission denied to restore version' });
          return;
        }

        const result = roomManager.restoreContent(contractId, payload.content);

        const restoreBroadcast: VersionRestoreBroadcast = {
          versionNumber: payload.versionNumber,
          restoredBy: {
            id: user.id,
            name: user.name,
          },
          content: result.content,
          timestamp: result.timestamp,
        };

        // Broadcast to ALL sockets in the room, including sender
        io.to(roomKey).emit('doc:version_restored', restoreBroadcast);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        const leftPresence = roomManager.leaveRoom(contractId, socket.id);
        if (leftPresence) {
          socket.to(roomKey).emit('presence:leave', {
            socketId: socket.id,
            userId: user.id,
            userName: user.name,
          });
          io.to(roomKey).emit('presence:update', roomManager.getRoomPresences(contractId));
        }
      });
    } catch (err: any) {
      socket.emit('error', { code: 'JOIN_ERROR', message: err?.message || 'Failed to join collaboration room' });
      socket.disconnect(true);
    }
  });

  return io;
}
