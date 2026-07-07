import { useState } from 'react';
import { Zap, UserPlus, MessageSquare, Play } from 'lucide-react';
import { api } from '../api';

interface Props {
  onAction: () => void;
}

export default function DemoPanel({ onAction }: Props) {
  const [loading, setLoading] = useState('');
  const [smsPhone, setSmsPhone] = useState('+15559999001');
  const [smsBody, setSmsBody] = useState('Hi, I am interested in your automation suite. What are the prices?');
  const [leadName, setLeadName] = useState('Alex Johnson');
  const [leadPhone, setLeadPhone] = useState('+15559999002');

  const run = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(action);
    try {
      await fn();
      onAction();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold">Demo Simulator</h3>
        </div>
        <p className="text-xs text-slate-400 mt-1">Test the system without real SMS</p>
      </div>

      <div className="p-4 space-y-4">
        <button
          onClick={() => run('simulate', () => api.demoSimulate())}
          disabled={!!loading}
          className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          {loading === 'simulate' ? 'Creating...' : 'Simulate Full Conversation'}
        </button>

        <div className="space-y-2">
          <label className="text-xs text-slate-400 flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> New Lead Outreach
          </label>
          <input className="input text-sm" placeholder="Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
          <input className="input text-sm" placeholder="Phone" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} />
          <button
            onClick={() => run('lead', () => api.demoNewLead(leadName, leadPhone, undefined, 'Demo Company'))}
            disabled={!!loading}
            className="w-full btn-primary text-sm"
          >
            {loading === 'lead' ? 'Sending...' : 'Trigger Outreach SMS'}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-400 flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" /> Simulate Inbound SMS
          </label>
          <input className="input text-sm" placeholder="Phone" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} />
          <textarea
            className="input text-sm resize-none"
            rows={2}
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
          />
          <button
            onClick={() => run('sms', () => api.demoInboundSMS(smsPhone, smsBody))}
            disabled={!!loading}
            className="w-full btn-primary text-sm"
          >
            {loading === 'sms' ? 'Processing...' : 'Send Inbound SMS'}
          </button>
        </div>
      </div>
    </div>
  );
}
