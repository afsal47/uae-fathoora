import { useEffect, useState } from 'react';
import { Building2, Cable, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { tenantApi, invoiceApi, type Tenant, type Invoice } from '../lib/api';

export default function DashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      tenantApi.list().catch(() => []),
      invoiceApi.list().catch(() => []),
    ]).then(([t, i]) => {
      setTenants(t);
      setInvoices(i);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  const totalIntegrations = tenants.reduce((s, t) => s + (t.integrations?.length ?? 0), 0);
  const accepted = invoices.filter(i => i.status === 'ACCEPTED').length;
  const rejected = invoices.filter(i => i.status === 'REJECTED').length;
  const pending = invoices.filter(i => ['DRAFT', 'QUEUED', 'SUBMITTING', 'SUBMITTED'].includes(i.status)).length;

  const stats = [
    { label: 'Tenants', value: tenants.length, icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Integrations', value: totalIntegrations, icon: Cable, color: 'text-purple-600 bg-purple-50' },
    { label: 'Total Invoices', value: invoices.length, icon: FileText, color: 'text-gray-600 bg-gray-100' },
    { label: 'Accepted', value: accepted, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Rejected', value: rejected, icon: XCircle, color: 'text-red-600 bg-red-50' },
    { label: 'Pending', value: pending, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${color}`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Recent Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Invoice #</th>
                  <th className="px-5 py-3 text-left">Seller</th>
                  <th className="px-5 py-3 text-left">Buyer</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.slice(0, 5).map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-gray-600">{inv.sellerName}</td>
                    <td className="px-5 py-3 text-gray-600">{inv.buyerName}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{inv.currencyCode} {Number(inv.totalAmount).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        inv.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                        inv.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
