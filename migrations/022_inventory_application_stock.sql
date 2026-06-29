IF COL_LENGTH('dbo.Fertilizantes', 'cantidad_disponible') IS NULL
BEGIN
  ALTER TABLE dbo.Fertilizantes
  ADD cantidad_disponible DECIMAL(14, 2) NULL
      CONSTRAINT DF_Fertilizantes_CantidadDisponible DEFAULT (0);
END;

IF COL_LENGTH('dbo.Fertilizantes', 'unidad_medida') IS NULL
BEGIN
  ALTER TABLE dbo.Fertilizantes
  ADD unidad_medida NVARCHAR(30) NULL;
END;

IF COL_LENGTH('dbo.ControlPlagas', 'id_fertilizante') IS NULL
BEGIN
  ALTER TABLE dbo.ControlPlagas
  ADD id_fertilizante INT NULL;
END;

IF COL_LENGTH('dbo.ControlPlagas', 'cantidad_aplicada') IS NULL
BEGIN
  ALTER TABLE dbo.ControlPlagas
  ADD cantidad_aplicada DECIMAL(14, 2) NULL;
END;

EXEC sp_executesql N'
  UPDATE dbo.Fertilizantes
  SET cantidad_disponible = 0
  WHERE cantidad_disponible IS NULL;
';

IF OBJECT_ID('dbo.FK_ControlPlagas_Fertilizantes', 'F') IS NULL
   AND OBJECT_ID('dbo.ControlPlagas', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.Fertilizantes', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.ControlPlagas WITH CHECK
  ADD CONSTRAINT FK_ControlPlagas_Fertilizantes
  FOREIGN KEY (id_fertilizante) REFERENCES dbo.Fertilizantes(id_fertilizante);
END;
