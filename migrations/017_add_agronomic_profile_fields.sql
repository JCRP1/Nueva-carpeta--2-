IF COL_LENGTH('dbo.CultivoPerfilAgronomico', 'agua_aproximada') IS NULL
BEGIN
  ALTER TABLE dbo.CultivoPerfilAgronomico
  ADD agua_aproximada NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.CultivoPerfilAgronomico', 'fertilizantes') IS NULL
BEGIN
  ALTER TABLE dbo.CultivoPerfilAgronomico
  ADD fertilizantes NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.CultivoPerfilAgronomico', 'abonos') IS NULL
BEGIN
  ALTER TABLE dbo.CultivoPerfilAgronomico
  ADD abonos NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.CultivoPerfilAgronomico', 'rendimiento_por_mata') IS NULL
BEGIN
  ALTER TABLE dbo.CultivoPerfilAgronomico
  ADD rendimiento_por_mata NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.CultivoPerfilAgronomico', 'plagas') IS NULL
BEGIN
  ALTER TABLE dbo.CultivoPerfilAgronomico
  ADD plagas NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.CultivoPerfilAgronomico', 'meses_recomendados') IS NULL
BEGIN
  ALTER TABLE dbo.CultivoPerfilAgronomico
  ADD meses_recomendados NVARCHAR(MAX) NULL;
END;
