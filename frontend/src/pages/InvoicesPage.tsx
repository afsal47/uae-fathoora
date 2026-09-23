import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { invoiceApi, type Invoice } from '../lib/api';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    invoiceApi.list().then(setInvoices).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-center py-16">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Invoices</h1>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No invoices yet. Create one via the API (POST /v1/invoices).
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <div key={inv.id} className="bg-white rounded-xl border border-gray-200">
              <button
                onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-6 text-sm">
                  <span className="font-medium text-gray-900 w-32">{inv.invoiceNumber}</span>
                  <span className="text-gray-500 w-40">{inv.sellerName}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-500 w-40">{inv.buyerName}</span>
                  <span className="font-medium text-gray-900 w-28 text-right">
                    {inv.currencyCode} {Number(inv.totalAmount).toLocaleString()}
                  </span>
                  <StatusBadge status={inv.status} />
                </div>
                {expandedId === inv.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {expandedId === inv.id && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">Document Type</p>
                      <p className="text-gray-900">{inv.documentType}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Issue Date</p>
                      <p className="text-gray-900">{new Date(inv.issueDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Source System</p>
                      <p className="text-gray-900">{inv.sourceSystem}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Attempts</p>
                      <p className="text-gray-900">{inv.submissionAttempts}</p>
                    </div>
                    {inv.aspMessageId && (
                      <div>
                        <p className="text-gray-400 text-xs">ASP Message ID</p>
                        <p className="text-gray-900 font-mono text-xs">{inv.aspMessageId}</p>
                      </div>
                    )}
                    {inv.rejectionReason && (
                      <div className="col-span-2">
                        <p className="text-gray-400 text-xs">Rejection Reason</p>
                        <p className="text-red-600">{inv.rejectionReason}</p>
                      </div>
                    )}
                    {inv.lastSubmissionError && (
                      <div className="col-span-2">
                        <p className="text-gray-400 text-xs">Last Error</p>
                        <p className="text-red-600">{inv.lastSubmissionError}</p>
                      </div>
                    )}
                  </div>

                  {inv.lines.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</p>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">#</th>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                            <th className="px-3 py-2 text-right">VAT %</th>
                            <th className="px-3 py-2 text-right">Tax</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {inv.lines.map(line => (
                            <tr key={line.id}>
                              <td className="px-3 py-2 text-gray-500">{line.lineNumber}</td>
                              <td className="px-3 py-2 text-gray-900">{line.description}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{Number(line.quantity)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{Number(line.unitPrice).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{Number(line.vatRate)}%</td>
                              <td className="px-3 py-2 text-right text-gray-700">{Number(line.taxAmount).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900">{Number(line.totalAmount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-gray-200 font-medium">
                          <tr>
                            <td colSpan={5}></td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">Subtotal</td>
                            <td className="px-3 py-2 text-right text-gray-900">{Number(inv.subtotalAmount).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td colSpan={5}></td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">Tax</td>
                            <td className="px-3 py-2 text-right text-gray-900">{Number(inv.taxAmount).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td colSpan={5}></td>
                            <td className="px-3 py-2 text-right text-xs font-bold text-gray-700">Total</td>
                            <td className="px-3 py-2 text-right font-bold text-gray-900">{inv.currencyCode} {Number(inv.totalAmount).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {inv.events.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Event Timeline</p>
                      <div className="space-y-2">
                        {inv.events.map(ev => (
                          <div key={ev.id} className="flex items-start gap-3 text-xs">
                            <span className="text-gray-400 w-36 shrink-0">
                              {new Date(ev.createdAt).toLocaleString()}
                            </span>
                            <span className="font-mono text-gray-500 w-40 shrink-0">{ev.type}</span>
                            <span className="text-gray-700">{ev.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
