import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, BarChart3, Settings, Radio,
  Bot, Zap, LogOut, User,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Analytics from './pages/Analytics';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import NotificationBell from './components/NotificationBell';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './context/AuthContext';
import { useState, useCallback } from 'react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function AppShell() {
  const location = useLocation();
  const { agent, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleWSEvent = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const { connected } = useWebSocket(handleWSEvent);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">SMS Agent</h1>
              <p className="text-xs text-slate-400">AI-Powered Sales</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Radio className={`w-3.5 h-3.5 ${connected ? 'text-emerald-400' : 'text-red-400'}`} />
            <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
              {connected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300">Demo Mode Active</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400">
            <User className="w-4 h-4" />
            <span className="flex-1 truncate">{agent?.name}</span>
            <button onClick={logout} className="p-1 hover:text-white" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-950">
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold capitalize">
            {location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1).replace(/-/g, ' ')}
          </h2>
          <NotificationBell />
        </header>
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard refreshKey={refreshKey} />} />
            <Route path="/conversations" element={<Conversations refreshKey={refreshKey} />} />
            <Route path="/analytics" element={<Analytics refreshKey={refreshKey} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { agent, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!agent) return <Login />;

  return <AppShell />;
}
