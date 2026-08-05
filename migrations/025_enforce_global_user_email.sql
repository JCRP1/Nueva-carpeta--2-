IF OBJECT_ID('dbo.Usuarios', 'U') IS NOT NULL
BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.Usuarios
    WHERE correo IS NULL OR LTRIM(RTRIM(correo)) = ''
  )
  BEGIN
    THROW 50025, 'No se puede aplicar la regla: existen usuarios sin correo.', 1;
  END;

  IF EXISTS (
    SELECT 1
    FROM dbo.Usuarios
    GROUP BY LOWER(LTRIM(RTRIM(correo)))
    HAVING COUNT(*) > 1
  )
  BEGIN
    THROW 50026, 'No se puede aplicar la regla: existen correos repetidos en Usuarios.', 1;
  END;

  IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Usuarios')
      AND name = 'correo'
      AND is_nullable = 1
  )
  BEGIN
    ALTER TABLE dbo.Usuarios
    ALTER COLUMN correo NVARCHAR(255) NOT NULL;
  END;

  IF COL_LENGTH('dbo.Usuarios', 'correo_normalizado') IS NULL
  BEGIN
    ALTER TABLE dbo.Usuarios
    ADD correo_normalizado AS LOWER(LTRIM(RTRIM(correo))) PERSISTED;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Usuarios')
      AND is_unique = 1
      AND name = 'UX_Usuarios_Correo_Normalizado_Global'
  )
  BEGIN
    CREATE UNIQUE INDEX UX_Usuarios_Correo_Normalizado_Global
    ON dbo.Usuarios(correo_normalizado);
  END;
END;
