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
        className="relative p-2.5 rounded-xl hover:bg-luxury-100 border border-transparent hover:border-luxury-200 transition-all"
      >
        <Bell className="w-5 h-5 text-luxury-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-gold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 card z-50 shadow-luxury-lg">
          <div className="p-3 border-b border-luxury-200 flex items-center justify-between">
            <span className="font-semibold text-sm text-luxury-800">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-gold-600 hover:text-gold-700 font-medium">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-luxury-150">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-luxury-400 text-center">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 hover:bg-luxury-50 ${n.read ? 'opacity-60' : ''}`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  {n.conversation_id ? (
                    <Link
                      to={`/conversations?id=${n.conversation_id}`}
                      onClick={() => setOpen(false)}
                      className="block"
                    >
                      <p className="text-sm font-medium text-luxury-800">{n.title}</p>
                      <p className="text-xs text-luxury-500 mt-0.5 line-clamp-2">{n.body}</p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-luxury-800">{n.title}</p>
                      <p className="text-xs text-luxury-500 mt-0.5">{n.body}</p>
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
