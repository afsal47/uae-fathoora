-- XML content remains in aspPayload; version/hash audit columns are unused.

IF COL_LENGTH('dbo.invoices', 'xmlVersion') IS NOT NULL
  ALTER TABLE [dbo].[invoices] DROP COLUMN [xmlVersion];

IF COL_LENGTH('dbo.invoices', 'xmlDocumentHash') IS NOT NULL
  ALTER TABLE [dbo].[invoices] DROP COLUMN [xmlDocumentHash];
