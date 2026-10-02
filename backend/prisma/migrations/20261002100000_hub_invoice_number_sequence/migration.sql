-- AlterTable
ALTER TABLE [dbo].[tenants] ADD [invoiceSequence] INT NOT NULL CONSTRAINT [tenants_invoiceSequence_df] DEFAULT 0;

-- AlterTable
ALTER TABLE [dbo].[invoices] ADD [sourceSystemCreditNoteId] NVARCHAR(100) NULL;
