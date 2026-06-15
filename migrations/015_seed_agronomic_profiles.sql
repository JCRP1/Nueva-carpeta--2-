BEGIN TRANSACTION;

DECLARE @Perfil TABLE (
  nombre nvarchar(100) NOT NULL PRIMARY KEY,
  densidad_plantas_m2 nvarchar(100) NULL,
  sustrato_suelo nvarchar(500) NULL,
  observaciones nvarchar(max) NULL
);

INSERT INTO @Perfil (nombre, densidad_plantas_m2, sustrato_suelo, observaciones)
VALUES
  (N'Tomate de ensalada', N'2.0 a 2.8 plantas/m2', N'Suelo franco bien drenado o sustrato con buena aireacion y materia organica.', N'Mantener tutorado, poda sanitaria y monitoreo frecuente de humedad y EC.'),
  (N'Tomate industria', N'2.5 a 3.5 plantas/m2', N'Suelo franco a franco-arenoso con drenaje estable.', N'Priorizar uniformidad de floracion, cuaje y maduracion.'),
  (N'Pepino', N'1.5 a 2.5 plantas/m2', N'Sustrato liviano o suelo franco con buen drenaje.', N'Requiere humedad constante sin encharcar y cosecha frecuente.'),
  (N'Lechuga', N'16 a 25 plantas/m2', N'Suelo suelto, fresco y rico en materia organica.', N'Evitar estres hidrico y exceso de nitrogeno cerca de cosecha.'),
  (N'Ajíes', N'3 a 5 plantas/m2', N'Suelo franco, drenado, con pH ligeramente acido a neutro.', N'Controlar floracion, carga de frutos y humedad estable.'),
  (N'Berenjena', N'2 a 3 plantas/m2', N'Suelo profundo, fertil y bien drenado.', N'Requiere poda ligera, tutorado y control preventivo de plagas.'),
  (N'Cebolla roja', N'40 a 80 plantas/m2', N'Suelo suelto, sin compactacion, con buen drenaje.', N'Mantener humedad moderada y reducir riego cerca de maduracion.'),
  (N'Repollo', N'4 a 6 plantas/m2', N'Suelo franco con buena materia organica y drenaje.', N'Necesita nutricion constante durante formacion de cabeza.'),
  (N'Brócoli', N'3 a 5 plantas/m2', N'Suelo fresco, profundo y bien drenado.', N'Evitar altas temperaturas durante formacion de cabeza.'),
  (N'Melón', N'0.8 a 1.5 plantas/m2', N'Suelo franco-arenoso, profundo y bien drenado.', N'Manejar riego con cuidado durante llenado y maduracion de frutos.'),
  (N'Sandía', N'0.4 a 0.8 plantas/m2', N'Suelo franco-arenoso, profundo, con buen drenaje.', N'Evitar exceso de humedad cerca de cosecha para mejorar dulzor.'),
  (N'Yuca', N'1 a 1.5 plantas/m2', N'Suelo suelto, profundo y bien drenado.', N'Tolerante a sequia, pero responde a humedad estable en establecimiento.'),
  (N'Plátano', N'0.16 a 0.25 plantas/m2', N'Suelo profundo, fertil, con buen drenaje y materia organica.', N'Requiere manejo de hijuelos, deshoje sanitario y nutricion potasica.'),
  (N'Guineo (Banano)', N'0.18 a 0.28 plantas/m2', N'Suelo profundo, humedo pero no encharcado, rico en materia organica.', N'Mantener humedad constante, drenaje y control de sigatoka.');

INSERT INTO dbo.CultivoPerfilAgronomico (
  id_cultivo,
  densidad_plantas_m2,
  sustrato_suelo,
  observaciones,
  fecha_creacion
)
SELECT
  c.id_cultivo,
  p.densidad_plantas_m2,
  p.sustrato_suelo,
  p.observaciones,
  GETDATE()
FROM dbo.Cultivos c
INNER JOIN @Perfil p ON LOWER(LTRIM(RTRIM(c.nombre))) = LOWER(LTRIM(RTRIM(p.nombre)))
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.CultivoPerfilAgronomico existente
  WHERE existente.id_cultivo = c.id_cultivo
);

DECLARE @Fertilizacion TABLE (
  nombre nvarchar(100) NOT NULL,
  etapa nvarchar(30) NOT NULL,
  recomendacion nvarchar(max) NOT NULL,
  npk nvarchar(50) NULL,
  calcio nvarchar(100) NULL,
  magnesio nvarchar(100) NULL,
  micronutrientes nvarchar(500) NULL,
  ec_objetivo decimal(5, 2) NULL,
  ph_objetivo decimal(4, 2) NULL,
  frecuencia_dias int NULL
);

