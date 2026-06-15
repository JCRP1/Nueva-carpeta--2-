IF COL_LENGTH('Cultivos', 'umbral_humedad') IS NULL
BEGIN
  ALTER TABLE Cultivos ADD umbral_humedad decimal(5, 2) NULL;
END

IF COL_LENGTH('Cultivos', 'umbral_ph') IS NULL
BEGIN
  ALTER TABLE Cultivos ADD umbral_ph decimal(4, 2) NULL;
END

IF COL_LENGTH('Cultivos', 'umbral_ec') IS NULL
BEGIN
  ALTER TABLE Cultivos ADD umbral_ec decimal(5, 2) NULL;
END

IF COL_LENGTH('Cultivos', 'umbral_tds') IS NULL
BEGIN
  ALTER TABLE Cultivos ADD umbral_tds decimal(6, 2) NULL;
END

IF COL_LENGTH('CultivoDetalle', 'umbral_humedad') IS NOT NULL
BEGIN
  EXEC(N'
    UPDATE c
    SET
      c.umbral_humedad = COALESCE(c.umbral_humedad, d.umbral_humedad),
      c.umbral_ph = COALESCE(c.umbral_ph, d.umbral_ph),
      c.umbral_ec = COALESCE(c.umbral_ec, d.umbral_ec),
      c.umbral_tds = COALESCE(c.umbral_tds, d.umbral_tds)
    FROM Cultivos c
    OUTER APPLY (
      SELECT TOP 1 umbral_humedad, umbral_ph, umbral_ec, umbral_tds
      FROM CultivoDetalle
      WHERE id_cultivo = c.id_cultivo
      ORDER BY id_detalle DESC
    ) d;
  ');
END

IF COL_LENGTH('ZonasRiego', 'fecha_siembra') IS NULL
BEGIN
  ALTER TABLE ZonasRiego ADD fecha_siembra date NULL;
END

IF COL_LENGTH('ZonasRiego', 'fecha_cosecha_estimada') IS NULL
BEGIN
  ALTER TABLE ZonasRiego ADD fecha_cosecha_estimada date NULL;
END

IF COL_LENGTH('ZonasRiego', 'tiempo_germinacion_dias') IS NULL
BEGIN
  ALTER TABLE ZonasRiego ADD tiempo_germinacion_dias int NULL;
END

IF COL_LENGTH('ZonasRiego', 'tiempo_crecimiento_dias') IS NULL
BEGIN
  ALTER TABLE ZonasRiego ADD tiempo_crecimiento_dias int NULL;
END

IF COL_LENGTH('ZonasRiego', 'tiempo_cosecha_dias') IS NULL
BEGIN
  ALTER TABLE ZonasRiego ADD tiempo_cosecha_dias int NULL;
END

IF COL_LENGTH('ZonasRiego', 'notas_cultivo') IS NULL
BEGIN
  ALTER TABLE ZonasRiego ADD notas_cultivo nvarchar(max) NULL;
END
