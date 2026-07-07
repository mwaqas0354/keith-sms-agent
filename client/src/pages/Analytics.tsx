import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { api, Analytics as AnalyticsType } from '../api';

interface Props {
  refreshKey: number;
}

const COLORS = ['#1E3A5F', '#B8956A', '#10b981', '#ef4444', '#5C85A8', '#C9A962'];

const tooltipStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5DDD2',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(20,18,16,0.08)',
  color: '#352F2B',
};

export default function Analytics({ refreshKey }: Props) {
  const [data, setData] = useState<AnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(setData).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusData = [
    { name: 'Active', value: data.activeConversations },
    { name: 'Escalated', value: data.escalatedConversations },
    { name: 'Won', value: data.wonDeals },
    { name: 'Lost', value: data.lostDeals },
  ].filter((d) => d.value > 0);

  const eventData = data.recentEvents.map((e) => ({
    name: e.event_type.replace(/_/g, ' '),
    count: e.count,
  }));

  const dailyData = data.dailyConversations.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Conversations', value: data.totalConversations },
          { label: 'AI Messages Sent', value: data.aiMessages },
          { label: 'Success Rate', value: `${data.successRate}%` },
          { label: 'Escalation Rate', value: `${data.escalationRate}%` },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <p className="text-3xl font-bold text-luxury-900">{kpi.value}</p>
            <p className="text-sm text-luxury-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-4 text-luxury-900">Conversation Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-luxury-400 text-center py-12">No data yet</p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4 text-luxury-900">Events (Last 7 Days)</h3>
          {eventData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={eventData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD2" />
                <XAxis dataKey="name" tick={{ fill: '#6B6560', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6B6560', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-luxury-400 text-center py-12">No events yet</p>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4 text-luxury-900">Daily Conversations</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD2" />
                <XAxis dataKey="date" tick={{ fill: '#6B6560', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6B6560', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="#B8956A" strokeWidth={2} dot={{ fill: '#B8956A' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-luxury-400 text-center py-12">No daily data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
