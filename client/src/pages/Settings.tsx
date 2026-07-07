import { useEffect, useState } from 'react';
import {
  Save, CheckCircle, XCircle, Key, Bot, HelpCircle, Users, Bell,
} from 'lucide-react';
import { api, Settings, Agent } from '../api';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { agent } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [newAgent, setNewAgent] = useState({ email: '', name: '', password: '' });

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setForm({
        openai_api_key: '',
        openai_model: s.settings.openai_model || 'gpt-4o-mini',
        twilio_account_sid: '',
        twilio_auth_token: '',
        twilio_phone_number: s.settings.twilio_phone_number || '',
        zoho_client_id: '',
        zoho_client_secret: '',
        zoho_refresh_token: '',
        demo_mode: s.integrations.demoMode ? 'true' : 'false',
        bot_system_prompt: s.settings.bot_system_prompt || '',
        bot_products_catalog: s.settings.bot_products_catalog || '',
        bot_company_name: s.settings.bot_company_name || '',
        bot_outreach_template: s.settings.bot_outreach_template || '',
        zoho_notify_on_conversation: s.settings.zoho_notify_on_conversation || 'true',
        zoho_notify_on_escalation: s.settings.zoho_notify_on_escalation || 'true',
      });
    });
    if (agent?.role === 'admin') {
      api.getAgents().then(setAgents).catch(() => {});
    }
  }, [agent?.role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave: Record<string, string> = {};
      for (const [key, value] of Object.entries(form)) {
        if (value && !value.startsWith('••••')) toSave[key] = value;
      }
      await api.updateSettings(toSave);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      const updated = await api.getSettings();
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgent.email || !newAgent.name || !newAgent.password) return;
    await api.createAgent(newAgent);
    setNewAgent({ email: '', name: '', password: '' });
    const list = await api.getAgents();
    setAgents(list);
  };

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const integrations = [
    { name: 'OpenAI', key: 'openai', configured: settings.integrations.openai },
    { name: 'Twilio', key: 'twilio', configured: settings.integrations.twilio },
    { name: 'Zoho CRM', key: 'zoho', configured: settings.integrations.zoho },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Product FAQ */}
      <div className="card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-brand-400" />
          Product FAQ
        </h3>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-white">Which AI platform is used?</p>
            <p className="text-slate-400 mt-1">
              The platform uses <strong className="text-slate-300">OpenAI</strong> ({settings.integrations.aiModel || 'gpt-4o-mini'}).
              In demo mode, smart fallback responses are used when no API key is configured.
            </p>
          </div>
          <div>
            <p className="font-medium text-white">Who trains the bot?</p>
            <p className="text-slate-400 mt-1">
              Your team trains the bot via the <strong className="text-slate-300">Bot Training</strong> section below —
              no coding required. Edit the system prompt, product catalog, company info, and outreach templates.
              This is prompt engineering, not model fine-tuning.
            </p>
          </div>
          <div>
            <p className="font-medium text-white">Zoho notifications during conversations?</p>
            <p className="text-slate-400 mt-1">
              When Zoho CRM is connected, the system adds Notes and Tasks to the lead record on conversation start,
              escalation, human takeover, and deal close. Toggle below. In-app alerts also appear in the dashboard bell icon.
            </p>
          </div>
          <div>
            <p className="font-medium text-white">Can agents take over conversations?</p>
            <p className="text-slate-400 mt-1">
              Yes. Each agent logs into this dashboard. Click <strong className="text-slate-300">Take Over</strong> to pause AI
              and reply manually. Click <strong className="text-slate-300">Resume AI</strong> to hand back to the bot.
            </p>
          </div>
          <div>
            <p className="font-medium text-white">Multi-tenant (separate orgs)?</p>
            <p className="text-slate-400 mt-1">
              Not in this version — single organization with multiple agent logins. Multi-tenant would require
              additional development time.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-brand-400" />
          Integration Status
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {integrations.map((int) => (
            <div key={int.key} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
              {int.configured ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-500" />
              )}
              <div>
                <p className="font-medium text-sm">{int.name}</p>
                <p className="text-xs text-slate-400">
                  {int.configured ? 'Connected' : 'Not configured (demo mode)'}
                </p>
              </div>
            </div>
          ))}
        </div>
        {settings.integrations.demoMode && (
          <p className="text-sm text-amber-300 mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            Demo mode is active. The app works fully without API keys — AI uses smart fallback responses.
            Add your keys below when ready.
          </p>
        )}
      </div>

      {/* Bot Training */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand-400" />
          Bot Training
        </h3>
        <p className="text-sm text-slate-400">
          Configure how the AI agent talks to leads. Changes apply to new AI responses immediately.
        </p>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Company Name</label>
          <input className="input" value={form.bot_company_name} onChange={(e) => update('bot_company_name', e.target.value)} placeholder="Your Company" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Products / Services Catalog</label>
          <textarea className="input min-h-[80px]" value={form.bot_products_catalog} onChange={(e) => update('bot_products_catalog', e.target.value)} placeholder="List your products, pricing, features..." />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">System Prompt (Bot Personality & Rules)</label>
          <textarea className="input min-h-[120px] font-mono text-xs" value={form.bot_system_prompt} onChange={(e) => update('bot_system_prompt', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Outreach Template (use {'{name}'} for lead name)</label>
          <textarea className="input min-h-[60px]" value={form.bot_outreach_template} onChange={(e) => update('bot_outreach_template', e.target.value)} placeholder="Hi {name}! I'm reaching out from..." />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">OpenAI</h3>
        <div>
          <label className="block text-sm text-slate-400 mb-1">API Key</label>
          <input
            className="input"
            type="password"
            placeholder={settings.settings.openai_api_key || 'sk-...'}
            value={form.openai_api_key}
            onChange={(e) => update('openai_api_key', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Model</label>
          <select className="input" value={form.openai_model} onChange={(e) => update('openai_model', e.target.value)}>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4-turbo">gpt-4-turbo</option>
          </select>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">Twilio SMS</h3>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Account SID</label>
          <input className="input" placeholder="AC..." value={form.twilio_account_sid} onChange={(e) => update('twilio_account_sid', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Auth Token</label>
          <input className="input" type="password" placeholder="Auth token" value={form.twilio_auth_token} onChange={(e) => update('twilio_auth_token', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
          <input className="input" placeholder="+1234567890" value={form.twilio_phone_number} onChange={(e) => update('twilio_phone_number', e.target.value)} />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">Zoho CRM</h3>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Client ID</label>
          <input className="input" value={form.zoho_client_id} onChange={(e) => update('zoho_client_id', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Client Secret</label>
          <input className="input" type="password" value={form.zoho_client_secret} onChange={(e) => update('zoho_client_secret', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Refresh Token</label>
          <input className="input" type="password" value={form.zoho_refresh_token} onChange={(e) => update('zoho_refresh_token', e.target.value)} />
        </div>
        <div className="pt-2 border-t border-slate-800 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-400" />
            Zoho Notifications
          </h4>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.zoho_notify_on_conversation === 'true'}
              onChange={(e) => update('zoho_notify_on_conversation', e.target.checked ? 'true' : 'false')}
              className="rounded"
            />
            Notify on new conversation (add Note to lead)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.zoho_notify_on_escalation === 'true'}
              onChange={(e) => update('zoho_notify_on_escalation', e.target.checked ? 'true' : 'false')}
              className="rounded"
            />
            Notify on escalation / takeover (add Task to lead)
          </label>
        </div>
      </div>

      {agent?.role === 'admin' && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            Team Agents
          </h3>
          <p className="text-sm text-slate-400">Add sales agents who can log in and take over conversations.</p>
          {agents.length > 0 && (
            <ul className="divide-y divide-slate-800 text-sm">
              {agents.map((a) => (
                <li key={a.id} className="py-2 flex justify-between">
                  <span>{a.name} <span className="text-slate-500">({a.email})</span></span>
                  <span className="text-xs text-slate-500 capitalize">{a.role}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid sm:grid-cols-3 gap-3">
            <input className="input" placeholder="Email" value={newAgent.email} onChange={(e) => setNewAgent((a) => ({ ...a, email: e.target.value }))} />
            <input className="input" placeholder="Name" value={newAgent.name} onChange={(e) => setNewAgent((a) => ({ ...a, name: e.target.value }))} />
            <input className="input" type="password" placeholder="Password" value={newAgent.password} onChange={(e) => setNewAgent((a) => ({ ...a, password: e.target.value }))} />
          </div>
          <button onClick={handleCreateAgent} className="btn-secondary text-sm">Add Agent</button>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
        <Save className="w-4 h-4" />
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
