import { AspSubmissionContext } from './asp.types';

export type PintAeParty = {
  name: string;
  trn?: string;
  endpointId?: string;
  endpointScheme?: string;
  address: {
    line1?: string;
    line2?: string;
    line3?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode: string;
  };
  legalRegistration?: {
    tradeLicense?: string;
    emiratesId?: string;
    passport?: string;
    commercialRegistration?: string;
    schemeAgencyName?: string;
  };
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
};

export type PintAeAllowanceCharge = {
  chargeIndicator: boolean;
  reason?: string;
  reasonCode?: string;
  amount: number;
  vatCategory?: string;
  vatRate?: number;
};

export type PintAeLine = {
  lineNumber: number;
  description: string;
  itemDescription?: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  netAmount: number;
  vatCategory: string;
  vatRate: number;
  taxAmount: number;
  totalAmount: number;
  vatExemptionReason?: string;
  vatExemptionReasonCode?: string;
  rcmNatureCode?: string;
  classificationId?: string;
  classificationScheme?: string;
  accountingCost?: string;
  orderLineReferenceId?: string;
  invoicePeriod?: {
    startDate?: string;
    endDate?: string;
    descriptionCode?: string;
  };
  allowanceCharges?: PintAeAllowanceCharge[];
};

export type PintAeTotals = {
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  allowanceTotalAmount?: number;
  chargeTotalAmount?: number;
  prepaidAmount?: number;
  taxBreakdown: {
    category: string;
    rate: number;
    taxableAmount: number;
    taxAmount: number;
    exemptionReason?: string;
    exemptionReasonCode?: string;
  }[];
};

export type PintAeInvoice = {
  documentType: string;
  invoiceNumber: string;
  issueDate: string;
  taxPointDate?: string;
  dueDate?: string;
  currencyCode: string;
  taxCurrencyCode?: string;
  accountingCost?: string;
  contractReference?: string;
  seller: PintAeParty;
  buyer: PintAeParty;
  lines: PintAeLine[];
  totals: PintAeTotals;
  notes?: string;
  paymentMeans?: {
    code: string;
    name?: string;
    note?: string;
    cardNumber?: string;
    accountNumber?: string;
    bankName?: string;
    bic?: string;
  };
  paymentTerms?: {
    note?: string;
  };
  delivery?: {
    actualDeliveryDate?: string;
    address?: {
      line1?: string;
      city?: string;
      postalCode?: string;
      countryCode?: string;
    };
    partyName?: string;
  };
  invoicePeriod?: {
    startDate?: string;
    endDate?: string;
    descriptionCode?: string;
  };
  precedingInvoiceRef?: {
    id: string;
    issueDate?: string;
  };
  creditNoteReasonCode?: string;
  orderReference?: {
    purchaseOrderId?: string;
    salesOrderId?: string;
  };
  allowanceCharges?: PintAeAllowanceCharge[];
  transactionFlags?: {
    freeTradeZone?: boolean;
    deemedSupply?: boolean;
    marginScheme?: boolean;
    summaryInvoice?: boolean;
    continuousSupply?: boolean;
    disclosedAgentBilling?: boolean;
    supplyThroughEcommerce?: boolean;
    export?: boolean;
    exportOutsideGcc?: boolean;
    intraGcc?: boolean;
  };
  profileExecutionId?: string;
  principalTrn?: string;
  exchangeRate?: number;
  taxInclusiveAmountInAed?: number;
  metadata: {
    sourceSystem: string;
    sourceDocumentId: string;
    idempotencyKey: string;
  };
};

/** IBMS sends a raw number such as 0030; Peppol cbc:ID uses inv-0030. */
export function toPeppolInvoiceNumber(invoiceNumber: string): string {
  const trimmed = invoiceNumber.trim();
  if (/^inv-/i.test(trimmed)) {
    return trimmed;
  }
  return `inv-${trimmed}`;
}

