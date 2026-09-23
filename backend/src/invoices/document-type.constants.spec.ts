import {
  resolveDocumentTypeFromTaxMix,
  isZeroChargedVatCategory,
  omitsTaxPercent,
} from './document-type.constants';
import {
  wrapAspPassthrough,
  parseAspPassthrough,
  mergeSubmissionIntoAspPayload,
} from './asp-payload.storage';

describe('resolveDocumentTypeFromTaxMix', () => {
  it('maps all-O TAX_INVOICE to COMMERCIAL_INVOICE', () => {
    expect(resolveDocumentTypeFromTaxMix('TAX_INVOICE', ['O', 'O'])).toBe(
      'COMMERCIAL_INVOICE',
    );
  });

  it('maps all-E CREDIT_NOTE to COMMERCIAL_CREDIT_NOTE', () => {
    expect(resolveDocumentTypeFromTaxMix('CREDIT_NOTE', ['E'])).toBe(
      'COMMERCIAL_CREDIT_NOTE',
    );
  });

  it('keeps TAX_INVOICE when categories are mixed', () => {
    expect(resolveDocumentTypeFromTaxMix('TAX_INVOICE', ['O', 'S'])).toBe(
      'TAX_INVOICE',
    );
  });

  it('does not alter self-billed types', () => {
    expect(
      resolveDocumentTypeFromTaxMix('SELF_BILLED_TAX_INVOICE', ['O']),
    ).toBe('SELF_BILLED_TAX_INVOICE');
  });

  it('downgrades commercial to tax when not pure E/O', () => {
    expect(resolveDocumentTypeFromTaxMix('COMMERCIAL_INVOICE', ['S'])).toBe(
      'TAX_INVOICE',
    );
  });
});

describe('VAT category helpers', () => {
  it('treats AE/E/O as zero-charged', () => {
    expect(isZeroChargedVatCategory('AE')).toBe(true);
    expect(isZeroChargedVatCategory('E')).toBe(true);
    expect(isZeroChargedVatCategory('S')).toBe(false);
  });

  it('omits percent for E and O only', () => {
    expect(omitsTaxPercent('E')).toBe(true);
    expect(omitsTaxPercent('O')).toBe(true);
    expect(omitsTaxPercent('AE')).toBe(false);
  });
});

describe('asp-payload.storage', () => {
  it('round-trips passthrough in v2 envelope', () => {
    const raw = wrapAspPassthrough({ dueDate: '2026-04-01', profileExecutionId: '00000000' });
    expect(parseAspPassthrough(raw)).toEqual({
      dueDate: '2026-04-01',
      profileExecutionId: '00000000',
    });
  });

  it('preserves passthrough after mergeSubmission', () => {
    const created = wrapAspPassthrough({ creditNoteReasonCode: 'DL8.61.1.A' });
    const merged = mergeSubmissionIntoAspPayload(created, { xml: '<Invoice/>' });
    expect(parseAspPassthrough(merged)).toEqual({
      creditNoteReasonCode: 'DL8.61.1.A',
    });
    const envelope = JSON.parse(merged);
    expect(envelope.lastSubmission.payload).toEqual({ xml: '<Invoice/>' });
  });

  it('reads legacy flat passthrough', () => {
    expect(parseAspPassthrough(JSON.stringify({ dueDate: 'x' }))).toEqual({
      dueDate: 'x',
    });
  });

  it('returns null for legacy ASP overwrite shape', () => {
    expect(
      parseAspPassthrough(JSON.stringify({ json: {}, xml: '<x/>' })),
    ).toBeNull();
  });
});
