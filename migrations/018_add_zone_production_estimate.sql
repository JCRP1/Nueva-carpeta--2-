IF COL_LENGTH('dbo.ZonasRiego', 'rendimiento_por_mata') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego
  ADD rendimiento_por_mata DECIMAL(12, 4) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'unidad_rendimiento') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego
  ADD unidad_rendimiento NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'produccion_estimada') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego
  ADD produccion_estimada DECIMAL(14, 4) NULL;
END;
