import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { invoiceApi, type Invoice, type InvoiceSourcePayload } from '../lib/api';

function Field({ label, value }: { label: string; value?: string | number | null | boolean }) {
  if (value === undefined || value === null || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-sm leading-snug text-gray-900 break-words">{display}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      {children}
    </section>
  );
}

function visibleEntries(data?: Record<string, unknown> | null) {
  if (!data) return [];
  return Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '');
}

function ObjectGrid({
  data,
  columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
}: {
  data?: Record<string, unknown> | null;
  columns?: string;
}) {
  const entries = visibleEntries(data);
  if (entries.length === 0) return null;

  return (
    <div className={`grid items-start gap-x-8 gap-y-4 ${columns}`}>
      {entries.map(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return (
            <div key={key} className="col-span-full space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{labelize(key)}</p>
              <ObjectGrid data={value as Record<string, unknown>} columns={columns} />
            </div>
          );
        }
        if (Array.isArray(value)) return null;
        return <Field key={key} label={labelize(key)} value={value as string | number | boolean} />;
      })}
    </div>
  );
}

function RecordList({ items }: { items?: Record<string, unknown>[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <ObjectGrid data={item} columns="grid-cols-2 sm:grid-cols-3" />
        </div>
      ))}
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
  const registration = visibleEntries(extras?.legalRegistration);
  const contact = visibleEntries(extras?.contact);

  return (
    <div className="h-full rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{name}</p>
      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
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
      {registration.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Legal Registration</p>
          <ObjectGrid data={extras?.legalRegistration} columns="grid-cols-2" />
        </div>
      )}
      {contact.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Contact</p>
          <ObjectGrid data={extras?.contact} columns="grid-cols-2" />
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
    <div className="border-t border-gray-100 px-5 pb-6">
      <Section title="Document">
        <div className="grid grid-cols-2 items-start gap-x-8 gap-y-4 md:grid-cols-4">
          <Field label="Document Type" value={formatDocumentType(inv.documentType)} />
          <Field label="Hub Invoice Number" value={inv.invoiceNumber} />
          <Field
            label="Source System DCNote"
            value={inv.sourceSystemDCNoteId || '—'}
          />
          <Field label="Source Document ID" value={inv.sourceDocumentId} />
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
          <div className="grid grid-cols-2 items-start gap-x-8 gap-y-4 rounded-lg border border-amber-100 bg-amber-50 p-4 md:grid-cols-4">
            <Field label="Reason Code" value={creditReasonCode || '—'} />
            <Field
              label="Against credit note ID"
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
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
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
          <div className="space-y-5">
            {src.paymentMeans && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Payment Means</p>
                <ObjectGrid data={src.paymentMeans} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
              </div>
            )}
            {src.paymentTerms && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Payment Terms</p>
                <ObjectGrid data={src.paymentTerms} />
              </div>
            )}
          </div>
        </Section>
      )}

      {(src?.delivery || src?.invoicePeriod || src?.orderReference || src?.precedingInvoiceRef || src?.references) && (
        <Section title="References & Delivery">
          <div className="space-y-5">
            {src.delivery && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Delivery</p>
                <ObjectGrid data={src.delivery} />
              </div>
            )}
            {src.invoicePeriod && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Invoice Period</p>
                <ObjectGrid data={src.invoicePeriod} />
              </div>
            )}
            {src.orderReference && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Order Reference</p>
                <ObjectGrid data={src.orderReference} />
              </div>
            )}
            {src.precedingInvoiceRef && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Preceding Invoice</p>
                <ObjectGrid data={src.precedingInvoiceRef} />
              </div>
            )}
            {src.references && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">References</p>
                <ObjectGrid data={src.references} />
              </div>
            )}
          </div>
        </Section>
      )}

      {(src?.transactionFlags || (src?.allowanceCharges && src.allowanceCharges.length > 0)) && (
        <Section title="Transaction Flags & Allowances">
          <div className="space-y-5">
            {src.transactionFlags && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">Transaction Flags</p>
                <ObjectGrid data={src.transactionFlags} />
              </div>
            )}
            {src.allowanceCharges && src.allowanceCharges.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Document Allowances / Charges
                </p>
                <RecordList items={src.allowanceCharges} />
              </div>
            )}
          </div>
        </Section>
      )}

      {inv.lines.length > 0 && (
        <Section title="Line Items">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                            <div>
                              Period:{' '}
                              {visibleEntries(extra.invoicePeriod)
                                .map(([key, value]) => `${labelize(key)} ${String(value)}`)
                                .join(', ')}
                            </div>
                          )}
                          {extra.allowanceCharges && extra.allowanceCharges.length > 0 && (
                            <div className="mt-1">
                              <RecordList items={extra.allowanceCharges} />
                            </div>
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
          </div>
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    invoiceApi.list().then(setInvoices).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-center py-16">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Invoices</h1>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No invoices yet.
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-white rounded-xl border border-gray-200">
              <button
                onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 text-sm text-left min-w-0 flex-1">
                  <span className="font-medium text-gray-900 truncate">{inv.invoiceNumber}</span>
                  <span className="text-gray-500 truncate">{inv.sellerName}</span>
                  <span className="text-gray-500 truncate">{inv.buyerName}</span>
                  <span className="font-medium text-gray-900 whitespace-nowrap">
                    {inv.currencyCode} {Number(inv.totalAmount).toLocaleString()}
                  </span>
                  <StatusBadge status={inv.status} />
                </div>
                {expandedId === inv.id ? (
                  <ChevronUp size={16} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400 shrink-0" />
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
