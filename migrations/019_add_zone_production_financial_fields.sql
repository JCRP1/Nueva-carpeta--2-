IF COL_LENGTH('dbo.ZonasRiego', 'rendimiento_por_mata') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD rendimiento_por_mata DECIMAL(12, 2) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'unidad_rendimiento') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD unidad_rendimiento NVARCHAR(30) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'produccion_estimada') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD produccion_estimada DECIMAL(14, 2) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'costo_por_mata') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD costo_por_mata DECIMAL(14, 2) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'precio_mercado') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD precio_mercado DECIMAL(14, 2) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'costo_total_matas') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD costo_total_matas DECIMAL(14, 2) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'ingreso_estimado') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD ingreso_estimado DECIMAL(14, 2) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'margen_estimado') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD margen_estimado DECIMAL(14, 2) NULL;
END;

IF COL_LENGTH('dbo.ZonasRiego', 'margen_porcentaje') IS NULL
BEGIN
  ALTER TABLE dbo.ZonasRiego ADD margen_porcentaje DECIMAL(8, 2) NULL;
END;
