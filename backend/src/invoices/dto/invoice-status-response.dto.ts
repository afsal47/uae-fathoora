import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceStatusEventDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'STATUS_RECONCILED' })
  type: string;

  @ApiPropertyOptional({ example: 'SUBMITTED', nullable: true })
  fromStatus?: string | null;

  @ApiPropertyOptional({ example: 'COMPLETED', nullable: true })
  toStatus?: string | null;

  @ApiPropertyOptional({
    example: 'Polled ASP document status for trackingId …',
    nullable: true,
  })
  message?: string | null;

  @ApiProperty({ example: '2026-11-11T10:22:00.000Z' })
  createdAt: Date;
}

/**
 * Response for source-system status polling (IBMS).
 */
export class InvoiceStatusResponseDto {
  @ApiProperty({
    description: 'Hub numeric invoice id (save this after POST /v1/invoices)',
    example: 50,
  })
  id: number;

  @ApiProperty({
    description: 'Hub-generated Peppol invoice number',
    example: 'inv-50',
  })
  invoiceNumber: string;

  @ApiPropertyOptional({
    description: 'Source-system document id sent at create',
    example: '100245',
    nullable: true,
  })
  sourceDocumentId?: string | null;

  @ApiPropertyOptional({
    description: 'IBMS DCNote / source document number',
    example: '119',
    nullable: true,
  })
  sourceSystemDCNoteId?: string | null;

  @ApiProperty({
    description:
      'Current processing status. Map to IBMS UI: QUEUED/SUBMITTING/SUBMITTED → Processing; ACCEPTED/COMPLETED → Posted; REJECTED/FAILED → Failed; CANCELLED → Cancelled.',
    enum: [
      'DRAFT',
      'QUEUED',
      'SUBMITTING',
      'SUBMITTED',
      'ACCEPTED',
      'COMPLETED',
      'REJECTED',
      'FAILED',
      'CANCELLED',
    ],
    example: 'COMPLETED',
  })
  status: string;

  @ApiProperty({ example: 1 })
  submissionAttempts: number;

  @ApiPropertyOptional({
    description: 'ASP message / Peppol UUID when available',
    example: '03ddcf81-8ece-46f6-a454-00482a8595a3',
    nullable: true,
  })
  aspMessageId?: string | null;

  @ApiPropertyOptional({
    description: 'ASP tracking / reference id — show in IBMS “ASP reference” column',
    example: '03ddcf81-8ece-46f6-a454-00482a8595a3',
    nullable: true,
  })
  aspReferenceId?: string | null;

  @ApiPropertyOptional({
    description: 'Reject / failure reason from ASP or Hub',
    example: null,
    nullable: true,
  })
  rejectionReason?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastSubmissionError?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastSubmissionAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  submittedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  acceptedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  rejectedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Recent status events (newest first)',
    type: [InvoiceStatusEventDto],
  })
  events?: InvoiceStatusEventDto[];
}
