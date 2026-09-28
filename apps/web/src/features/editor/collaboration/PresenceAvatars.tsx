import type { FC } from 'react';
import type { CollaboratorPresence } from '@cml/shared';

interface PresenceAvatarsProps {
  users: CollaboratorPresence[];
  currentUserId?: string;
}

export const PresenceAvatars: FC<PresenceAvatarsProps> = ({ users, currentUserId }) => {
  // Deduplicate by user ID to show distinct people
  const uniqueUsers = Array.from(
    new Map(users.map((item) => [item.user.id, item])).values(),
  );

  const count = uniqueUsers.length;
  const label = count === 1 ? '1 person editing' : `${count} people editing`;

  return (
    <div className="flex items-center gap-2.5">
      {/* Overlapping Avatar Stack */}
      <div className="flex -space-x-2 overflow-hidden py-1">
        {uniqueUsers.map((presence) => {
          const isMe = presence.user.id === currentUserId;
          const initials = presence.user.name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'U';

          return (
            <div
              key={presence.user.id}
              className="group relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-xs transition hover:z-20 hover:scale-110"
              style={{ backgroundColor: presence.user.color }}
              title={`${presence.user.name} (${presence.user.role || 'editor'})${isMe ? ' - You' : ''}`}
            >
              <span>{initials}</span>

              {/* Online Pulse Dot */}
              <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white" />

              {/* Hover Details Popover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-950 px-2.5 py-1 text-[11px] font-medium text-white shadow-xl group-hover:block z-30">
                <p className="font-semibold">
                  {presence.user.name} {isMe && <span className="text-emerald-400">(You)</span>}
                </p>
                <p className="text-[10px] text-ink-300">
                  {presence.user.email} · {presence.user.role || 'editor'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <span className="text-xs font-semibold text-ink-600 hidden sm:inline-block">
        {label}
      </span>
    </div>
  );
};
