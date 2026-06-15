/* =========================================================
   Seed de cultivos desde lib/cultivos-rd-data.ts
   Ajusta @id_invernadero antes de ejecutar.
   Inserta en Cultivos y crea un CultivoDetalle base por cultivo.
   ========================================================= */

DECLARE @id_invernadero int = 1; -- CAMBIAR por el ID real del invernadero
DECLARE @fecha_siembra date = CAST(GETDATE() AS date);

BEGIN TRANSACTION;

DECLARE @CultivosRD TABLE (
  categoria nvarchar(100) NOT NULL,
  nombre nvarchar(100) NOT NULL,
  variedad nvarchar(100) NULL,
  duracion int NULL,
  germinacion int NULL,
  crecimiento int NULL,
  cosecha int NULL,
  rendimiento_kg_m2 decimal(10,2) NULL,
  umbral_humedad decimal(5,2) NULL,
  umbral_ph decimal(4,2) NULL,
  umbral_ec decimal(5,2) NULL,
  umbral_tds decimal(6,2) NULL
);

INSERT INTO @CultivosRD (categoria, nombre, variedad, duracion, germinacion, crecimiento, cosecha, rendimiento_kg_m2, umbral_humedad, umbral_ph, umbral_ec, umbral_tds)
VALUES
  (N'Cereales', N'Arroz', N'Indica', 150, 7, 100, 43, 0.6, 80, 6, 1.8, 900),
  (N'Cereales', N'Maíz', N'Híbrido amarillo', 120, 5, 75, 40, 0.8, 65, 6.2, 1.6, 800),
  (N'Cereales', N'Sorgo', N'Granífero', 130, 5, 85, 40, 0.5, 55, 6, 1.5, 750),
  (N'Oleaginosas', N'Maní', N'Valencia', 110, 7, 70, 33, 0.4, 55, 6.2, 1.3, 650),
  (N'Oleaginosas', N'Coco', N'Alto del Caribe', 2555, 90, 2000, 465, 1.5, 70, 6, 1.8, 900),
  (N'Leguminosas', N'Habichuela roja', N'Criolla', 120, 5, 75, 40, 0.5, 60, 6.3, 1.4, 700),
  (N'Leguminosas', N'Habichuela negra', N'Criolla', 120, 5, 75, 40, 0.5, 60, 6.3, 1.4, 700),
  (N'Leguminosas', N'Habichuela blanca', N'Blanca', 120, 5, 75, 40, 0.5, 60, 6.3, 1.4, 700),
  (N'Leguminosas', N'Guandul', N'Enano', 150, 7, 100, 43, 0.7, 58, 6.2, 1.5, 750),
  (N'Raíces y Tubérculos', N'Batata', N'Criolla', 140, 10, 90, 40, 2.5, 65, 5.8, 1.5, 750),
  (N'Raíces y Tubérculos', N'Ñame', N'Espino', 360, 30, 250, 80, 3.5, 70, 6, 1.6, 800),
  (N'Raíces y Tubérculos', N'Papa', N'Granola', 110, 10, 70, 30, 3, 70, 5.5, 1.8, 900),
  (N'Raíces y Tubérculos', N'Yautía', N'Blanca', 450, 30, 320, 100, 3, 75, 6, 1.6, 800),
  (N'Raíces y Tubérculos', N'Yuca', N'Valencia', 300, 14, 220, 66, 3.5, 55, 5.8, 1.3, 650),
  (N'Raíces y Tubérculos', N'Mapuey', N'Amarillo', 480, 30, 350, 100, 3, 70, 6, 1.5, 750),
  (N'Musáceas', N'Plátano', N'Barraganete', 360, 30, 250, 80, 3.5, 75, 6, 2, 1000),
  (N'Musáceas', N'Guineo (Banano)', N'Cavendish', 330, 30, 230, 70, 4, 75, 6, 2.1, 1050),
  (N'Hortalizas', N'Ajíes', N'Cubanelle', 150, 10, 90, 50, 4, 65, 6.2, 2, 1000),
  (N'Hortalizas', N'Ajo', N'Criollo', 120, 10, 80, 30, 1.2, 55, 6.5, 1.6, 800),
  (N'Hortalizas', N'Auyama', N'Criolla', 120, 5, 75, 40, 3, 60, 6.2, 1.8, 900),
  (N'Hortalizas', N'Berenjena', N'Black Beauty', 140, 8, 90, 42, 5, 65, 6, 2.2, 1100),
  (N'Hortalizas', N'Cebolla roja', N'Roja', 150, 10, 100, 40, 3, 60, 6.3, 1.5, 750),
  (N'Hortalizas', N'Pepino', N'Slice', 100, 4, 60, 36, 8, 70, 6, 2, 1000),
  (N'Hortalizas', N'Molondrón (Okra)', N'Clemson', 100, 5, 65, 30, 3, 60, 6.2, 1.8, 900),
  (N'Hortalizas', N'Orégano', N'Dominicano', 180, 10, 120, 50, 1.5, 45, 6.5, 1.2, 600),
  (N'Hortalizas', N'Rábano', N'Red Globe', 30, 3, 20, 7, 2, 60, 6.2, 1.4, 700),
  (N'Hortalizas', N'Lechuga', N'Romana', 60, 3, 40, 17, 3, 75, 6, 1.2, 600),
  (N'Hortalizas', N'Repollo', N'Green', 90, 5, 60, 25, 4, 70, 6.3, 1.8, 900),
  (N'Hortalizas', N'Tayota', N'Verde', 150, 15, 100, 35, 5, 70, 6, 1.8, 900),
  (N'Hortalizas', N'Tomate de ensalada', N'Roma', 120, 7, 70, 43, 7, 65, 6.2, 2.5, 1250),
  (N'Hortalizas', N'Tomate industria', N'Industrial', 110, 7, 65, 38, 6, 65, 6.2, 2.5, 1250),
  (N'Hortalizas', N'Calabacín', N'Zucchini', 50, 4, 30, 16, 4.5, 65, 6.2, 1.8, 900),
  (N'Hortalizas', N'Zanahoria', N'Nantes', 120, 10, 80, 30, 3.5, 60, 6.3, 1.5, 750),
  (N'Hortalizas', N'Remolacha', N'Detroit', 90, 7, 60, 23, 3, 65, 6.5, 2, 1000),
  (N'Hortalizas', N'Coliflor', N'Snowball', 150, 7, 100, 43, 3.5, 70, 6.5, 2, 1000),
  (N'Hortalizas', N'Brócoli', N'Calabrese', 150, 7, 100, 43, 3, 70, 6.5, 2, 1000),
  (N'Frutales', N'Aguacate', N'Hass', 1825, 30, 1500, 295, 2.5, 65, 6.2, 1.8, 900),
  (N'Frutales', N'Lechosa (Papaya)', N'Maradol', 720, 15, 500, 205, 5, 70, 6, 1.8, 900),
  (N'Frutales', N'Limón', N'Criollo', 1460, 20, 1200, 240, 2.5, 60, 6, 1.7, 850),
  (N'Frutales', N'Melón', N'Cantaloupe', 90, 5, 55, 30, 4, 60, 6.2, 2, 1000),
  (N'Frutales', N'Naranja', N'Valencia', 1825, 25, 1500, 300, 2.5, 60, 6, 1.7, 850),
  (N'Frutales', N'Piña', N'MD2', 450, 30, 300, 120, 5, 60, 5.5, 1.6, 800),
  (N'Frutales', N'Sandía', N'Crimson Sweet', 120, 5, 75, 40, 4.5, 65, 6.2, 2, 1000),
  (N'Frutales', N'Chinola (Maracuyá)', N'Amarilla', 720, 20, 500, 200, 3, 70, 6, 1.7, 850),
  (N'Frutales', N'Mango', N'Criollo', 1825, 30, 1500, 295, 2.5, 60, 6, 1.5, 750);