INSERT INTO @Fertilizacion (nombre, etapa, recomendacion, npk, calcio, magnesio, micronutrientes, ec_objetivo, ph_objetivo, frecuencia_dias)
VALUES
  (N'Tomate de ensalada', N'germinacion', N'Arranque suave con fosforo y calcio; evitar EC alta en plantulas.', N'10-52-10 suave', N'Bajo a medio', N'Bajo', N'Boro y zinc en dosis baja', 1.20, 6.20, 7),
  (N'Tomate de ensalada', N'crecimiento', N'Balancear nitrogeno, calcio y potasio para vigor y floracion.', N'18-18-18 / 13-40-13', N'Medio', N'Medio', N'Boro, zinc y hierro', 2.20, 6.20, 5),
  (N'Tomate de ensalada', N'cosecha', N'Subir potasio y calcio para firmeza y calidad de fruto.', N'12-12-36', N'Alto', N'Medio', N'Boro y magnesio', 2.80, 6.30, 4),
  (N'Tomate industria', N'germinacion', N'Usar fertilizacion baja en sales y buen fosforo inicial.', N'10-52-10 suave', N'Bajo', N'Bajo', N'Zinc', 1.20, 6.20, 7),
  (N'Tomate industria', N'crecimiento', N'Promover follaje sano sin exceso de nitrogeno.', N'18-18-18', N'Medio', N'Medio', N'Boro y zinc', 2.00, 6.20, 5),
  (N'Tomate industria', N'cosecha', N'Priorizar potasio para maduracion uniforme y solidos.', N'12-12-36', N'Medio', N'Medio', N'Boro', 2.50, 6.30, 4),
  (N'Pepino', N'germinacion', N'Mantener solucion suave y humedad pareja.', N'10-52-10 suave', N'Bajo', N'Bajo', N'Zinc', 1.10, 6.00, 7),
  (N'Pepino', N'crecimiento', N'Aumentar nitrogeno y potasio sin descuidar calcio.', N'18-18-18', N'Medio', N'Medio', N'Boro y hierro', 2.00, 6.10, 5),
  (N'Pepino', N'cosecha', N'Mantener potasio y calcio para frutos firmes y continuos.', N'15-5-30', N'Medio a alto', N'Medio', N'Boro', 2.40, 6.10, 3),
  (N'Lechuga', N'germinacion', N'Fertilizacion ligera; evitar sales altas.', N'10-52-10 muy suave', N'Bajo', N'Bajo', N'Hierro', 0.80, 6.20, 7),
  (N'Lechuga', N'crecimiento', N'Nitrogeno moderado y calcio para hojas sanas.', N'20-10-20', N'Medio', N'Bajo', N'Hierro y manganeso', 1.40, 6.20, 5),
  (N'Lechuga', N'cosecha', N'Reducir excesos de nitrogeno y mantener calcio.', N'15-5-20', N'Medio', N'Bajo', N'Hierro', 1.20, 6.30, 5),
  (N'Ajíes', N'germinacion', N'Arranque con fosforo y baja conductividad.', N'10-52-10 suave', N'Bajo', N'Bajo', N'Zinc', 1.00, 6.20, 7),
  (N'Ajíes', N'crecimiento', N'Balancear nitrogeno, potasio y calcio durante floracion.', N'18-18-18', N'Medio', N'Medio', N'Boro y zinc', 2.00, 6.30, 5),
  (N'Ajíes', N'cosecha', N'Priorizar potasio y calcio para firmeza y color.', N'12-12-36', N'Medio a alto', N'Medio', N'Boro', 2.40, 6.30, 4);

INSERT INTO @Fertilizacion (nombre, etapa, recomendacion, npk, calcio, magnesio, micronutrientes, ec_objetivo, ph_objetivo, frecuencia_dias)
SELECT p.nombre, base.etapa, base.recomendacion, base.npk, base.calcio, base.magnesio, base.micronutrientes, base.ec_objetivo, base.ph_objetivo, base.frecuencia_dias
FROM @Perfil p
CROSS APPLY (
  VALUES
    (N'germinacion', N'Fertilizacion suave en establecimiento, evitando exceso de sales.', N'10-52-10 suave', N'Bajo', N'Bajo', N'Zinc y hierro segun analisis', CAST(1.10 AS decimal(5, 2)), CAST(6.20 AS decimal(4, 2)), 7),
    (N'crecimiento', N'Mantener nutricion balanceada segun vigor, analisis de suelo y lectura EC.', N'18-18-18', N'Medio', N'Medio', N'Boro, zinc y hierro', CAST(1.80 AS decimal(5, 2)), CAST(6.30 AS decimal(4, 2)), 6),
    (N'cosecha', N'Ajustar potasio y calcio para calidad, firmeza y rendimiento.', N'12-12-36', N'Medio', N'Medio', N'Boro y magnesio', CAST(2.10 AS decimal(5, 2)), CAST(6.30 AS decimal(4, 2)), 5)
) base(etapa, recomendacion, npk, calcio, magnesio, micronutrientes, ec_objetivo, ph_objetivo, frecuencia_dias)
WHERE NOT EXISTS (
  SELECT 1
  FROM @Fertilizacion existente
  WHERE existente.nombre = p.nombre
    AND existente.etapa = base.etapa
);

