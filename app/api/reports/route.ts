import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

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

    const nutrientesRows = (await query(
      `SELECT
         DATENAME(WEEKDAY, fecha_aplicacion) AS dia,
         COUNT(*) AS aplicaciones,
         SUM(TRY_CONVERT(decimal(12, 2), cantidad_aplicada)) AS cantidad
       FROM AplicacionesFertilizantes af
       INNER JOIN PlanFertilizacion pf ON pf.id_plan = af.id_plan
       INNER JOIN Cultivos c ON c.id_cultivo = pf.id_cultivo
       WHERE c.id_invernadero = @invernaderoId
         AND af.fecha_aplicacion >= DATEADD(DAY, -7, GETDATE())
       GROUP BY DATENAME(WEEKDAY, fecha_aplicacion), DATEPART(WEEKDAY, fecha_aplicacion)
       ORDER BY DATEPART(WEEKDAY, fecha_aplicacion)`,
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
    })
  } catch (err) {
    console.error("[reports] GET Error:", err)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
