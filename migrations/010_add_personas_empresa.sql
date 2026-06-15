IF COL_LENGTH('Personas', 'id_empresa') IS NULL
BEGIN
  ALTER TABLE Personas ADD id_empresa int NULL;
END;

IF COL_LENGTH('Personas', 'id_empresa') IS NOT NULL
BEGIN
  UPDATE p
  SET p.id_empresa = i.id_empresa
  FROM Personas p
  INNER JOIN Invernaderos i ON p.id_invernadero = i.id_invernadero
  WHERE p.id_empresa IS NULL;
END;

IF COL_LENGTH('Personas', 'id_empresa') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Personas_Empresas'
  )
BEGIN
  ALTER TABLE Personas
    ADD CONSTRAINT FK_Personas_Empresas
    FOREIGN KEY (id_empresa) REFERENCES Empresas(id_empresa);
END;
