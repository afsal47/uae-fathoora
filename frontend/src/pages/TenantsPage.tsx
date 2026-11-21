import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Building, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { useConfirmAction } from '../hooks/useConfirmAction';
import {
  legalEntityApi,
  tenantApi,
  type Tenant,
} from '../lib/api';

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

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [legalEntitiesTenant, setLegalEntitiesTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState('');
  const [legalEntityError, setLegalEntityError] = useState('');
  const { ask, confirmProps } = useConfirmAction();

  const load = (mode: 'silent' | 'refresh' = 'silent') => {
    if (mode === 'refresh') setRefreshing(true);
    tenantApi
      .list()
      .then(setTenants)
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const applySearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const filteredTenants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => {
      const haystack = [t.code, t.name, t.trn, t.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tenants, searchQuery]);

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

  const openLegalEntities = (tenant: Tenant) => {
    setShowForm(false);
    setEditingTenant(null);
    setLegalEntityError('');
    setLegalEntitiesTenant(tenant);
  };

  const closeLegalEntities = () => {
    setLegalEntitiesTenant(null);
    setLegalEntityError('');
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === 'string' && v.trim()) data[k] = v.trim();
    });

    ask(
      {
        title: 'Create tenant?',
        description: 'Are you sure you want to create this tenant?',
        confirmLabel: 'Create tenant',
      },
      async () => {
        try {
          await tenantApi.create(data);
          setShowForm(false);
          load();
        } catch (err: any) {
          setError(err.response?.data?.message ?? 'Failed to create tenant');
        }
      },
    );
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
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

    ask(
      {
        title: 'Save tenant changes?',
        description: 'Are you sure you want to save these changes?',
        confirmLabel: 'Save changes',
      },
      async () => {
        try {
          await tenantApi.update(editingTenant.id, data);
          setEditingTenant(null);
          load();
        } catch (err: any) {
          setError(err.response?.data?.message ?? 'Failed to update tenant');
        }
      },
    );
  };

  const handleSaveLegalEntity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!legalEntitiesTenant) return;
    setLegalEntityError('');
    const fd = new FormData(e.currentTarget);
    const data = {
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim(),
      trn: String(fd.get('trn') ?? '').trim() || undefined,
      email: String(fd.get('email') ?? '').trim() || undefined,
      isActive: fd.get('isActive') === 'on',
    };

    ask(
      {
        title: 'Create legal entity?',
        description: 'Are you sure you want to create this legal entity?',
        confirmLabel: 'Create legal entity',
      },
      async () => {
        try {
          await legalEntityApi.create(legalEntitiesTenant.id, data);
          closeLegalEntities();
        } catch (err: any) {
          const message = err.response?.data?.message ?? 'Failed to create legal entity';
          setLegalEntityError(Array.isArray(message) ? message.join(', ') : message);
        }
      },
    );
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Tenants</h1>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-primary">
          <Plus size={16} />
          New Tenant
        </button>
      </header>

      <Modal
        open={showForm}
        title="Register New Tenant"
        description="Create the company account. Add legal entities and ASP connections next."
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
          </div>
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
        description="Update company details for this tenant."
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

      <section className="page-filters" aria-label="Tenant filters">
        <form className="filter-bar" onSubmit={applySearch}>
          <div className="field filter-bar-search">
            <label htmlFor="tenant-search" className="field-label">
              Search
            </label>
            <input
              id="tenant-search"
              className="input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Code, name, TRN…"
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
        {tenants.length === 0 ? (
          <div className="panel-empty">No tenants yet. Create one to get started.</div>
        ) : filteredTenants.length === 0 ? (
          <div className="panel-empty">No tenants match your search.</div>
        ) : (
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant code</th>
                  <th>Company name</th>
                  <th>TRN</th>
                  <th className="cell-center">Integrations</th>
                  <th className="cell-status">Status</th>
                  <th className="cell-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((t) => (
                  <tr key={t.id}>
                    <td className="cell-mono">{t.code}</td>
                    <td className="cell-wrap">{t.name}</td>
                    <td className="font-mono text-xs">{t.trn ?? '—'}</td>
                    <td className="cell-center tabular-nums">{t.integrations?.length ?? 0}</td>
                    <td className="cell-status">
                      <span className={`badge ${t.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="cell-actions">
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="btn-link"
                          title="Edit tenant"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openLegalEntities(t)}
                          className="btn-link"
                          title="Add legal entity"
                        >
                          <Building size={14} /> Legal entities
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
        open={legalEntitiesTenant !== null}
        title={
          legalEntitiesTenant
            ? `Add legal entity — ${legalEntitiesTenant.code}`
            : 'Add legal entity'
        }
        description="Legal entities are the TRN-level businesses under this tenant. ASP connections are assigned per legal entity."
        onClose={closeLegalEntities}
      >
        {legalEntitiesTenant ? (
          <form
            key={legalEntitiesTenant.id}
            onSubmit={handleSaveLegalEntity}
            className="form-grid form-grid-2"
          >
            {legalEntityError ? <p className="alert-error">{legalEntityError}</p> : null}
            <Field label="Code *">
              <input name="code" required placeholder="CM_DXB" className={inputClass} />
            </Field>
            <Field label="Name *">
              <input
                name="name"
                required
                placeholder="City Marine Dubai"
                className={inputClass}
              />
            </Field>
            <Field label="TRN">
              <input
                name="trn"
                placeholder="100111456700003"
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                placeholder="finance@company.ae"
                className={inputClass}
              />
            </Field>
            <div className="flex flex-col gap-3 justify-end pb-2.5">
              <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)] cursor-pointer">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked
                  className="border-[var(--color-line)] text-[var(--color-brand-600)] focus:ring-[var(--color-brand-500)]"
                />
                Active
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={closeLegalEntities}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create legal entity
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}
