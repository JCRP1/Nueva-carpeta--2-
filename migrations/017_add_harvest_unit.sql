IF COL_LENGTH('dbo.Cosechas', 'unidad_cosecha') IS NULL
BEGIN
  ALTER TABLE dbo.Cosechas
  ADD unidad_cosecha NVARCHAR(20) NULL
      CONSTRAINT DF_Cosechas_UnidadCosecha DEFAULT ('kg');
END;

IF COL_LENGTH('dbo.Cosechas', 'cantidad_unidades') IS NULL
BEGIN
  ALTER TABLE dbo.Cosechas
  ADD cantidad_unidades DECIMAL(14, 2) NULL
      CONSTRAINT DF_Cosechas_CantidadUnidades DEFAULT (0);
END;

EXEC sp_executesql N'
  UPDATE dbo.Cosechas
  SET unidad_cosecha = ''kg''
  WHERE unidad_cosecha IS NULL;
';

EXEC sp_executesql N'
  UPDATE dbo.Cosechas
  SET cantidad_unidades = 0
  WHERE cantidad_unidades IS NULL;
';
