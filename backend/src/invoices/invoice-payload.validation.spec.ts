import { BadRequestException } from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  resolveVatCategory,
  validateInvoicePayload,
} from './invoice-payload.validation';

function baseDto(
  overrides: Partial<CreateInvoiceDto> = {},
): CreateInvoiceDto {
  return {
    tenantCode: 'CITY_MARINE',
    sourceSystem: 'IBMS_BROKING',
    idempotencyKey: 'idem-1',
    documentType: 'TAX_INVOICE',
    sourceDocumentId: 'DOC-1',
    issueDate: '2026-08-18',
    seller: { name: 'Seller' },
    buyer: { name: 'Buyer' },
    lines: [
      {
        description: 'Fee',
        quantity: 1,
        unitPrice: 105,
        vatRate: 5,
        vatCategory: 'S',
      },
    ],
    ...overrides,
  } as CreateInvoiceDto;
}

describe('invoice-payload.validation', () => {
  it('resolves VAT category aliases', () => {
    expect(resolveVatCategory('standard')).toBe('S');
    expect(resolveVatCategory('ZERO-RATED')).toBe('Z');
    expect(resolveVatCategory('REVERSE_CHARGE')).toBe('AE');
    expect(resolveVatCategory('bogus')).toBeUndefined();
  });

  it('normalizes alias vatCategory on the line', () => {
    const dto = baseDto({
      lines: [
        {
          description: 'Fee',
          quantity: 1,
          unitPrice: 105,
          vatRate: 5,
          vatCategory: 'STANDARD',
        },
      ],
    });

    validateInvoicePayload(dto);
    expect(dto.lines[0].vatCategory).toBe('S');
  });

  it('rejects unknown vatCategory', () => {
    const dto = baseDto({
      lines: [
        {
          description: 'Fee',
          quantity: 1,
          unitPrice: 100,
          vatRate: 0,
          vatCategory: 'XYZ',
        },
      ],
    });

    expect(() => validateInvoicePayload(dto)).toThrow(BadRequestException);
    expect(() => validateInvoicePayload(dto)).toThrow(/vatCategory/);
  });

  it('requires vatExemptionReason for E/O/AE/K/G', () => {
    const dto = baseDto({
      lines: [
        {
          description: 'Exempt fee',
          quantity: 1,
          unitPrice: 100,
          vatRate: 0,
          vatCategory: 'E',
        },
      ],
    });

    expect(() => validateInvoicePayload(dto)).toThrow(/vatExemptionReason/);
  });

  it('requires rcmNatureCode for AE', () => {
    const dto = baseDto({
      lines: [
        {
          description: 'Imported service',
          quantity: 1,
          unitPrice: 1000,
          vatRate: 5,
          vatCategory: 'AE',
          vatExemptionReason: 'Reverse charge',
        },
      ],
    });

    expect(() => validateInvoicePayload(dto)).toThrow(/rcmNatureCode/);
  });

  it('accepts AE when exemption reason and rcmNatureCode are present', () => {
    const dto = baseDto({
      lines: [
        {
          description: 'Imported service',
          quantity: 1,
          unitPrice: 1000,
          vatRate: 5,
          vatCategory: 'AE',
          vatExemptionReason: 'Reverse charge — buyer accounts for VAT',
          rcmNatureCode: 'DL8.48.8.2',
        },
      ],
    });

    expect(() => validateInvoicePayload(dto)).not.toThrow();
  });

  it('requires credit note reason code for credit note types', () => {
    const dto = baseDto({
      documentType: 'CREDIT_NOTE',
    });

    expect(() => validateInvoicePayload(dto)).toThrow(/creditNoteReasonCode/);
  });

  it('accepts reasonCode alias for credit notes', () => {
    const dto = baseDto({
      documentType: 'CREDIT_NOTE',
      reasonCode: 'DL8.61.1.A',
    });

    expect(() => validateInvoicePayload(dto)).not.toThrow();
  });
});
