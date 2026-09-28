import type { Socket } from 'socket.io';
import type { CollaboratorUser, CollaboratorPresence, CursorPosition, SelectionRange } from '@cml/shared';

export interface CollaborationSocketSession {
  user: CollaboratorUser;
  organizationId: string;
  contractId: string;
  canEdit: boolean;
}

export interface CollaborationSocket extends Socket {
  data: CollaborationSocketSession;
}

export interface RoomDocumentState {
  contractId: string;
  organizationId: string;
  content: string;
  revision: number;
  lastSavedAt: number;
  activeSockets: Map<string, CollaboratorPresence>;
}
