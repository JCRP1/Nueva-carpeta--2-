IF OBJECT_ID('dbo.Inventario', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Inventario (
    id_producto INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    id_fertilizante_origen INT NULL,
    nombre NVARCHAR(150) NOT NULL,
    tipo NVARCHAR(80) NOT NULL,
    categoria NVARCHAR(80) NULL,
    composicion NVARCHAR(MAX) NULL,
    fabricante NVARCHAR(150) NULL,
    ph DECIMAL(6, 2) NULL,
    nitrogeno DECIMAL(6, 2) NULL,
    fosforo DECIMAL(6, 2) NULL,
    potasio DECIMAL(6, 2) NULL,
    micronutrientes NVARCHAR(MAX) NULL,
    forma_aplicacion NVARCHAR(150) NULL,
    riesgos NVARCHAR(MAX) NULL,
    cantidad_disponible DECIMAL(14, 2) NOT NULL CONSTRAINT DF_Inventario_CantidadDisponible DEFAULT (0),
    unidad_medida NVARCHAR(30) NULL,
    ubicacion NVARCHAR(150) NULL,
    notas NVARCHAR(MAX) NULL,
    id_empresa INT NULL,
    fecha_registro DATETIME NOT NULL CONSTRAINT DF_Inventario_FechaRegistro DEFAULT (GETDATE())
  );
END;

IF OBJECT_ID('dbo.Fertilizantes', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.Fertilizantes', 'id_fertilizante') IS NOT NULL
   AND COL_LENGTH('dbo.Fertilizantes', 'nombre') IS NOT NULL
BEGIN
  DECLARE @sqlMigrarFertilizantes NVARCHAR(MAX);
  DECLARE @tipoExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'tipo') IS NOT NULL THEN N'ISNULL(NULLIF(f.tipo, ''''), ''Fertilizante'')' ELSE N'''Fertilizante''' END;
  DECLARE @composicionExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'composicion') IS NOT NULL THEN N'f.composicion' ELSE N'NULL' END;
  DECLARE @fabricanteExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'fabricante') IS NOT NULL THEN N'f.fabricante' ELSE N'NULL' END;
  DECLARE @phExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'ph') IS NOT NULL THEN N'f.ph' ELSE N'NULL' END;
  DECLARE @nitrogenoExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'nitrogeno') IS NOT NULL THEN N'f.nitrogeno' ELSE N'NULL' END;
  DECLARE @fosforoExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'fosforo') IS NOT NULL THEN N'f.fosforo' ELSE N'NULL' END;
  DECLARE @potasioExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'potasio') IS NOT NULL THEN N'f.potasio' ELSE N'NULL' END;
  DECLARE @micronutrientesExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'micronutrientes') IS NOT NULL THEN N'f.micronutrientes' ELSE N'NULL' END;
  DECLARE @formaAplicacionExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'forma_aplicacion') IS NOT NULL THEN N'f.forma_aplicacion' ELSE N'NULL' END;
  DECLARE @riesgosExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'riesgos') IS NOT NULL THEN N'f.riesgos' ELSE N'NULL' END;
  DECLARE @cantidadExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'cantidad_disponible') IS NOT NULL THEN N'ISNULL(f.cantidad_disponible, 0)' ELSE N'0' END;
  DECLARE @unidadExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'unidad_medida') IS NOT NULL THEN N'f.unidad_medida' ELSE N'NULL' END;
  DECLARE @empresaExpr NVARCHAR(MAX) = CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'id_empresa') IS NOT NULL THEN N'f.id_empresa' ELSE N'NULL' END;

  SET @sqlMigrarFertilizantes = N'
    INSERT INTO dbo.Inventario (
      id_fertilizante_origen,
      nombre,
      tipo,
      categoria,
      composicion,
      fabricante,
      ph,
      nitrogeno,
      fosforo,
      potasio,
      micronutrientes,
      forma_aplicacion,
      riesgos,
      cantidad_disponible,
      unidad_medida,
      id_empresa
    )
    SELECT
      f.id_fertilizante,
      f.nombre,
      ' + @tipoExpr + N',
      ''Fertilizante'',
      ' + @composicionExpr + N',
      ' + @fabricanteExpr + N',
      ' + @phExpr + N',
      ' + @nitrogenoExpr + N',
      ' + @fosforoExpr + N',
      ' + @potasioExpr + N',
      ' + @micronutrientesExpr + N',
      ' + @formaAplicacionExpr + N',
      ' + @riesgosExpr + N',
      ' + @cantidadExpr + N',
      ' + @unidadExpr + N',
      ' + @empresaExpr + N'
    FROM dbo.Fertilizantes f
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.Inventario i
      WHERE i.id_fertilizante_origen = f.id_fertilizante
    );
  ';

  EXEC sp_executesql @sqlMigrarFertilizantes;
END;

IF COL_LENGTH('dbo.ControlPlagas', 'id_producto_inventario') IS NULL
BEGIN
  ALTER TABLE dbo.ControlPlagas
  ADD id_producto_inventario INT NULL;
END;

IF COL_LENGTH('dbo.ControlPlagas', 'cantidad_aplicada') IS NULL
BEGIN
  ALTER TABLE dbo.ControlPlagas
  ADD cantidad_aplicada DECIMAL(14, 2) NULL;
END;

IF OBJECT_ID('dbo.ControlPlagas', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.ControlPlagas', 'id_producto_inventario') IS NOT NULL
   AND COL_LENGTH('dbo.ControlPlagas', 'id_fertilizante') IS NOT NULL
BEGIN
  EXEC sp_executesql N'
    UPDATE cp
    SET id_producto_inventario = i.id_producto
    FROM dbo.ControlPlagas cp
    INNER JOIN dbo.Inventario i ON i.id_fertilizante_origen = cp.id_fertilizante
    WHERE cp.id_producto_inventario IS NULL
      AND cp.id_fertilizante IS NOT NULL;
  ';
END;

IF OBJECT_ID('dbo.FK_ControlPlagas_Inventario', 'F') IS NULL
   AND OBJECT_ID('dbo.ControlPlagas', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.Inventario', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.ControlPlagas WITH CHECK
  ADD CONSTRAINT FK_ControlPlagas_Inventario
  FOREIGN KEY (id_producto_inventario) REFERENCES dbo.Inventario(id_producto);
END;
