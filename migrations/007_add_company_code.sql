IF COL_LENGTH('Empresas', 'codigo_empresa') IS NULL
BEGIN
  ALTER TABLE Empresas
  ADD codigo_empresa NVARCHAR(30) NULL;
END;

UPDATE Empresas
SET codigo_empresa = 'EMP-' + RIGHT('0000' + CONVERT(VARCHAR(10), id_empresa - 1), 4)
WHERE codigo_empresa IS NULL
   OR LTRIM(RTRIM(codigo_empresa)) = ''
   OR UPPER(codigo_empresa) LIKE 'GS-%';

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('Empresas')
    AND name = 'codigo_empresa'
    AND is_nullable = 1
)
BEGIN
  ALTER TABLE Empresas
  ALTER COLUMN codigo_empresa NVARCHAR(30) NOT NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_Empresas_CodigoEmpresa'
    AND object_id = OBJECT_ID('Empresas')
)
BEGIN
  CREATE UNIQUE INDEX UX_Empresas_CodigoEmpresa
  ON Empresas(codigo_empresa);
END;
