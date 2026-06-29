IF COL_LENGTH('dbo.ZonasRiego', 'fertilizante_estimado') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD fertilizante_estimado NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'abono_estimado') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD abono_estimado NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'recomendacion_siembra') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD recomendacion_siembra NVARCHAR(MAX) NULL;
END;
