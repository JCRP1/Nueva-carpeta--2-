IF OBJECT_ID('dbo.SuscripcionesPush', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.SuscripcionesPush;
END;

DELETE FROM dbo.ConfiguracionesSistema
WHERE parametro = 'notifPush';
