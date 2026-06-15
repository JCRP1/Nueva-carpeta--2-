IF COL_LENGTH('ZonasRiego', 'cantidad_cultivo') IS NULL
BEGIN
  ALTER TABLE ZonasRiego ADD cantidad_cultivo int NULL;
END
