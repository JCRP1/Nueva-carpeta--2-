IF COL_LENGTH('dbo.Cosechas', 'cantidad_disponible_kg') IS NULL
BEGIN
  ALTER TABLE dbo.Cosechas
  ADD cantidad_disponible_kg DECIMAL(14, 2) NULL;
END;

EXEC sp_executesql N'
  UPDATE co
  SET cantidad_disponible_kg = CASE
    WHEN ISNULL(co.cantidad_cosechada_kg, 0) - ISNULL(ventas.kg_vendidos, 0) < 0 THEN 0
    ELSE ISNULL(co.cantidad_cosechada_kg, 0) - ISNULL(ventas.kg_vendidos, 0)
  END
  FROM dbo.Cosechas co
  OUTER APPLY (
    SELECT SUM(v.cantidad_kg) AS kg_vendidos
    FROM dbo.VentasCosecha v
    WHERE v.id_cosecha = co.id_cosecha
  ) ventas
  WHERE co.cantidad_disponible_kg IS NULL;
';
