-- Convert invoices.id from NVARCHAR UUID to INT IDENTITY (numeric hub id).
-- Each ALTER/UPDATE is in its own dynamic batch for SQL Server.

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'invoice_lines_invoiceId_fkey')
  ALTER TABLE [dbo].[invoice_lines] DROP CONSTRAINT [invoice_lines_invoiceId_fkey];

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'invoice_events_invoiceId_fkey')
  ALTER TABLE [dbo].[invoice_events] DROP CONSTRAINT [invoice_events_invoiceId_fkey];

IF COL_LENGTH('dbo.invoices', 'newId') IS NULL
  ALTER TABLE [dbo].[invoices] ADD [newId] INT IDENTITY(1,1) NOT NULL;

EXEC(N'IF COL_LENGTH(''dbo.invoice_lines'', ''newInvoiceId'') IS NULL ALTER TABLE [dbo].[invoice_lines] ADD [newInvoiceId] INT NULL;');
EXEC(N'UPDATE l SET l.[newInvoiceId] = i.[newId] FROM [dbo].[invoice_lines] l INNER JOIN [dbo].[invoices] i ON i.[id] = l.[invoiceId];');

EXEC(N'IF COL_LENGTH(''dbo.invoice_events'', ''newInvoiceId'') IS NULL ALTER TABLE [dbo].[invoice_events] ADD [newInvoiceId] INT NULL;');
EXEC(N'UPDATE e SET e.[newInvoiceId] = i.[newId] FROM [dbo].[invoice_events] e INNER JOIN [dbo].[invoices] i ON i.[id] = e.[invoiceId];');

EXEC(N'IF COL_LENGTH(''dbo.webhook_deliveries'', ''newInvoiceId'') IS NULL ALTER TABLE [dbo].[webhook_deliveries] ADD [newInvoiceId] INT NULL;');
EXEC(N'UPDATE w SET w.[newInvoiceId] = i.[newId] FROM [dbo].[webhook_deliveries] w INNER JOIN [dbo].[invoices] i ON i.[id] = w.[invoiceId];');
EXEC(N'DELETE FROM [dbo].[webhook_deliveries] WHERE [newInvoiceId] IS NULL;');

EXEC(N'
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = ''invoice_lines_invoiceId_lineNumber_key'' AND parent_object_id = OBJECT_ID(''dbo.invoice_lines''))
  ALTER TABLE [dbo].[invoice_lines] DROP CONSTRAINT [invoice_lines_invoiceId_lineNumber_key];
IF COL_LENGTH(''dbo.invoice_lines'', ''invoiceId'') IS NOT NULL AND COL_LENGTH(''dbo.invoice_lines'', ''newInvoiceId'') IS NOT NULL
BEGIN
  ALTER TABLE [dbo].[invoice_lines] DROP COLUMN [invoiceId];
  EXEC sp_rename ''dbo.invoice_lines.newInvoiceId'', ''invoiceId'', ''COLUMN'';
  ALTER TABLE [dbo].[invoice_lines] ALTER COLUMN [invoiceId] INT NOT NULL;
END
');

EXEC(N'
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''invoice_events_invoiceId_createdAt_idx'' AND object_id = OBJECT_ID(''dbo.invoice_events''))
  DROP INDEX [invoice_events_invoiceId_createdAt_idx] ON [dbo].[invoice_events];
IF COL_LENGTH(''dbo.invoice_events'', ''invoiceId'') IS NOT NULL AND COL_LENGTH(''dbo.invoice_events'', ''newInvoiceId'') IS NOT NULL
BEGIN
  ALTER TABLE [dbo].[invoice_events] DROP COLUMN [invoiceId];
  EXEC sp_rename ''dbo.invoice_events.newInvoiceId'', ''invoiceId'', ''COLUMN'';
  ALTER TABLE [dbo].[invoice_events] ALTER COLUMN [invoiceId] INT NOT NULL;
END
');

EXEC(N'
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = ''webhook_deliveries_invoiceId_createdAt_idx'' AND object_id = OBJECT_ID(''dbo.webhook_deliveries''))
  DROP INDEX [webhook_deliveries_invoiceId_createdAt_idx] ON [dbo].[webhook_deliveries];
IF COL_LENGTH(''dbo.webhook_deliveries'', ''invoiceId'') IS NOT NULL AND COL_LENGTH(''dbo.webhook_deliveries'', ''newInvoiceId'') IS NOT NULL
BEGIN
  ALTER TABLE [dbo].[webhook_deliveries] DROP COLUMN [invoiceId];
  EXEC sp_rename ''dbo.webhook_deliveries.newInvoiceId'', ''invoiceId'', ''COLUMN'';
  ALTER TABLE [dbo].[webhook_deliveries] ALTER COLUMN [invoiceId] INT NOT NULL;
END
');

EXEC(N'
IF COL_LENGTH(''dbo.invoices'', ''id'') IS NOT NULL AND COL_LENGTH(''dbo.invoices'', ''newId'') IS NOT NULL
BEGIN
  ALTER TABLE [dbo].[invoices] DROP CONSTRAINT [invoices_pkey];
  ALTER TABLE [dbo].[invoices] DROP COLUMN [id];
  EXEC sp_rename ''dbo.invoices.newId'', ''id'', ''COLUMN'';
  ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_pkey] PRIMARY KEY CLUSTERED ([id]);
END
');

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'invoice_lines_invoiceId_fkey')
  ALTER TABLE [dbo].[invoice_lines] ADD CONSTRAINT [invoice_lines_invoiceId_fkey]
  FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'invoice_events_invoiceId_fkey')
  ALTER TABLE [dbo].[invoice_events] ADD CONSTRAINT [invoice_events_invoiceId_fkey]
  FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

IF NOT EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = 'invoice_lines_invoiceId_lineNumber_key'
    AND parent_object_id = OBJECT_ID('dbo.invoice_lines')
)
  ALTER TABLE [dbo].[invoice_lines]
    ADD CONSTRAINT [invoice_lines_invoiceId_lineNumber_key] UNIQUE ([invoiceId], [lineNumber]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'invoice_events_invoiceId_createdAt_idx'
    AND object_id = OBJECT_ID('dbo.invoice_events')
)
  CREATE INDEX [invoice_events_invoiceId_createdAt_idx]
    ON [dbo].[invoice_events]([invoiceId], [createdAt]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'webhook_deliveries_invoiceId_createdAt_idx'
    AND object_id = OBJECT_ID('dbo.webhook_deliveries')
)
  CREATE INDEX [webhook_deliveries_invoiceId_createdAt_idx]
    ON [dbo].[webhook_deliveries]([invoiceId], [createdAt]);
