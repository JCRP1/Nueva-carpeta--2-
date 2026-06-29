import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"

export const dynamic = "force-dynamic"

function mapWeekday(day: unknown) {
  const key = String(day || "")
  const map: Record<string, string> = {
    Monday: "Lun",
    Tuesday: "Mar",
    Wednesday: "Mie",
    Thursday: "Jue",
    Friday: "Vie",
    Saturday: "Sab",
    Sunday: "Dom",
    lunes: "Lun",
    martes: "Mar",
    miércoles: "Mie",
    miercoles: "Mie",
    jueves: "Jue",
    viernes: "Vie",
    sábado: "Sab",
    sabado: "Sab",
    domingo: "Dom",
  }
  return map[key] || key.slice(0, 3) || "-"
}

async function planUsesCropColumn() {
  const rows = (await query(
    `SELECT CASE
       WHEN COL_LENGTH('dbo.PlanFertilizacion', 'id_cultivo') IS NULL THEN 0 ELSE 1
     END AS hasCropColumn`
  ).catch(() => [])) as Record<string, unknown>[]

  return Number(rows[0]?.hasCropColumn || 0) === 1
}

async function getOrCreateManualFertilizer() {
  const existingRows = (await query(
    `SELECT TOP 1 id_fertilizante
     FROM Fertilizantes
     WHERE nombre = @nombre
     ORDER BY id_fertilizante`,
    { nombre: "Registro manual de nutrientes" }
  ).catch(() => [])) as Record<string, unknown>[]

  if (existingRows[0]?.id_fertilizante != null) {
    return Number(existingRows[0].id_fertilizante)
  }

  const inserted = await execute(
    `INSERT INTO Fertilizantes (nombre, tipo, composicion)
     OUTPUT INSERTED.id_fertilizante
     VALUES (@nombre, @tipo, @composicion)`,
    {
      nombre: "Registro manual de nutrientes",
      tipo: "Manual",
      composicion: "Aplicacion registrada desde reportes",
    }
  )

  return Number(inserted.recordset?.[0]?.id_fertilizante || 0)
}

async function getOrCreateCropDetail(cropId: number, date: string) {
  const detailRows = (await query(
    `SELECT TOP 1 id_detalle
     FROM CultivoDetalle
     WHERE id_cultivo = @cropId
     ORDER BY id_detalle DESC`,
    { cropId }
  ).catch(() => [])) as Record<string, unknown>[]

  if (detailRows[0]?.id_detalle != null) {
    return Number(detailRows[0].id_detalle)
  }

  const inserted = await execute(
    `INSERT INTO CultivoDetalle (id_cultivo, fecha_siembra, variedad, notas)
     OUTPUT INSERTED.id_detalle
     SELECT
       c.id_cultivo,
       COALESCE(c.fecha_siembra, TRY_CONVERT(date, @date), CAST(GETDATE() AS date)),
       ISNULL(c.variedad, ''),
       'Detalle creado para registro manual de nutrientes'
     FROM Cultivos c
     WHERE c.id_cultivo = @cropId`,
    { cropId, date: date || null }
  )

  return Number(inserted.recordset?.[0]?.id_detalle || 0)
}

