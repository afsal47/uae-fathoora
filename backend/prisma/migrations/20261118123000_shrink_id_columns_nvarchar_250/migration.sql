BEGIN TRY

BEGIN TRAN;

-- Shrink UUID/id FK columns NVARCHAR(1000) -> NVARCHAR(250).

DECLARE @sql NVARCHAR(MAX) = N'';

-- 1) Drop ALL foreign keys touching these tables
SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
  + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
  + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN (
    N'tenants', N'integrations', N'invoices', N'invoice_lines', N'invoice_events',
    N'legal_entities', N'asp_providers', N'asp_provider_api_configs',
    N'asp_connections', N'asp_credentials', N'asp_webhook_events'
  )
  OR OBJECT_NAME(fk.referenced_object_id) IN (
    N'tenants', N'integrations', N'invoices', N'invoice_lines', N'invoice_events',
    N'legal_entities', N'asp_providers', N'asp_provider_api_configs',
    N'asp_connections', N'asp_credentials', N'asp_webhook_events'
  );
IF LEN(@sql) > 0 EXEC sp_executesql @sql;
SET @sql = N'';

-- 2) Drop ALL non-PK / non-UQ indexes on these tables
SELECT @sql = @sql + N'DROP INDEX ' + QUOTENAME(i.name) + N' ON '
  + QUOTENAME(OBJECT_SCHEMA_NAME(i.object_id)) + N'.' + QUOTENAME(OBJECT_NAME(i.object_id)) + N';'
FROM sys.indexes i
WHERE i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND i.name IS NOT NULL
  AND i.type > 0
  AND OBJECT_NAME(i.object_id) IN (
    N'tenants', N'integrations', N'invoices', N'invoice_lines', N'invoice_events',
    N'legal_entities', N'asp_providers', N'asp_provider_api_configs',
    N'asp_connections', N'asp_credentials', N'asp_webhook_events'
  );
IF LEN(@sql) > 0 EXEC sp_executesql @sql;
SET @sql = N'';

-- 3) Drop unique constraints
SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(kc.parent_object_id))
  + N'.' + QUOTENAME(OBJECT_NAME(kc.parent_object_id))
  + N' DROP CONSTRAINT ' + QUOTENAME(kc.name) + N';'
FROM sys.key_constraints kc
WHERE kc.type = N'UQ'
  AND OBJECT_NAME(kc.parent_object_id) IN (
    N'tenants', N'integrations', N'invoices', N'invoice_lines', N'invoice_events',
    N'legal_entities', N'asp_providers', N'asp_provider_api_configs',
    N'asp_connections', N'asp_credentials', N'asp_webhook_events'
  );
IF LEN(@sql) > 0 EXEC sp_executesql @sql;
SET @sql = N'';

-- 4) Drop primary keys
SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(kc.parent_object_id))
  + N'.' + QUOTENAME(OBJECT_NAME(kc.parent_object_id))
  + N' DROP CONSTRAINT ' + QUOTENAME(kc.name) + N';'
FROM sys.key_constraints kc
WHERE kc.type = N'PK'
  AND OBJECT_NAME(kc.parent_object_id) IN (
    N'tenants', N'integrations', N'invoices', N'invoice_lines', N'invoice_events',
    N'legal_entities', N'asp_providers', N'asp_provider_api_configs',
    N'asp_connections', N'asp_credentials', N'asp_webhook_events'
  );
IF LEN(@sql) > 0 EXEC sp_executesql @sql;

-- 5) Alter columns
ALTER TABLE [dbo].[tenants] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;

ALTER TABLE [dbo].[integrations] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[integrations] ALTER COLUMN [tenantId] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[integrations] ALTER COLUMN [legalEntityId] NVARCHAR(250) NULL;

