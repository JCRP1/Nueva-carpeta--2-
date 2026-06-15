IF COL_LENGTH('dbo.Cosechas', 'id_zona') IS NULL
BEGIN
  ALTER TABLE dbo.Cosechas ADD id_zona int NULL;
END

IF COL_LENGTH('dbo.Cosechas', 'id_zona') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM sys.foreign_keys
     WHERE name = 'FK_Cosechas_ZonasRiego'
       AND parent_object_id = OBJECT_ID('dbo.Cosechas')
   )
BEGIN
  ALTER TABLE dbo.Cosechas WITH CHECK
  ADD CONSTRAINT FK_Cosechas_ZonasRiego
  FOREIGN KEY (id_zona) REFERENCES dbo.ZonasRiego(id_zona);
END

IF COL_LENGTH('dbo.Cosechas', 'id_zona') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM sys.indexes
     WHERE name = 'IX_Cosechas_id_zona'
       AND object_id = OBJECT_ID('dbo.Cosechas')
   )
BEGIN
  CREATE INDEX IX_Cosechas_id_zona
  ON dbo.Cosechas(id_zona);
END
