-- API version was unused for URL building; paths include version when needed.
IF COL_LENGTH(N'dbo.asp_provider_api_configs', N'apiVersion') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [apiVersion];
