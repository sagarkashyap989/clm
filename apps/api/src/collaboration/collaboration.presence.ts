import type {
  CollaboratorUser,
  CollaboratorPresence,
  CursorPosition,
  SelectionRange,
} from '@cml/shared';

const COLOR_PALETTE = [
  '#059669', // Emerald
  '#4f46e5', // Indigo
  '#7c3aed', // Violet
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0891b2', // Cyan
  '#c026d3', // Fuchsia
  '#2563eb', // Blue
];

export function getDeterministicColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i += 1) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index] || '#4f46e5';
}

export function createCollaboratorPresence(
  socketId: string,
  user: { id: string; name: string; email: string; role?: string },
): CollaboratorPresence {
  return {
    socketId,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'editor',
      color: getDeterministicColor(user.id || socketId),
    },
    cursor: null,
    selection: null,
    lastActiveAt: Date.now(),
    isEditing: false,
  };
}
