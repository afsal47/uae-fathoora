/**
 * UAE Peppol PINT-AE document types and UNCL 1001 type codes.
 * Aligns with Evatra Data Dictionary (Invoice Types / Codes List).
 */

export const DOCUMENT_TYPES = [
  'TAX_INVOICE',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'SELF_BILLED_TAX_INVOICE',
  'SELF_BILLED_CREDIT_NOTE',
  'COMMERCIAL_INVOICE',
  'COMMERCIAL_CREDIT_NOTE',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** UNCL 1001 invoice / credit note type codes */
export const DOCUMENT_TYPE_CODES: Record<DocumentType, string> = {
  TAX_INVOICE: '380',
  CREDIT_NOTE: '381',
  DEBIT_NOTE: '383',
  SELF_BILLED_TAX_INVOICE: '389',
  SELF_BILLED_CREDIT_NOTE: '261',
  COMMERCIAL_INVOICE: '480',
  COMMERCIAL_CREDIT_NOTE: '81',
};

export const CREDIT_NOTE_DOCUMENT_TYPES: readonly DocumentType[] = [
  'CREDIT_NOTE',
  'SELF_BILLED_CREDIT_NOTE',
  'COMMERCIAL_CREDIT_NOTE',
] as const;

export const SELF_BILLED_DOCUMENT_TYPES: readonly DocumentType[] = [
  'SELF_BILLED_TAX_INVOICE',
  'SELF_BILLED_CREDIT_NOTE',
] as const;

export const PRECEDING_REF_REQUIRED_TYPES: readonly DocumentType[] = [
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'SELF_BILLED_CREDIT_NOTE',
  'COMMERCIAL_CREDIT_NOTE',
] as const;

export const BILLING_CUSTOMIZATION_ID = 'urn:peppol:pint:billing-1@ae-1';
export const BILLING_PROFILE_ID = 'urn:peppol:bis:billing';
export const SELFBILLING_CUSTOMIZATION_ID = 'urn:peppol:pint:selfbilling-1@ae-1';
export const SELFBILLING_PROFILE_ID = 'urn:peppol:bis:selfbilling';

/** Default Peppol EAS for UAE Tax Identification Number (TIN) */
export const UAE_ENDPOINT_SCHEME = '0235';

export type TransactionTypeFlags = {
  freeTradeZone?: boolean;
  deemedSupply?: boolean;
  marginScheme?: boolean;
  summaryInvoice?: boolean;
  continuousSupply?: boolean;
  disclosedAgentBilling?: boolean;
  supplyThroughEcommerce?: boolean;
  /** Position 8 — export (also accepts legacy exportOutsideGcc) */
  export?: boolean;
  exportOutsideGcc?: boolean;
  /** Legacy / informational — not part of ProfileExecutionID */
  intraGcc?: boolean;
};

/**
 * Build BTAE-02 ProfileExecutionID (8 positions, 0/1).
 * Positions: FreeZone | Deemed | Margin | Summary | Continuous | Agent | E-Commerce | Export
 */
export function buildProfileExecutionId(
  flags?: TransactionTypeFlags | null,
  explicit?: string | null,
): string {
  if (explicit && /^[01]{8}$/.test(explicit)) {
    return explicit;
  }

  if (!flags) {
    return '00000000';
  }

  return [
    flags.freeTradeZone ? '1' : '0',
    flags.deemedSupply ? '1' : '0',
    flags.marginScheme ? '1' : '0',
    flags.summaryInvoice ? '1' : '0',
    flags.continuousSupply ? '1' : '0',
    flags.disclosedAgentBilling ? '1' : '0',
    flags.supplyThroughEcommerce ? '1' : '0',
    flags.export || flags.exportOutsideGcc ? '1' : '0',
  ].join('');
}

export function isCreditNoteDocument(documentType: string): boolean {
  return (CREDIT_NOTE_DOCUMENT_TYPES as readonly string[]).includes(documentType);
}

export function isSelfBilledDocument(documentType: string): boolean {
  return (SELF_BILLED_DOCUMENT_TYPES as readonly string[]).includes(documentType);
}

export function getPeppolProfileIds(documentType: string): {
  customizationId: string;
  profileId: string;
} {
  if (isSelfBilledDocument(documentType)) {
    return {
      customizationId: SELFBILLING_CUSTOMIZATION_ID,
      profileId: SELFBILLING_PROFILE_ID,
    };
  }
  return {
    customizationId: BILLING_CUSTOMIZATION_ID,
    profileId: BILLING_PROFILE_ID,
  };
}

export function resolveDocumentTypeCode(documentType: string): string {
  return DOCUMENT_TYPE_CODES[documentType as DocumentType] ?? '380';
}

/**
 * Evatra rule: if ALL lines are Exempt (E) or ALL are Outside Scope (O) → commercial (480/81).
 * Mixed VAT categories → standard tax invoice / credit note (380/381).
 * Self-billed and debit notes are left unchanged.
 */
export function resolveDocumentTypeFromTaxMix(
  requested: DocumentType,
  vatCategories: string[],
): DocumentType {
  if (isSelfBilledDocument(requested) || requested === 'DEBIT_NOTE') {
    return requested;
  }

  const unique = [
    ...new Set(vatCategories.map((c) => c.toUpperCase().trim()).filter(Boolean)),
  ];
  const isPureCommercial =
    unique.length === 1 && (unique[0] === 'E' || unique[0] === 'O');

  const isInvoiceFamily =
    requested === 'TAX_INVOICE' || requested === 'COMMERCIAL_INVOICE';
  const isCreditFamily =
    requested === 'CREDIT_NOTE' || requested === 'COMMERCIAL_CREDIT_NOTE';

  if (isInvoiceFamily) {
    return isPureCommercial ? 'COMMERCIAL_INVOICE' : 'TAX_INVOICE';
  }
  if (isCreditFamily) {
    return isPureCommercial ? 'COMMERCIAL_CREDIT_NOTE' : 'CREDIT_NOTE';
  }

  return requested;
}

/** Categories where invoice tax amount must be zero (buyer accounts / no VAT charged). */
export function isZeroChargedVatCategory(category: string): boolean {
  const c = category.toUpperCase().trim();
  return c === 'AE' || c === 'E' || c === 'O';
}

/** Categories that omit &lt;cbc:Percent&gt; in PINT-AE tax blocks. */
export function omitsTaxPercent(category: string): boolean {
  const c = category.toUpperCase().trim();
  return c === 'E' || c === 'O';
}
