/* =========================================================
   Catalogo comun de cultivos y datos productivos por siembra
   Ejecutar despues de 016_seed_cultivos_rd_catalog.sql
   ========================================================= */

BEGIN TRANSACTION;

IF OBJECT_ID('dbo.CatalogoCultivos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CatalogoCultivos (
    id_catalogo int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre nvarchar(100) NOT NULL,
    variedad nvarchar(100) NULL,
    categoria nvarchar(100) NULL,
    umbral_humedad decimal(5,2) NULL,
    umbral_temperatura decimal(5,2) NULL,
    umbral_ph decimal(4,2) NULL,
    umbral_ec decimal(5,2) NULL,
    umbral_tds decimal(6,2) NULL,
    agua_litros_por_mata_dia decimal(10,2) NULL,
    rendimiento_por_mata decimal(10,2) NULL,
    unidad_rendimiento nvarchar(30) NULL,
    fertilizantes nvarchar(max) NULL,
    abonos nvarchar(max) NULL,
    plagas_comunes nvarchar(max) NULL,
    tratamiento_recomendado nvarchar(max) NULL,
    mejores_meses nvarchar(200) NULL,
    recomendacion_siembra nvarchar(max) NULL,
    activo bit NOT NULL CONSTRAINT DF_CatalogoCultivos_activo DEFAULT 1,
    fecha_creacion datetime NOT NULL CONSTRAINT DF_CatalogoCultivos_fecha DEFAULT GETDATE(),
    fecha_actualizacion datetime NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UX_CatalogoCultivos_nombre_variedad'
    AND object_id = OBJECT_ID('dbo.CatalogoCultivos')
)
BEGIN
  CREATE UNIQUE INDEX UX_CatalogoCultivos_nombre_variedad
  ON dbo.CatalogoCultivos(nombre, variedad);
END;

IF COL_LENGTH('dbo.Cultivos', 'umbral_temperatura') IS NULL
  ALTER TABLE dbo.Cultivos ADD umbral_temperatura decimal(5,2) NULL;

IF COL_LENGTH('dbo.Cultivos', 'agua_litros_por_mata_dia') IS NULL
  ALTER TABLE dbo.Cultivos ADD agua_litros_por_mata_dia decimal(10,2) NULL;

IF COL_LENGTH('dbo.Cultivos', 'rendimiento_por_mata') IS NULL
  ALTER TABLE dbo.Cultivos ADD rendimiento_por_mata decimal(10,2) NULL;

IF COL_LENGTH('dbo.Cultivos', 'unidad_rendimiento') IS NULL
  ALTER TABLE dbo.Cultivos ADD unidad_rendimiento nvarchar(30) NULL;

IF COL_LENGTH('dbo.Cultivos', 'fertilizantes') IS NULL
  ALTER TABLE dbo.Cultivos ADD fertilizantes nvarchar(max) NULL;

IF COL_LENGTH('dbo.Cultivos', 'abonos') IS NULL
  ALTER TABLE dbo.Cultivos ADD abonos nvarchar(max) NULL;

IF COL_LENGTH('dbo.Cultivos', 'plagas_comunes') IS NULL
  ALTER TABLE dbo.Cultivos ADD plagas_comunes nvarchar(max) NULL;

IF COL_LENGTH('dbo.Cultivos', 'tratamiento_recomendado') IS NULL
  ALTER TABLE dbo.Cultivos ADD tratamiento_recomendado nvarchar(max) NULL;

IF COL_LENGTH('dbo.Cultivos', 'mejores_meses') IS NULL
  ALTER TABLE dbo.Cultivos ADD mejores_meses nvarchar(200) NULL;

IF COL_LENGTH('dbo.Cultivos', 'recomendacion_siembra') IS NULL
  ALTER TABLE dbo.Cultivos ADD recomendacion_siembra nvarchar(max) NULL;

IF COL_LENGTH('dbo.ZonasRiego', 'rendimiento_estimado') IS NULL
  ALTER TABLE dbo.ZonasRiego ADD rendimiento_estimado decimal(12,2) NULL;

IF COL_LENGTH('dbo.ZonasRiego', 'unidad_rendimiento') IS NULL
  ALTER TABLE dbo.ZonasRiego ADD unidad_rendimiento nvarchar(30) NULL;

IF COL_LENGTH('dbo.ZonasRiego', 'agua_estimada_litros_dia') IS NULL
  ALTER TABLE dbo.ZonasRiego ADD agua_estimada_litros_dia decimal(12,2) NULL;

