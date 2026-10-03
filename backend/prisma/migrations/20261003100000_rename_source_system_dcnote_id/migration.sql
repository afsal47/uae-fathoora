-- RenameColumn
EXEC sp_rename N'[dbo].[invoices].[sourceSystemCreditNoteId]', N'sourceSystemDCNoteId', 'COLUMN';
