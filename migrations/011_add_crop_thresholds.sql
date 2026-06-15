IF COL_LENGTH('CultivoDetalle', 'umbral_humedad') IS NULL
BEGIN
  ALTER TABLE CultivoDetalle ADD umbral_humedad decimal(5, 2) NULL;
END

IF COL_LENGTH('CultivoDetalle', 'umbral_ph') IS NULL
BEGIN
  ALTER TABLE CultivoDetalle ADD umbral_ph decimal(4, 2) NULL;
END

IF COL_LENGTH('CultivoDetalle', 'umbral_ec') IS NULL
BEGIN
  ALTER TABLE CultivoDetalle ADD umbral_ec decimal(5, 2) NULL;
END

IF COL_LENGTH('CultivoDetalle', 'umbral_tds') IS NULL
BEGIN
  ALTER TABLE CultivoDetalle ADD umbral_tds decimal(6, 2) NULL;
END