IF COL_LENGTH('dbo.ZonasRiego', 'humedad_siembra') IS NULL
  ALTER TABLE dbo.ZonasRiego ADD humedad_siembra decimal(5,2) NULL;

IF COL_LENGTH('dbo.ZonasRiego', 'temperatura_siembra') IS NULL
  ALTER TABLE dbo.ZonasRiego ADD temperatura_siembra decimal(5,2) NULL;

IF COL_LENGTH('dbo.ZonasRiego', 'ph_siembra') IS NULL
  ALTER TABLE dbo.ZonasRiego ADD ph_siembra decimal(4,2) NULL;

IF COL_LENGTH('dbo.ZonasRiego', 'ec_siembra') IS NULL
  ALTER TABLE dbo.ZonasRiego ADD ec_siembra decimal(5,2) NULL;

IF COL_LENGTH('dbo.ZonasRiego', 'tds_siembra') IS NULL
  ALTER TABLE dbo.ZonasRiego ADD tds_siembra decimal(6,2) NULL;

IF COL_LENGTH('dbo.Cosechas', 'cantidad_unidades') IS NULL
  ALTER TABLE dbo.Cosechas ADD cantidad_unidades decimal(12,2) NULL;

IF COL_LENGTH('dbo.Cosechas', 'unidad_cosecha') IS NULL
  ALTER TABLE dbo.Cosechas ADD unidad_cosecha nvarchar(30) NULL;

IF COL_LENGTH('dbo.CostosCultivo', 'costo_mata') IS NULL
  ALTER TABLE dbo.CostosCultivo ADD costo_mata decimal(12,2) NULL;

IF COL_LENGTH('dbo.CostosCultivo', 'cantidad_matas') IS NULL
  ALTER TABLE dbo.CostosCultivo ADD cantidad_matas int NULL;

IF COL_LENGTH('dbo.CostosCultivo', 'precio_mercado') IS NULL
  ALTER TABLE dbo.CostosCultivo ADD precio_mercado decimal(12,2) NULL;

IF COL_LENGTH('dbo.CostosCultivo', 'unidad_precio_mercado') IS NULL
  ALTER TABLE dbo.CostosCultivo ADD unidad_precio_mercado nvarchar(30) NULL;

INSERT INTO dbo.CatalogoCultivos (
  nombre, variedad, categoria, umbral_humedad, umbral_temperatura, umbral_ph, umbral_ec, umbral_tds,
  agua_litros_por_mata_dia, rendimiento_por_mata, unidad_rendimiento,
  fertilizantes, abonos, plagas_comunes, tratamiento_recomendado, mejores_meses, recomendacion_siembra
)
SELECT src.nombre, src.variedad, src.categoria, src.umbral_humedad, src.umbral_temperatura, src.umbral_ph, src.umbral_ec, src.umbral_tds,
       src.agua_litros_por_mata_dia, src.rendimiento_por_mata, src.unidad_rendimiento,
       src.fertilizantes, src.abonos, src.plagas_comunes, src.tratamiento_recomendado, src.mejores_meses, src.recomendacion_siembra
