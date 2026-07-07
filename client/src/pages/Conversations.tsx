import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, Pause, Play, Trophy, XCircle, Bot, User, MessageCircle, Phone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, Conversation, Message } from '../api';
import StatusBadge from '../components/StatusBadge';
import SentimentBadge from '../components/SentimentBadge';

interface Props {
  refreshKey: number;
}

export default function Conversations({ refreshKey }: Props) {
  const { agent } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation & { messages: Message[] } | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedId = searchParams.get('id');

  useEffect(() => {
    api.getConversations().then(setConversations).finally(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    if (selectedId) {
      api.getConversation(selectedId).then(setSelected);
    }
  }, [selectedId, refreshKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages]);

  const selectConversation = (id: string) => {
    setSearchParams({ id });
    api.getConversation(id).then(setSelected);
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await api.reply(selected.id, reply);
      const updated = await api.getConversation(selected.id);
      setSelected(updated);
      setReply('');
    } finally {
      setSending(false);
    }
  };

  const handlePause = async () => {
    if (!selected) return;
    await api.pauseAI(selected.id);
    const updated = await api.getConversation(selected.id);
    setSelected(updated);
  };

  const handleResume = async () => {
    if (!selected) return;
    await api.resumeAI(selected.id);
    const updated = await api.getConversation(selected.id);
    setSelected(updated);
  };

  const handleClose = async (outcome: 'won' | 'lost') => {
    if (!selected) return;
    await api.closeConversation(selected.id, outcome);
    const updated = await api.getConversation(selected.id);
    setSelected(updated);
    const convos = await api.getConversations();
    setConversations(convos);
  };

  const filterOptions = ['all', 'active', 'escalated', 'paused', 'won'] as const;

  const filterCounts = filterOptions.reduce((acc, f) => {
    acc[f] = f === 'all' ? conversations.length : conversations.filter((c) => c.status === f).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = conversations.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <div className="w-[26rem] min-w-[22rem] shrink-0 card flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-800">
          <div className="flex gap-1.5 flex-wrap">
            {filterOptions.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full capitalize transition-colors ${
                  filter === f
                    ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {f} <span className="opacity-70">({filterCounts[f]})</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No conversations in this filter</p>
          ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={`w-full text-left p-3 hover:bg-slate-800/50 transition-colors ${
                selectedId === c.id ? 'bg-brand-600/10 border-l-2 border-brand-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm truncate">{c.lead_name}</span>
                <StatusBadge status={c.status} small />
              </div>
              <p className="text-xs text-slate-500 truncate">{c.last_message}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <SentimentBadge sentiment={c.sentiment} />
                <span className="text-xs text-slate-600">{c.message_count} msgs</span>
              </div>
            </button>
          )))}
        </div>
      </div>

      <div className="flex-1 card flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a conversation to view</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{selected.lead_name}</h3>
                <div className="flex items-center gap-3 text-sm text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{selected.lead_phone}</span>
                  {selected.lead_company && <span>{selected.lead_company}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.status} />
                {selected.ai_enabled ? (
                  <button onClick={handlePause} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
                    <Pause className="w-3.5 h-3.5" /> Take Over
                  </button>
                ) : selected.status !== 'won' && selected.status !== 'lost' ? (
                  <button onClick={handleResume} className="btn-primary text-xs flex items-center gap-1.5 py-1.5">
                    <Play className="w-3.5 h-3.5" /> Resume AI
                  </button>
                ) : null}
                {selected.status !== 'won' && selected.status !== 'lost' && (
                  <>
                    <button onClick={() => handleClose('won')} className="btn-primary text-xs flex items-center gap-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-500">
                      <Trophy className="w-3.5 h-3.5" /> Won
                    </button>
                    <button onClick={() => handleClose('lost')} className="btn-danger text-xs flex items-center gap-1.5 py-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Lost
                    </button>
                  </>
                )}
              </div>
            </div>

            {selected.escalation_reason && (
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-sm text-amber-300 flex items-center gap-2">
                <span className="font-medium">Escalated:</span> {selected.escalation_reason}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'lead' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.sender === 'lead'
                        ? 'bg-slate-800 rounded-bl-md'
                        : msg.sender === 'human'
                        ? 'bg-emerald-600/30 border border-emerald-500/30 rounded-br-md'
                        : msg.sender === 'system'
                        ? 'bg-amber-600/20 border border-amber-500/30 rounded-br-md'
                        : 'bg-brand-600/30 border border-brand-500/30 rounded-br-md'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {msg.sender === 'lead' ? (
                        <User className="w-3 h-3 text-slate-400" />
                      ) : (
                        <Bot className="w-3 h-3 text-brand-300" />
                      )}
                      <span className="text-xs text-slate-400 capitalize">
                        {msg.sender === 'ai' ? 'AI Agent' : msg.sender === 'human' ? (selected.assigned_agent || agent?.name || 'Agent') : msg.sender}
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(msg.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.body}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {selected.status !== 'won' && selected.status !== 'lost' && (
              <div className="p-4 border-t border-slate-800">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder={selected.ai_enabled ? 'Take over to reply manually...' : 'Type your reply...'}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                    disabled={!!selected.ai_enabled}
                  />
                  <button
                    onClick={handleReply}
                    disabled={!reply.trim() || sending || !!selected.ai_enabled}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
                {selected.ai_enabled && (
                  <p className="text-xs text-slate-500 mt-2">Click "Take Over" to pause AI and reply manually</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
