import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, TrendingUp, AlertTriangle, Trophy, Users, Clock, Bot, ArrowRight,
} from 'lucide-react';
import { api, Conversation, Analytics as AnalyticsType } from '../api';
import StatusBadge from '../components/StatusBadge';
import DemoPanel from '../components/DemoPanel';

interface Props {
  refreshKey: number;
}

export default function Dashboard({ refreshKey }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getConversations(), api.getAnalytics()])
      .then(([convos, stats]) => {
        setConversations(convos);
        setAnalytics(stats);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const stats = [
    { label: 'Active Conversations', value: analytics?.activeConversations ?? 0, icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Escalated', value: analytics?.escalatedConversations ?? 0, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Deals Won', value: analytics?.wonDeals ?? 0, icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Success Rate', value: `${analytics?.successRate ?? 0}%`, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Messages', value: analytics?.totalMessages ?? 0, icon: Bot, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Avg Response', value: `${analytics?.avgResponseMinutes ?? 0}m`, icon: Clock, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  ];

  const recent = conversations.slice(0, 5);
  const needsAttention = conversations.filter((c) => c.status === 'escalated');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">Needs Attention</h3>
              {needsAttention.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full">
                  {needsAttention.length}
                </span>
              )}
            </div>
            <Link to="/conversations" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {needsAttention.length === 0 ? (
              <p className="p-6 text-slate-500 text-sm text-center">No escalations — all clear!</p>
            ) : (
              needsAttention.map((c) => (
                <Link
                  key={c.id}
                  to={`/conversations?id=${c.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-semibold text-sm">
                    {c.lead_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.lead_name}</p>
                    <p className="text-sm text-slate-400 truncate">{c.escalation_reason}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))
            )}
          </div>
        </div>

        <DemoPanel onAction={() => window.location.reload()} />
      </div>

      <div className="card">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold">Recent Conversations</h3>
          </div>
          <Link to="/conversations" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left p-4 font-medium">Lead</th>
                <th className="text-left p-4 font-medium">Company</th>
                <th className="text-left p-4 font-medium">Last Message</th>
                <th className="text-left p-4 font-medium">Stage</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recent.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="p-4">
                    <Link to={`/conversations?id=${c.id}`} className="font-medium hover:text-brand-400">
                      {c.lead_name}
                    </Link>
                    <p className="text-xs text-slate-500">{c.lead_phone}</p>
                  </td>
                  <td className="p-4 text-slate-400">{c.lead_company || '—'}</td>
                  <td className="p-4 text-slate-400 max-w-xs truncate">{c.last_message}</td>
                  <td className="p-4">
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300 capitalize">
                      {c.deal_stage.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4"><StatusBadge status={c.status} /></td>
                  <td className="p-4">
                    {c.ai_enabled ? (
                      <span className="text-emerald-400 text-xs">Active</span>
                    ) : (
                      <span className="text-slate-500 text-xs">Paused</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
