import { useEffect, useState, type ReactNode } from 'react';
import { Pencil, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import { tenantApi, type Tenant } from '../lib/api';

const inputClass = 'input';

/** Browsers treat email + password as a login and ignore autocomplete="off". */
function unlockOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.readOnly = false;
}

function AutofillTrap() {
  return (
    <div className="absolute w-0 h-0 overflow-hidden" aria-hidden="true">
      <input type="text" tabIndex={-1} autoComplete="username" />
      <input type="password" tabIndex={-1} autoComplete="current-password" />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function AspFields({
  tenant,
  mode,
}: {
  tenant?: Tenant | null;
  mode: 'create' | 'edit';
}) {
  return (
    <div className="form-section">
      <h3 className="form-section-title">ASP configuration</h3>
      <p className="field-hint mb-4">
        Access Point used for Peppol and FTA submission.
        {mode === 'edit' && ' Leave the API key blank to keep the current value.'}
      </p>
      <div className="form-grid form-grid-2">
        <Field label="ASP Provider *">
          <input
            name="aspProvider"
            required
            defaultValue={tenant?.aspProvider ?? ''}
            placeholder="Provider name"
            className={inputClass}
          />
        </Field>
        <Field label="ASP Base URL">
          <input
            name="aspBaseUrl"
            type="url"
            defaultValue={tenant?.aspBaseUrl ?? ''}
            placeholder="https://"
            className={inputClass}
          />
        </Field>
        <Field label="ASP API Key">
          <input
            name="aspApiKey"
            type="password"
            autoComplete="new-password"
            readOnly
            onFocus={unlockOnFocus}
            placeholder={
              mode === 'edit' && tenant?.aspApiKey
                ? `Current: ${tenant.aspApiKey}`
                : 'ASP API key'
            }
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    tenantApi.list().then(setTenants).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditingTenant(null);
    setError('');
    setShowForm(true);
  };

  const closeCreate = () => {
    setShowForm(false);
    setError('');
  };

  const openEdit = (tenant: Tenant) => {
    setShowForm(false);
    setError('');
    setEditingTenant(tenant);
  };

  const closeEdit = () => {
    setEditingTenant(null);
    setError('');
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === 'string' && v.trim()) data[k] = v.trim();
    });

    try {
      await tenantApi.create(data);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to create tenant');
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTenant) return;
    setError('');

    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};

    for (const [k, v] of fd.entries()) {
      if (k === 'isActive') continue;
      if (typeof v === 'string' && v.trim()) data[k] = v.trim();
    }
    data.isActive = fd.get('isActive') === 'on';

    try {
      await tenantApi.update(editingTenant.id, data);
      setEditingTenant(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to update tenant');
    }
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Tenants</h1>
          <p className="page-subtitle">Companies and access points connected to the hub.</p>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-primary">
          <Plus size={16} />
          New Tenant
        </button>
      </header>

      <Modal
        open={showForm}
        title="Register New Tenant"
        description="Company details and the access point used for submission."
        onClose={closeCreate}
      >
        <form onSubmit={handleCreate} autoComplete="off" className="relative">
          <AutofillTrap />
          {error && !editingTenant && <p className="alert-error">{error}</p>}
          <div className="form-grid form-grid-2">
            <Field label="Tenant code *">
              <input name="code" required placeholder="TENANT_CODE" className={inputClass} />
            </Field>
            <Field label="Company Name *">
              <input name="name" required placeholder="Registered company name" className={inputClass} />
            </Field>
            <Field label="TRN">
              <input name="trn" placeholder="Tax registration number" className={inputClass} />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="text"
                inputMode="email"
                autoComplete="off"
                readOnly
                onFocus={unlockOnFocus}
                placeholder="name@company.com"
                className={inputClass}
              />
            </Field>
            <Field label="City">
              <input name="city" placeholder="City" className={inputClass} />
            </Field>
          </div>
          <AspFields mode="create" />
          <div className="form-actions">
            <button type="button" onClick={closeCreate} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Tenant
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editingTenant !== null}
        title="Edit Tenant"
        description="Update company details and access point credentials."
        onClose={closeEdit}
      >
        {editingTenant && (
          <form
            key={editingTenant.id}
            onSubmit={handleUpdate}
            autoComplete="off"
            className="relative"
          >
            <AutofillTrap />
            {error && <p className="alert-error">{error}</p>}
            <div className="form-grid form-grid-2">
              <Field label="Tenant code">
                <input
                  value={editingTenant.code}
                  disabled
                  className="input is-locked"
                />
              </Field>
              <Field label="Company Name *">
                <input
                  name="name"
                  required
                  defaultValue={editingTenant.name}
                  className={inputClass}
                />
              </Field>
              <Field label="TRN">
                <input
                  name="trn"
                  defaultValue={editingTenant.trn ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  readOnly
                  onFocus={unlockOnFocus}
                  defaultValue={editingTenant.email ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="City">
                <input
                  name="city"
                  defaultValue={editingTenant.city ?? ''}
                  className={inputClass}
                />
              </Field>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)] cursor-pointer">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={editingTenant.isActive}
                    className="border-[var(--color-line)] text-[var(--color-brand-600)] focus:ring-[var(--color-brand-500)]"
                  />
                  Active
                </label>
              </div>
            </div>
            <AspFields mode="edit" tenant={editingTenant} />
            <div className="form-actions">
              <button type="button" onClick={closeEdit} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      <div className="panel">
        {tenants.length === 0 ? (
          <div className="panel-empty">No tenants yet. Create one to get started.</div>
        ) : (
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant code</th>
                  <th>Company name</th>
                  <th>TRN</th>
                  <th>ASP</th>
                  <th>ASP URL</th>
                  <th className="!text-center">Integrations</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="cell-mono">{t.code}</td>
                    <td className="cell-strong">{t.name}</td>
                    <td className="font-mono text-xs">{t.trn ?? '—'}</td>
                    <td>
                      <span className="badge badge-accent">{t.aspProvider}</span>
                    </td>
                    <td className="min-w-[12rem] max-w-[28rem] !whitespace-normal text-xs break-all" title={t.aspBaseUrl ?? undefined}>
                      {t.aspBaseUrl ?? '—'}
                    </td>
                    <td className="cell-center tabular-nums">{t.integrations?.length ?? 0}</td>
                    <td>
                      <span className={`badge ${t.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="btn-link"
                        title="Edit tenant"
                      >
                        <Pencil size={14} /> Edit
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
