import { useEffect, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { tenantApi, type Tenant } from '../lib/api';

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

function AspFields({
  tenant,
  mode,
}: {
  tenant?: Tenant | null;
  mode: 'create' | 'edit';
}) {
  return (
    <div className="md:col-span-2 mt-2 pt-4 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">ASP configuration</h3>
      <p className="text-xs text-gray-500 mb-4">
        Access Point provider for Peppol / FTA submission. Use FAKE for local testing.
        {mode === 'edit' && ' Leave API key / webhook token blank to keep current values.'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ASP Provider *</label>
          <select
            name="aspProvider"
            defaultValue={tenant?.aspProvider ?? 'FAKE'}
            className={inputClass}
          >
            <option value="FAKE">FAKE (Testing)</option>
            <option value="CLEARTAX">ClearTax</option>
            <option value="COMARCH">Comarch</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ASP Base URL</label>
          <input
            name="aspBaseUrl"
            type="url"
            defaultValue={tenant?.aspBaseUrl ?? ''}
            placeholder="https://api.cleartax.com or http://localhost:3100"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ASP API Key</label>
          <input
            name="aspApiKey"
            type="password"
            autoComplete="off"
            placeholder={
              mode === 'edit' && tenant?.aspApiKey
                ? `Current: ${tenant.aspApiKey}`
                : 'ClearTax / ASP API key'
            }
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ASP Webhook Token</label>
          <input
            name="aspWebhookToken"
            type="password"
            autoComplete="off"
            placeholder={
              mode === 'edit' && tenant?.aspWebhookToken
                ? `Current: ${tenant.aspWebhookToken}`
                : 'Token ASP sends on inbound webhooks'
            }
            className={inputClass}
          />
        </div>
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
    setShowForm(!showForm);
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Tenant'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Register New Tenant</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input name="code" required placeholder="CITY_MARINE" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                name="name"
                required
                placeholder="City Marine Insurance LLC"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TRN</label>
              <input name="trn" placeholder="100123456700003" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                placeholder="accounts@company.ae"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input name="city" placeholder="Dubai" className={inputClass} />
            </div>
            <AspFields mode="create" />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Tenant
            </button>
          </div>
        </form>
      )}

      {editingTenant && (
        <form
          key={editingTenant.id}
          onSubmit={handleUpdate}
          className="bg-white rounded-xl border border-gray-200 p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Edit Tenant</h2>
            <button
              type="button"
              onClick={closeEdit}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X size={16} /> Cancel
            </button>
          </div>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                value={editingTenant.code}
                disabled
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                name="name"
                required
                defaultValue={editingTenant.name}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TRN</label>
              <input
                name="trn"
                defaultValue={editingTenant.trn ?? ''}
                placeholder="100123456700003"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={editingTenant.email ?? ''}
                placeholder="accounts@company.ae"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                name="city"
                defaultValue={editingTenant.city ?? ''}
                placeholder="Dubai"
                className={inputClass}
              />
            </div>
            <div className="flex items-end pb-2">
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
            <AspFields mode="edit" tenant={editingTenant} />
          </div>
          <div className="mt-4 flex justify-end gap-3">
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

      <div className="bg-white rounded-xl border border-gray-200">
        {tenants.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No tenants yet. Create one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">TRN</th>
                  <th className="px-5 py-3 text-left">ASP</th>
                  <th className="px-5 py-3 text-left">ASP URL</th>
                  <th className="px-5 py-3 text-center">Integrations</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-sm font-medium text-gray-900">{t.code}</td>
                    <td className="px-5 py-3 text-gray-700">{t.name}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{t.trn ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {t.aspProvider}
                      </span>
                    </td>
                    <td
                      className="px-5 py-3 text-gray-500 text-xs max-w-[180px] truncate"
                      title={t.aspBaseUrl ?? undefined}
                    >
                      {t.aspBaseUrl ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">
                      {t.integrations?.length ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
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
