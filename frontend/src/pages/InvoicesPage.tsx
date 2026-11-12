import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import SelectMenu from '../components/SelectMenu';
import StatusBadge from '../components/StatusBadge';
import { invoiceApi, tenantApi, type Invoice, type InvoiceSourcePayload, type Tenant } from '../lib/api';

const PAGE_SIZE = 25;

function trackingIdOf(inv: Invoice) {
  return inv.aspMessageId?.trim() || inv.aspReferenceId?.trim() || '';
}

function apiErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Request failed.';
}

function Field({ label, value }: { label: string; value?: string | number | null | boolean }) {
  if (value === undefined || value === null || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">{label}</p>
      <p className="mt-1 text-sm leading-snug text-[var(--color-ink)] break-words">{display}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-subtle)]">{title}</h3>
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
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">{labelize(key)}</p>
              {value.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-subtle)]">—</p>
              ) : value.every((item) => item && typeof item === 'object' && !Array.isArray(item)) ? (
                <RecordList items={value as Record<string, unknown>[]} showEmpty={showEmpty} />
              ) : (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border border-[var(--color-line-soft)] bg-slate-50 p-3 font-mono text-xs text-[var(--color-ink)]">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          );
        }
        if (value && typeof value === 'object') {
          return (
            <div key={key} className="col-span-full space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">{labelize(key)}</p>
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
        <div key={index} className="border border-[var(--color-line-soft)] bg-slate-50 px-5 py-3">
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
    <div className="h-full border border-[var(--color-line)] bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-subtle)]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{name}</p>
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
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Legal Registration</p>
          <ObjectGrid data={extras?.legalRegistration} columns="grid-cols-2" />
        </div>
      )}
      {contact.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Contact</p>
          <ObjectGrid data={extras?.contact} columns="grid-cols-2" />
        </div>
      )}
      {more && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
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
    return <p className="text-sm text-[var(--color-ink-subtle)]">No ASP response stored for this invoice.</p>;
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
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border border-[var(--color-line-soft)] bg-slate-50 p-3 font-mono text-xs text-[var(--color-ink)]">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    return (
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border border-[var(--color-line-soft)] bg-slate-50 p-3 font-mono text-xs text-[var(--color-ink)]">
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
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!error && xml === null && <p className="text-sm text-[var(--color-ink-subtle)]">Loading XML…</p>}
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
              className="btn btn-secondary btn-sm"
            >
              {copied ? 'Copied' : 'Copy XML'}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
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
    <div className="bg-white">
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
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Rejection Reason</p>
              <p className="mt-1 text-sm text-red-700">{inv.rejectionReason}</p>
            </div>
          )}
          {inv.lastSubmissionError && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">ASP error</p>
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
          <div className="grid grid-cols-2 items-start gap-x-8 gap-y-4 border border-amber-200 bg-amber-50 p-4 md:grid-cols-4">
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
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Payment Means</p>
                <ObjectGrid data={src.paymentMeans} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
              </div>
            )}
            {src.paymentTerms && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Payment Terms</p>
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
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Delivery</p>
                <ObjectGrid data={src.delivery} />
              </div>
            )}
            {src.invoicePeriod && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Invoice Period</p>
                <ObjectGrid data={src.invoicePeriod} />
              </div>
            )}
            {src.orderReference && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Order Reference</p>
                <ObjectGrid data={src.orderReference} />
              </div>
            )}
            {src.precedingInvoiceRef && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Preceding Invoice</p>
                <ObjectGrid data={src.precedingInvoiceRef} />
              </div>
            )}
            {src.references && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">References</p>
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
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">Transaction Flags</p>
                <ObjectGrid data={src.transactionFlags} />
              </div>
            )}
            {src.allowanceCharges && src.allowanceCharges.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">
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
          <div className="overflow-x-auto border border-[var(--color-line)]">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>VAT Cat</th>
                <th className="!text-right">Qty</th>
                <th className="!text-right">Unit Price (excl.)</th>
                <th className="!text-right">VAT %</th>
                <th className="!text-right">Tax</th>
                <th className="!text-right">Total (incl.)</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((line, idx) => {
                const extra = lineExtras[idx];
                const moreLineFields = restFields(extra, SHOWN_LINE_KEYS);
                return (
                  <tr key={line.id}>
                    <td className="align-top !whitespace-normal text-[var(--color-ink-subtle)]">{line.lineNumber}</td>
                    <td className="align-top !whitespace-normal cell-strong">
                      <div>{line.description}</div>
                      {extra && (
                        <div className="mt-1 space-y-0.5 text-[11px] font-normal text-[var(--color-ink-subtle)]">
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
                    <td className="align-top">{line.vatCategory}</td>
                    <td className="cell-right align-top">{Number(line.quantity)}</td>
                    <td className="cell-right align-top">{Number(line.unitPrice).toFixed(2)}</td>
                    <td className="cell-right align-top">{Number(line.vatRate)}%</td>
                    <td className="cell-right align-top">{Number(line.taxAmount).toFixed(2)}</td>
                    <td className="cell-right cell-strong align-top">{Number(line.totalAmount).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-[var(--color-line)] font-medium">
              <tr>
                <td colSpan={6}></td>
                <td className="cell-right px-5 py-2 text-xs text-[var(--color-ink-subtle)]">Subtotal</td>
                <td className="cell-right cell-strong px-5 py-2">
                  {Number(inv.subtotalAmount).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={6}></td>
                <td className="cell-right px-5 py-2 text-xs text-[var(--color-ink-subtle)]">Tax</td>
                <td className="cell-right cell-strong px-5 py-2">
                  {Number(inv.taxAmount).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={6}></td>
                <td className="cell-right px-5 py-2 text-xs font-bold text-[var(--color-ink-muted)]">Total</td>
                <td className="cell-right px-5 py-2 font-bold text-[var(--color-ink)]">
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
              <div key={ev.id} className="flex items-start gap-3 border border-[var(--color-line-soft)] bg-slate-50 px-3 py-2 text-xs">
                <span className="w-36 shrink-0 text-[var(--color-ink-subtle)]">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
                <span className="w-40 shrink-0 font-mono text-[var(--color-ink-muted)]">{ev.type}</span>
                <span className="text-[var(--color-ink)]">{ev.message}</span>
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
  const [loading, setLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [tenantFilter, setTenantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [actionBusy, setActionBusy] = useState<'sync' | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [listError, setListError] = useState('');

  const loadList = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setListRefreshing(true);
    else setLoading(true);
    setListError('');
    try {
      const [invoiceRows, tenantRows] = await Promise.all([invoiceApi.list(), tenantApi.list()]);
      setInvoices(invoiceRows);
      setTenants(tenantRows);
    } catch (error) {
      setListError(apiErrorMessage(error));
    } finally {
      if (mode === 'refresh') setListRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    void loadList('initial');
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tenantFilter]);

  const tenantById = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant])),
    [tenants],
  );

  const filteredInvoices = useMemo(
    () => (tenantFilter ? invoices.filter((inv) => inv.tenantId === tenantFilter) : invoices),
    [invoices, tenantFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredInvoices.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = filteredInvoices.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, filteredInvoices.length);

  const trackingId = viewing ? trackingIdOf(viewing) : '';
  const canSync = Boolean(trackingId);
  const applyUpdatedInvoice = (updated: Invoice) => {
    setInvoices((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
    setViewing((current) => (current?.id === updated.id ? updated : current));
  };

  const openInvoice = (inv: Invoice) => {
    setActionError('');
    setActionBusy(null);
    setViewing(inv);
  };

  const refreshStatus = async (invoice: Invoice, source: 'list' | 'detail') => {
    const id = trackingIdOf(invoice);
    if (!id) {
      const message = 'No ASP tracking ID yet — submit first, then refresh status.';
      if (source === 'list') setListError(message);
      else setActionError(message);
      return;
    }

    if (source === 'list') {
      if (refreshingId !== null || actionBusy) return;
      setRefreshingId(invoice.id);
      setListError('');
    } else {
      if (actionBusy || refreshingId !== null) return;
      setActionBusy('sync');
      setActionError('');
    }

    try {
      const updated = await invoiceApi.syncStatus(invoice.id);
      applyUpdatedInvoice(updated);
    } catch (error) {
      const message = apiErrorMessage(error);
      if (source === 'list') setListError(message);
      else setActionError(message);
    } finally {
      if (source === 'list') setRefreshingId(null);
      else setActionBusy(null);
    }
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div className="page page-fill">
      <header className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Submission status, ASP responses, and document detail.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={listRefreshing || refreshingId !== null || actionBusy !== null}
          onClick={() => void loadList('refresh')}
          title="Reload invoice list"
        >
          <RefreshCw size={16} className={listRefreshing ? 'animate-spin' : undefined} />
          {listRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="panel panel-fill">
        <div className="panel-toolbar">
          <div className="field w-full max-w-sm">
            <label htmlFor="invoice-tenant-filter" className="field-label">
              Tenant
            </label>
            <SelectMenu
              id="invoice-tenant-filter"
              value={tenantFilter}
              onChange={setTenantFilter}
              placeholder="All tenants"
              options={[
                { value: '', label: 'All tenants' },
                ...tenants.map((tenant) => ({
                  value: tenant.id,
                  label: tenant.code,
                  description: tenant.name,
                })),
              ]}
            />
          </div>
          <p className="text-xs text-[var(--color-ink-subtle)]">
            {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? '' : 's'}
            {tenantFilter ? ' for selected tenant' : ''}
          </p>
        </div>

        {listError && (
          <pre className="mx-5 mt-4 shrink-0 border border-red-200 bg-red-50 px-4 py-3 whitespace-pre-wrap break-words font-sans text-sm text-red-700">
            {listError}
          </pre>
        )}

        {filteredInvoices.length === 0 ? (
          <div className="panel-empty">
            {invoices.length === 0
              ? 'No invoices yet.'
              : 'No invoices for the selected tenant.'}
          </div>
        ) : (
          <>
            <div className="data-table-viewport">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Invoice #</th>
                    <th>Seller</th>
                    <th>Buyer</th>
                    <th className="!text-right">Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((inv) => {
                    const canRefresh = Boolean(trackingIdOf(inv));
                    const isRowBusy = refreshingId === inv.id;
                    return (
                      <tr key={inv.id}>
                        <td className="cell-mono">{tenantById.get(inv.tenantId)?.code ?? '—'}</td>
                        <td className="cell-strong">{inv.invoiceNumber}</td>
                        <td className="max-w-[220px] !whitespace-normal">{inv.sellerName}</td>
                        <td className="max-w-[220px] !whitespace-normal">{inv.buyerName}</td>
                        <td className="cell-right cell-strong tabular-nums">
                          {inv.currencyCode} {Number(inv.totalAmount).toLocaleString()}
                        </td>
                        <td>
                          <StatusBadge status={inv.status} />
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openInvoice(inv)}
                              className="btn-link"
                              title="View invoice"
                            >
                              <Eye size={14} /> View
                            </button>
                            <button
                              type="button"
                              onClick={() => void refreshStatus(inv, 'list')}
                              className="btn-link"
                              disabled={!canRefresh || isRowBusy || actionBusy !== null}
                              title={
                                canRefresh
                                  ? 'Refresh status from this company ASP'
                                  : 'Refresh needs an ASP tracking ID'
                              }
                            >
                              <RefreshCw size={14} />
                              {isRowBusy ? 'Working…' : 'Refresh'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="panel-footer">
              <p>
                Showing {rangeStart}–{rangeEnd} of {filteredInvoices.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="tabular-nums text-xs text-[var(--color-ink-subtle)]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={viewing !== null}
        title={viewing ? `Invoice ${viewing.invoiceNumber}` : 'Invoice'}
        description={
          viewing
            ? `${tenantById.get(viewing.tenantId)?.code ?? '—'} · ${viewing.sellerName} → ${viewing.buyerName}`
            : undefined
        }
        onClose={() => {
          if (actionBusy) return;
          setViewing(null);
          setActionError('');
        }}
        size="xl"
      >
        {viewing && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!canSync || actionBusy !== null || refreshingId !== null}
                onClick={() => void refreshStatus(viewing, 'detail')}
                title={
                  canSync
                    ? `Refresh status from ASP for trackingId ${trackingId}`
                    : 'Refresh needs an ASP trackingId from a prior submit'
                }
              >
                <RefreshCw size={14} />
                {actionBusy === 'sync' ? 'Refreshing…' : 'Refresh status'}
              </button>
              {trackingId ? (
                <span className="text-xs text-[var(--color-ink-subtle)]">
                  Tracking ID: <span className="font-mono text-[var(--color-ink)]">{trackingId}</span>
                </span>
              ) : (
                <span className="text-xs text-[var(--color-ink-subtle)]">
                  No ASP tracking ID yet — submit first, then refresh status.
                </span>
              )}
            </div>
            {actionError && (
              <pre className="mb-4 border border-red-200 bg-red-50 px-4 py-3 whitespace-pre-wrap break-words font-sans text-sm text-red-700">
                {actionError}
              </pre>
            )}
            {viewing.lastSubmissionError && (
              <pre className="mb-4 border border-red-200 bg-red-50 px-4 py-3 whitespace-pre-wrap break-words font-sans text-sm text-red-700">
                {viewing.lastSubmissionError}
              </pre>
            )}
            <InvoiceDetails inv={viewing} />
          </div>
        )}
      </Modal>
    </div>
  );
}
