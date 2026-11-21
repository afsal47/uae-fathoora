-- Address comes from invoice payload; legal entity routing uses integration.legalEntityId.
-- Drop LegalEntity address columns and isDefault.

DECLARE @sql nvarchar(max);

-- Drop default constraints before dropping columns (SQL Server).
SELECT @sql = STRING_AGG(
  'ALTER TABLE [dbo].[legal_entities] DROP CONSTRAINT [' + dc.name + '];',
  CHAR(10)
)
FROM sys.default_constraints dc
INNER JOIN sys.columns c
  ON c.default_object_id = dc.object_id
INNER JOIN sys.tables t
  ON t.object_id = dc.parent_object_id
WHERE t.name = 'legal_entities'
  AND SCHEMA_NAME(t.schema_id) = 'dbo'
  AND c.name IN (
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'postalCode',
    'countryCode',
    'isDefault'
  );

IF @sql IS NOT NULL EXEC sp_executesql @sql;

IF COL_LENGTH('dbo.legal_entities', 'addressLine1') IS NOT NULL
  ALTER TABLE [dbo].[legal_entities] DROP COLUMN [addressLine1];

IF COL_LENGTH('dbo.legal_entities', 'addressLine2') IS NOT NULL
  ALTER TABLE [dbo].[legal_entities] DROP COLUMN [addressLine2];

IF COL_LENGTH('dbo.legal_entities', 'city') IS NOT NULL
  ALTER TABLE [dbo].[legal_entities] DROP COLUMN [city];

IF COL_LENGTH('dbo.legal_entities', 'state') IS NOT NULL
  ALTER TABLE [dbo].[legal_entities] DROP COLUMN [state];

IF COL_LENGTH('dbo.legal_entities', 'postalCode') IS NOT NULL
  ALTER TABLE [dbo].[legal_entities] DROP COLUMN [postalCode];

IF COL_LENGTH('dbo.legal_entities', 'countryCode') IS NOT NULL
  ALTER TABLE [dbo].[legal_entities] DROP COLUMN [countryCode];

IF COL_LENGTH('dbo.legal_entities', 'isDefault') IS NOT NULL
  ALTER TABLE [dbo].[legal_entities] DROP COLUMN [isDefault];