INSERT INTO dbo.CultivoFertilizacionEtapa (
  id_perfil,
  etapa,
  recomendacion,
  npk,
  calcio,
  magnesio,
  micronutrientes,
  ec_objetivo,
  ph_objetivo,
  frecuencia_dias
)
SELECT
  pa.id_perfil,
  f.etapa,
  f.recomendacion,
  f.npk,
  f.calcio,
  f.magnesio,
  f.micronutrientes,
  f.ec_objetivo,
  f.ph_objetivo,
  f.frecuencia_dias
FROM dbo.CultivoPerfilAgronomico pa
INNER JOIN dbo.Cultivos c ON c.id_cultivo = pa.id_cultivo
INNER JOIN @Fertilizacion f ON LOWER(LTRIM(RTRIM(c.nombre))) = LOWER(LTRIM(RTRIM(f.nombre)))
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.CultivoFertilizacionEtapa existente
  WHERE existente.id_perfil = pa.id_perfil
    AND existente.etapa = f.etapa
);

DECLARE @Manejo TABLE (
  nombre nvarchar(100) NOT NULL,
  etapa nvarchar(30) NOT NULL,
  recomendacion nvarchar(max) NOT NULL,
  labores nvarchar(max) NULL
);

INSERT INTO @Manejo (nombre, etapa, recomendacion, labores)
SELECT p.nombre, base.etapa, base.recomendacion, base.labores
FROM @Perfil p
CROSS APPLY (
  VALUES
    (N'germinacion', N'Mantener humedad uniforme, buena emergencia y proteccion contra golpes de sol o exceso de agua.', N'Revisar germinacion, drenaje, bandejas o camas y primeras fallas de siembra.'),
    (N'crecimiento', N'Revisar vigor, competencia, malezas, tutorado cuando aplique y balance vegetativo.', N'Deshierbe, poda sanitaria, monitoreo de sensores, ajuste de riego y nutricion.'),
    (N'cosecha', N'Cosechar en punto adecuado, evitar danos mecanicos y retirar frutos u hojas enfermas.', N'Seleccion, limpieza, registro de rendimiento, perdidas y calidad.')
) base(etapa, recomendacion, labores);

INSERT INTO dbo.CultivoManejoEtapa (id_perfil, etapa, recomendacion, labores)
SELECT
  pa.id_perfil,
  m.etapa,
  m.recomendacion,
  m.labores
FROM dbo.CultivoPerfilAgronomico pa
INNER JOIN dbo.Cultivos c ON c.id_cultivo = pa.id_cultivo
INNER JOIN @Manejo m ON LOWER(LTRIM(RTRIM(c.nombre))) = LOWER(LTRIM(RTRIM(m.nombre)))
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.CultivoManejoEtapa existente
  WHERE existente.id_perfil = pa.id_perfil
    AND existente.etapa = m.etapa
);

DECLARE @Sanidad TABLE (
  nombre_cultivo nvarchar(100) NOT NULL,
  nombre nvarchar(150) NOT NULL,
  tipo nvarchar(30) NOT NULL,
  etapa_riesgo nvarchar(30) NULL,
  sintomas nvarchar(max) NULL,
  prevencion nvarchar(max) NULL,
  accion_recomendada nvarchar(max) NULL,
  nivel_riesgo nvarchar(30) NULL
);

