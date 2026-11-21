-- Keep tenants.aspProvider column; remove only the default 'FAKE' constraint.

DECLARE @sql nvarchar(max);
SELECT @sql = STRING_AGG(
  'ALTER TABLE [dbo].[tenants] DROP CONSTRAINT [' + dc.name + '];',
  CHAR(10)
)
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
INNER JOIN sys.tables t ON t.object_id = dc.parent_object_id
WHERE t.name = 'tenants'
  AND SCHEMA_NAME(t.schema_id) = 'dbo'
  AND c.name = 'aspProvider';

IF @sql IS NOT NULL EXEC sp_executesql @sql;
