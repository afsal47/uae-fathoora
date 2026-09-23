import { useEffect, useState } from 'react';
import { Plus, X, RefreshCw, Copy, Check } from 'lucide-react';
import { tenantApi, integrationApi, type Tenant, type Integration } from '../lib/api';

export default function IntegrationsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [newKeys, setNewKeys] = useState<Integration | null>(null);

  useEffect(() => {
    tenantApi.list().then(t => {
      setTenants(t);
      if (t.length > 0) setSelectedTenant(t[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    integrationApi.list(selectedTenant).then(setIntegrations).catch(() => setIntegrations([]));
  }, [selectedTenant]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { if (typeof v === 'string' && v.trim()) data[k] = v.trim(); });

    try {
      const created = await integrationApi.create(selectedTenant, data);
      setNewKeys(created);
      setShowForm(false);
      integrationApi.list(selectedTenant).then(setIntegrations);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to create integration');
    }
  };

  const handleRegenerate = async (id: string) => {
    if (!confirm('This will invalidate the old API key. Continue?')) return;
    const updated = await integrationApi.regenerateKeys(selectedTenant, id);
    setNewKeys(updated);
    integrationApi.list(selectedTenant).then(setIntegrations);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) return <div className="text-gray-400 text-center py-16">Loading...</div>;

  if (tenants.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-2">No tenants found.</p>
        <p className="text-gray-400 text-sm">Create a tenant first from the Tenants page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <button
          onClick={() => { setShowForm(!showForm); setNewKeys(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Integration'}
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Tenant</label>
        <select
          value={selectedTenant}
          onChange={e => setSelectedTenant(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
          ))}
        </select>
      </div>

      {newKeys && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-green-800 mb-3">API Credentials Generated</h3>
          <p className="text-green-700 text-xs mb-3">Save these now. The secret will not be shown again.</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 w-20">API Key:</span>
              <code className="text-xs bg-white px-2 py-1 rounded border border-green-200 flex-1 font-mono">{newKeys.apiKey}</code>
              <button onClick={() => copyToClipboard(newKeys.apiKey, 'key')} className="p-1 hover:bg-green-100 rounded">
                {copied === 'key' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-green-600" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 w-20">API Secret:</span>
              <code className="text-xs bg-white px-2 py-1 rounded border border-green-200 flex-1 font-mono">{newKeys.apiSecret}</code>
              <button onClick={() => copyToClipboard(newKeys.apiSecret, 'secret')} className="p-1 hover:bg-green-100 rounded">
                {copied === 'secret' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-green-600" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Integration for {tenants.find(t => t.id === selectedTenant)?.code}</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input name="code" required placeholder="IBMS_BROKING" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input name="name" required placeholder="IBMS Broking System" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
              <input name="webhookUrl" placeholder="https://ibms.company.ae/api/webhooks/einvoice" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              <p className="text-xs text-gray-400 mt-1">Hub will POST invoice status updates to this URL</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Create & Generate Keys
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {integrations.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No integrations for this tenant yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">API Key</th>
                  <th className="px-5 py-3 text-left">Webhook</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {integrations.map(integ => (
                  <tr key={integ.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-sm font-medium text-gray-900">{integ.code}</td>
                    <td className="px-5 py-3 text-gray-700">{integ.name}</td>
                    <td className="px-5 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-600">
                        {integ.apiKey}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs max-w-[200px] truncate">{integ.webhookUrl ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${integ.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {integ.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleRegenerate(integ.id)}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                        title="Regenerate API keys"
                      >
                        <RefreshCw size={14} /> Regen Keys
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
