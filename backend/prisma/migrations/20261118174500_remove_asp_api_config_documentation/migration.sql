-- Remove unused OpenAPI documentation blob columns from ASP API configs.

IF COL_LENGTH('dbo.asp_provider_api_configs', 'documentationFileName') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [documentationFileName];

IF COL_LENGTH('dbo.asp_provider_api_configs', 'documentationMimeType') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [documentationMimeType];

IF COL_LENGTH('dbo.asp_provider_api_configs', 'documentationVersion') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [documentationVersion];

IF COL_LENGTH('dbo.asp_provider_api_configs', 'documentationContent') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [documentationContent];

IF COL_LENGTH('dbo.asp_provider_api_configs', 'documentationSha256') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [documentationSha256];
