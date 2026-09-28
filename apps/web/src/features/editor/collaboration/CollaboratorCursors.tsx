import type { FC } from 'react';
import type { CollaboratorPresence } from '@cml/shared';

interface CollaboratorCursorsProps {
  presences: CollaboratorPresence[];
  currentUserId?: string;
  containerRect?: DOMRect | null;
}

export const CollaboratorCursors: FC<CollaboratorCursorsProps> = ({
  presences,
  currentUserId,
}) => {
  // Filter out self and presences without a cursor
  const otherCursors = presences.filter(
    (p) => p.user.id !== currentUserId && p.cursor && typeof p.cursor.xRatio === 'number' && typeof p.cursor.yRatio === 'number',
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {otherCursors.map((presence) => {
        const cursor = presence.cursor!;
        const leftPercent = `${(cursor.xRatio! * 100).toFixed(2)}%`;
        const topPercent = `${(cursor.yRatio! * 100).toFixed(2)}%`;

        return (
          <div
            key={presence.socketId}
            className="absolute transition-all duration-150 ease-out"
            style={{ left: leftPercent, top: topPercent }}
          >
            {/* Blinking Caret Bar */}
            <div
              className="h-5 w-0.5 animate-pulse rounded-full"
              style={{ backgroundColor: presence.user.color }}
            />

            {/* Floating Name Badge */}
            <div
              className="absolute left-0 top-0 -translate-y-full rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm whitespace-nowrap"
              style={{ backgroundColor: presence.user.color }}
            >
              {presence.user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};
