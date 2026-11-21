import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleHelp, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import StatusToggle from '../components/StatusToggle';
import { useConfirmAction } from '../hooks/useConfirmAction';
import {
  aspProviderApi,
  type AspApiConfig,
  type AspProvider,
} from '../lib/api';

const PROVIDER_FIELD_TOOLTIPS = {
  code: 'Enter a unique code to identify this ASP provider within the hub',
  name: 'Enter the display name of the ASP provider.',
  status:
    'Select the provider status. Only active providers with implemented and registered adapters can be used for invoice processing.',
} as const;

const API_CONFIG_FIELD_TOOLTIPS = {
  environment:
    'Select the ASP environment to configure, such as SANDBOX for testing or PRODUCTION for live invoice processing.',
  baseUrl:
    'Enter the root URL of the ASP API server for the selected environment. Example: https://api-stage.evatrauae.com.',
  loginPath:
    'Enter the ASP authentication endpoint used to obtain an access token. Example: /auth/login.',
  invoiceSubmitPath:
    'Enter the ASP API endpoint used to submit electronic invoices. Example: /invoice/send-document-async.',
  statusPath:
    'Enter the ASP API endpoint used to retrieve document status. Example: /invoice/document-status/{trackingId}.',
  timeoutMs:
    'How long the hub waits for an ASP API response, in milliseconds. Default: 30000.',
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

function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

export default function AspProvidersPage() {
  const [providers, setProviders] = useState<AspProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<AspProvider | null>(null);
  const [configs, setConfigs] = useState<AspApiConfig[]>([]);
  const [configEnv, setConfigEnv] = useState<'SANDBOX' | 'PRODUCTION'>('PRODUCTION');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { ask, confirmProps } = useConfirmAction();

  const load = (mode: 'silent' | 'refresh' = 'silent') => {
    if (mode === 'refresh') setRefreshing(true);
    aspProviderApi
      .list()
      .then(setProviders)
      .catch(() => setProviders([]))
      .finally(() => {
        setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
      });
  };

  useEffect(() => {
    void load();
  }, []);

  const applySearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => {
      const haystack = [
        p.code,
        p.name,
        p.status,
        p.integrationImplementationStatus,
        p.adapterRegistered ? 'IMPLEMENTED' : 'NOT_IMPLEMENTED',
        p.integrationReady ? 'Ready' : 'Not ready',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [providers, searchQuery]);

  const activeConfig = configs.find((c) => c.environment === configEnv);

  const openCreate = () => {
    setEdit(null);
    setConfigs([]);
    setConfigEnv('PRODUCTION');
    setError('');
    setShowForm(true);
  };

  const openEdit = async (provider: AspProvider) => {
    setEdit(provider);
    setError('');
    setConfigEnv('PRODUCTION');
    setShowForm(true);
    try {
      const rows = await aspProviderApi.listApiConfigs(provider.id);
      setConfigs(rows);
      if (rows.some((c) => c.environment === 'PRODUCTION')) {
        setConfigEnv('PRODUCTION');
      } else if (rows.some((c) => c.environment === 'SANDBOX')) {
        setConfigEnv('SANDBOX');
      }
    } catch (err: unknown) {
      setConfigs([]);
      setError(apiErrorMessage(err, 'Failed to load API configs'));
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEdit(null);
    setConfigs([]);
    setError('');
    setSaving(false);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const providerData: Record<string, unknown> = {
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim(),
      status: String(fd.get('status') ?? 'INACTIVE'),
    };
    const timeoutRaw = Number(fd.get('timeoutMs') || 30000);
    const configData: Record<string, unknown> = {
      environment: String(fd.get('environment') || configEnv),
      baseUrl: String(fd.get('baseUrl') ?? '').trim() || undefined,
      loginPath: String(fd.get('loginPath') ?? '').trim() || undefined,
      invoiceSubmitPath: String(fd.get('invoiceSubmitPath') ?? '').trim() || undefined,
      statusPath: String(fd.get('statusPath') ?? '').trim() || undefined,
      timeoutMs: Number.isFinite(timeoutRaw) ? Math.trunc(timeoutRaw) : 30000,
    };

    const isEdit = Boolean(edit);
    ask(
      {
        title: isEdit ? 'Save provider changes?' : 'Create ASP provider?',
        description: isEdit
          ? 'Are you sure you want to save these changes?'
          : 'Are you sure you want to create this provider?',
        confirmLabel: isEdit ? 'Save changes' : 'Create provider',
      },
      async () => {
        setSaving(true);
        try {
          let providerId = edit?.id;
          if (edit) {
            await aspProviderApi.update(edit.id, {
              name: providerData.name,
              status: providerData.status,
            });
          } else {
            const created = await aspProviderApi.create(providerData);
            providerId = created.id;
          }

          if (!providerId) {
            throw new Error('Provider id missing after save');
          }

          await aspProviderApi.upsertApiConfig(providerId, configData);
          closeForm();
          await load();
        } catch (err: unknown) {
          setError(apiErrorMessage(err, 'Failed to save provider'));
        } finally {
          setSaving(false);
        }
      },
    );
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">ASP Providers</h1>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add provider
          </button>
        </div>
      </header>

      <section className="page-filters" aria-label="ASP provider filters">
        <form className="filter-bar" onSubmit={applySearch}>
          <div className="field filter-bar-search">
            <label htmlFor="asp-provider-search" className="field-label">
              Search
            </label>
            <input
              id="asp-provider-search"
              className="input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Code, name, status…"
            />
          </div>
          <div className="filter-bar-actions">
            <button type="submit" className="btn btn-search">
              <Search size={14} /> Search
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={refreshing}
              onClick={() => load('refresh')}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
              Refresh
            </button>
          </div>
        </form>
      </section>

      <div className="panel">
        {providers.length === 0 ? (
          <div className="panel-empty">No ASP providers yet.</div>
        ) : filteredProviders.length === 0 ? (
          <div className="panel-empty">No providers match your search.</div>
        ) : (
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Adapter</th>
                  <th>Readiness</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredProviders.map((p) => (
                  <tr key={p.id}>
                    <td className="cell-mono">{p.code}</td>
                    <td className="cell-wrap">{p.name}</td>
                    <td>{p.status}</td>
                    <td>
                      {p.integrationImplementationStatus ??
                        (p.adapterRegistered ? 'IMPLEMENTED' : 'NOT_IMPLEMENTED')}
                    </td>
                    <td>{p.integrationReady ? 'Ready' : 'Not ready'}</td>
                    <td>
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          className="btn-link"
                          title="Edit provider and API config"
                          onClick={() => void openEdit(p)}
                        >
                          <Pencil size={14} /> Edit
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

      <Modal
        open={showForm}
        title={edit ? `Edit ${edit.code}` : 'Create ASP provider'}
        onClose={closeForm}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              Cancel
            </button>
            <button
              type="submit"
              form="asp-provider-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form
          id="asp-provider-form"
          key={`${edit?.id ?? 'new'}-${configEnv}-${activeConfig?.id ?? 'cfg'}`}
          onSubmit={handleSave}
          className="form-grid"
        >
          {error ? <p className="alert-error">{error}</p> : null}

          <Field label="Code" tooltip={PROVIDER_FIELD_TOOLTIPS.code}>
            <input
              className="input"
              name="code"
              defaultValue={edit?.code}
              required
              disabled={Boolean(edit)}
            />
          </Field>
          <Field label="Name" tooltip={PROVIDER_FIELD_TOOLTIPS.name}>
            <input className="input" name="name" defaultValue={edit?.name} required />
          </Field>

          {configs.length > 0 ? (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <div className="data-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Saved env</th>
                      <th>Base URL</th>
                      <th>Timeout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((c) => (
                      <tr key={c.id}>
                        <td className="cell-mono">{c.environment}</td>
                        <td className="text-xs break-all">{c.baseUrl || '—'}</td>
                        <td>{c.timeoutMs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <Field label="Environment" tooltip={API_CONFIG_FIELD_TOOLTIPS.environment}>
            <select
              className="input"
              name="environment"
              value={configEnv}
              onChange={(e) => {
                setConfigEnv(e.target.value as 'SANDBOX' | 'PRODUCTION');
                setError('');
              }}
            >
              <option value="SANDBOX">SANDBOX</option>
              <option value="PRODUCTION">PRODUCTION</option>
            </select>
          </Field>
          <Field label="Status" tooltip={PROVIDER_FIELD_TOOLTIPS.status}>
            <StatusToggle defaultActive={edit?.status === 'ACTIVE'} />
          </Field>
          <Field label="Base URL" tooltip={API_CONFIG_FIELD_TOOLTIPS.baseUrl} wide>
            <input
              className="input"
              name="baseUrl"
              placeholder="https://api-stage.evatrauae.com"
              defaultValue={activeConfig?.baseUrl ?? ''}
            />
          </Field>
          <Field label="Login path" tooltip={API_CONFIG_FIELD_TOOLTIPS.loginPath}>
            <input
              className="input"
              name="loginPath"
              placeholder="/auth/login"
              defaultValue={activeConfig?.loginPath ?? ''}
            />
          </Field>
          <Field
            label="Invoice submit path"
            tooltip={API_CONFIG_FIELD_TOOLTIPS.invoiceSubmitPath}
          >
            <input
              className="input"
              name="invoiceSubmitPath"
              placeholder="/invoice/send-document-async"
              defaultValue={activeConfig?.invoiceSubmitPath ?? ''}
            />
          </Field>
          <Field label="Status path" tooltip={API_CONFIG_FIELD_TOOLTIPS.statusPath}>
            <input
              className="input"
              name="statusPath"
              placeholder="/invoice/document-status/{trackingId}"
              defaultValue={activeConfig?.statusPath ?? ''}
            />
          </Field>
          <Field label="Timeout (ms)" tooltip={API_CONFIG_FIELD_TOOLTIPS.timeoutMs}>
            <input
              className="input"
              name="timeoutMs"
              type="number"
              defaultValue={activeConfig?.timeoutMs ?? 30000}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}
