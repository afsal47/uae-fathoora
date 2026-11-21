import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleHelp, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import SelectMenu from '../components/SelectMenu';
import StatusToggle from '../components/StatusToggle';
import { useConfirmAction } from '../hooks/useConfirmAction';
import {
  aspConnectionApi,
  aspProviderApi,
  legalEntityApi,
  tenantApi,
  type AspConnection,
  type AspProvider,
  type LegalEntity,
  type Tenant,
} from '../lib/api';

const CONNECTION_FIELD_TOOLTIPS = {
  legalEntity:
    'Select the legal entity for which this ASP connection will be configured.',
  aspProvider:
    'Select the ASP provider that will process invoices for this legal entity. Only providers with implemented adapters can be used.',
  environment:
    'Select the ASP environment for this connection. Use SANDBOX for testing and PRODUCTION for live invoice processing.',
  status:
    'Select the connection status. ACTIVE enables this connection for invoice processing, while INACTIVE disables it.',
  apiKey:
    'Enter the API key provided by the selected ASP for authenticating this legal entity. Credentials are securely stored and must not be shared.',
  portalEmail:
    'Enter the ASP portal account email associated with the API key. This email is used during ASP authentication.',
} as const;

function FieldLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <span className="field-label-row">
      <span>{label}</span>
      <span className="field-tooltip">
        <button
          type="button"
          className="field-tooltip-trigger"
          aria-label={`Help: ${label}`}
          tabIndex={0}
        >
          <CircleHelp size={14} aria-hidden="true" />
        </button>
        <span role="tooltip" className="field-tooltip-bubble">
          {tooltip}
        </span>
      </span>
    </span>
  );
}

function Field({
  label,
  tooltip,
  children,
  wide,
}: {
  label: string;
  tooltip: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="field" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <FieldLabel label={label} tooltip={tooltip} />
      {children}
    </div>
  );
}

function readErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

