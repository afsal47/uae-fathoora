-- Drop ASP inbound webhook event store (hub uses polling for ASP status).

IF EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'asp_webhook_events_aspConnectionId_fkey'
    AND parent_object_id = OBJECT_ID(N'dbo.asp_webhook_events')
)
  ALTER TABLE [dbo].[asp_webhook_events] DROP CONSTRAINT [asp_webhook_events_aspConnectionId_fkey];

IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'asp_webhook_events_tenantId_receivedAt_idx'
    AND object_id = OBJECT_ID(N'dbo.asp_webhook_events')
)
  DROP INDEX [asp_webhook_events_tenantId_receivedAt_idx] ON [dbo].[asp_webhook_events];

IF OBJECT_ID(N'dbo.asp_webhook_events', N'U') IS NOT NULL
  DROP TABLE [dbo].[asp_webhook_events];
