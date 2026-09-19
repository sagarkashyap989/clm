import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NotificationItem } from '@cml/shared';
import { api } from '@/lib/api';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ notifications: NotificationItem[] }>('/api/v1/notifications'),
    refetchInterval: 10000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return api(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return api('/api/v1/notifications/mark-all-read', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleNotificationClick(notif: NotificationItem) {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    setIsOpen(false);
    if (notif.contractId) {
      navigate(`/contracts/${notif.contractId}`);
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case 'comment':
        return '💬';
      case 'version':
        return '📑';
      case 'share':
        return '👥';
      case 'status':
        return '🔄';
      default:
        return '🔔';
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-ink-100 bg-white text-ink-700 shadow-2xs hover:bg-slate-50"
        title="Notifications"
      >
        <span className="text-sm">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div
          id="notification-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-ink-100 bg-white p-4 shadow-xl z-50"
        >
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-sm font-bold text-ink-950">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-[11px] font-semibold text-accent hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto space-y-2 divide-y divide-ink-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-400">
                You have no notifications at this time.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl p-2.5 transition ${
                    notif.isRead
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-accent/5 hover:bg-accent/10'
                  }`}
                >
                  <span className="text-base">{getIcon(notif.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs ${
                          notif.isRead ? 'font-medium text-ink-800' : 'font-bold text-ink-950'
                        }`}
                      >
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-ink-400">
                        {new Date(notif.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-600 line-clamp-2">{notif.message}</p>
                    {notif.contractName && (
                      <span className="mt-1 inline-block text-[10px] font-semibold text-accent">
                        📄 {notif.contractName}
                      </span>
                    )}
                  </div>
                  {!notif.isRead && (
                    <span className="h-2 w-2 shrink-0 self-center rounded-full bg-accent" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
