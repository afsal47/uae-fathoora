-- Drop webhook deliveries table and related indexes (if present).
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'webhook_deliveries_invoiceId_createdAt_idx' AND object_id = OBJECT_ID('dbo.webhook_deliveries'))
  DROP INDEX [webhook_deliveries_invoiceId_createdAt_idx] ON [dbo].[webhook_deliveries];

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'webhook_deliveries_status_createdAt_idx' AND object_id = OBJECT_ID('dbo.webhook_deliveries'))
  DROP INDEX [webhook_deliveries_status_createdAt_idx] ON [dbo].[webhook_deliveries];

IF OBJECT_ID(N'dbo.webhook_deliveries', N'U') IS NOT NULL
  DROP TABLE [dbo].[webhook_deliveries];

-- Drop unused webhook columns from tenants / integrations.
IF COL_LENGTH('dbo.tenants', 'aspWebhookToken') IS NOT NULL
  ALTER TABLE [dbo].[tenants] DROP COLUMN [aspWebhookToken];

IF COL_LENGTH('dbo.integrations', 'webhookUrl') IS NOT NULL
  ALTER TABLE [dbo].[integrations] DROP COLUMN [webhookUrl];

IF COL_LENGTH('dbo.integrations', 'webhookSecret') IS NOT NULL
  ALTER TABLE [dbo].[integrations] DROP COLUMN [webhookSecret];