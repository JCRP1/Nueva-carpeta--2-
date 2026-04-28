IF COL_LENGTH('dbo.Sensores', 'id_zona') IS NULL
BEGIN
  ALTER TABLE dbo.Sensores
  ADD id_zona INT NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_Sensores_ZonasRiego'
    AND parent_object_id = OBJECT_ID('dbo.Sensores')
)
BEGIN
  ALTER TABLE dbo.Sensores WITH CHECK
  ADD CONSTRAINT FK_Sensores_ZonasRiego
  FOREIGN KEY (id_zona) REFERENCES dbo.ZonasRiego(id_zona);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Sensores_IdZona_Tipo'
    AND object_id = OBJECT_ID('dbo.Sensores')
)
BEGIN
  CREATE INDEX IX_Sensores_IdZona_Tipo
  ON dbo.Sensores(id_zona, tipo);
END;
