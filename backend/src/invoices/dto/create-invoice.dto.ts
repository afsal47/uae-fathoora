import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DOCUMENT_TYPES,
  type DocumentType,
} from '../document-type.constants';

export { DOCUMENT_TYPES, type DocumentType };

export const VAT_CATEGORIES = [
  'S',   // Standard rate
  'Z',   // Zero-rated
  'E',   // Exempt
  'AE',  // Reverse charge
  'O',   // Out of scope (services outside UAE VAT)
  'K',   // Intra-GCC supply
  'G',   // Export outside GCC
  'L',   // Canary Islands
  'M',   // Ceuta and Melilla
] as const;

export type VatCategory = (typeof VAT_CATEGORIES)[number];

// --- Sub-DTOs for pass-through FTA fields (not stored in Hub DB) ---

class PartyAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line3?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  postalCode?: string;

  @ApiPropertyOptional({ default: 'AE' })
  @IsOptional()
  @IsString()
  countryCode?: string;
}

class LegalRegistrationDto {
  @ApiPropertyOptional({ description: 'Trade License number (BT-30, scheme TL)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tradeLicense?: string;

  @ApiPropertyOptional({ description: 'Emirates ID (scheme EID)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emiratesId?: string;

  @ApiPropertyOptional({ description: 'Passport number (scheme PAS)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  passport?: string;

  @ApiPropertyOptional({ description: 'Commercial registration / Cabinet Decision (scheme CD)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  commercialRegistration?: string;

  @ApiPropertyOptional({
    description:
      'BTAE-12 — issuing authority name (e.g. Department of Economic Development). Required with legal registration ID.',
    example: 'Department of Economic Development',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schemeAgencyName?: string;
}

class ContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;
}

class PartyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  trn?: string;

  @ApiPropertyOptional({ description: 'Peppol endpoint ID (defaults to first 10 digits of TRN)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  endpointId?: string;

  @ApiPropertyOptional({
    description: 'Peppol endpoint scheme (defaults to 0235 — UAE TIN)',
    default: '0235',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  endpointScheme?: string;

  @ApiPropertyOptional({ type: PartyAddressDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PartyAddressDto)
  address?: PartyAddressDto;

  @ApiPropertyOptional({ type: LegalRegistrationDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LegalRegistrationDto)
  legalRegistration?: LegalRegistrationDto;

  @ApiPropertyOptional({ type: ContactDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;
}

class AllowanceChargeDto {
  @ApiProperty({ description: 'true = charge, false = allowance (discount)' })
  @Type(() => Boolean)
  chargeIndicator!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  reasonCode?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vatCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  vatRate?: number;
}

class PaymentMeansDto {
  @ApiProperty({ description: 'UNCL 4461 code: 10=cash, 30=credit transfer, 42=bank account, 48=bank card, 49=direct debit, 57=standing agreement, 58=SEPA', example: '30' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  code!: string;

  @ApiPropertyOptional({
    description: 'IBG-16 / PaymentMeansCode @name (e.g. Credit transfer)',
    example: 'Credit transfer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @ApiPropertyOptional({ description: 'Payment card last 4 digits' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cardNumber?: string;

  @ApiPropertyOptional({ description: 'IBAN or bank account number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountNumber?: string;

  @ApiPropertyOptional({ description: 'Bank name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankName?: string;

  @ApiPropertyOptional({ description: 'BIC/SWIFT code' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  bic?: string;
}

class PaymentTermsDto {
  @ApiPropertyOptional({ example: 'Net 30 days' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class DeliveryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualDeliveryDate?: string;

  @ApiPropertyOptional({ type: PartyAddressDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PartyAddressDto)
  address?: PartyAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  partyName?: string;
}

class InvoicePeriodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'UNCL 2005 code for tax point date: 3=invoice date, 35=delivery date, 432=paid date' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  descriptionCode?: string;
}

class PrecedingInvoiceRefDto {
  @ApiProperty({ description: 'Original invoice number being credited/debited' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;
}

class OrderReferenceDto {
  @ApiPropertyOptional({ description: 'Purchase order reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  purchaseOrderId?: string;

  @ApiPropertyOptional({ description: 'Sales order reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  salesOrderId?: string;
}

class LineAllowanceChargeDto {
  @ApiProperty()
  @Type(() => Boolean)
  chargeIndicator!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}

class InvoiceLineDto {
  @ApiProperty({
    description: 'Item name (BT-153). Also used as Description (IBT-154) when itemDescription is omitted.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({
    description: 'Item description (IBT-154). Defaults to description when omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  itemDescription?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional({ description: 'UN/ECE Rec 20 unit code', default: 'EA' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  unitCode?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vatRate!: number;

  @ApiProperty({ example: 'S', enum: VAT_CATEGORIES })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vatCategory!: string;

  @ApiPropertyOptional({ description: 'VAT exemption reason (required when vatCategory is E, O, AE, K, G)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  vatExemptionReason?: string;

  @ApiPropertyOptional({ description: 'VAT exemption reason code (e.g. DL8.46.1)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vatExemptionReasonCode?: string;

  @ApiPropertyOptional({
    description:
      'RCM nature of goods/services code (BTAE-09), e.g. DL8.48.8.2 — recommended when vatCategory is AE',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rcmNatureCode?: string;

  @ApiPropertyOptional({ description: 'Item classification code (e.g. commodity code)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  classificationId?: string;

  @ApiPropertyOptional({ description: 'Scheme for classificationId (e.g. SRV for services)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  classificationScheme?: string;

  @ApiPropertyOptional({ description: 'Buyer accounting reference for this line' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountingCost?: string;

  @ApiPropertyOptional({ description: 'Line-level order reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  orderLineReferenceId?: string;

  @ApiPropertyOptional({ type: InvoicePeriodDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InvoicePeriodDto)
  invoicePeriod?: InvoicePeriodDto;

  @ApiPropertyOptional({ type: [LineAllowanceChargeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineAllowanceChargeDto)
  allowanceCharges?: LineAllowanceChargeDto[];
}

class InvoiceReferenceDto {
  @ApiProperty({ example: 'POL-8891' })
  @IsString()
  @IsNotEmpty()
  policyNo!: string;
}

class TransactionFlagsDto {
  @ApiPropertyOptional({ description: 'Position 1 — Free trade zone' })
  @IsOptional()
  @Type(() => Boolean)
  freeTradeZone?: boolean;

  @ApiPropertyOptional({ description: 'Position 2 — Deemed supply' })
  @IsOptional()
  @Type(() => Boolean)
  deemedSupply?: boolean;

  @ApiPropertyOptional({ description: 'Position 3 — Profit margin scheme' })
  @IsOptional()
  @Type(() => Boolean)
  marginScheme?: boolean;

  @ApiPropertyOptional({ description: 'Position 4 — Summary invoice' })
  @IsOptional()
  @Type(() => Boolean)
  summaryInvoice?: boolean;

  @ApiPropertyOptional({ description: 'Position 5 — Continuous supply' })
  @IsOptional()
  @Type(() => Boolean)
  continuousSupply?: boolean;

  @ApiPropertyOptional({ description: 'Position 6 — Disclosed agent billing' })
  @IsOptional()
  @Type(() => Boolean)
  disclosedAgentBilling?: boolean;

  @ApiPropertyOptional({ description: 'Position 7 — Supply through e-commerce' })
  @IsOptional()
  @Type(() => Boolean)
  supplyThroughEcommerce?: boolean;

  @ApiPropertyOptional({ description: 'Position 8 — Export' })
  @IsOptional()
  @Type(() => Boolean)
  export?: boolean;

  @ApiPropertyOptional({ description: 'Legacy alias for export (position 8)' })
  @IsOptional()
  @Type(() => Boolean)
  exportOutsideGcc?: boolean;

  @ApiPropertyOptional({ description: 'Informational — Intra-GCC (not a ProfileExecutionID bit)' })
  @IsOptional()
  @Type(() => Boolean)
  intraGcc?: boolean;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'CITY_MARINE' })
  @IsString()
  @IsNotEmpty()
  tenantCode!: string;

  @ApiProperty({ example: 'IBMS_BROKING' })
  @IsString()
  @IsNotEmpty()
  sourceSystem!: string;

  @ApiProperty({ example: 'BROKING-COMM-100245' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiProperty({ enum: DOCUMENT_TYPES })
  @IsEnum(DOCUMENT_TYPES)
  documentType!: DocumentType;

  @ApiProperty({ example: 'INV-100245' })
  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @ApiProperty({ example: '100245' })
  @IsString()
  @IsNotEmpty()
  sourceDocumentId!: string;

  @ApiProperty()
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ description: 'Tax point date (defaults to issueDate)' })
  @IsOptional()
  @IsDateString()
  taxPointDate?: string;

  @ApiPropertyOptional({ description: 'Due date for payment' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ default: 'AED' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @ApiPropertyOptional({ description: 'Tax reporting currency (defaults to AED)' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/)
  taxCurrencyCode?: string;

  @ApiPropertyOptional({ description: 'Buyer accounting reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  accountingCost?: string;

  @ApiPropertyOptional({ description: 'Contract or project reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractReference?: string;

  @ApiProperty({ type: PartyDto })
  @ValidateNested()
  @Type(() => PartyDto)
  seller!: PartyDto;

  @ApiProperty({ type: PartyDto })
  @ValidateNested()
  @Type(() => PartyDto)
  buyer!: PartyDto;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  // --- Pass-through fields for XML (not stored in Hub DB) ---

  @ApiPropertyOptional({ type: PaymentMeansDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentMeansDto)
  paymentMeans?: PaymentMeansDto;

  @ApiPropertyOptional({ type: PaymentTermsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentTermsDto)
  paymentTerms?: PaymentTermsDto;

  @ApiPropertyOptional({ type: DeliveryDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery?: DeliveryDto;

  @ApiPropertyOptional({ type: InvoicePeriodDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InvoicePeriodDto)
  invoicePeriod?: InvoicePeriodDto;

  @ApiPropertyOptional({
    type: PrecedingInvoiceRefDto,
    description: 'Required for credit/debit notes — references the original invoice',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PrecedingInvoiceRefDto)
  precedingInvoiceRef?: PrecedingInvoiceRefDto;

  @ApiPropertyOptional({
    description:
      'Credit note reason code (BTAE-03), e.g. DL8.61.1.A — required for credit note types',
    example: 'DL8.61.1.A',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  creditNoteReasonCode?: string;

  @ApiPropertyOptional({ type: OrderReferenceDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrderReferenceDto)
  orderReference?: OrderReferenceDto;

  @ApiPropertyOptional({ type: [AllowanceChargeDto], description: 'Document-level allowances/charges' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceChargeDto)
  allowanceCharges?: AllowanceChargeDto[];

  @ApiPropertyOptional({
    type: TransactionFlagsDto,
    description: 'UAE transaction type flags used to build ProfileExecutionID (BTAE-02)',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TransactionFlagsDto)
  transactionFlags?: TransactionFlagsDto;

  @ApiPropertyOptional({
    description:
      'Explicit 8-character ProfileExecutionID (0/1). Overrides transactionFlags when provided.',
    example: '00000100',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[01]{8}$/)
  profileExecutionId?: string;

  @ApiPropertyOptional({
    description:
      'Principal taxpayer TRN (BTAE-14) — required when disclosed agent billing is used',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  principalTrn?: string;

  @ApiPropertyOptional({
    description:
      'UAE Central Bank exchange rate (invoice currency → AED). Required when currencyCode is not AED.',
    example: 3.6725,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({
    description:
      'Document tax-inclusive total in AED (aedtotal-incl-vat). Required when currencyCode is not AED.',
    example: 1928.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxInclusiveAmountInAed?: number;

  @ApiPropertyOptional({ type: InvoiceReferenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceReferenceDto)
  references?: InvoiceReferenceDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
