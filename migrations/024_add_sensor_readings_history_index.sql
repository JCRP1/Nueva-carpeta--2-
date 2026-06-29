IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_LecturasSensores_IdSensor_FechaHora'
    AND object_id = OBJECT_ID('dbo.LecturasSensores')
)
BEGIN
  CREATE INDEX IX_LecturasSensores_IdSensor_FechaHora
  ON dbo.LecturasSensores(id_sensor, fecha_hora)
  INCLUDE (valor, unidad);
END
