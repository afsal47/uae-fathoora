import { useEffect, useState, type ReactNode } from 'react';
import { Pencil, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import { tenantApi, type Tenant } from '../lib/api';

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

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
    <div className="min-w-0">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
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
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900">ASP configuration</h3>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Access Point used for Peppol and FTA submission.
        {mode === 'edit' && ' Leave the API key and webhook token blank to keep the current values.'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
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
        <Field label="ASP Webhook Token">
          <input
            name="aspWebhookToken"
            type="password"
            autoComplete="new-password"
            readOnly
            onFocus={unlockOnFocus}
            placeholder={
              mode === 'edit' && tenant?.aspWebhookToken
                ? `Current: ${tenant.aspWebhookToken}`
                : 'Webhook token'
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

  if (loading) return <div className="text-gray-400 text-center py-16">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          New Tenant
        </button>
      </div>

      <Modal
        open={showForm}
        title="Register New Tenant"
        description="Company details and the access point used for submission."
        onClose={closeCreate}
      >
        <form onSubmit={handleCreate} autoComplete="off" className="relative">
          <AutofillTrap />
          {error && !editingTenant && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Code *">
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
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeCreate}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
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
          {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Code">
              <input
                value={editingTenant.code}
                disabled
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
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
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={editingTenant.isActive}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Active
              </label>
            </div>
          </div>
          <AspFields mode="edit" tenant={editingTenant} />
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeEdit}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
        )}
      </Modal>

      <div className="bg-white rounded-xl border border-gray-200">
        {tenants.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No tenants yet. Create one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Code</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">TRN</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">ASP</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">ASP URL</th>
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Integrations</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 align-middle">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900 whitespace-nowrap">
                      {t.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{t.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {t.trn ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {t.aspProvider}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap max-w-[240px]"
                      title={t.aspBaseUrl ?? undefined}
                    >
                      <span className="block truncate">{t.aspBaseUrl ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap tabular-nums">
                      {t.integrations?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
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
