-- Connections are always for sending; test result message is returned to UI only (toast).

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'asp_connections_legalEntityId_environment_purpose_status_idx'
    AND object_id = OBJECT_ID(N'dbo.asp_connections')
)
  DROP INDEX [asp_connections_legalEntityId_environment_purpose_status_idx] ON [dbo].[asp_connections];

DECLARE @sql nvarchar(max);
SELECT @sql = STRING_AGG(
  'ALTER TABLE [dbo].[asp_connections] DROP CONSTRAINT [' + dc.name + '];',
  CHAR(10)
)
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
INNER JOIN sys.tables t ON t.object_id = dc.parent_object_id
WHERE t.name = 'asp_connections'
  AND SCHEMA_NAME(t.schema_id) = 'dbo'
  AND c.name IN ('purpose', 'lastTestMessage');

IF @sql IS NOT NULL EXEC sp_executesql @sql;

IF COL_LENGTH('dbo.asp_connections', 'purpose') IS NOT NULL
  ALTER TABLE [dbo].[asp_connections] DROP COLUMN [purpose];

IF COL_LENGTH('dbo.asp_connections', 'lastTestMessage') IS NOT NULL
  ALTER TABLE [dbo].[asp_connections] DROP COLUMN [lastTestMessage];

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'asp_connections_legalEntityId_environment_status_idx'
    AND object_id = OBJECT_ID(N'dbo.asp_connections')
)
  CREATE NONCLUSTERED INDEX [asp_connections_legalEntityId_environment_status_idx]
    ON [dbo].[asp_connections]([legalEntityId], [environment], [status]);
