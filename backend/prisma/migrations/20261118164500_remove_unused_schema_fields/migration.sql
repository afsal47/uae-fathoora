-- Remove unused / unused-in-runtime columns from the multi-ASP schema.

IF COL_LENGTH('dbo.integrations', 'allowedIpRanges') IS NOT NULL
  ALTER TABLE [dbo].[integrations] DROP COLUMN [allowedIpRanges];

IF COL_LENGTH('dbo.asp_providers', 'integrationVersion') IS NOT NULL
  ALTER TABLE [dbo].[asp_providers] DROP COLUMN [integrationVersion];

IF COL_LENGTH('dbo.asp_providers', 'supportedCapabilities') IS NOT NULL
  ALTER TABLE [dbo].[asp_providers] DROP COLUMN [supportedCapabilities];

IF COL_LENGTH('dbo.asp_providers', 'supportedAuthTypes') IS NOT NULL
  ALTER TABLE [dbo].[asp_providers] DROP COLUMN [supportedAuthTypes];

IF COL_LENGTH('dbo.asp_providers', 'supportedDocumentTypes') IS NOT NULL
  ALTER TABLE [dbo].[asp_providers] DROP COLUMN [supportedDocumentTypes];

IF COL_LENGTH('dbo.asp_provider_api_configs', 'creditNoteSubmitPath') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [creditNoteSubmitPath];

IF COL_LENGTH('dbo.asp_provider_api_configs', 'documentRetrievePath') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [documentRetrievePath];

IF COL_LENGTH('dbo.asp_provider_api_configs', 'webhookPath') IS NOT NULL
  ALTER TABLE [dbo].[asp_provider_api_configs] DROP COLUMN [webhookPath];

IF COL_LENGTH('dbo.asp_connections', 'name') IS NOT NULL
  ALTER TABLE [dbo].[asp_connections] DROP COLUMN [name];