export function buildPintAePayload(context: AspSubmissionContext): PintAeInvoice {
  const { invoice } = context;
  const dto = context.createInvoiceDto;

  const taxBreakdownMap = new Map<string, {
    taxableAmount: number; taxAmount: number; rate: number; category: string;
    exemptionReason?: string; exemptionReasonCode?: string;
  }>();

  const lines: PintAeLine[] = invoice.lines.map((line, idx) => {
    const key = `${line.vatCategory}_${Number(line.vatRate)}`;
    const dtoLine = dto?.lines?.[idx];
    const existing = taxBreakdownMap.get(key) ?? {
      category: line.vatCategory,
      rate: Number(line.vatRate),
      taxableAmount: 0,
      taxAmount: 0,
      exemptionReason: undefined as string | undefined,
      exemptionReasonCode: undefined as string | undefined,
    };
    existing.taxableAmount += Number(line.netAmount);
    existing.taxAmount += Number(line.taxAmount);

    if (dtoLine?.vatExemptionReason) {
      existing.exemptionReason = dtoLine.vatExemptionReason;
      existing.exemptionReasonCode = dtoLine.vatExemptionReasonCode;
    }
    taxBreakdownMap.set(key, existing);

    return {
      lineNumber: line.lineNumber,
      description: line.description,
      itemDescription: dtoLine?.itemDescription,
      quantity: Number(line.quantity),
      unitCode: dtoLine?.unitCode ?? 'EA',
      unitPrice: Number(line.unitPrice),
      netAmount: Number(line.netAmount),
      vatCategory: line.vatCategory,
      vatRate: Number(line.vatRate),
      taxAmount: Number(line.taxAmount),
      totalAmount: Number(line.totalAmount),
      vatExemptionReason: dtoLine?.vatExemptionReason,
      vatExemptionReasonCode: dtoLine?.vatExemptionReasonCode,
      rcmNatureCode: dtoLine?.rcmNatureCode,
      classificationId: dtoLine?.classificationId,
      classificationScheme: dtoLine?.classificationScheme,
      accountingCost: dtoLine?.accountingCost,
      orderLineReferenceId: dtoLine?.orderLineReferenceId,
      invoicePeriod: dtoLine?.invoicePeriod,
      allowanceCharges: dtoLine?.allowanceCharges,
    };
  });

  const buildParty = (
    name: string, trn: string | null,
    addr: Record<string, string | null>,
    dtoParty?: NonNullable<typeof dto>['seller'],
  ): PintAeParty => ({
    name,
    trn: trn ?? undefined,
    endpointId: dtoParty?.endpointId,
    endpointScheme: dtoParty?.endpointScheme,
    address: {
      line1: addr.line1 ?? undefined,
      line2: addr.line2 ?? undefined,
      line3: dtoParty?.address?.line3,
      city: addr.city ?? undefined,
      state: addr.state ?? undefined,
      postalCode: addr.postalCode ?? undefined,
      countryCode: addr.countryCode ?? 'AE',
    },
    legalRegistration: dtoParty?.legalRegistration,
    contact: dtoParty?.contact,
  });

  return {
    documentType: invoice.documentType,
    invoiceNumber: toPeppolInvoiceNumber(invoice.invoiceNumber),
    issueDate: invoice.issueDate.toISOString().split('T')[0],
    taxPointDate: dto?.taxPointDate,
    dueDate: dto?.dueDate,
    currencyCode: invoice.currencyCode,
    taxCurrencyCode: dto?.taxCurrencyCode ?? 'AED',
    accountingCost: dto?.accountingCost,
    contractReference: dto?.contractReference,
    seller: buildParty(
      invoice.sellerName, invoice.sellerTrn,
      {
        line1: invoice.sellerAddressLine1, line2: invoice.sellerAddressLine2,
        city: invoice.sellerCity, state: invoice.sellerState,
        postalCode: invoice.sellerPostalCode, countryCode: invoice.sellerCountryCode,
      },
      dto?.seller,
    ),
    buyer: buildParty(
      invoice.buyerName, invoice.buyerTrn,
      {
        line1: invoice.buyerAddressLine1, line2: invoice.buyerAddressLine2,
        city: invoice.buyerCity, state: invoice.buyerState,
        postalCode: invoice.buyerPostalCode, countryCode: invoice.buyerCountryCode,
      },
      dto?.buyer,
    ),
    lines,
    totals: {
      subtotalAmount: Number(invoice.subtotalAmount),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
      taxBreakdown: Array.from(taxBreakdownMap.values()),
    },
    paymentMeans: dto?.paymentMeans,
    paymentTerms: dto?.paymentTerms,
    delivery: dto?.delivery ? {
      actualDeliveryDate: dto.delivery.actualDeliveryDate,
      address: dto.delivery.address ? {
        line1: dto.delivery.address.line1,
        city: dto.delivery.address.city,
        postalCode: dto.delivery.address.postalCode,
        countryCode: dto.delivery.address.countryCode,
      } : undefined,
      partyName: dto.delivery.partyName,
    } : undefined,
    invoicePeriod: dto?.invoicePeriod,
    precedingInvoiceRef: dto?.precedingInvoiceRef,
    creditNoteReasonCode: dto?.creditNoteReasonCode,
    orderReference: dto?.orderReference,
    allowanceCharges: dto?.allowanceCharges,
    transactionFlags: dto?.transactionFlags,
    profileExecutionId: dto?.profileExecutionId,
    principalTrn: dto?.principalTrn,
    exchangeRate: dto?.exchangeRate,
    taxInclusiveAmountInAed: dto?.taxInclusiveAmountInAed,
    notes: invoice.notes ?? undefined,
    metadata: {
      sourceSystem: invoice.sourceSystem,
      sourceDocumentId: invoice.sourceDocumentId,
      idempotencyKey: invoice.idempotencyKey,
    },
  };
}
