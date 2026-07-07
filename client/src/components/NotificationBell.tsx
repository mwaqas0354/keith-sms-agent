import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api, AppNotification } from '../api';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = () => {
    api.getNotifications().then((data) => {
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id: string) => {
    await api.markNotificationRead(id);
    load();
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    load();
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-400" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 card z-50 shadow-xl">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-400 hover:text-brand-300">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 hover:bg-slate-800/50 ${n.read ? 'opacity-60' : ''}`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  {n.conversation_id ? (
                    <Link
                      to={`/conversations?id=${n.conversation_id}`}
                      onClick={() => setOpen(false)}
                      className="block"
                    >
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                    </>
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
