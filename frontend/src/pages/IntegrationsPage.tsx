import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Copy, Check, ChevronDown } from 'lucide-react';
import Modal from '../components/Modal';
import { tenantApi, integrationApi, type Tenant, type Integration } from '../lib/api';

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';


export default function IntegrationsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [newKeys, setNewKeys] = useState<Integration | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);

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

  const handleRegenerate = async () => {
    if (!regenId) return;
    const updated = await integrationApi.regenerateKeys(selectedTenant, regenId);
    setRegenId(null);
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

  const selected = tenants.find((t) => t.id === selectedTenant);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <button
          type="button"
          onClick={() => { setError(''); setShowForm(true); }}
          className="inline-flex shrink-0 items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          New Integration
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <label htmlFor="tenant-select" className="block text-sm font-medium text-gray-700 mb-1.5">
          Select Tenant
        </label>
        <div className="relative w-full max-w-2xl">
          <select
            id="tenant-select"
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            title={selected ? `${selected.code} — ${selected.name}` : undefined}
            className="w-full appearance-none border border-gray-300 rounded-lg pl-3 pr-10 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        </div>
      </div>

      <Modal
        open={showForm}
        title={`New Integration${selected ? ` for ${selected.code}` : ''}`}
        description="Create an API client for the selected tenant."
        onClose={() => { setShowForm(false); setError(''); }}
        size="md"
      >
        <form onSubmit={handleCreate}>
          {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Code *</label>
              <input name="code" required placeholder="INTEGRATION_CODE" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
              <input name="name" required placeholder="Integration name" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Webhook URL</label>
              <input name="webhookUrl" type="url" placeholder="https://" className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">Hub will POST invoice status updates to this URL</p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(''); }}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Create & Generate Keys
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={newKeys !== null}
        title="API Credentials Generated"
        description="Save these now. The secret will not be shown again."
        onClose={() => setNewKeys(null)}
        size="md"
      >
        {newKeys && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24 shrink-0">API Key</span>
              <code className="text-xs bg-gray-50 px-2 py-1.5 rounded border border-gray-200 flex-1 font-mono break-all">{newKeys.apiKey}</code>
              <button type="button" onClick={() => copyToClipboard(newKeys.apiKey, 'key')} className="p-1.5 hover:bg-gray-100 rounded">
                {copied === 'key' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-gray-500" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24 shrink-0">API Secret</span>
              <code className="text-xs bg-gray-50 px-2 py-1.5 rounded border border-gray-200 flex-1 font-mono break-all">{newKeys.apiSecret}</code>
              <button type="button" onClick={() => copyToClipboard(newKeys.apiSecret, 'secret')} className="p-1.5 hover:bg-gray-100 rounded">
                {copied === 'secret' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-gray-500" />}
              </button>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setNewKeys(null)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={regenId !== null}
        title="Regenerate API keys"
        description="This invalidates the current API key and secret. Existing clients will need the new credentials."
        onClose={() => setRegenId(null)}
        size="md"
      >
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setRegenId(null)}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            Regenerate
          </button>
        </div>
      </Modal>

      <div className="bg-white rounded-xl border border-gray-200">
        {integrations.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No integrations for this tenant yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Code</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">API Key</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Webhook</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {integrations.map((integ) => (
                  <tr key={integ.id} className="hover:bg-gray-50 align-middle">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900 whitespace-nowrap">
                      {integ.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{integ.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="inline-block text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-600">
                        {integ.apiKey}
                      </code>
                    </td>
                    <td
                      className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap max-w-[280px]"
                      title={integ.webhookUrl ?? undefined}
                    >
                      <span className="block truncate">{integ.webhookUrl ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          integ.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {integ.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setRegenId(integ.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700"
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
