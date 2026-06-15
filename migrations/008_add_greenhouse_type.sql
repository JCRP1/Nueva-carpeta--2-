IF COL_LENGTH('Invernaderos', 'tipo') IS NULL
BEGIN
  ALTER TABLE Invernaderos
  ADD tipo NVARCHAR(50) NOT NULL
    CONSTRAINT DF_Invernaderos_Tipo DEFAULT 'Tunel';
END;
