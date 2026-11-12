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
    return <div className="loading-state">Loading…</div>;
  }

  const totalIntegrations = tenants.reduce((s, t) => s + (t.integrations?.length ?? 0), 0);
  const accepted = invoices.filter((i) =>
    i.status === 'ACCEPTED' || i.status === 'COMPLETED',
  ).length;
  const rejected = invoices.filter((i) => i.status === 'REJECTED').length;
  const pending = invoices.filter((i) =>
    ['DRAFT', 'QUEUED', 'SUBMITTING', 'SUBMITTED'].includes(i.status),
  ).length;

  const stats = [
    { label: 'Tenants', value: tenants.length, icon: Building2, tone: '' },
    { label: 'Integrations', value: totalIntegrations, icon: Cable, tone: '' },
    { label: 'Total Invoices', value: invoices.length, icon: FileText, tone: 'is-muted' },
    { label: 'Accepted', value: accepted, icon: CheckCircle, tone: 'is-success' },
    { label: 'Rejected', value: rejected, icon: XCircle, tone: 'is-danger' },
    { label: 'Pending', value: pending, icon: Clock, tone: 'is-warning' },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of tenants, integrations, and invoice status.</p>
        </div>
      </header>

      <div className="stat-grid">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="stat-card">
            <div className={`stat-icon ${tone}`}>
              <Icon size={20} strokeWidth={1.75} />
            </div>
            <div>
              <p className="stat-label">{label}</p>
              <p className="stat-value">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {invoices.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Recent invoices</h2>
          </div>
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Seller</th>
                  <th>Buyer</th>
                  <th className="!text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 5).map((inv) => (
                  <tr key={inv.id}>
                    <td className="cell-strong">{inv.invoiceNumber}</td>
                    <td>{inv.sellerName}</td>
                    <td>{inv.buyerName}</td>
                    <td className="cell-right cell-strong">
                      {inv.currencyCode} {Number(inv.totalAmount).toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          inv.status === 'ACCEPTED' || inv.status === 'COMPLETED'
                            ? 'badge-success'
                            : inv.status === 'REJECTED' || inv.status === 'FAILED'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }`}
                      >
                        {inv.status}
                      </span>
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