FROM (
  VALUES
    (N'Tomate de ensalada', N'Roma', N'Hortalizas', 65, 27, 6.2, 2.5, 1250, 1.8, 4.0, N'lb', N'18-18-18 en crecimiento; 12-12-36 y calcio en produccion', N'Compost maduro o humus antes del trasplante', N'Mosca blanca, trips, tuta absoluta, botrytis', N'Manejo integrado: trampas, monitoreo, poda sanitaria y producto autorizado segun tecnico', N'enero, febrero, marzo, octubre, noviembre, diciembre', N'Mejor con temperaturas moderadas y buena ventilacion. Evitar humedad foliar prolongada.'),
    (N'Tomate industria', N'Industrial', N'Hortalizas', 65, 27, 6.2, 2.5, 1250, 1.7, 3.5, N'lb', N'18-18-18; 12-12-36 en llenado', N'Materia organica madura', N'Mosca blanca, trips, antracnosis', N'Monitoreo semanal y control preventivo autorizado', N'enero, febrero, marzo, octubre, noviembre, diciembre', N'Priorizar uniformidad de floracion y maduracion.'),
    (N'Pepino', N'Slice', N'Hortalizas', 70, 28, 6.0, 2.0, 1000, 2.0, 3.0, N'lb', N'18-18-18; 15-5-30 en cosecha; calcio', N'Humus o compost bien curado', N'Mildiu, oidio, trips, acaros', N'Ventilacion, poda sanitaria y rotacion de productos autorizados', N'enero, febrero, marzo, abril, octubre, noviembre, diciembre', N'Requiere humedad estable sin encharcar y cosecha frecuente.'),
    (N'Lechuga', N'Romana', N'Hortalizas', 75, 22, 6.0, 1.2, 600, 0.35, 0.8, N'lb', N'20-10-20 suave; calcio; EC baja', N'Compost fino y sustrato fresco', N'Mildiu, pudricion basal, quemado de borde', N'Mantener ventilacion, calcio disponible y humedad sin saturar', N'enero, febrero, marzo, noviembre, diciembre', N'Preferir meses frescos o manejo de sombra/ventilacion.'),
    (N'Ajíes', N'Cubanelle', N'Hortalizas', 65, 27, 6.2, 2.0, 1000, 1.2, 1.5, N'lb', N'18-18-18; 12-12-36; calcio y boro', N'Compost maduro', N'Trips, afidos, acaros, antracnosis', N'Manejo integrado, trampas y control autorizado segun plaga', N'enero, febrero, marzo, octubre, noviembre, diciembre', N'Evitar exceso de humedad durante floracion y cosecha.'),
    (N'Berenjena', N'Black Beauty', N'Hortalizas', 65, 28, 6.0, 2.2, 1100, 1.4, 2.0, N'lb', N'18-18-18; potasio y calcio en fructificacion', N'Compost y materia organica', N'Mosca blanca, acaros, marchitez', N'Monitoreo preventivo, poda sanitaria y control autorizado', N'enero, febrero, marzo, octubre, noviembre, diciembre', N'Necesita buena ventilacion y tutorado.'),
    (N'Brócoli', N'Calabrese', N'Hortalizas', 70, 22, 6.5, 2.0, 1000, 0.8, 1.2, N'lb', N'20-10-20; calcio; boro', N'Compost maduro', N'Afidos, orugas, mildiu', N'Mallas, monitoreo y control biologico/quimico autorizado', N'enero, febrero, noviembre, diciembre', N'Rinde mejor en ambiente fresco.'),
    (N'Coliflor', N'Snowball', N'Hortalizas', 70, 22, 6.5, 2.0, 1000, 0.8, 1.5, N'lb', N'20-10-20; calcio; boro', N'Materia organica', N'Afidos, orugas, pudriciones', N'Control preventivo y ventilacion', N'enero, febrero, noviembre, diciembre', N'Evitar calor fuerte durante formacion de cabeza.'),
    (N'Melón', N'Cantaloupe', N'Frutales', 60, 29, 6.2, 2.0, 1000, 2.5, 4.0, N'lb', N'18-18-18; 12-12-36 en llenado', N'Compost y cama bien drenada', N'Mildiu, trips, afidos', N'Ventilacion, polinizacion y control autorizado', N'enero, febrero, marzo, abril, noviembre, diciembre', N'Requiere buena luz y cuidado del riego en maduracion.'),
    (N'Sandía', N'Crimson Sweet', N'Frutales', 65, 29, 6.2, 2.0, 1000, 3.0, 8.0, N'lb', N'18-18-18; potasio alto en llenado', N'Compost y suelo/sustrato drenado', N'Mildiu, afidos, trips', N'Monitoreo, ventilacion y control autorizado', N'enero, febrero, marzo, abril, noviembre, diciembre', N'Manejar riego para mejorar dulzor cerca de cosecha.')
) AS src(nombre, variedad, categoria, umbral_humedad, umbral_temperatura, umbral_ph, umbral_ec, umbral_tds, agua_litros_por_mata_dia, rendimiento_por_mata, unidad_rendimiento, fertilizantes, abonos, plagas_comunes, tratamiento_recomendado, mejores_meses, recomendacion_siembra)
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.CatalogoCultivos c
  WHERE LOWER(LTRIM(RTRIM(c.nombre))) = LOWER(LTRIM(RTRIM(src.nombre)))
    AND LOWER(LTRIM(RTRIM(ISNULL(c.variedad, '')))) = LOWER(LTRIM(RTRIM(ISNULL(src.variedad, ''))))
);

COMMIT TRANSACTION;
