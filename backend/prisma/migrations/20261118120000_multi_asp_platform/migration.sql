BEGIN TRY

BEGIN TRAN;

-- NOTE: Existing hub UUID PKs are NVARCHAR(1000). New FK columns must match that length.

-- Legal entities
CREATE TABLE [dbo].[legal_entities] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(100) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [trn] NVARCHAR(50),
    [email] NVARCHAR(200),
    [phone] NVARCHAR(50),
    [addressLine1] NVARCHAR(200),
    [addressLine2] NVARCHAR(200),
    [city] NVARCHAR(100),
    [state] NVARCHAR(100),
    [postalCode] NVARCHAR(50),
    [countryCode] NVARCHAR(2) NOT NULL CONSTRAINT [legal_entities_countryCode_df] DEFAULT 'AE',
    [isDefault] BIT NOT NULL CONSTRAINT [legal_entities_isDefault_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [legal_entities_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [legal_entities_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [legal_entities_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [legal_entities_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

CREATE NONCLUSTERED INDEX [legal_entities_tenantId_isActive_idx] ON [dbo].[legal_entities]([tenantId], [isActive]);

ALTER TABLE [dbo].[legal_entities] ADD CONSTRAINT [legal_entities_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ASP providers
CREATE TABLE [dbo].[asp_providers] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(50) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(2000),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [asp_providers_status_df] DEFAULT 'INACTIVE',
    [integrationVersion] NVARCHAR(50),
    [supportedCapabilities] NVARCHAR(max),
    [supportedAuthTypes] NVARCHAR(1000),
    [supportedDocumentTypes] NVARCHAR(1000),
    [documentationUrl] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [asp_providers_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [asp_providers_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [asp_providers_code_key] UNIQUE NONCLUSTERED ([code])
);

-- ASP API configs
CREATE TABLE [dbo].[asp_provider_api_configs] (
    [id] NVARCHAR(1000) NOT NULL,
    [aspProviderId] NVARCHAR(1000) NOT NULL,
    [environment] NVARCHAR(20) NOT NULL,
    [apiVersion] NVARCHAR(50),
    [baseUrl] NVARCHAR(500),
    [loginPath] NVARCHAR(500),
    [invoiceSubmitPath] NVARCHAR(500),
    [creditNoteSubmitPath] NVARCHAR(500),
    [statusPath] NVARCHAR(500),
    [documentRetrievePath] NVARCHAR(500),
    [webhookPath] NVARCHAR(500),
    [timeoutMs] INT NOT NULL CONSTRAINT [asp_provider_api_configs_timeoutMs_df] DEFAULT 30000,
    [documentationFileName] NVARCHAR(255),
    [documentationMimeType] NVARCHAR(100),
    [documentationVersion] NVARCHAR(50),
    [documentationContent] NVARCHAR(max),
    [documentationSha256] NVARCHAR(64),
    [isActive] BIT NOT NULL CONSTRAINT [asp_provider_api_configs_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [asp_provider_api_configs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [asp_provider_api_configs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [asp_provider_api_configs_aspProviderId_environment_key] UNIQUE NONCLUSTERED ([aspProviderId],[environment])
);

ALTER TABLE [dbo].[asp_provider_api_configs] ADD CONSTRAINT [asp_provider_api_configs_aspProviderId_fkey]
  FOREIGN KEY ([aspProviderId]) REFERENCES [dbo].[asp_providers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ASP connections
CREATE TABLE [dbo].[asp_connections] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [legalEntityId] NVARCHAR(1000) NOT NULL,
    [aspProviderId] NVARCHAR(1000) NOT NULL,
    [environment] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(200),
    [purpose] NVARCHAR(50) NOT NULL CONSTRAINT [asp_connections_purpose_df] DEFAULT 'SENDING',
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [asp_connections_status_df] DEFAULT 'INACTIVE',
    [submitUrlOverride] NVARCHAR(500),
    [lastTestAt] DATETIME2,
    [lastTestStatus] NVARCHAR(50),
    [lastTestMessage] NVARCHAR(2000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [asp_connections_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [asp_connections_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [asp_connections_tenantId_status_idx] ON [dbo].[asp_connections]([tenantId], [status]);
CREATE NONCLUSTERED INDEX [asp_connections_legalEntityId_environment_purpose_status_idx]
  ON [dbo].[asp_connections]([legalEntityId], [environment], [purpose], [status]);

ALTER TABLE [dbo].[asp_connections] ADD CONSTRAINT [asp_connections_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asp_connections] ADD CONSTRAINT [asp_connections_legalEntityId_fkey]
  FOREIGN KEY ([legalEntityId]) REFERENCES [dbo].[legal_entities]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asp_connections] ADD CONSTRAINT [asp_connections_aspProviderId_fkey]
  FOREIGN KEY ([aspProviderId]) REFERENCES [dbo].[asp_providers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ASP credentials
CREATE TABLE [dbo].[asp_credentials] (
    [id] NVARCHAR(1000) NOT NULL,
    [aspConnectionId] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(100) NOT NULL,
    [valueEncrypted] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [asp_credentials_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [asp_credentials_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [asp_credentials_aspConnectionId_key_key] UNIQUE NONCLUSTERED ([aspConnectionId],[key])
);

ALTER TABLE [dbo].[asp_credentials] ADD CONSTRAINT [asp_credentials_aspConnectionId_fkey]
  FOREIGN KEY ([aspConnectionId]) REFERENCES [dbo].[asp_connections]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- Webhook event store (dedup)
CREATE TABLE [dbo].[asp_webhook_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [aspConnectionId] NVARCHAR(1000) NOT NULL,
    [providerCode] NVARCHAR(50) NOT NULL,
    [eventKey] NVARCHAR(200) NOT NULL,
    [invoiceId] INT,
    [signatureValid] BIT NOT NULL CONSTRAINT [asp_webhook_events_signatureValid_df] DEFAULT 0,
    [processed] BIT NOT NULL CONSTRAINT [asp_webhook_events_processed_df] DEFAULT 0,
    [rawPayload] NVARCHAR(max) NOT NULL,
    [processError] NVARCHAR(2000),
    [receivedAt] DATETIME2 NOT NULL CONSTRAINT [asp_webhook_events_receivedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    CONSTRAINT [asp_webhook_events_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [asp_webhook_events_aspConnectionId_eventKey_key] UNIQUE NONCLUSTERED ([aspConnectionId],[eventKey])
);

CREATE NONCLUSTERED INDEX [asp_webhook_events_tenantId_receivedAt_idx]
  ON [dbo].[asp_webhook_events]([tenantId], [receivedAt]);

ALTER TABLE [dbo].[asp_webhook_events] ADD CONSTRAINT [asp_webhook_events_aspConnectionId_fkey]
  FOREIGN KEY ([aspConnectionId]) REFERENCES [dbo].[asp_connections]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Integration optional legal entity
ALTER TABLE [dbo].[integrations] ADD [legalEntityId] NVARCHAR(1000);
ALTER TABLE [dbo].[integrations] ADD CONSTRAINT [integrations_legalEntityId_fkey]
  FOREIGN KEY ([legalEntityId]) REFERENCES [dbo].[legal_entities]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Invoice multi-ASP / status columns
ALTER TABLE [dbo].[invoices] ADD [legalEntityId] NVARCHAR(1000);
ALTER TABLE [dbo].[invoices] ADD [aspConnectionId] NVARCHAR(1000);
ALTER TABLE [dbo].[invoices] ADD [hubProcessingStatus] NVARCHAR(50);
ALTER TABLE [dbo].[invoices] ADD [aspSubmissionStatus] NVARCHAR(50);
ALTER TABLE [dbo].[invoices] ADD [peppolDeliveryStatus] NVARCHAR(50);
ALTER TABLE [dbo].[invoices] ADD [taxReportingStatus] NVARCHAR(50);
ALTER TABLE [dbo].[invoices] ADD [providerStatusRaw] NVARCHAR(100);
ALTER TABLE [dbo].[invoices] ADD [providerResponseCode] NVARCHAR(50);
ALTER TABLE [dbo].[invoices] ADD [providerErrorMessage] NVARCHAR(2000);
ALTER TABLE [dbo].[invoices] ADD [xmlVersion] NVARCHAR(50);
ALTER TABLE [dbo].[invoices] ADD [xmlDocumentHash] NVARCHAR(64);

CREATE NONCLUSTERED INDEX [invoices_legalEntityId_status_idx] ON [dbo].[invoices]([legalEntityId], [status]);

ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_legalEntityId_fkey]
  FOREIGN KEY ([legalEntityId]) REFERENCES [dbo].[legal_entities]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_aspConnectionId_fkey]
  FOREIGN KEY ([aspConnectionId]) REFERENCES [dbo].[asp_connections]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Seed EVATRA + MOCK_ASP_B providers
DECLARE @evatraId NVARCHAR(1000) = LOWER(CONVERT(NVARCHAR(36), NEWID()));
DECLARE @mockId NVARCHAR(1000) = LOWER(CONVERT(NVARCHAR(36), NEWID()));
DECLARE @now DATETIME2 = SYSUTCDATETIME();

INSERT INTO [dbo].[asp_providers]
  ([id],[code],[name],[description],[status],[integrationVersion],[supportedCapabilities],[supportedAuthTypes],[supportedDocumentTypes],[documentationUrl],[createdAt],[updatedAt])
VALUES
  (@evatraId, N'EVATRA', N'EVATRA', N'UAE ASP with R-Auth login and PINT AE XML submission.', N'ACTIVE', N'1.0',
   N'["SUBMIT_INVOICE","DOCUMENT_STATUS","TDD_RETRY","POLL"]',
   N'["API_KEY_LOGIN","R_AUTH"]',
   N'["INVOICE","CREDIT_NOTE"]',
   NULL, @now, @now),
  (@mockId, N'MOCK_ASP_B', N'Mock ASP B (scaffold)', N'Scaffold/test fixture only. Not a real ASP integration.', N'INACTIVE', N'0.1-scaffold',
   N'["SUBMIT_INVOICE","DOCUMENT_STATUS"]',
   N'["API_KEY"]',
   N'["INVOICE"]',
   NULL, @now, @now);

INSERT INTO [dbo].[asp_provider_api_configs]
  ([id],[aspProviderId],[environment],[apiVersion],[baseUrl],[loginPath],[invoiceSubmitPath],[statusPath],[timeoutMs],[isActive],[createdAt],[updatedAt])
VALUES
  (LOWER(CONVERT(NVARCHAR(36), NEWID())), @evatraId, N'SANDBOX', N'v1', NULL, N'/auth/login', NULL, N'/invoice/document-status/{trackingId}', 30000, 1, @now, @now),
  (LOWER(CONVERT(NVARCHAR(36), NEWID())), @evatraId, N'PRODUCTION', N'v1', NULL, N'/auth/login', NULL, N'/invoice/document-status/{trackingId}', 30000, 1, @now, @now),
  (LOWER(CONVERT(NVARCHAR(36), NEWID())), @mockId, N'SANDBOX', N'scaffold', NULL, NULL, NULL, NULL, 30000, 1, @now, @now);

-- Backfill one default legal entity per tenant
INSERT INTO [dbo].[legal_entities]
  ([id],[tenantId],[code],[name],[trn],[email],[phone],[addressLine1],[addressLine2],[city],[state],[postalCode],[countryCode],[isDefault],[isActive],[createdAt],[updatedAt])
SELECT
  LOWER(CONVERT(NVARCHAR(36), NEWID())),
  t.[id],
  N'DEFAULT',
  t.[name],
  t.[trn],
  t.[email],
  t.[phone],
  t.[addressLine1],
  t.[addressLine2],
  t.[city],
  t.[state],
  t.[postalCode],
  t.[countryCode],
  1,
  t.[isActive],
  @now,
  @now
FROM [dbo].[tenants] t
WHERE NOT EXISTS (
  SELECT 1 FROM [dbo].[legal_entities] le WHERE le.[tenantId] = t.[id] AND le.[code] = N'DEFAULT'
);

-- Point integrations at default legal entity
UPDATE i
SET i.[legalEntityId] = le.[id]
FROM [dbo].[integrations] i
INNER JOIN [dbo].[legal_entities] le ON le.[tenantId] = i.[tenantId] AND le.[code] = N'DEFAULT'
WHERE i.[legalEntityId] IS NULL;

-- Backfill ASP connections from legacy tenant ASP fields when base URL present
INSERT INTO [dbo].[asp_connections]
  ([id],[tenantId],[legalEntityId],[aspProviderId],[environment],[name],[purpose],[status],[submitUrlOverride],[createdAt],[updatedAt])
SELECT
  LOWER(CONVERT(NVARCHAR(36), NEWID())),
  t.[id],
  le.[id],
  CASE
    WHEN UPPER(LTRIM(RTRIM(t.[aspProvider]))) IN (N'EVATRA', N'GENERIC') THEN @evatraId
    WHEN UPPER(LTRIM(RTRIM(t.[aspProvider]))) = N'MOCK_ASP_B' THEN @mockId
    ELSE @evatraId
  END,
  N'PRODUCTION',
  N'Migrated from tenant ASP fields',
  N'SENDING',
  N'ACTIVE',
  t.[aspBaseUrl],
  @now,
  @now
FROM [dbo].[tenants] t
INNER JOIN [dbo].[legal_entities] le ON le.[tenantId] = t.[id] AND le.[isDefault] = 1
WHERE t.[aspBaseUrl] IS NOT NULL AND LTRIM(RTRIM(t.[aspBaseUrl])) <> N''
  AND NOT EXISTS (
    SELECT 1 FROM [dbo].[asp_connections] c
    WHERE c.[legalEntityId] = le.[id] AND c.[environment] = N'PRODUCTION' AND c.[purpose] = N'SENDING' AND c.[status] = N'ACTIVE'
  );

-- Copy encrypted API key into connection credentials
INSERT INTO [dbo].[asp_credentials]
  ([id],[aspConnectionId],[key],[valueEncrypted],[createdAt],[updatedAt])
SELECT
  LOWER(CONVERT(NVARCHAR(36), NEWID())),
  c.[id],
  N'apiKey',
  t.[aspApiKey],
  @now,
  @now
FROM [dbo].[asp_connections] c
INNER JOIN [dbo].[tenants] t ON t.[id] = c.[tenantId]
WHERE c.[name] = N'Migrated from tenant ASP fields'
  AND t.[aspApiKey] IS NOT NULL AND LTRIM(RTRIM(t.[aspApiKey])) <> N''
  AND NOT EXISTS (
    SELECT 1 FROM [dbo].[asp_credentials] cr WHERE cr.[aspConnectionId] = c.[id] AND cr.[key] = N'apiKey'
  );

INSERT INTO [dbo].[asp_credentials]
  ([id],[aspConnectionId],[key],[valueEncrypted],[createdAt],[updatedAt])
SELECT
  LOWER(CONVERT(NVARCHAR(36), NEWID())),
  c.[id],
  N'email',
  t.[email],
  @now,
  @now
FROM [dbo].[asp_connections] c
INNER JOIN [dbo].[tenants] t ON t.[id] = c.[tenantId]
WHERE c.[name] = N'Migrated from tenant ASP fields'
  AND t.[email] IS NOT NULL AND LTRIM(RTRIM(t.[email])) <> N''
  AND NOT EXISTS (
    SELECT 1 FROM [dbo].[asp_credentials] cr WHERE cr.[aspConnectionId] = c.[id] AND cr.[key] = N'email'
  );

-- Attach historical invoices to default legal entity / migrated connection where possible
UPDATE inv
SET
  inv.[legalEntityId] = le.[id],
  inv.[aspConnectionId] = c.[id],
  inv.[hubProcessingStatus] = CASE
    WHEN inv.[status] IN (N'DRAFT') THEN N'RECEIVED'
    WHEN inv.[status] IN (N'QUEUED', N'SUBMITTING') THEN N'QUEUED'
    ELSE N'QUEUED'
  END
FROM [dbo].[invoices] inv
INNER JOIN [dbo].[legal_entities] le ON le.[tenantId] = inv.[tenantId] AND le.[isDefault] = 1
LEFT JOIN [dbo].[asp_connections] c
  ON c.[legalEntityId] = le.[id] AND c.[purpose] = N'SENDING' AND c.[status] = N'ACTIVE'
WHERE inv.[legalEntityId] IS NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
