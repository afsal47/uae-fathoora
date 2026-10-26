import { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { invoiceApi, tenantApi, type Invoice, type InvoiceSourcePayload, type Tenant } from '../lib/api';

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

function visibleEntries(data?: Record<string, unknown> | null, showEmpty = false) {
  if (!data) return [];
  return Object.entries(data).filter(([, value]) => {
    if (showEmpty) return value !== undefined;
    return value !== undefined && value !== null && value !== '';
  });
}

function ObjectGrid({
  data,
  columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  showEmpty = false,
}: {
  data?: Record<string, unknown> | null;
  columns?: string;
  showEmpty?: boolean;
}) {
  const entries = visibleEntries(data, showEmpty);
  if (entries.length === 0) return null;

  return (
    <div className={`grid items-start gap-x-8 gap-y-4 ${columns}`}>
      {entries.map(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            <div key={key} className="col-span-full space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{labelize(key)}</p>
              {value.length === 0 ? (
                <p className="text-sm text-gray-400">—</p>
              ) : value.every((item) => item && typeof item === 'object' && !Array.isArray(item)) ? (
                <RecordList items={value as Record<string, unknown>[]} showEmpty={showEmpty} />
              ) : (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-800">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          );
        }
        if (value && typeof value === 'object') {
          return (
            <div key={key} className="col-span-full space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{labelize(key)}</p>
              <ObjectGrid data={value as Record<string, unknown>} columns={columns} showEmpty={showEmpty} />
            </div>
          );
        }
        if (showEmpty && (value === null || value === '')) {
          return <Field key={key} label={labelize(key)} value="—" />;
        }
        return <Field key={key} label={labelize(key)} value={value as string | number | boolean} />;
      })}
    </div>
  );
}

function RecordList({
  items,
  showEmpty = false,
}: {
  items?: Record<string, unknown>[] | null;
  showEmpty?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <ObjectGrid data={item} columns="grid-cols-2 sm:grid-cols-3" showEmpty={showEmpty} />
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
  const more = restFields(extras, SHOWN_PARTY_KEYS);

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
      {more && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <ObjectGrid data={more} columns="grid-cols-2" />
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

function formatWhen(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const SHOWN_SOURCE_KEYS = new Set([
  'taxPointDate',
  'dueDate',
  'taxCurrencyCode',
  'accountingCost',
  'contractReference',
  'principalTrn',
  'profileExecutionId',
  'exchangeRate',
  'taxInclusiveAmountInAed',
  'creditNoteReasonCode',
  'reasonCode',
  'againstCreditNoteId',
  'againstDCNoteId',
  'precedingInvoiceRef',
  'seller',
  'buyer',
  'paymentMeans',
  'paymentTerms',
  'delivery',
  'invoicePeriod',
  'orderReference',
  'references',
  'transactionFlags',
  'allowanceCharges',
  'lines',
  'sourceSystemDCNoteId',
]);

function additionalSourceFields(src: InvoiceSourcePayload | null) {
  if (!src) return null;
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (!SHOWN_SOURCE_KEYS.has(key)) extra[key] = value;
  }
  return visibleEntries(extra).length > 0 ? extra : null;
}

function restFields(data: Record<string, unknown> | null | undefined, shown: Set<string>) {
  if (!data) return null;
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!shown.has(key)) extra[key] = value;
  }
  return visibleEntries(extra).length > 0 ? extra : null;
}

const SHOWN_PARTY_KEYS = new Set([
  'endpointId',
  'endpointScheme',
  'legalRegistration',
  'contact',
  'addressLine3',
]);

const SHOWN_LINE_KEYS = new Set([
  'itemDescription',
  'unitCode',
  'vatExemptionReason',
  'vatExemptionReasonCode',
  'rcmNatureCode',
  'classificationId',
  'classificationScheme',
  'accountingCost',
  'orderLineReferenceId',
  'invoicePeriod',
  'allowanceCharges',
]);

function AspResponseFields({ raw }: { raw?: string | null }) {
  if (!raw) {
    return <p className="text-sm text-gray-400">No ASP response stored for this invoice.</p>;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return (
        <ObjectGrid
          data={parsed as Record<string, unknown>}
          columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          showEmpty
        />
      );
    }
    return (
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-800">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    return (
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-800">
        {raw}
      </pre>
    );
  }
}

function InvoiceXml({ invoiceId }: { invoiceId: number }) {
  const [xml, setXml] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setXml(null);
    setError('');
    invoiceApi
      .xml(invoiceId)
      .then((body) => {
        if (!cancelled) setXml(typeof body === 'string' ? body : String(body));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the Peppol XML for this invoice.');
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  return (
    <Section title="Peppol XML">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && xml === null && <p className="text-sm text-gray-400">Loading XML…</p>}
      {xml && (
        <div>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(xml).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {copied ? 'Copied' : 'Copy XML'}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre rounded-lg bg-gray-950 p-4 font-mono text-xs leading-relaxed text-gray-100">
            {xml}
          </pre>
        </div>
      )}
    </Section>
  );
}

function InvoiceDetails({ inv }: { inv: Invoice }) {
  const src = inv.sourcePayload ?? null;
  const extraSource = additionalSourceFields(src);
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
          <Field label="Idempotency Key" value={inv.idempotencyKey} />
          <Field label="Created" value={formatWhen(inv.createdAt)} />
          <Field label="Updated" value={formatWhen(inv.updatedAt)} />
          <Field label="Last Submission" value={formatWhen(inv.lastSubmissionAt)} />
          <Field label="Submitted" value={formatWhen(inv.submittedAt)} />
          <Field label="Accepted" value={formatWhen(inv.acceptedAt)} />
          <Field label="Rejected" value={formatWhen(inv.rejectedAt)} />
          <Field label="Cancelled" value={formatWhen(inv.cancelledAt)} />
          <Field label="ASP Message ID" value={inv.aspMessageId || '—'} />
          <Field label="ASP Reference ID" value={inv.aspReferenceId || '—'} />
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
            <div className="col-span-2 md:col-span-4">
              <p className="text-gray-400 text-xs">ASP error</p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-red-700">
                {inv.lastSubmissionError}
              </pre>
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
                const moreLineFields = restFields(extra, SHOWN_LINE_KEYS);
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
                          {moreLineFields && (
                            <div className="mt-2">
                              <ObjectGrid data={moreLineFields} columns="grid-cols-2" />
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

      {extraSource && (
        <Section title="Source fields">
          <ObjectGrid data={extraSource} showEmpty />
        </Section>
      )}

      <Section title="ASP response">
        <AspResponseFields raw={inv.aspResponse} />
      </Section>

      <InvoiceXml invoiceId={inv.id} />

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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [requeueId, setRequeueId] = useState<number | null>(null);
  const [requeueError, setRequeueError] = useState('');

  const load = () =>
    Promise.all([invoiceApi.list(), tenantApi.list()]).then(([invoiceRows, tenantRows]) => {
      setInvoices(invoiceRows);
      setTenants(tenantRows);
    });

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const requeue = async (id: number) => {
    setRequeueError('');
    setRequeueId(id);
    try {
      await invoiceApi.requeue(id);
      setExpandedId(id);
      await load();
    } catch (err) {
      let message = 'Requeue failed.';
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string | string[] } | undefined;
        if (Array.isArray(data?.message)) message = data.message.join(', ');
        else if (typeof data?.message === 'string') message = data.message;
        else message = err.message;
      }
      setRequeueError(message);
    } finally {
      setRequeueId(null);
    }
  };

  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const visible = tenantId ? invoices.filter((inv) => inv.tenantId === tenantId) : invoices;

  if (loading) return <div className="text-gray-400 text-center py-16">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>

      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <label htmlFor="invoice-tenant" className="block text-sm font-medium text-gray-700 mb-1.5">
          Tenant code
        </label>
        <div className="relative w-full max-w-2xl">
          <select
            id="invoice-tenant"
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              setExpandedId(null);
            }}
            className="w-full appearance-none border border-gray-300 rounded-lg pl-3 pr-10 py-2.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">All tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.code} — {tenant.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        </div>
      </div>

      {requeueError && (
        <p className="text-sm text-red-600">{requeueError}</p>
      )}

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          {tenantId ? 'No invoices for this tenant code.' : 'No invoices yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((inv) => (
            <div key={inv.id} className="bg-white rounded-xl border border-gray-200">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedId(expandedId === inv.id ? null : inv.id);
                  }
                }}
                className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
              >
                <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 text-sm text-left min-w-0 flex-1">
                  <span className="font-mono text-xs text-gray-500 whitespace-nowrap">
                    {tenantById.get(inv.tenantId)?.code ?? '—'}
                  </span>
                  <span className="font-medium text-gray-900 truncate">{inv.invoiceNumber}</span>
                  <span className="text-gray-500 truncate">{inv.sellerName}</span>
                  <span className="text-gray-500 truncate">{inv.buyerName}</span>
                  <span className="font-medium text-gray-900 whitespace-nowrap">
                    {inv.currencyCode} {Number(inv.totalAmount).toLocaleString()}
                  </span>
                  <StatusBadge status={inv.status} />
                </div>
                {inv.status === 'FAILED' && (
                  <button
                    type="button"
                    disabled={requeueId === inv.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void requeue(inv.id);
                    }}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {requeueId === inv.id ? 'Requeueing…' : 'Requeue'}
                  </button>
                )}
                {expandedId === inv.id ? (
                  <ChevronUp size={16} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400 shrink-0" />
                )}
              </div>

              {inv.lastSubmissionError && expandedId !== inv.id && (
                <pre className="border-t border-red-100 bg-red-50 px-5 py-3 whitespace-pre-wrap break-words font-sans text-sm text-red-700">
                  {inv.lastSubmissionError}
                </pre>
              )}

              {expandedId === inv.id && <InvoiceDetails inv={inv} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
