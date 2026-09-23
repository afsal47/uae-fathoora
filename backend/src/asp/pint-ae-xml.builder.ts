import { PintAeInvoice, PintAeParty, PintAeAllowanceCharge } from './pint-ae-payload.builder';
import {
  UAE_ENDPOINT_SCHEME,
  buildProfileExecutionId,
  getPeppolProfileIds,
  isCreditNoteDocument,
  omitsTaxPercent,
  resolveDocumentTypeCode,
} from '../invoices/document-type.constants';

const VAT_CATEGORY_CODES: Record<string, string> = {
  S: 'S',
  Z: 'Z',
  E: 'E',
  AE: 'AE',
  O: 'O',
  K: 'K',
  G: 'G',
  L: 'L',
  M: 'M',
  STANDARD: 'S',
  'ZERO-RATED': 'Z',
  ZERO_RATED: 'Z',
  EXEMPT: 'E',
  REVERSE_CHARGE: 'AE',
  OUT_OF_SCOPE: 'O',
};

function esc(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function amt(value: number): string {
  return value.toFixed(2);
}

function vatCat(category: string): string {
  return VAT_CATEGORY_CODES[category.toUpperCase().trim()] ?? 'S';
}

function deriveTin(trn?: string): string {
  if (!trn) return '';
  return trn.replace(/\D/g, '').substring(0, 10);
}

function opt(condition: unknown, xml: string): string {
  return condition ? xml : '';
}

function buildPartyXml(tag: string, party: PintAeParty, role: 'seller' | 'buyer'): string {
  const tin = deriveTin(party.trn);
  const epId = party.endpointId ?? tin;
  const epScheme = party.endpointScheme ?? UAE_ENDPOINT_SCHEME;
  const lr = party.legalRegistration;
  const ct = party.contact;

  const legalRegEntry = lr?.tradeLicense
    ? { scheme: 'TL', id: lr.tradeLicense }
    : lr?.emiratesId
      ? { scheme: 'EID', id: lr.emiratesId }
      : lr?.passport
        ? { scheme: 'PAS', id: lr.passport }
        : lr?.commercialRegistration
          ? { scheme: 'CD', id: lr.commercialRegistration }
          : null;

  const partyLegalEntityCompanyId = legalRegEntry
    ? `<cbc:CompanyID schemeAgencyID="${esc(legalRegEntry.scheme)}"${
        lr?.schemeAgencyName
          ? ` schemeAgencyName="${esc(lr.schemeAgencyName)}"`
          : ''
      }>${esc(legalRegEntry.id)}</cbc:CompanyID>`
    : '';

  const contactXml = ct ? `
      <cac:Contact>
        ${opt(ct.name, `<cbc:Name>${esc(ct.name)}</cbc:Name>`)}
        ${opt(ct.phone, `<cbc:Telephone>${esc(ct.phone)}</cbc:Telephone>`)}
        ${opt(ct.email, `<cbc:ElectronicMail>${esc(ct.email)}</cbc:ElectronicMail>`)}
      </cac:Contact>` : '';

  return `
    <cac:${tag}>
      ${epId ? `<cbc:EndpointID schemeID="${esc(epScheme)}">${esc(epId)}</cbc:EndpointID>` : ''}
      <cac:PartyIdentification>
        <cbc:ID${party.trn ? ' schemeID="TRN"' : ''}>${esc(party.trn ?? party.name)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${esc(party.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        ${opt(party.address.line1, `<cbc:StreetName>${esc(party.address.line1)}</cbc:StreetName>`)}
        ${opt(party.address.line2, `<cbc:AdditionalStreetName>${esc(party.address.line2)}</cbc:AdditionalStreetName>`)}
        ${opt(party.address.line3, `<cac:AddressLine><cbc:Line>${esc(party.address.line3)}</cbc:Line></cac:AddressLine>`)}
        ${opt(party.address.city, `<cbc:CityName>${esc(party.address.city)}</cbc:CityName>`)}
        ${opt(party.address.postalCode, `<cbc:PostalZone>${esc(party.address.postalCode)}</cbc:PostalZone>`)}
        ${opt(party.address.state, `<cbc:CountrySubentity>${esc(party.address.state)}</cbc:CountrySubentity>`)}
        <cac:Country>
          <cbc:IdentificationCode>${esc(party.address.countryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(party.trn ?? '')}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(party.name)}</cbc:RegistrationName>
        ${partyLegalEntityCompanyId}
      </cac:PartyLegalEntity>
      ${contactXml}
    </cac:${tag}>`;
}

function buildAllowanceChargesXml(
  charges: PintAeAllowanceCharge[] | undefined,
  currencyCode: string,
): string {
  if (!charges?.length) return '';
  return charges
    .map(
      (ac) => `
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>${ac.chargeIndicator}</cbc:ChargeIndicator>
    ${opt(ac.reasonCode, `<cbc:AllowanceChargeReasonCode>${esc(ac.reasonCode)}</cbc:AllowanceChargeReasonCode>`)}
    ${opt(ac.reason, `<cbc:AllowanceChargeReason>${esc(ac.reason)}</cbc:AllowanceChargeReason>`)}
    <cbc:Amount currencyID="${currencyCode}">${amt(ac.amount)}</cbc:Amount>
    ${ac.vatCategory ? `<cac:TaxCategory>
      <cbc:ID>${vatCat(ac.vatCategory)}</cbc:ID>
      ${ac.vatRate !== undefined ? `<cbc:Percent>${amt(ac.vatRate)}</cbc:Percent>` : ''}
      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
    </cac:TaxCategory>` : ''}
  </cac:AllowanceCharge>`,
    )
    .join('');
}

function buildPaymentMeansXml(invoice: PintAeInvoice): string {
  const pm = invoice.paymentMeans;
  if (!pm) return '';
  const codeName = pm.name ? ` name="${esc(pm.name)}"` : '';
  return `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode${codeName}>${esc(pm.code)}</cbc:PaymentMeansCode>
    ${opt(pm.note, `<cbc:InstructionNote>${esc(pm.note)}</cbc:InstructionNote>`)}
    ${pm.cardNumber ? `<cac:CardAccount><cbc:PrimaryAccountNumberID>${esc(pm.cardNumber)}</cbc:PrimaryAccountNumberID><cbc:NetworkID>NA</cbc:NetworkID></cac:CardAccount>` : ''}
    ${pm.accountNumber ? `<cac:PayeeFinancialAccount>
      <cbc:ID>${esc(pm.accountNumber)}</cbc:ID>
      ${opt(pm.bankName, `<cbc:Name>${esc(pm.bankName)}</cbc:Name>`)}
      ${pm.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${esc(pm.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ''}
    </cac:PayeeFinancialAccount>` : ''}
  </cac:PaymentMeans>`;
}

function buildDeliveryXml(invoice: PintAeInvoice): string {
  const d = invoice.delivery;
  if (!d) return '';
  return `
  <cac:Delivery>
    ${opt(d.actualDeliveryDate, `<cbc:ActualDeliveryDate>${esc(d.actualDeliveryDate)}</cbc:ActualDeliveryDate>`)}
    ${d.address ? `<cac:DeliveryLocation>
      <cac:Address>
        ${opt(d.address.line1, `<cbc:StreetName>${esc(d.address.line1)}</cbc:StreetName>`)}
        ${opt(d.address.city, `<cbc:CityName>${esc(d.address.city)}</cbc:CityName>`)}
        ${opt(d.address.postalCode, `<cbc:PostalZone>${esc(d.address.postalCode)}</cbc:PostalZone>`)}
        ${d.address.countryCode ? `<cac:Country><cbc:IdentificationCode>${esc(d.address.countryCode)}</cbc:IdentificationCode></cac:Country>` : ''}
      </cac:Address>
    </cac:DeliveryLocation>` : ''}
    ${d.partyName ? `<cac:DeliveryParty><cac:PartyName><cbc:Name>${esc(d.partyName)}</cbc:Name></cac:PartyName></cac:DeliveryParty>` : ''}
  </cac:Delivery>`;
}

function buildInvoicePeriodXml(period: PintAeInvoice['invoicePeriod']): string {
  if (!period) return '';
  return `
  <cac:InvoicePeriod>
    ${opt(period.startDate, `<cbc:StartDate>${esc(period.startDate)}</cbc:StartDate>`)}
    ${opt(period.endDate, `<cbc:EndDate>${esc(period.endDate)}</cbc:EndDate>`)}
    ${opt(period.descriptionCode, `<cbc:DescriptionCode>${esc(period.descriptionCode)}</cbc:DescriptionCode>`)}
  </cac:InvoicePeriod>`;
}

function taxPercentXml(category: string, rate: number): string {
  if (omitsTaxPercent(category)) {
    return '';
  }
  const c = vatCat(category);
  // AE reverse charge shows statutory 5% even when charged tax amount is 0
  const pct = c === 'AE' && rate === 0 ? 5 : rate;
  return `<cbc:Percent>${amt(pct)}</cbc:Percent>`;
}

function buildTaxTotalXml(invoice: PintAeInvoice): string {
  const breakdownXml = invoice.totals.taxBreakdown
    .map(
      (tb) => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${invoice.currencyCode}">${amt(tb.taxableAmount)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${invoice.currencyCode}">${amt(tb.taxAmount)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${vatCat(tb.category)}</cbc:ID>
          ${taxPercentXml(tb.category, tb.rate)}
          ${opt(tb.exemptionReason, `<cbc:TaxExemptionReason>${esc(tb.exemptionReason)}</cbc:TaxExemptionReason>`)}
          ${opt(tb.exemptionReasonCode, `<cbc:TaxExemptionReasonCode>${esc(tb.exemptionReasonCode)}</cbc:TaxExemptionReasonCode>`)}
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`,
    )
    .join('');

  return `
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${invoice.currencyCode}">${amt(invoice.totals.taxAmount)}</cbc:TaxAmount>
    ${breakdownXml}
  </cac:TaxTotal>`;
}

function buildInvoiceLinesXml(invoice: PintAeInvoice, isCreditNote: boolean): string {
  const lineTag = isCreditNote ? 'CreditNoteLine' : 'InvoiceLine';
  const qtyTag = isCreditNote ? 'CreditedQuantity' : 'InvoicedQuantity';

  return invoice.lines
    .map((line) => {
      const lineAllowances = buildAllowanceChargesXml(
        line.allowanceCharges?.map((ac) => ({ ...ac, vatCategory: undefined, vatRate: undefined })),
        invoice.currencyCode,
      );

      const linePeriod = line.invoicePeriod
        ? `<cac:InvoicePeriod>
            ${opt(line.invoicePeriod.startDate, `<cbc:StartDate>${esc(line.invoicePeriod.startDate)}</cbc:StartDate>`)}
            ${opt(line.invoicePeriod.endDate, `<cbc:EndDate>${esc(line.invoicePeriod.endDate)}</cbc:EndDate>`)}
          </cac:InvoicePeriod>`
        : '';

      return `
  <cac:${lineTag}>
    <cbc:ID>${line.lineNumber}</cbc:ID>
    ${opt(line.orderLineReferenceId, `<cac:OrderLineReference><cbc:LineID>${esc(line.orderLineReferenceId)}</cbc:LineID></cac:OrderLineReference>`)}
    ${opt(line.accountingCost, `<cbc:AccountingCost>${esc(line.accountingCost)}</cbc:AccountingCost>`)}
    <cbc:${qtyTag} unitCode="${esc(line.unitCode)}">${line.quantity}</cbc:${qtyTag}>
    <cbc:LineExtensionAmount currencyID="${invoice.currencyCode}">${amt(line.netAmount)}</cbc:LineExtensionAmount>
    ${linePeriod}
    ${lineAllowances}
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${invoice.currencyCode}">${amt(line.taxAmount)}</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${esc(line.itemDescription ?? line.description)}</cbc:Description>
      <cbc:Name>${esc(line.description)}</cbc:Name>
      ${line.classificationId ? `<cac:CommodityClassification>
        <cbc:ItemClassificationCode listID="${esc(line.classificationScheme ?? 'SRV')}">${esc(line.classificationId)}</cbc:ItemClassificationCode>
      </cac:CommodityClassification>` : ''}
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${vatCat(line.vatCategory)}</cbc:ID>
        ${taxPercentXml(line.vatCategory, line.vatRate)}
        ${opt(line.vatExemptionReason, `<cbc:TaxExemptionReason>${esc(line.vatExemptionReason)}</cbc:TaxExemptionReason>`)}
        ${opt(line.vatExemptionReasonCode, `<cbc:TaxExemptionReasonCode>${esc(line.vatExemptionReasonCode)}</cbc:TaxExemptionReasonCode>`)}
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
      ${opt(line.rcmNatureCode, `<cbc:NatureCode>${esc(line.rcmNatureCode)}</cbc:NatureCode>`)}
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${invoice.currencyCode}">${amt(line.unitPrice)}</cbc:PriceAmount>
      <cbc:BaseQuantity unitCode="${esc(line.unitCode)}">1</cbc:BaseQuantity>
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:Amount currencyID="${invoice.currencyCode}">0.00</cbc:Amount>
        <cbc:BaseAmount currencyID="${invoice.currencyCode}">${amt(line.unitPrice)}</cbc:BaseAmount>
      </cac:AllowanceCharge>
    </cac:Price>
    <cac:ItemPriceExtension>
      <cbc:Amount currencyID="${invoice.currencyCode}">${amt(line.netAmount + line.taxAmount)}</cbc:Amount>
    </cac:ItemPriceExtension>
  </cac:${lineTag}>`;
    })
    .join('');
}

function buildTransactionFlagsXml(flags: PintAeInvoice['transactionFlags']): string {
  if (!flags) return '';
  const notes: string[] = [];
  if (flags.freeTradeZone) notes.push('FREE_TRADE_ZONE');
  if (flags.deemedSupply) notes.push('DEEMED_SUPPLY');
  if (flags.marginScheme) notes.push('MARGIN_SCHEME');
  if (flags.summaryInvoice) notes.push('SUMMARY_INVOICE');
  if (flags.continuousSupply) notes.push('CONTINUOUS_SUPPLY');
  if (flags.disclosedAgentBilling) notes.push('DISCLOSED_AGENT_BILLING');
  if (flags.supplyThroughEcommerce) notes.push('SUPPLY_THROUGH_ECOMMERCE');
  if (flags.export || flags.exportOutsideGcc) notes.push('EXPORT');
  if (flags.intraGcc) notes.push('INTRA_GCC');
  return notes.map((n) => `<cbc:Note>${n}</cbc:Note>`).join('\n  ');
}

function buildPrincipalPartyXml(principalTrn?: string): string {
  if (!principalTrn) return '';
  return `
  <cac:SellerSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID>${esc(principalTrn)}</cbc:ID>
      </cac:PartyIdentification>
    </cac:Party>
  </cac:SellerSupplierParty>`;
}

function buildFxXml(invoice: PintAeInvoice): string {
  if (!invoice.exchangeRate || invoice.currencyCode === 'AED') {
    return '';
  }

  const aedTotal =
    invoice.taxInclusiveAmountInAed !== undefined
      ? `
  <cac:AdditionalDocumentReference>
    <cbc:ID>AED</cbc:ID>
    <cbc:DocumentTypeCode>aedtotal-incl-vat</cbc:DocumentTypeCode>
    <cbc:DocumentDescription>${amt(invoice.taxInclusiveAmountInAed)}</cbc:DocumentDescription>
  </cac:AdditionalDocumentReference>`
      : '';

  return `
  <cac:TaxExchangeRate>
    <cbc:SourceCurrencyCode>${esc(invoice.currencyCode)}</cbc:SourceCurrencyCode>
    <cbc:TargetCurrencyCode>${esc(invoice.taxCurrencyCode ?? 'AED')}</cbc:TargetCurrencyCode>
    <cbc:CalculationRate>${invoice.exchangeRate}</cbc:CalculationRate>
  </cac:TaxExchangeRate>${aedTotal}`;
}

function buildCreditNoteReasonXml(reasonCode?: string): string {
  if (!reasonCode) return '';
  return `
  <cac:DiscrepancyResponse>
    <cbc:ResponseCode>${esc(reasonCode)}</cbc:ResponseCode>
  </cac:DiscrepancyResponse>`;
}

export function buildPintAeXml(invoice: PintAeInvoice): string {
  const typeCode = resolveDocumentTypeCode(invoice.documentType);
  const isCreditNote = isCreditNoteDocument(invoice.documentType);
  const rootElement = isCreditNote ? 'CreditNote' : 'Invoice';
  const typeCodeTag = isCreditNote ? 'CreditNoteTypeCode' : 'InvoiceTypeCode';
  const { customizationId, profileId } = getPeppolProfileIds(invoice.documentType);
  const profileExecutionId = buildProfileExecutionId(
    invoice.transactionFlags,
    invoice.profileExecutionId,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement}
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:${rootElement}-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <cbc:CustomizationID>${customizationId}</cbc:CustomizationID>
  <cbc:ProfileID>${profileId}</cbc:ProfileID>
  <cbc:ProfileExecutionID>${profileExecutionId}</cbc:ProfileExecutionID>

  <cbc:ID>${esc(invoice.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${esc(invoice.issueDate)}</cbc:IssueDate>
  ${opt(invoice.taxPointDate, `<cbc:TaxPointDate>${esc(invoice.taxPointDate)}</cbc:TaxPointDate>`)}
  ${opt(invoice.dueDate, `<cbc:DueDate>${esc(invoice.dueDate)}</cbc:DueDate>`)}
  <cbc:${typeCodeTag}>${typeCode}</cbc:${typeCodeTag}>
  ${opt(invoice.notes, `<cbc:Note>${esc(invoice.notes)}</cbc:Note>`)}
  ${buildTransactionFlagsXml(invoice.transactionFlags)}
  <cbc:DocumentCurrencyCode>${esc(invoice.currencyCode)}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${esc(invoice.taxCurrencyCode ?? 'AED')}</cbc:TaxCurrencyCode>
  ${opt(invoice.accountingCost, `<cbc:AccountingCost>${esc(invoice.accountingCost)}</cbc:AccountingCost>`)}

  ${buildInvoicePeriodXml(invoice.invoicePeriod)}

  ${invoice.orderReference?.purchaseOrderId ? `<cac:OrderReference><cbc:ID>${esc(invoice.orderReference.purchaseOrderId)}</cbc:ID>${opt(invoice.orderReference.salesOrderId, `<cbc:SalesOrderID>${esc(invoice.orderReference.salesOrderId)}</cbc:SalesOrderID>`)}</cac:OrderReference>` : ''}

  ${buildCreditNoteReasonXml(invoice.creditNoteReasonCode)}

  ${invoice.precedingInvoiceRef ? `<cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(invoice.precedingInvoiceRef.id)}</cbc:ID>
      ${opt(invoice.precedingInvoiceRef.issueDate, `<cbc:IssueDate>${esc(invoice.precedingInvoiceRef.issueDate)}</cbc:IssueDate>`)}
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ''}

  ${opt(invoice.contractReference, `<cac:ContractDocumentReference><cbc:ID>${esc(invoice.contractReference)}</cbc:ID></cac:ContractDocumentReference>`)}

  ${buildFxXml(invoice)}

  <cac:AccountingSupplierParty>
    ${buildPartyXml('Party', invoice.seller, 'seller')}
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    ${buildPartyXml('Party', invoice.buyer, 'buyer')}
  </cac:AccountingCustomerParty>

  ${buildPrincipalPartyXml(invoice.principalTrn)}

  ${buildDeliveryXml(invoice)}

  ${buildPaymentMeansXml(invoice)}

  ${invoice.paymentTerms?.note ? `<cac:PaymentTerms><cbc:Note>${esc(invoice.paymentTerms.note)}</cbc:Note></cac:PaymentTerms>` : ''}

  ${buildAllowanceChargesXml(invoice.allowanceCharges, invoice.currencyCode)}

  ${buildTaxTotalXml(invoice)}

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${invoice.currencyCode}">${amt(invoice.totals.subtotalAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${invoice.currencyCode}">${amt(invoice.totals.subtotalAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${invoice.currencyCode}">${amt(invoice.totals.totalAmount)}</cbc:TaxInclusiveAmount>
    ${invoice.totals.allowanceTotalAmount !== undefined ? `<cbc:AllowanceTotalAmount currencyID="${invoice.currencyCode}">${amt(invoice.totals.allowanceTotalAmount)}</cbc:AllowanceTotalAmount>` : ''}
    ${invoice.totals.chargeTotalAmount !== undefined ? `<cbc:ChargeTotalAmount currencyID="${invoice.currencyCode}">${amt(invoice.totals.chargeTotalAmount)}</cbc:ChargeTotalAmount>` : ''}
    ${invoice.totals.prepaidAmount !== undefined ? `<cbc:PrepaidAmount currencyID="${invoice.currencyCode}">${amt(invoice.totals.prepaidAmount)}</cbc:PrepaidAmount>` : ''}
    <cbc:PayableAmount currencyID="${invoice.currencyCode}">${amt(invoice.totals.totalAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${buildInvoiceLinesXml(invoice, isCreditNote)}

</${rootElement}>`;
}
