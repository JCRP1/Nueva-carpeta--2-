IF COL_LENGTH('Personas', 'id_invernadero') IS NULL
BEGIN
  ALTER TABLE Personas ADD id_invernadero int NULL;
END;

IF COL_LENGTH('Personas', 'id_invernadero') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Personas_Invernaderos'
  )
BEGIN
  ALTER TABLE Personas
    ADD CONSTRAINT FK_Personas_Invernaderos
    FOREIGN KEY (id_invernadero) REFERENCES Invernaderos(id_invernadero);
END;

IF COL_LENGTH('CultivoDetalle', 'cantidad_plantas') IS NULL
BEGIN
  ALTER TABLE CultivoDetalle ADD cantidad_plantas int NULL;
END;

IF COL_LENGTH('CultivoDetalle', 'fecha_cosecha_real') IS NULL
BEGIN
  ALTER TABLE CultivoDetalle ADD fecha_cosecha_real date NULL;
END;

IF COL_LENGTH('CultivoDetalle', 'rendimiento_kg') IS NULL
BEGIN
  ALTER TABLE CultivoDetalle ADD rendimiento_kg decimal(12, 2) NULL;
END;

IF COL_LENGTH('CultivoDetalle', 'calidad_cosecha') IS NULL
BEGIN
  ALTER TABLE CultivoDetalle ADD calidad_cosecha nvarchar(50) NULL;
END;
