IF OBJECT_ID('dbo.VentasCosecha', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.VentasCosecha (
    id_venta INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    id_cosecha INT NOT NULL,
    fecha_venta DATE NOT NULL,
    cantidad_kg DECIMAL(14, 2) NOT NULL CONSTRAINT DF_VentasCosecha_CantidadKg DEFAULT (0),
    precio_kg DECIMAL(14, 2) NOT NULL CONSTRAINT DF_VentasCosecha_PrecioKg DEFAULT (0),
    ingreso_total AS (cantidad_kg * precio_kg) PERSISTED,
    comprador NVARCHAR(150) NULL,
    observaciones NVARCHAR(MAX) NULL,
    fecha_registro DATETIME NOT NULL CONSTRAINT DF_VentasCosecha_FechaRegistro DEFAULT (GETDATE())
  );
END;

IF OBJECT_ID('dbo.CostosCultivo', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CostosCultivo (
    id_costo INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    id_zona INT NULL,
    id_cultivo INT NULL,
    concepto NVARCHAR(150) NOT NULL,
    monto DECIMAL(14, 2) NOT NULL CONSTRAINT DF_CostosCultivo_Monto DEFAULT (0),
    fecha DATE NOT NULL,
    descripcion NVARCHAR(MAX) NULL,
    fecha_registro DATETIME NOT NULL CONSTRAINT DF_CostosCultivo_FechaRegistro DEFAULT (GETDATE())
  );
END;

IF OBJECT_ID('dbo.VentasCosecha', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.FK_VentasCosecha_Cosechas', 'F') IS NULL
   AND OBJECT_ID('dbo.Cosechas', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.VentasCosecha WITH CHECK
  ADD CONSTRAINT FK_VentasCosecha_Cosechas
  FOREIGN KEY (id_cosecha) REFERENCES dbo.Cosechas(id_cosecha);
END;

IF OBJECT_ID('dbo.CostosCultivo', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.FK_CostosCultivo_ZonasRiego', 'F') IS NULL
   AND OBJECT_ID('dbo.ZonasRiego', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.CostosCultivo WITH CHECK
  ADD CONSTRAINT FK_CostosCultivo_ZonasRiego
  FOREIGN KEY (id_zona) REFERENCES dbo.ZonasRiego(id_zona);
END;

IF OBJECT_ID('dbo.CostosCultivo', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.FK_CostosCultivo_Cultivos', 'F') IS NULL
   AND OBJECT_ID('dbo.Cultivos', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.CostosCultivo WITH CHECK
  ADD CONSTRAINT FK_CostosCultivo_Cultivos
  FOREIGN KEY (id_cultivo) REFERENCES dbo.Cultivos(id_cultivo);
END;
