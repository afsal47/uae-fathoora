import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { invoiceApi, type Invoice, type InvoiceSourcePayload } from '../lib/api';

function Field({ label, value }: { label: string; value?: string | number | null | boolean }) {
  if (value === undefined || value === null || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <div>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-gray-900 break-words">{display}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</p>
      {children}
    </div>
  );
}

function ObjectGrid({ data }: { data?: Record<string, unknown> | null }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      {entries.map(([key, value]) => {
        if (typeof value === 'object') {
          return (
            <div key={key} className="col-span-2 md:col-span-4">
              <p className="text-gray-400 text-xs mb-1">{labelize(key)}</p>
              <pre className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs text-gray-700 overflow-x-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          );
        }
        return <Field key={key} label={labelize(key)} value={value as string | number | boolean} />;
      })}
    </div>
  );
}

function labelize(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(', ') || null;
}

function PartyBlock({
  title,
  name,
  trn,
  addressLine1,
  addressLine2,
  addressLine3,
  city,
  state,
  postalCode,
  countryCode,
  extras,
}: {
  title: string;
  name: string;
  trn?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  extras?: InvoiceSourcePayload['seller'] | null;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase">{title}</p>
      <p className="font-medium text-gray-900">{name}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Field label="TRN" value={trn} />
        <Field
          label="Address"
          value={formatAddress([
            addressLine1,
            addressLine2,
            addressLine3,
            city,
            state,
            postalCode,
            countryCode,
          ])}
        />
        <Field label="Endpoint ID" value={extras?.endpointId} />
        <Field label="Endpoint Scheme" value={extras?.endpointScheme} />
      </div>
      {extras?.legalRegistration && (
        <div>
          <p className="text-gray-400 text-xs mb-1">Legal Registration</p>
          <ObjectGrid data={extras.legalRegistration} />
        </div>
      )}
      {extras?.contact && (
        <div>
          <p className="text-gray-400 text-xs mb-1">Contact</p>
          <ObjectGrid data={extras.contact} />
        </div>
      )}
    </div>
  );
}

function isCreditOrDebitNote(documentType: string) {
  return /CREDIT_NOTE|DEBIT_NOTE/i.test(documentType);
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TAX_INVOICE: 'Standard Tax Invoice',
  CREDIT_NOTE: 'Standard Credit Note',
  DEBIT_NOTE: 'Debit Note',
  SELF_BILLED_TAX_INVOICE: 'Self-Billed Tax Invoice',
  SELF_BILLED_CREDIT_NOTE: 'Self-Billed Credit Note',
  COMMERCIAL_INVOICE: 'Commercial Invoice',
  COMMERCIAL_CREDIT_NOTE: 'Commercial Credit Note',
};

function formatDocumentType(documentType: string) {
  return DOCUMENT_TYPE_LABELS[documentType] ?? documentType;
}

