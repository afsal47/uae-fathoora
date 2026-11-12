import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Copy, Check } from 'lucide-react';
import Modal from '../components/Modal';
import SelectMenu from '../components/SelectMenu';
import { tenantApi, integrationApi, type Tenant, type Integration } from '../lib/api';

const inputClass = 'input';

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
    tenantApi
      .list()
      .then((t) => {
        setTenants(t);
        if (t.length > 0) setSelectedTenant(t[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
    fd.forEach((v, k) => {
      if (typeof v === 'string' && v.trim()) data[k] = v.trim();
    });

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

  if (loading) return <div className="loading-state">Loading…</div>;

  if (tenants.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Integrations</h1>
            <p className="page-subtitle">Source systems that send invoices into the hub.</p>
          </div>
        </header>
        <div className="panel">
          <div className="panel-empty">
            No tenants found. Create a tenant first from the Tenants page.
          </div>
        </div>
      </div>
    );
  }

  const selected = tenants.find((t) => t.id === selectedTenant);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="page-subtitle">Source systems that send invoices into the hub.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setShowForm(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={16} />
          New source system
        </button>
      </header>

      <div className="panel panel-body">
        <label htmlFor="tenant-select" className="field-label">
          Tenant
        </label>
        <SelectMenu
          id="tenant-select"
          value={selectedTenant}
          onChange={setSelectedTenant}
          options={tenants.map((t) => ({
            value: t.id,
            label: t.code,
            description: t.name,
          }))}
          placeholder="Select tenant"
        />
      </div>

      <Modal
        open={showForm}
        title={`New source system${selected ? ` for tenant code ${selected.code}` : ''}`}
        description="Source system is the invoice field sourceSystem. Tenant code is the company selected above."
        onClose={() => {
          setShowForm(false);
          setError('');
        }}
        size="md"
      >
        <form onSubmit={handleCreate}>
          {error && <p className="alert-error">{error}</p>}
          <div className="form-grid">
            <div className="field">
              <label className="field-label">Source system *</label>
              <input name="code" required placeholder="SOURCE_SYSTEM" className={inputClass} />
              <p className="field-hint">Invoice field sourceSystem must equal this value.</p>
            </div>
            <div className="field">
              <label className="field-label">Display name *</label>
              <input name="name" required placeholder="Name shown in this list" className={inputClass} />
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError('');
              }}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
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
              <span className="w-24 shrink-0 text-xs text-[var(--color-ink-subtle)]">API Key</span>
              <code className="flex-1 break-all border border-[var(--color-line)] bg-slate-50 px-2 py-1.5 font-mono text-xs">
                {newKeys.apiKey}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(newKeys.apiKey, 'key')}
                className="p-1.5 hover:bg-slate-100"
              >
                {copied === 'key' ? (
                  <Check size={14} className="text-[var(--color-ink)]" />
                ) : (
                  <Copy size={14} className="text-[var(--color-ink-subtle)]" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-[var(--color-ink-subtle)]">API Secret</span>
              <code className="flex-1 break-all border border-[var(--color-line)] bg-slate-50 px-2 py-1.5 font-mono text-xs">
                {newKeys.apiSecret}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(newKeys.apiSecret, 'secret')}
                className="p-1.5 hover:bg-slate-100"
              >
                {copied === 'secret' ? (
                  <Check size={14} className="text-[var(--color-ink)]" />
                ) : (
                  <Copy size={14} className="text-[var(--color-ink-subtle)]" />
                )}
              </button>
            </div>
            <div className="form-actions !mt-4">
              <button type="button" onClick={() => setNewKeys(null)} className="btn btn-primary">
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
        <div className="form-actions !mt-0 !border-0 !pt-0">
          <button type="button" onClick={() => setRegenId(null)} className="btn btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={handleRegenerate} className="btn btn-danger">
            Regenerate
          </button>
        </div>
      </Modal>

      <div className="panel">
        {integrations.length === 0 ? (
          <div className="panel-empty">No source systems for this tenant code yet.</div>
        ) : (
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source system</th>
                  <th>Display name</th>
                  <th>API Key</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((integ) => (
                  <tr key={integ.id}>
                    <td className="cell-mono">{integ.code}</td>
                    <td className="cell-strong">{integ.name}</td>
                    <td>
                      <code className="inline-block border border-[var(--color-line-soft)] bg-slate-50 px-2 py-1 font-mono text-xs text-[var(--color-ink-muted)]">
                        {integ.apiKey}
                      </code>
                    </td>
                    <td>
                      <span className={`badge ${integ.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {integ.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setRegenId(integ.id)}
                        className="btn-link btn-link-warn"
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