ALTER TABLE [dbo].[invoices] ALTER COLUMN [tenantId] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[invoices] ALTER COLUMN [integrationId] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[invoices] ALTER COLUMN [legalEntityId] NVARCHAR(250) NULL;
ALTER TABLE [dbo].[invoices] ALTER COLUMN [aspConnectionId] NVARCHAR(250) NULL;

ALTER TABLE [dbo].[invoice_lines] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[invoice_events] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;

ALTER TABLE [dbo].[legal_entities] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[legal_entities] ALTER COLUMN [tenantId] NVARCHAR(250) NOT NULL;

ALTER TABLE [dbo].[asp_providers] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;

ALTER TABLE [dbo].[asp_provider_api_configs] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[asp_provider_api_configs] ALTER COLUMN [aspProviderId] NVARCHAR(250) NOT NULL;

ALTER TABLE [dbo].[asp_connections] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[asp_connections] ALTER COLUMN [tenantId] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[asp_connections] ALTER COLUMN [legalEntityId] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[asp_connections] ALTER COLUMN [aspProviderId] NVARCHAR(250) NOT NULL;

ALTER TABLE [dbo].[asp_credentials] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[asp_credentials] ALTER COLUMN [aspConnectionId] NVARCHAR(250) NOT NULL;

ALTER TABLE [dbo].[asp_webhook_events] ALTER COLUMN [id] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[asp_webhook_events] ALTER COLUMN [tenantId] NVARCHAR(250) NOT NULL;
ALTER TABLE [dbo].[asp_webhook_events] ALTER COLUMN [aspConnectionId] NVARCHAR(250) NOT NULL;