function InvoiceDetails({ inv }: { inv: Invoice }) {
  const src = inv.sourcePayload ?? null;
  const lineExtras = src?.lines ?? [];
  const creditReasonCode = src?.creditNoteReasonCode || src?.reasonCode;
  const againstDCNoteId =
    src?.againstCreditNoteId || src?.againstDCNoteId;
  const precedingHubInvoiceId = src?.precedingInvoiceRef?.id;

  return (
    <div className="px-5 pb-5 border-t border-gray-100">
      <Section title="Document">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Document Type" value={formatDocumentType(inv.documentType)} />
          <Field label="Hub Invoice Number" value={inv.invoiceNumber} />
          <Field
            label="Source System DCNote"
            value={inv.sourceSystemDCNoteId || '—'}
          />
          <Field label="Source Document ID" value={inv.sourceDocumentId} />
          <Field label="Idempotency Key" value={inv.idempotencyKey} />
          <Field label="Issue Date" value={new Date(inv.issueDate).toLocaleDateString()} />
          <Field label="Tax Point Date" value={src?.taxPointDate} />
          <Field label="Due Date" value={src?.dueDate} />
          <Field label="Currency" value={inv.currencyCode} />
          <Field label="Tax Currency" value={src?.taxCurrencyCode} />
          <Field label="Source System" value={inv.sourceSystem} />
          <Field label="Accounting Cost" value={src?.accountingCost} />
          <Field label="Contract Reference" value={src?.contractReference} />
          <Field label="Principal TRN" value={src?.principalTrn} />
          <Field label="Profile Execution ID" value={src?.profileExecutionId} />
          <Field label="Exchange Rate" value={src?.exchangeRate} />
          <Field label="Tax Inclusive Amount (AED)" value={src?.taxInclusiveAmountInAed} />
          <Field label="Attempts" value={inv.submissionAttempts} />
          {inv.aspMessageId && <Field label="ASP Message ID" value={inv.aspMessageId} />}
          {inv.aspReferenceId && <Field label="ASP Reference ID" value={inv.aspReferenceId} />}
          {inv.notes && (
            <div className="col-span-2 md:col-span-4">
              <Field label="Notes" value={inv.notes} />
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
      </Section>

      {(isCreditOrDebitNote(inv.documentType) ||
        creditReasonCode ||
        againstDCNoteId ||
        precedingHubInvoiceId) && (
        <Section title="Credit / Debit Note">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-amber-50 border border-amber-100 rounded-lg p-3">
            <Field label="Reason Code" value={creditReasonCode || '—'} />
            <Field
              label="Against Credit Note ID (IBMS)"
              value={againstDCNoteId || '—'}
            />
            <Field
              label="Preceding Hub Invoice Number"
              value={precedingHubInvoiceId || '—'}
            />
            <Field
              label="Preceding Invoice Issue Date"
              value={src?.precedingInvoiceRef?.issueDate}
            />
          </div>
        </Section>
      )}

      <Section title="Parties">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PartyBlock
            title="Seller"
            name={inv.sellerName}
            trn={inv.sellerTrn}
            addressLine1={inv.sellerAddressLine1}
            addressLine2={inv.sellerAddressLine2}
            addressLine3={src?.seller?.addressLine3}
            city={inv.sellerCity}
            state={inv.sellerState}
            postalCode={inv.sellerPostalCode}
            countryCode={inv.sellerCountryCode}
            extras={src?.seller}
          />
          <PartyBlock
            title="Buyer"
            name={inv.buyerName}
            trn={inv.buyerTrn}
            addressLine1={inv.buyerAddressLine1}
            addressLine2={inv.buyerAddressLine2}
            addressLine3={src?.buyer?.addressLine3}
            city={inv.buyerCity}
            state={inv.buyerState}
            postalCode={inv.buyerPostalCode}
            countryCode={inv.buyerCountryCode}
            extras={src?.buyer}
          />
        </div>
      </Section>

      {(src?.paymentMeans || src?.paymentTerms) && (
        <Section title="Payment">
          <div className="space-y-3">
            {src.paymentMeans && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Payment Means</p>
                <ObjectGrid data={src.paymentMeans} />
              </div>
            )}
            {src.paymentTerms && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Payment Terms</p>
                <ObjectGrid data={src.paymentTerms} />
              </div>
            )}
          </div>
        </Section>
      )}

      {(src?.delivery || src?.invoicePeriod || src?.orderReference || src?.precedingInvoiceRef || src?.references) && (
        <Section title="References & Delivery">
          <div className="space-y-3">
            {src.delivery && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Delivery</p>
                <ObjectGrid data={src.delivery} />
              </div>
            )}
            {src.invoicePeriod && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Invoice Period</p>
                <ObjectGrid data={src.invoicePeriod} />
              </div>
            )}
            {src.orderReference && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Order Reference</p>
                <ObjectGrid data={src.orderReference} />
              </div>
            )}
            {src.precedingInvoiceRef && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Preceding Invoice</p>
                <ObjectGrid data={src.precedingInvoiceRef} />
              </div>
            )}
            {src.references && (
              <div>
                <p className="text-gray-400 text-xs mb-1">References</p>
                <ObjectGrid data={src.references} />
              </div>
            )}
          </div>
        </Section>
      )}

      {(src?.transactionFlags || (src?.allowanceCharges && src.allowanceCharges.length > 0)) && (
        <Section title="Transaction Flags & Allowances">
          <div className="space-y-3">
            {src.transactionFlags && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Transaction Flags</p>
                <ObjectGrid data={src.transactionFlags} />
              </div>
            )}
            {src.allowanceCharges && src.allowanceCharges.length > 0 && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Document Allowances / Charges</p>
                <pre className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs text-gray-700 overflow-x-auto">
                  {JSON.stringify(src.allowanceCharges, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Section>
      )}

      {inv.lines.length > 0 && (
        <Section title="Line Items">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">VAT Cat</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit Price (excl.)</th>
                <th className="px-3 py-2 text-right">VAT %</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Total (incl.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inv.lines.map((line, idx) => {
                const extra = lineExtras[idx];
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2 text-gray-500 align-top">{line.lineNumber}</td>
                    <td className="px-3 py-2 text-gray-900 align-top">
                      <div>{line.description}</div>
                      {extra && (
                        <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                          {extra.itemDescription && <div>Item desc: {extra.itemDescription}</div>}
                          {extra.unitCode && <div>Unit: {extra.unitCode}</div>}
                          {extra.vatExemptionReason && (
                            <div>Exemption: {extra.vatExemptionReason}</div>
                          )}
                          {extra.vatExemptionReasonCode && (
                            <div>Exemption code: {extra.vatExemptionReasonCode}</div>
                          )}
                          {extra.rcmNatureCode && <div>RCM: {extra.rcmNatureCode}</div>}
                          {extra.classificationId && (
                            <div>
                              Class: {extra.classificationId}
                              {extra.classificationScheme ? ` (${extra.classificationScheme})` : ''}
                            </div>
                          )}
                          {extra.accountingCost && <div>Acct cost: {extra.accountingCost}</div>}
                          {extra.orderLineReferenceId && (
                            <div>Order line: {extra.orderLineReferenceId}</div>
                          )}
                          {extra.invoicePeriod && (
                            <div>Period: {JSON.stringify(extra.invoicePeriod)}</div>
                          )}
                          {extra.allowanceCharges && extra.allowanceCharges.length > 0 && (
                            <div>Line A/C: {JSON.stringify(extra.allowanceCharges)}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700 align-top">{line.vatCategory}</td>
                    <td className="px-3 py-2 text-right text-gray-700 align-top">
                      {Number(line.quantity)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 align-top">
                      {Number(line.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 align-top">
                      {Number(line.vatRate)}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 align-top">
                      {Number(line.taxAmount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900 align-top">
                      {Number(line.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-gray-200 font-medium">
              <tr>
                <td colSpan={6}></td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">Subtotal</td>
                <td className="px-3 py-2 text-right text-gray-900">
                  {Number(inv.subtotalAmount).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={6}></td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">Tax</td>
                <td className="px-3 py-2 text-right text-gray-900">
                  {Number(inv.taxAmount).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={6}></td>
                <td className="px-3 py-2 text-right text-xs font-bold text-gray-700">Total</td>
                <td className="px-3 py-2 text-right font-bold text-gray-900">
                  {inv.currencyCode} {Number(inv.totalAmount).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Section>
      )}

      {src && (
        <Section title="Full Source Payload">
          <pre className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto max-h-80">
            {JSON.stringify(src, null, 2)}
          </pre>
        </Section>
      )}

      {inv.events.length > 0 && (
        <Section title="Event Timeline">
          <div className="space-y-2">
            {inv.events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 text-xs">
                <span className="text-gray-400 w-36 shrink-0">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
                <span className="font-mono text-gray-500 w-40 shrink-0">{ev.type}</span>
                <span className="text-gray-700">{ev.message}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

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
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-white rounded-xl border border-gray-200">
              <button
                onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-6 text-sm">
                  <span className="font-medium text-gray-900 w-32">{inv.invoiceNumber}</span>
                  <span className="text-gray-500 w-40 truncate">{inv.sellerName}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-500 w-40 truncate">{inv.buyerName}</span>
                  <span className="font-medium text-gray-900 w-28 text-right">
                    {inv.currencyCode} {Number(inv.totalAmount).toLocaleString()}
                  </span>
                  <StatusBadge status={inv.status} />
                </div>
                {expandedId === inv.id ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </button>

              {expandedId === inv.id && <InvoiceDetails inv={inv} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
