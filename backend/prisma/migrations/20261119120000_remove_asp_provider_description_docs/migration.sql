-- Provider description / documentation URL are unused in hub operations.
IF COL_LENGTH(N'dbo.asp_providers', N'description') IS NOT NULL
  ALTER TABLE [dbo].[asp_providers] DROP COLUMN [description];

IF COL_LENGTH(N'dbo.asp_providers', N'documentationUrl') IS NOT NULL
  ALTER TABLE [dbo].[asp_providers] DROP COLUMN [documentationUrl];