export default function AspConnectionsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [providers, setProviders] = useState<AspProvider[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [connections, setConnections] = useState<AspConnection[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AspConnection | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const { ask, confirmProps } = useConfirmAction();

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    Promise.all([tenantApi.list(), aspProviderApi.list()])
      .then(([t, p]) => {
        setTenants(t);
        setProviders(p);
        if (t.length > 0) setSelectedTenant(t[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const reloadConnections = async (
    tenantId: string,
    mode: 'silent' | 'refresh' = 'silent',
  ) => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const [entities, conns] = await Promise.all([
        legalEntityApi.list(tenantId),
        aspConnectionApi.list(tenantId),
      ]);
      setLegalEntities(entities);
      setConnections(conns);
    } finally {
      if (mode === 'refresh') setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!selectedTenant) return;
    void reloadConnections(selectedTenant).catch(() => {
      setLegalEntities([]);
      setConnections([]);
    });
  }, [selectedTenant]);

  const applySearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const filteredConnections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) => {
      const haystack = [
        c.legalEntity?.code,
        c.legalEntityId,
        c.aspProvider?.code,
        c.aspProviderId,
        c.environment,
        c.status,
        c.lastTestStatus,
        ...(c.credentialKeys ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [connections, searchQuery]);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const apiKey = String(fd.get('apiKey') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const credentials: Record<string, string> = {};
    if (apiKey) credentials.apiKey = apiKey;
    if (email) credentials.email = email;

    const data: Record<string, unknown> = {
      legalEntityId: String(fd.get('legalEntityId')),
      aspProviderId: String(fd.get('aspProviderId')),
      environment: String(fd.get('environment')),
      status: String(fd.get('status') ?? 'INACTIVE'),
      credentials: Object.keys(credentials).length ? credentials : undefined,
    };

    ask(
      {
        title: 'Create ASP connection?',
        description: 'Are you sure you want to create this connection?',
        confirmLabel: 'Create connection',
      },
      async () => {
        try {
          await aspConnectionApi.create(selectedTenant, data);
          setShowForm(false);
          await reloadConnections(selectedTenant);
        } catch (err: unknown) {
          setError(readErrorMessage(err, 'Failed to create connection'));
        }
      },
    );
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    const fd = new FormData(e.currentTarget);
    const apiKey = String(fd.get('apiKey') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const credentials: Record<string, string> = {};
    if (apiKey) credentials.apiKey = apiKey;
    if (email) credentials.email = email;

    const data: Record<string, unknown> = {
      environment: String(fd.get('environment')),
      status: String(fd.get('status') ?? editing.status),
      credentials: Object.keys(credentials).length ? credentials : undefined,
    };

    ask(
      {
        title: 'Save connection changes?',
        description: 'Are you sure you want to save these changes?',
        confirmLabel: 'Save changes',
      },
      async () => {
        try {
          await aspConnectionApi.update(selectedTenant, editing.id, data);
          setEditing(null);
          await reloadConnections(selectedTenant);
          showToast('success', 'Connection updated');
        } catch (err: unknown) {
          setError(readErrorMessage(err, 'Failed to update connection'));
        }
      },
    );
  };

  const handleActivate = (connection: AspConnection, status: string) => {
    const activating = status === 'ACTIVE';
    ask(
      {
        title: activating ? 'Activate connection?' : 'Deactivate connection?',
        description: activating
          ? 'Are you sure you want to activate this connection?'
          : 'Are you sure you want to deactivate this connection?',
        confirmLabel: activating ? 'Activate' : 'Deactivate',
        tone: activating ? 'primary' : 'danger',
      },
      async () => {
        setError('');
        try {
          await aspConnectionApi.update(selectedTenant, connection.id, { status });
          await reloadConnections(selectedTenant);
        } catch (err: unknown) {
          setError(readErrorMessage(err, 'Failed to update connection'));
        }
      },
    );
  };

  const handleTest = async (connection: AspConnection) => {
    try {
      const result = await aspConnectionApi.test(selectedTenant, connection.id);
      if (result.ok) {
        showToast('success', 'Connection test OK');
      } else {
        showToast('error', result.message || 'Connection test failed');
      }
      await reloadConnections(selectedTenant);
    } catch (err: unknown) {
      showToast('error', readErrorMessage(err, 'Connection test failed'));
    }
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">ASP Connections</h1>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedTenant || legalEntities.length === 0}
            onClick={() => {
              setError('');
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus size={16} /> Add connection
          </button>
        </div>
      </header>

      {toast ? (
        <div
          className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      <section className="page-filters" aria-label="ASP connection filters">
        <form className="filter-bar" onSubmit={applySearch}>
          <div className="field filter-bar-tenant">
            <label htmlFor="asp-connection-tenant" className="field-label">
              Tenant
            </label>
            <SelectMenu
              id="asp-connection-tenant"
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
            <label htmlFor="asp-connection-search" className="field-label">
              Search
            </label>
            <input
              id="asp-connection-search"
              className="input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Entity, provider, env…"
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
              onClick={() => selectedTenant && void reloadConnections(selectedTenant, 'refresh')}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
              Refresh
            </button>
          </div>
        </form>
      </section>

      {error && !showForm && !editing ? <p className="form-error">{error}</p> : null}

      <div className="panel">
        {connections.length === 0 ? (
          <div className="panel-empty">No ASP connections for this tenant yet.</div>
        ) : filteredConnections.length === 0 ? (
          <div className="panel-empty">No connections match your search.</div>
        ) : (
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Legal entity</th>
                  <th>Provider</th>
                  <th>Env</th>
                  <th>Status</th>
                  <th>Credentials</th>
                  <th>Last test</th>
                  <th className="cell-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredConnections.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-strong">{c.legalEntity?.code ?? c.legalEntityId}</td>
                    <td>{c.aspProvider?.code ?? c.aspProviderId}</td>
                    <td>{c.environment}</td>
                    <td>{c.status}</td>
                    <td>{(c.credentialKeys ?? []).join(', ') || '—'}</td>
                    <td>{c.lastTestStatus ?? '—'}</td>
                    <td className="cell-actions">
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-link"
                          title="Edit connection"
                          onClick={() => {
                            setError('');
                            setShowForm(false);
                            setEditing(c);
                          }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleTest(c)}
                        >
                          Test
                        </button>
                        {c.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-action-status"
                            onClick={() => handleActivate(c, 'INACTIVE')}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-action-status"
                            onClick={() => handleActivate(c, 'ACTIVE')}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showForm}
        title="Create ASP connection"
        onClose={() => {
          setShowForm(false);
          setError('');
        }}
      >
        <form onSubmit={handleCreate} className="form-grid">
          {error ? <p className="form-error">{error}</p> : null}
          <Field label="Legal entity" tooltip={CONNECTION_FIELD_TOOLTIPS.legalEntity}>
            <select className="input" name="legalEntityId" required>
              {legalEntities.map((le) => (
                <option key={le.id} value={le.id}>
                  {le.code} — {le.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ASP provider" tooltip={CONNECTION_FIELD_TOOLTIPS.aspProvider}>
            <select className="input" name="aspProviderId" required>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} ({p.integrationImplementationStatus ?? 'unknown'})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Environment" tooltip={CONNECTION_FIELD_TOOLTIPS.environment}>
            <select className="input" name="environment" defaultValue="SANDBOX">
              <option value="SANDBOX">SANDBOX</option>
              <option value="PRODUCTION">PRODUCTION</option>
            </select>
          </Field>
          <Field label="Status" tooltip={CONNECTION_FIELD_TOOLTIPS.status}>
            <StatusToggle />
          </Field>
          <Field label="API key" tooltip={CONNECTION_FIELD_TOOLTIPS.apiKey}>
            <input className="input" name="apiKey" type="password" autoComplete="new-password" />
          </Field>
          <Field label="Portal email" tooltip={CONNECTION_FIELD_TOOLTIPS.portalEmail}>
            <input className="input" name="email" type="email" autoComplete="off" />
          </Field>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        title={
          editing
            ? `Edit connection · ${editing.legalEntity?.code ?? 'Legal entity'} · ${editing.aspProvider?.code ?? 'ASP'}`
            : 'Edit ASP connection'
        }
        description="Update environment, status, or credentials. Leave credential fields blank to keep existing values. Submit URL comes from ASP Provider API config."
        onClose={() => {
          setEditing(null);
          setError('');
        }}
      >
        {editing ? (
          <form key={editing.id} onSubmit={handleUpdate} className="form-grid">
            {error ? <p className="form-error">{error}</p> : null}
            <Field label="Legal entity" tooltip={CONNECTION_FIELD_TOOLTIPS.legalEntity}>
              <input
                className="input is-locked"
                disabled
                value={`${editing.legalEntity?.code ?? editing.legalEntityId}${
                  editing.legalEntity?.name ? ` — ${editing.legalEntity.name}` : ''
                }`}
              />
            </Field>
            <Field label="ASP provider" tooltip={CONNECTION_FIELD_TOOLTIPS.aspProvider}>
              <input
                className="input is-locked"
                disabled
                value={`${editing.aspProvider?.code ?? editing.aspProviderId}${
                  editing.aspProvider?.name ? ` — ${editing.aspProvider.name}` : ''
                }`}
              />
            </Field>
            <Field label="Environment" tooltip={CONNECTION_FIELD_TOOLTIPS.environment}>
              <select
                className="input"
                name="environment"
                defaultValue={editing.environment}
                required
              >
                <option value="SANDBOX">SANDBOX</option>
                <option value="PRODUCTION">PRODUCTION</option>
              </select>
            </Field>
            <Field label="Status" tooltip={CONNECTION_FIELD_TOOLTIPS.status}>
              <StatusToggle defaultActive={editing.status === 'ACTIVE'} />
            </Field>
            <Field label="API key" tooltip={CONNECTION_FIELD_TOOLTIPS.apiKey}>
              <input
                className="input"
                name="apiKey"
                type="password"
                autoComplete="new-password"
                placeholder={
                  editing.credentialKeys?.includes('apiKey')
                    ? 'Leave blank to keep existing'
                    : undefined
                }
              />
            </Field>
            <Field label="Portal email" tooltip={CONNECTION_FIELD_TOOLTIPS.portalEmail}>
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="off"
                placeholder={
                  editing.credentialKeys?.includes('email')
                    ? 'Leave blank to keep existing'
                    : undefined
                }
              />
            </Field>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(null);
                  setError('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save changes
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}
