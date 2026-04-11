ALTER TABLE DispositivosIoT
ADD codigo_dispositivo NVARCHAR(100) NULL;

UPDATE DispositivosIoT
SET codigo_dispositivo = UPPER(
  CONCAT(
    'DEV-',
    RIGHT('0000' + CAST(id_dispositivo AS VARCHAR(10)), 4)
  )
)
WHERE codigo_dispositivo IS NULL;

ALTER TABLE DispositivosIoT
ALTER COLUMN codigo_dispositivo NVARCHAR(100) NOT NULL;

CREATE UNIQUE INDEX UX_DispositivosIoT_CodigoDispositivo
ON DispositivosIoT(codigo_dispositivo);
