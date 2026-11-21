import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Copy, Check, Search } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import SelectMenu from '../components/SelectMenu';
import { useConfirmAction } from '../hooks/useConfirmAction';
import {
  tenantApi,
  integrationApi,
  legalEntityApi,
  type Tenant,
  type Integration,
  type LegalEntity,
} from '../lib/api';

const inputClass = 'input';

export default function IntegrationsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [newKeys, setNewKeys] = useState<Integration | null>(null);
  const { ask, confirmProps } = useConfirmAction();

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
    void Promise.all([
      integrationApi.list(selectedTenant),
      legalEntityApi.list(selectedTenant),
    ])
      .then(([integ, entities]) => {
        setIntegrations(integ);
        setLegalEntities(entities.filter((le) => le.isActive));
      })
      .catch(() => {
        setIntegrations([]);
        setLegalEntities([]);
      });
  }, [selectedTenant]);

  const reloadIntegrations = async (mode: 'silent' | 'refresh' = 'silent') => {
    if (!selectedTenant) return;
    if (mode === 'refresh') setRefreshing(true);
    try {
      const [integ, entities] = await Promise.all([
        integrationApi.list(selectedTenant),
        legalEntityApi.list(selectedTenant),
      ]);
      setIntegrations(integ);
      setLegalEntities(entities.filter((le) => le.isActive));
    } catch {
      setIntegrations([]);
      setLegalEntities([]);
    } finally {
      if (mode === 'refresh') setRefreshing(false);
    }
  };

  const applySearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const filteredIntegrations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return integrations;
    return integrations.filter((integ) => {
      const haystack = [
        integ.code,
        integ.name,
        integ.apiKey,
        integ.legalEntity?.code,
        integ.legalEntity?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [integrations, searchQuery]);

  const defaultLegalEntityId = legalEntities[0]?.id ?? '';

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim(),
      legalEntityId: String(fd.get('legalEntityId') ?? '').trim(),
    };

    if (!data.legalEntityId) {
      setError('Select a legal entity for this source system.');
      return;
    }

    ask(
      {
        title: 'Create source system?',
        description: 'Are you sure you want to create this source system?',
        confirmLabel: 'Create & generate keys',
      },
      async () => {
        try {
          const created = await integrationApi.create(selectedTenant, data);
          setNewKeys(created);
          setShowForm(false);
          await reloadIntegrations();
        } catch (err: any) {
          const message = err.response?.data?.message ?? 'Failed to create integration';
          setError(Array.isArray(message) ? message.join(', ') : message);
        }
      },
    );
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      name: String(fd.get('name') ?? '').trim(),
      legalEntityId: String(fd.get('legalEntityId') ?? '').trim(),
      isActive: fd.get('isActive') === 'on',
    };

    if (!data.legalEntityId) {
      setError('Select a legal entity for this source system.');
      return;
    }

    ask(
      {
        title: 'Save source system changes?',
        description: 'Are you sure you want to save these changes?',
        confirmLabel: 'Save changes',
      },
      async () => {
        try {
          await integrationApi.update(selectedTenant, editing.id, data);
          setEditing(null);
          await reloadIntegrations();
        } catch (err: any) {
          const message = err.response?.data?.message ?? 'Failed to update integration';
          setError(Array.isArray(message) ? message.join(', ') : message);
        }
      },
    );
  };

  const requestRegenerate = (integration: Integration) => {
    ask(
      {
        title: 'Regenerate API keys?',
        description: 'Are you sure you want to regenerate the API keys?',
        confirmLabel: 'Regenerate',
        tone: 'danger',
      },
      async () => {
        const updated = await integrationApi.regenerateKeys(selectedTenant, integration.id);
        setNewKeys(updated);
        await reloadIntegrations();
      },
    );
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
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setEditing(null);
            setShowForm(true);
          }}
          className="btn btn-primary"
          disabled={legalEntities.length === 0}
          title={
            legalEntities.length === 0
              ? 'Create a legal entity under Tenants first'
              : undefined
          }
        >
          <Plus size={16} />
          New source system
        </button>
      </header>

      <Modal
        open={showForm}
        title={`New source system${selected ? ` for ${selected.code}` : ''}`}
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
              <input
                name="code"
                required
                placeholder="Source system *"
                aria-label="Source system"
                className={inputClass}
              />
            </div>
            <div className="field">
              <input
                name="name"
                required
                placeholder="Display name *"
                aria-label="Display name"
                className={inputClass}
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <select
                name="legalEntityId"
                required
                className={inputClass}
                defaultValue={defaultLegalEntityId}
                aria-label="Legal entity"
              >
                <option value="" disabled>
                  Legal entity *
                </option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>
                    {le.code} — {le.name}
                  </option>
                ))}
              </select>
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
        open={editing !== null}
        title={editing ? `Edit ${editing.code}` : 'Edit source system'}
        onClose={() => {
          setEditing(null);
          setError('');
        }}
        size="md"
      >
        {editing && (
          <form key={editing.id} onSubmit={handleUpdate}>
            {error && <p className="alert-error">{error}</p>}
            <div className="form-grid">
              <div className="field">
                <input
                  value={editing.code}
                  disabled
                  className="input is-locked"
                  aria-label="Source system"
                />
              </div>
              <div className="field">
                <input
                  name="name"
                  required
                  defaultValue={editing.name}
                  placeholder="Display name *"
                  aria-label="Display name"
                  className={inputClass}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <select
                  name="legalEntityId"
                  required
                  className={inputClass}
                  defaultValue={editing.legalEntityId ?? defaultLegalEntityId}
                  aria-label="Legal entity"
                >
                  <option value="" disabled>
                    Legal entity *
                  </option>
                  {legalEntities.map((le) => (
                    <option key={le.id} value={le.id}>
                      {le.code} — {le.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)] cursor-pointer">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={editing.isActive}
                    className="border-[var(--color-line)] text-[var(--color-brand-600)] focus:ring-[var(--color-brand-500)]"
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setError('');
                }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save changes
              </button>
            </div>
          </form>
        )}
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
            {newKeys.legalEntity ? (
              <p className="page-subtitle">
                Linked legal entity: {newKeys.legalEntity.code} — {newKeys.legalEntity.name}
              </p>
            ) : null}
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

      <ConfirmModal {...confirmProps} />

      <section className="page-filters" aria-label="Integrations filters">
        <form className="filter-bar" onSubmit={applySearch}>
          <div className="field filter-bar-tenant">
            <label htmlFor="tenant-select" className="field-label">
              Tenant
            </label>
            <SelectMenu
              id="tenant-select"
              value={selectedTenant}
              onChange={(value) => {
                setSelectedTenant(value);
                setSearchInput('');
                setSearchQuery('');
              }}
              labelOnly
              options={tenants.map((t) => ({
                value: t.id,
                label: t.code,
                description: t.name,
              }))}
              placeholder="Select tenant"
            />
          </div>
          <div className="field filter-bar-search">
            <label htmlFor="integration-search" className="field-label">
              Search
            </label>
            <input
              id="integration-search"
              className="input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Code, name, API key…"
            />
          </div>
          <div className="filter-bar-actions">
            <button type="submit" className="btn btn-search">
              <Search size={14} /> Search
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={refreshing || !selectedTenant}
              onClick={() => void reloadIntegrations('refresh')}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
              Refresh
            </button>
          </div>
        </form>
      </section>

      {legalEntities.length === 0 ? (
        <p className="field-hint">
          This tenant has no active legal entity. Open Tenants → Legal entities and create one
          (for example CM_DXB) before adding a source system.
        </p>
      ) : null}

      <div className="panel">
        {integrations.length === 0 ? (
          <div className="panel-empty">No source systems for this tenant yet.</div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="panel-empty">No source systems match your search.</div>
        ) : (
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source system</th>
                  <th>Display name</th>
                  <th>Legal entity</th>
                  <th>API Key</th>
                  <th className="cell-status">Status</th>
                  <th className="cell-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIntegrations.map((integ) => (
                  <tr key={integ.id}>
                    <td className="cell-mono">{integ.code}</td>
                    <td className="cell-wrap">{integ.name}</td>
                    <td>
                      {integ.legalEntity ? (
                        <span className="cell-mono">{integ.legalEntity.code}</span>
                      ) : (
                        <span className="page-subtitle">Not linked</span>
                      )}
                    </td>
                    <td>
                      <code className="inline-block border border-[var(--color-line-soft)] bg-slate-50 px-2 py-1 font-mono text-xs text-[var(--color-ink-muted)]">
                        {integ.apiKey}
                      </code>
                    </td>
                    <td className="cell-status">
                      <span className={`badge ${integ.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {integ.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="cell-actions">
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setError('');
                            setShowForm(false);
                            setEditing(integ);
                          }}
                          className="btn-link"
                          title="Edit source system"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRegenerate(integ)}
                          className="btn-link btn-link-warn"
                          title="Regenerate API keys"
                        >
                          <RefreshCw size={14} /> Regen Keys
                        </button>
                      </div>
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
