import type { CollaboratorPresence, CursorPosition, SelectionRange } from '@cml/shared';
import type { RoomDocumentState } from './collaboration.types.js';
import { createCollaboratorPresence } from './collaboration.presence.js';

export class CollaborationRoomManager {
  private rooms = new Map<string, RoomDocumentState>();

  getRoom(contractId: string): RoomDocumentState | undefined {
    return this.rooms.get(contractId);
  }

  getOrCreateRoom(contractId: string, organizationId: string, initialContent = ''): RoomDocumentState {
    let room = this.rooms.get(contractId);
    if (!room) {
      room = {
        contractId,
        organizationId,
        content: initialContent,
        revision: 0,
        lastSavedAt: Date.now(),
        activeSockets: new Map<string, CollaboratorPresence>(),
      };
      this.rooms.set(contractId, room);
    }
    return room;
  }

  joinRoom(
    contractId: string,
    organizationId: string,
    socketId: string,
    user: { id: string; name: string; email: string; role?: string },
    initialContent = '',
  ): { room: RoomDocumentState; presence: CollaboratorPresence } {
    const room = this.getOrCreateRoom(contractId, organizationId, initialContent);

    // Organization Isolation Check
    if (room.organizationId && room.organizationId !== organizationId) {
      throw new Error('ORGANIZATION_MISMATCH: Cross-organization document access is prohibited');
    }

    const presence = createCollaboratorPresence(socketId, user);
    room.activeSockets.set(socketId, presence);
    return { room, presence };
  }

  leaveRoom(contractId: string, socketId: string): CollaboratorPresence | null {
    const room = this.rooms.get(contractId);
    if (!room) return null;

    const presence = room.activeSockets.get(socketId) || null;
    room.activeSockets.delete(socketId);

    return presence;
  }

  updateCursor(contractId: string, socketId: string, cursor: CursorPosition | null): CollaboratorPresence | null {
    const room = this.rooms.get(contractId);
    if (!room) return null;

    const presence = room.activeSockets.get(socketId);
    if (!presence) return null;

    presence.cursor = cursor;
    presence.lastActiveAt = Date.now();
    return presence;
  }

  updateSelection(contractId: string, socketId: string, selection: SelectionRange | null): CollaboratorPresence | null {
    const room = this.rooms.get(contractId);
    if (!room) return null;

    const presence = room.activeSockets.get(socketId);
    if (!presence) return null;

    presence.selection = selection;
    presence.lastActiveAt = Date.now();
    return presence;
  }

  applyPatch(
    contractId: string,
    patchContent: string,
  ): { revision: number; content: string; timestamp: number } {
    const room = this.rooms.get(contractId);
    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    room.revision += 1;
    room.content = patchContent;
    room.lastSavedAt = Date.now();

    return {
      revision: room.revision,
      content: room.content,
      timestamp: room.lastSavedAt,
    };
  }

  restoreContent(
    contractId: string,
    content: string,
  ): { revision: number; content: string; timestamp: number } {
    const room = this.rooms.get(contractId);
    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    room.revision += 1;
    room.content = content;
    room.lastSavedAt = Date.now();

    return {
      revision: room.revision,
      content: room.content,
      timestamp: room.lastSavedAt,
    };
  }

  getRoomPresences(contractId: string): CollaboratorPresence[] {
    const room = this.rooms.get(contractId);
    if (!room) return [];
    return Array.from(room.activeSockets.values());
  }
}

export const roomManager = new CollaborationRoomManager();