async function getOrCreateFertilizationPlan(cropId: number, detailId: number, fertilizerId: number, date: string) {
  const usesCropColumn = await planUsesCropColumn()
  const planRows = (await query(
    usesCropColumn
      ? `SELECT TOP 1 id_plan
         FROM PlanFertilizacion
         WHERE id_cultivo = @cropId AND id_fertilizante = @fertilizerId
         ORDER BY id_plan DESC`
      : `SELECT TOP 1 id_plan
         FROM PlanFertilizacion
         WHERE id_detalle = @detailId AND id_fertilizante = @fertilizerId
         ORDER BY id_plan DESC`,
    { cropId, detailId, fertilizerId }
  ).catch(() => [])) as Record<string, unknown>[]

  if (planRows[0]?.id_plan != null) {
    return Number(planRows[0].id_plan)
  }

  if (usesCropColumn) {
    const inserted = await execute(
      `INSERT INTO PlanFertilizacion (
         id_cultivo,
         id_fertilizante,
         dosis,
         frecuencia_dias,
         inicio_aplicacion,
         notas
       )
       OUTPUT INSERTED.id_plan
       VALUES (
         @cropId,
         @fertilizerId,
         'Manual',
         1,
         COALESCE(TRY_CONVERT(date, @date), CAST(GETDATE() AS date)),
         'Plan creado para registros manuales desde reportes'
       )`,
      { cropId, fertilizerId, date: date || null }
    )

    return Number(inserted.recordset?.[0]?.id_plan || 0)
  }

  const inserted = await execute(
    `INSERT INTO PlanFertilizacion (
       id_detalle,
       id_fertilizante,
       dosis,
       frecuencia_dias,
       inicio_aplicacion,
       notas
     )
     OUTPUT INSERTED.id_plan
     VALUES (
       @detailId,
       @fertilizerId,
       'Manual',
       1,
       COALESCE(TRY_CONVERT(date, @date), CAST(GETDATE() AS date)),
       'Plan creado para registros manuales desde reportes'
     )`,
    { detailId, fertilizerId, date: date || null }
  )

  return Number(inserted.recordset?.[0]?.id_plan || 0)
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouse = Number(searchParams.get("greenhouse") || 0)

    const greenhouseRows = (await query(
      greenhouse
        ? `SELECT TOP 1 id_invernadero
           FROM Invernaderos
           WHERE id_invernadero = @greenhouse AND id_empresa = @empresaId`
        : `SELECT TOP 1 id_invernadero
           FROM Invernaderos
           WHERE id_empresa = @empresaId
           ORDER BY id_invernadero`,
      { greenhouse, empresaId: session.empresaId }
    )) as Record<string, unknown>[]

    const invernaderoId = Number(greenhouseRows[0]?.id_invernadero || 0)
    if (!invernaderoId) {
      return NextResponse.json({
        consumoAgua: [],
        resumenRiego: [],
        eficiencia: [],
        nutrientes: [],
        sensores: [],
        productividad: {
          cultivosActivos: 0,
          cosechasEstimadas: 0,
          rendimientoRegistrado: 0,
        },
      })
    }

    const consumoRows = (await query(
      `SELECT
         DATENAME(WEEKDAY, r.fecha_inicio) AS dia,
         SUM(ISNULL(r.volumen_litros, 0)) AS litros
       FROM Riegos r
       INNER JOIN ZonasRiego z ON z.id_zona = r.id_zona
       WHERE z.id_invernadero = @invernaderoId
         AND r.fecha_inicio >= DATEADD(DAY, -7, GETDATE())
       GROUP BY DATENAME(WEEKDAY, r.fecha_inicio), DATEPART(WEEKDAY, r.fecha_inicio)
       ORDER BY DATEPART(WEEKDAY, r.fecha_inicio)`,
      { invernaderoId }
    )) as Record<string, unknown>[]

    const resumenRows = (await query(
      `SELECT
         CONCAT('Sem ', DATEPART(WEEK, r.fecha_inicio)) AS semana,
         SUM(CASE WHEN LOWER(ISNULL(r.tipo, '')) = 'automatico' THEN 1 ELSE 0 END) AS riegoAuto,
         SUM(CASE WHEN LOWER(ISNULL(r.tipo, '')) <> 'automatico' THEN 1 ELSE 0 END) AS riegoManual,
         SUM(ISNULL(r.volumen_litros, 0)) AS aguaTotal,
         COUNT(*) AS eventos
       FROM Riegos r
       INNER JOIN ZonasRiego z ON z.id_zona = r.id_zona
       WHERE z.id_invernadero = @invernaderoId
         AND r.fecha_inicio >= DATEADD(DAY, -28, GETDATE())
       GROUP BY DATEPART(WEEK, r.fecha_inicio)
       ORDER BY DATEPART(WEEK, r.fecha_inicio)`,
      { invernaderoId }
    )) as Record<string, unknown>[]

    const sensorRows = (await query(
      `SELECT
         s.tipo,
         AVG(CAST(l.valor AS FLOAT)) AS promedio,
         MIN(l.valor) AS minimo,
         MAX(l.valor) AS maximo,
         COUNT(*) AS lecturasFueraRango
       FROM Sensores s
       LEFT JOIN LecturasSensores l ON l.id_sensor = s.id_sensor
         AND l.fecha_hora >= DATEADD(DAY, -7, GETDATE())
       WHERE s.id_invernadero = @invernaderoId
       GROUP BY s.tipo`,
      { invernaderoId }
    )) as Record<string, unknown>[]

    const sensorHistoryRows = (await query(
      `SELECT TOP 240
         s.tipo,
         l.fecha_hora AS timestamp,
         l.valor
       FROM LecturasSensores l
       INNER JOIN Sensores s ON s.id_sensor = l.id_sensor
       WHERE s.id_invernadero = @invernaderoId
       ORDER BY l.fecha_hora DESC`,
      { invernaderoId }
    )) as Record<string, unknown>[]

    const nutrientesUseCropColumn = await planUsesCropColumn()
    const nutrientesRows = (await query(
      nutrientesUseCropColumn
        ? `SELECT
             DATENAME(WEEKDAY, af.fecha_aplicacion) AS dia,
             COUNT(*) AS aplicaciones,
             SUM(TRY_CONVERT(decimal(12, 2), af.cantidad_aplicada)) AS cantidad
           FROM AplicacionesFertilizantes af
           INNER JOIN PlanFertilizacion pf ON pf.id_plan = af.id_plan
           INNER JOIN Cultivos c ON c.id_cultivo = pf.id_cultivo
           WHERE c.id_invernadero = @invernaderoId
             AND af.fecha_aplicacion >= DATEADD(DAY, -7, GETDATE())
           GROUP BY DATENAME(WEEKDAY, af.fecha_aplicacion), DATEPART(WEEKDAY, af.fecha_aplicacion)
           ORDER BY DATEPART(WEEKDAY, af.fecha_aplicacion)`
        : `SELECT
             DATENAME(WEEKDAY, af.fecha_aplicacion) AS dia,
             COUNT(*) AS aplicaciones,
             SUM(TRY_CONVERT(decimal(12, 2), af.cantidad_aplicada)) AS cantidad
           FROM AplicacionesFertilizantes af
           INNER JOIN PlanFertilizacion pf ON pf.id_plan = af.id_plan
           INNER JOIN CultivoDetalle cd ON cd.id_detalle = pf.id_detalle
           INNER JOIN Cultivos c ON c.id_cultivo = cd.id_cultivo
           WHERE c.id_invernadero = @invernaderoId
             AND af.fecha_aplicacion >= DATEADD(DAY, -7, GETDATE())
           GROUP BY DATENAME(WEEKDAY, af.fecha_aplicacion), DATEPART(WEEKDAY, af.fecha_aplicacion)
           ORDER BY DATEPART(WEEKDAY, af.fecha_aplicacion)`,
      { invernaderoId }
    ).catch(() => [])) as Record<string, unknown>[]

    const productivityRows = (await query(
      `SELECT
         COUNT(DISTINCT c.id_cultivo) AS cultivosActivos,
         SUM(CASE WHEN d.fecha_cosecha_estimada IS NOT NULL THEN 1 ELSE 0 END) AS cosechasEstimadas
       FROM Cultivos c
       LEFT JOIN CultivoDetalle d ON d.id_cultivo = c.id_cultivo
       WHERE c.id_invernadero = @invernaderoId`,
      { invernaderoId }
    )) as Record<string, unknown>[]

    const greenhouseComparisonRows = (await query(
      `SELECT
         i.id_invernadero AS id,
         i.nombre,
         SUM(ISNULL(co.cantidad_cosechada_kg, 0)) AS kgCosechados,
         SUM(ISNULL(co.cantidad_unidades, 0)) AS unidadesCosechadas,
         SUM(ISNULL(v.ingreso_total, 0)) AS ingresos,
         SUM(ISNULL(costos.totalCostos, 0)) AS costos
       FROM dbo.Invernaderos i
       LEFT JOIN dbo.Cultivos c ON c.id_invernadero = i.id_invernadero
       LEFT JOIN dbo.CultivoDetalle cd ON cd.id_cultivo = c.id_cultivo
       LEFT JOIN dbo.Cosechas co ON co.id_detalle = cd.id_detalle
       LEFT JOIN dbo.VentasCosecha v ON v.id_cosecha = co.id_cosecha
       OUTER APPLY (
         SELECT SUM(cc.monto) AS totalCostos
         FROM dbo.CostosCultivo cc
         WHERE cc.id_cultivo = c.id_cultivo
            OR cc.id_zona IN (
              SELECT z.id_zona
              FROM dbo.ZonasRiego z
              WHERE z.id_invernadero = i.id_invernadero
            )
       ) costos
       WHERE i.id_empresa = @empresaId
       GROUP BY i.id_invernadero, i.nombre
       ORDER BY SUM(ISNULL(v.ingreso_total, 0)) - SUM(ISNULL(costos.totalCostos, 0)) DESC`,
      { empresaId: session.empresaId }
    ).catch(() => [])) as Record<string, unknown>[]

    const totalEvents = resumenRows.reduce((sum, row) => sum + Number(row.eventos || 0), 0)
    const autoEvents = resumenRows.reduce((sum, row) => sum + Number(row.riegoAuto || 0), 0)
    const efficiency = totalEvents > 0 ? Math.round((autoEvents / totalEvents) * 100) : 0

    return NextResponse.json({
      consumoAgua: consumoRows.map((row) => ({
        dia: mapWeekday(row.dia),
        litros: Number(row.litros) || 0,
      })),
      resumenRiego: resumenRows.map((row) => ({
        semana: String(row.semana || ""),
        riegoAuto: Number(row.riegoAuto) || 0,
        riegoManual: Number(row.riegoManual) || 0,
        aguaTotal: Number(row.aguaTotal) || 0,
      })),
      eficiencia: [
        {
          mes: "Actual",
          eficiencia: efficiency,
        },
      ],
      nutrientes: nutrientesRows.map((row) => ({
        dia: mapWeekday(row.dia),
        aplicaciones: Number(row.aplicaciones) || 0,
        cantidad: Number(row.cantidad) || 0,
      })),
      sensores: sensorRows.map((row) => ({
        tipo: String(row.tipo || ""),
        promedio: Number(row.promedio) || 0,
        minimo: Number(row.minimo) || 0,
        maximo: Number(row.maximo) || 0,
      })),
      sensorHistory: sensorHistoryRows.reverse().map((row) => ({
        tipo: String(row.tipo || ""),
        timestamp: row.timestamp,
        valor: Number(row.valor) || 0,
      })),
      productividad: {
        cultivosActivos: Number(productivityRows[0]?.cultivosActivos) || 0,
        cosechasEstimadas: Number(productivityRows[0]?.cosechasEstimadas) || 0,
        rendimientoRegistrado: 0,
      },
      comparativoInvernaderos: greenhouseComparisonRows.map((row) => {
        const ingresos = Number(row.ingresos) || 0
        const costos = Number(row.costos) || 0
        return {
          id: String(row.id || ""),
          nombre: String(row.nombre || ""),
          kgCosechados: Number(row.kgCosechados) || 0,
          unidadesCosechadas: Number(row.unidadesCosechadas) || 0,
          ingresos,
          costos,
          ganancia: ingresos - costos,
        }
      }),
    })
  } catch (err) {
    console.error("[reports] GET Error:", err)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const type = String(body.type || "water")
    const greenhouse = Number(body.greenhouse || 0)
    const date = String(body.date || "").trim()

    if (type === "nutrients") {
      const cropId = Number(body.cropId || 0)
      const amount = Number(body.amount || 0)
      const notes = String(body.notes || "").trim()

      if (!greenhouse || !cropId) {
        return NextResponse.json({ error: "Selecciona un invernadero y un cultivo" }, { status: 400 })
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Ingresa una cantidad de nutrientes valida" }, { status: 400 })
      }

      const cropRows = (await query(
        `SELECT TOP 1 c.id_cultivo
         FROM Cultivos c
         INNER JOIN Invernaderos i ON i.id_invernadero = c.id_invernadero
         WHERE c.id_cultivo = @cropId
           AND c.id_invernadero = @greenhouse
           AND i.id_empresa = @empresaId`,
        { cropId, greenhouse, empresaId: session.empresaId }
      )) as Record<string, unknown>[]

      if (!cropRows[0]) {
        return NextResponse.json({ error: "El cultivo no pertenece a este invernadero" }, { status: 404 })
      }

      const fertilizerId = await getOrCreateManualFertilizer()
      const detailId = await getOrCreateCropDetail(cropId, date)
      const planId = await getOrCreateFertilizationPlan(cropId, detailId, fertilizerId, date)

      if (!fertilizerId || !detailId || !planId) {
        return NextResponse.json({ error: "No se pudo preparar el plan de fertilizacion" }, { status: 500 })
      }

      await execute(
        `INSERT INTO AplicacionesFertilizantes (
           id_plan,
           fecha_aplicacion,
           cantidad_aplicada,
           aplicado_por,
           notas
         )
         VALUES (
           @planId,
           COALESCE(TRY_CONVERT(datetime, @fechaRegistro, 126), GETDATE()),
           @amount,
           @userId,
           @notes
         )`,
        {
          planId,
          fechaRegistro: date ? `${date}T12:00:00` : null,
          amount: String(amount),
          userId: session.userId,
          notes: notes || null,
        }
      )

      return NextResponse.json({ ok: true })
    }

    const zoneId = Number(body.zoneId || 0)
    const liters = Number(body.liters || 0)

    if (!greenhouse || !zoneId) {
      return NextResponse.json({ error: "Selecciona un invernadero y una zona" }, { status: 400 })
    }

    if (!Number.isFinite(liters) || liters <= 0) {
      return NextResponse.json({ error: "Ingresa un consumo de agua valido" }, { status: 400 })
    }

    const zoneRows = (await query(
      `SELECT TOP 1 z.id_zona
       FROM ZonasRiego z
       INNER JOIN Invernaderos i ON i.id_invernadero = z.id_invernadero
       WHERE z.id_zona = @zoneId
         AND z.id_invernadero = @greenhouse
         AND i.id_empresa = @empresaId`,
      { zoneId, greenhouse, empresaId: session.empresaId }
    )) as Record<string, unknown>[]

    if (!zoneRows[0]) {
      return NextResponse.json({ error: "La zona no pertenece a este invernadero" }, { status: 404 })
    }

    const fechaRegistro = date ? `${date}T12:00:00` : null
    await execute(
      `INSERT INTO Riegos (
         id_zona,
         id_usuario,
         tipo,
         duracion_min,
         volumen_litros,
         fecha_inicio,
         fecha_fin
       )
       VALUES (
         @zoneId,
         @userId,
         'Manual',
         0,
         @liters,
         COALESCE(TRY_CONVERT(datetime, @fechaRegistro, 126), GETDATE()),
         COALESCE(TRY_CONVERT(datetime, @fechaRegistro, 126), GETDATE())
       )`,
      {
        zoneId,
        userId: session.userId,
        liters,
        fechaRegistro,
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[reports] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar el registro del reporte" }, { status: 500 })
  }
}
