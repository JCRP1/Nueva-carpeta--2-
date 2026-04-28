CREATE OR ALTER PROCEDURE dbo.sp_EvaluarReglas
  @ZonaID INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    CAST(NULL AS INT) AS ReglaID,
    CONCAT('Validar ', s.tipo, ' en zona ', z.nombre) AS Nombre,
    'rango' AS Operador,
    CAST(NULL AS DECIMAL(10, 2)) AS ValorUmbral,
    CASE
      WHEN ls.valor IS NULL THEN 'sin_lectura'
      WHEN s.tipo = 'humedad_suelo' AND ls.valor < COALESCE(s.rango_min, z.umbral_humedad) THEN 'iniciar_riego'
      WHEN s.rango_min IS NOT NULL AND ls.valor < s.rango_min THEN 'alerta_baja'
      WHEN s.rango_max IS NOT NULL AND ls.valor > s.rango_max THEN 'alerta_alta'
      ELSE 'ninguna'
    END AS AccionTipo,
    CONCAT(
      '{"sensorId":', s.id_sensor,
      ',"zonaId":', z.id_zona,
      ',"tipo":"', s.tipo,
      '","unidad":"', COALESCE(ls.unidad, s.unidad_medida, ''),
      '"}'
    ) AS AccionParametros,
    s.tipo AS TipoSensor,
    ls.valor AS UltimaLectura,
    ls.fecha_hora AS FechaLectura,
    s.rango_min AS UmbralMin,
    s.rango_max AS UmbralMax,
    COALESCE(ls.unidad, s.unidad_medida) AS Unidad,
    CASE
      WHEN ls.valor IS NULL THEN 'sin_datos'
      WHEN s.rango_min IS NOT NULL AND ls.valor < s.rango_min THEN 'bajo'
      WHEN s.rango_max IS NOT NULL AND ls.valor > s.rango_max THEN 'alto'
      ELSE 'normal'
    END AS EstadoLectura
  FROM dbo.ZonasRiego z
  INNER JOIN dbo.Sensores s
    ON s.id_zona = z.id_zona
  OUTER APPLY (
    SELECT TOP 1
      l.valor,
      l.unidad,
      l.fecha_hora
    FROM dbo.LecturasSensores l
    WHERE l.id_sensor = s.id_sensor
    ORDER BY l.fecha_hora DESC
  ) ls
  WHERE z.id_zona = @ZonaID
  ORDER BY s.tipo, s.id_sensor;
END;