INSERT INTO @Sanidad (nombre_cultivo, nombre, tipo, etapa_riesgo, sintomas, prevencion, accion_recomendada, nivel_riesgo)
VALUES
  (N'Tomate de ensalada', N'Mosca blanca', N'plaga', N'crecimiento', N'Amarillamiento, melaza y debilitamiento general.', N'Usar trampas amarillas, monitoreo semanal y manejo de malezas.', N'Aplicar manejo integrado y rotar productos si supera umbral.', N'alto'),
  (N'Tomate de ensalada', N'Tizon temprano', N'enfermedad', N'crecimiento', N'Manchas concentricas en hojas bajas.', N'Evitar mojado excesivo, mejorar ventilacion y retirar hojas afectadas.', N'Aplicar fungicida autorizado y reducir humedad foliar.', N'alto'),
  (N'Tomate de ensalada', N'Pudricion apical', N'fisiopatia', N'cosecha', N'Necrosis oscura en punta del fruto.', N'Mantener riego uniforme y calcio disponible.', N'Corregir riego, revisar EC y suministro de calcio.', N'medio'),
  (N'Pepino', N'Mildiu polvoso', N'enfermedad', N'crecimiento', N'Polvo blanco en hojas y perdida de vigor.', N'Mejorar ventilacion y evitar exceso de nitrogeno.', N'Aplicar control preventivo y retirar hojas muy afectadas.', N'alto'),
  (N'Pepino', N'Trips', N'plaga', N'crecimiento', N'Plateado o deformacion en hojas y frutos.', N'Monitoreo con trampas y control de malezas.', N'Aplicar manejo integrado y proteger brotes nuevos.', N'medio'),
  (N'Lechuga', N'Quemado de borde', N'fisiopatia', N'crecimiento', N'Bordes necrosados en hojas jovenes.', N'Evitar estres hidrico y mejorar calcio disponible.', N'Ajustar riego, ventilacion y calcio.', N'medio'),
  (N'Lechuga', N'Mildiu velloso', N'enfermedad', N'crecimiento', N'Manchas amarillas y moho en el enves.', N'Evitar humedad prolongada y mejorar separacion.', N'Retirar plantas afectadas y aplicar control autorizado.', N'alto'),
  (N'Ajíes', N'Antracnosis', N'enfermedad', N'cosecha', N'Lesiones hundidas en frutos.', N'Evitar humedad alta, usar semilla sana y retirar frutos enfermos.', N'Aplicar manejo preventivo y cosechar frutos afectados aparte.', N'alto'),
  (N'Ajíes', N'Afidos', N'plaga', N'crecimiento', N'Brotes enrollados, melaza y debilitamiento.', N'Monitoreo frecuente, control de malezas y trampas.', N'Aplicar manejo integrado y proteger brotes.', N'medio');

INSERT INTO @Sanidad (nombre_cultivo, nombre, tipo, etapa_riesgo, sintomas, prevencion, accion_recomendada, nivel_riesgo)
SELECT p.nombre, base.nombre, base.tipo, base.etapa_riesgo, base.sintomas, base.prevencion, base.accion_recomendada, base.nivel_riesgo
FROM @Perfil p
CROSS APPLY (
  VALUES
    (N'Afidos', N'plaga', N'crecimiento', N'Brotes debiles, hojas deformes o melaza.', N'Monitoreo semanal, control de malezas y plantas hospederas.', N'Aplicar manejo integrado si aumenta la poblacion.', N'medio'),
    (N'Pudricion de raiz', N'enfermedad', N'germinacion', N'Marchitez, bajo crecimiento o raices oscuras.', N'Evitar encharcamiento y mejorar drenaje.', N'Reducir riego, retirar plantas afectadas y revisar sustrato.', N'alto'),
    (N'Estres hidrico', N'fisiopatia', N'crecimiento', N'Marchitez, amarillamiento o bajo vigor.', N'Ajustar riego segun sensores y etapa del cultivo.', N'Corregir frecuencia de riego y revisar caudal por zona.', N'medio')
) base(nombre, tipo, etapa_riesgo, sintomas, prevencion, accion_recomendada, nivel_riesgo)
WHERE NOT EXISTS (
  SELECT 1
  FROM @Sanidad existente
  WHERE existente.nombre_cultivo = p.nombre
    AND existente.nombre = base.nombre
);

INSERT INTO dbo.CultivoPlagasEnfermedades (
  id_perfil,
  nombre,
  tipo,
  etapa_riesgo,
  sintomas,
  prevencion,
  accion_recomendada,
  nivel_riesgo
)
SELECT
  pa.id_perfil,
  s.nombre,
  s.tipo,
  s.etapa_riesgo,
  s.sintomas,
  s.prevencion,
  s.accion_recomendada,
  s.nivel_riesgo
FROM dbo.CultivoPerfilAgronomico pa
INNER JOIN dbo.Cultivos c ON c.id_cultivo = pa.id_cultivo
INNER JOIN @Sanidad s ON LOWER(LTRIM(RTRIM(c.nombre))) = LOWER(LTRIM(RTRIM(s.nombre_cultivo)))
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.CultivoPlagasEnfermedades existente
  WHERE existente.id_perfil = pa.id_perfil
    AND existente.nombre = s.nombre
);

COMMIT TRANSACTION;
