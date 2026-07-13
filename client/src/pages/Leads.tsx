import { useEffect, useState } from 'react';
import { Phone, Building2, Plus, X } from 'lucide-react';
import { api, Lead } from '../api';
import StatusBadge from '../components/StatusBadge';

interface Props {
  refreshKey: number;
}

export default function Leads({ refreshKey }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.getLeads().then(setLeads).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, [refreshKey]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      await api.createLead(form);
      setForm({ name: '', phone: '', email: '', company: '' });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-luxury-200 flex items-center justify-between">
        <h3 className="font-semibold text-luxury-900">All Leads</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-luxury-500">{leads.length} total</span>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="btn-primary text-xs flex items-center gap-1.5 py-1.5"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cancel' : 'Add Lead'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 border-b border-luxury-200 bg-luxury-50/50 grid grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="Phone (+1...) *"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            className="input"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="input"
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
          <button
            onClick={handleCreate}
            disabled={saving || !form.name.trim() || !form.phone.trim()}
            className="btn-primary col-span-2"
          >
            {saving ? 'Creating...' : 'Create Lead'}
          </button>
        </div>
      )}

      {leads.length === 0 ? (
        <p className="p-6 text-sm text-luxury-400 text-center">No leads yet</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-luxury-400 text-xs uppercase tracking-wider border-b border-luxury-200">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Company</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-luxury-150">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-luxury-50 transition-colors">
                <td className="p-3 font-medium text-luxury-800">{lead.name}</td>
                <td className="p-3 text-luxury-600">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-luxury-400" />
                    {lead.phone}
                  </span>
                </td>
                <td className="p-3 text-luxury-600">
                  {lead.company ? (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-luxury-400" />
                      {lead.company}
                    </span>
                  ) : (
                    <span className="text-luxury-400">—</span>
                  )}
                </td>
                <td className="p-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="p-3 text-luxury-500">
                  {new Date(lead.created_at + 'Z').toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
