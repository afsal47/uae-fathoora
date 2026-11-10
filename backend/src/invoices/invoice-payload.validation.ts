import { BadRequestException } from '@nestjs/common';
import {
  VAT_CATEGORIES,
  type CreateInvoiceDto,
  type VatCategory,
} from './dto/create-invoice.dto';
import {
  CREDIT_NOTE_DOCUMENT_TYPES,
  CREDIT_NOTE_REASON_CODES,
} from './document-type.constants';

/** Source-system aliases normalized to Peppol VAT category IDs. */
const VAT_CATEGORY_ALIASES: Record<string, VatCategory> = {
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
  ZERORATED: 'Z',
  EXEMPT: 'E',
  REVERSE_CHARGE: 'AE',
  REVERSECHARGE: 'AE',
  OUT_OF_SCOPE: 'O',
  OUTOFSCOPE: 'O',
};

/** Categories that require a human-readable exemption reason (IBT-120). */
export const EXEMPTION_REASON_REQUIRED_CATEGORIES: readonly VatCategory[] = [
  'E',
  'O',
  'AE',
  'K',
  'G',
] as const;

export function normalizeVatCategory(raw: string | undefined | null): string {
  return (raw ?? '').toUpperCase().trim();
}

export function resolveVatCategory(raw: string | undefined | null): VatCategory | undefined {
  const key = normalizeVatCategory(raw);
  return VAT_CATEGORY_ALIASES[key];
}

/**
 * Fail early on invalid VAT / reason fields before the invoice is queued.
 * Mutates line.vatCategory to the canonical Peppol code when an alias is used.
 */
export function validateInvoicePayload(dto: CreateInvoiceDto): void {
  for (let i = 0; i < dto.lines.length; i++) {
    const line = dto.lines[i];
    const resolved = resolveVatCategory(line.vatCategory);
    if (!resolved) {
      throw new BadRequestException(
        `lines[${i}].vatCategory "${line.vatCategory}" is invalid. Allowed: ${VAT_CATEGORIES.join(', ')} (aliases: STANDARD, ZERO-RATED, EXEMPT, REVERSE_CHARGE, OUT_OF_SCOPE).`,
      );
    }
    line.vatCategory = resolved;

    const needsExemption = (
      EXEMPTION_REASON_REQUIRED_CATEGORIES as readonly string[]
    ).includes(resolved);
    if (needsExemption && !line.vatExemptionReason?.trim()) {
      throw new BadRequestException(
        `lines[${i}].vatExemptionReason is required when vatCategory is ${resolved}.`,
      );
    }

    if (resolved === 'AE' && !line.rcmNatureCode?.trim()) {
      throw new BadRequestException(
        `lines[${i}].rcmNatureCode is required when vatCategory is AE (BTAE-09).`,
      );
    }
  }

  const isCreditNote = (CREDIT_NOTE_DOCUMENT_TYPES as readonly string[]).includes(
    dto.documentType,
  );
  if (isCreditNote) {
    const reason =
      dto.creditNoteReasonCode?.trim() || dto.reasonCode?.trim() || '';
    if (!reason) {
      throw new BadRequestException(
        'creditNoteReasonCode (or reasonCode) is required for credit note types.',
      );
    }
    // ibr-001-ae: BTAE-03 must be from the official CreditReason code list
    const canonical =
      reason.toUpperCase() === 'VD'
        ? 'VD'
        : (CREDIT_NOTE_REASON_CODES as readonly string[]).find(
            (code) => code.toUpperCase() === reason.toUpperCase(),
          );
    if (!canonical) {
      throw new BadRequestException(
        `creditNoteReasonCode "${reason}" is invalid (ibr-001-ae). Allowed: ${CREDIT_NOTE_REASON_CODES.join(', ')}.`,
      );
    }
    if (dto.creditNoteReasonCode) dto.creditNoteReasonCode = canonical;
    if (dto.reasonCode) dto.reasonCode = canonical;
  }
}