-- 6) Recreate primary keys
ALTER TABLE [dbo].[tenants] ADD CONSTRAINT [tenants_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[integrations] ADD CONSTRAINT [integrations_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[invoice_lines] ADD CONSTRAINT [invoice_lines_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[invoice_events] ADD CONSTRAINT [invoice_events_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[legal_entities] ADD CONSTRAINT [legal_entities_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[asp_providers] ADD CONSTRAINT [asp_providers_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[asp_provider_api_configs] ADD CONSTRAINT [asp_provider_api_configs_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[asp_connections] ADD CONSTRAINT [asp_connections_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[asp_credentials] ADD CONSTRAINT [asp_credentials_pkey] PRIMARY KEY CLUSTERED ([id]);
ALTER TABLE [dbo].[asp_webhook_events] ADD CONSTRAINT [asp_webhook_events_pkey] PRIMARY KEY CLUSTERED ([id]);

-- 7) Recreate unique constraints
ALTER TABLE [dbo].[tenants] ADD CONSTRAINT [tenants_code_key] UNIQUE NONCLUSTERED ([code]);
ALTER TABLE [dbo].[integrations] ADD CONSTRAINT [integrations_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code]);
ALTER TABLE [dbo].[legal_entities] ADD CONSTRAINT [legal_entities_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code]);
ALTER TABLE [dbo].[asp_providers] ADD CONSTRAINT [asp_providers_code_key] UNIQUE NONCLUSTERED ([code]);
ALTER TABLE [dbo].[asp_provider_api_configs] ADD CONSTRAINT [asp_provider_api_configs_aspProviderId_environment_key] UNIQUE NONCLUSTERED ([aspProviderId],[environment]);
ALTER TABLE [dbo].[asp_credentials] ADD CONSTRAINT [asp_credentials_aspConnectionId_key_key] UNIQUE NONCLUSTERED ([aspConnectionId],[key]);
ALTER TABLE [dbo].[asp_webhook_events] ADD CONSTRAINT [asp_webhook_events_aspConnectionId_eventKey_key] UNIQUE NONCLUSTERED ([aspConnectionId],[eventKey]);
ALTER TABLE [dbo].[invoice_lines] ADD CONSTRAINT [invoice_lines_invoiceId_lineNumber_key] UNIQUE NONCLUSTERED ([invoiceId],[lineNumber]);
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_tenantId_sourceSystem_sourceDocumentId_documentType_key] UNIQUE NONCLUSTERED ([tenantId],[sourceSystem],[sourceDocumentId],[documentType]);
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_tenantId_integrationId_idempotencyKey_key] UNIQUE NONCLUSTERED ([tenantId],[integrationId],[idempotencyKey]);
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_tenantId_invoiceNumber_documentType_key] UNIQUE NONCLUSTERED ([tenantId],[invoiceNumber],[documentType]);

-- 8) Recreate indexes
CREATE NONCLUSTERED INDEX [legal_entities_tenantId_isActive_idx] ON [dbo].[legal_entities]([tenantId], [isActive]);
CREATE NONCLUSTERED INDEX [asp_connections_tenantId_status_idx] ON [dbo].[asp_connections]([tenantId], [status]);
CREATE NONCLUSTERED INDEX [asp_connections_legalEntityId_environment_purpose_status_idx]
  ON [dbo].[asp_connections]([legalEntityId], [environment], [purpose], [status]);
CREATE NONCLUSTERED INDEX [asp_webhook_events_tenantId_receivedAt_idx]
  ON [dbo].[asp_webhook_events]([tenantId], [receivedAt]);
CREATE NONCLUSTERED INDEX [invoices_tenantId_status_idx] ON [dbo].[invoices]([tenantId], [status]);
CREATE NONCLUSTERED INDEX [invoices_integrationId_sourceDocumentId_idx] ON [dbo].[invoices]([integrationId], [sourceDocumentId]);
CREATE NONCLUSTERED INDEX [invoices_legalEntityId_status_idx] ON [dbo].[invoices]([legalEntityId], [status]);
CREATE NONCLUSTERED INDEX [invoice_events_invoiceId_createdAt_idx] ON [dbo].[invoice_events]([invoiceId], [createdAt]);

-- 9) Recreate foreign keys
ALTER TABLE [dbo].[integrations] ADD CONSTRAINT [integrations_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[integrations] ADD CONSTRAINT [integrations_legalEntityId_fkey]
  FOREIGN KEY ([legalEntityId]) REFERENCES [dbo].[legal_entities]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[legal_entities] ADD CONSTRAINT [legal_entities_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[asp_provider_api_configs] ADD CONSTRAINT [asp_provider_api_configs_aspProviderId_fkey]
  FOREIGN KEY ([aspProviderId]) REFERENCES [dbo].[asp_providers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[asp_connections] ADD CONSTRAINT [asp_connections_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asp_connections] ADD CONSTRAINT [asp_connections_legalEntityId_fkey]
  FOREIGN KEY ([legalEntityId]) REFERENCES [dbo].[legal_entities]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[asp_connections] ADD CONSTRAINT [asp_connections_aspProviderId_fkey]
  FOREIGN KEY ([aspProviderId]) REFERENCES [dbo].[asp_providers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[asp_credentials] ADD CONSTRAINT [asp_credentials_aspConnectionId_fkey]
  FOREIGN KEY ([aspConnectionId]) REFERENCES [dbo].[asp_connections]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [dbo].[asp_webhook_events] ADD CONSTRAINT [asp_webhook_events_aspConnectionId_fkey]
  FOREIGN KEY ([aspConnectionId]) REFERENCES [dbo].[asp_connections]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_tenantId_fkey]
  FOREIGN KEY ([tenantId]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_integrationId_fkey]
  FOREIGN KEY ([integrationId]) REFERENCES [dbo].[integrations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_legalEntityId_fkey]
  FOREIGN KEY ([legalEntityId]) REFERENCES [dbo].[legal_entities]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_aspConnectionId_fkey]
  FOREIGN KEY ([aspConnectionId]) REFERENCES [dbo].[asp_connections]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[invoice_lines] ADD CONSTRAINT [invoice_lines_invoiceId_fkey]
  FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[invoice_events] ADD CONSTRAINT [invoice_events_invoiceId_fkey]
  FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