INSERT INTO dbo.Cultivos (nombre, variedad, id_invernadero, fecha_siembra, umbral_humedad, umbral_ph, umbral_ec, umbral_tds)
SELECT
  src.nombre,
  src.variedad,
  @id_invernadero,
  @fecha_siembra,
  src.umbral_humedad,
  src.umbral_ph,
  src.umbral_ec,
  src.umbral_tds
FROM @CultivosRD src
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.Cultivos c
  WHERE c.id_invernadero = @id_invernadero
    AND LOWER(LTRIM(RTRIM(c.nombre))) = LOWER(LTRIM(RTRIM(src.nombre)))
    AND LOWER(LTRIM(RTRIM(ISNULL(c.variedad, '')))) = LOWER(LTRIM(RTRIM(ISNULL(src.variedad, ''))))
);

INSERT INTO dbo.CultivoDetalle (
  id_cultivo,
  fecha_siembra,
  fecha_cosecha_estimada,
  variedad,
  tiempo_germinacion_dias,
  tiempo_crecimiento_dias,
  tiempo_cosecha_dias,
  umbral_humedad,
  umbral_ph,
  umbral_ec,
  umbral_tds,
  notas
)
SELECT
  c.id_cultivo,
  @fecha_siembra,
  DATEADD(day, ISNULL(src.duracion, 0), @fecha_siembra),
  src.variedad,
  src.germinacion,
  src.crecimiento,
  src.cosecha,
  src.umbral_humedad,
  src.umbral_ph,
  src.umbral_ec,
  src.umbral_tds,
  CONCAT('Categoria: ', src.categoria, '; rendimiento ideal estimado: ', CONVERT(varchar(30), src.rendimiento_kg_m2), ' kg/m2')
FROM @CultivosRD src
INNER JOIN dbo.Cultivos c
  ON c.id_invernadero = @id_invernadero
 AND LOWER(LTRIM(RTRIM(c.nombre))) = LOWER(LTRIM(RTRIM(src.nombre)))
 AND LOWER(LTRIM(RTRIM(ISNULL(c.variedad, '')))) = LOWER(LTRIM(RTRIM(ISNULL(src.variedad, ''))))
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.CultivoDetalle d
  WHERE d.id_cultivo = c.id_cultivo
    AND d.fecha_siembra = @fecha_siembra
);

COMMIT TRANSACTION;
