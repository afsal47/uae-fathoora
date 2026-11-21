-- Submit URL comes from AspProviderApiConfig (baseUrl + invoiceSubmitPath).
IF COL_LENGTH(N'dbo.asp_connections', N'submitUrlOverride') IS NOT NULL
  ALTER TABLE [dbo].[asp_connections] DROP COLUMN [submitUrlOverride];
