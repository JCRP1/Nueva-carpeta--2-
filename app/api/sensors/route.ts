import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const gh = searchParams.get("greenhouse")

    // Get sensors, optionally filtered by greenhouse
    let sqlText = `
      SELECT
        s.id_sensor AS id,
        s.tipo,
        COALESCE(s.ubicacion_fisica, s.tipo + ' ' + CAST(s.id_sensor AS VARCHAR)) AS nombre,
        s.id_invernadero AS invernaderoId,
        s.estado,
        s.unidad_medida AS unidad,
        s.rango_min AS umbralMin,
        s.rango_max AS umbralMax
      FROM Sensores s
    `
    const params: Record<string, unknown> = {}
    if (gh) {
      sqlText += " WHERE s.id_invernadero = @gh"
      params.gh = Number(gh)
    }

    const sensors = (await query(sqlText, params)) as Record<string, unknown>[]

    // For each sensor, get the latest reading + recent history
    const result = await Promise.all(
      sensors.map(async (s) => {
        // Latest reading
        const latestRows = (await query(
          `SELECT TOP 1 valor, unidad, fecha_hora
           FROM LecturasSensores
           WHERE id_sensor = @sensorId
           ORDER BY fecha_hora DESC`,
          { sensorId: s.id }
        )) as Record<string, unknown>[]

        const latest = latestRows[0]

        // Recent 48 readings for history charts
        const historyRows = (await query(
          `SELECT TOP 48 valor, fecha_hora AS timestamp
           FROM LecturasSensores
           WHERE id_sensor = @sensorId
           ORDER BY fecha_hora DESC`,
          { sensorId: s.id }
        )) as Record<string, unknown>[]

        return {
          id: String(s.id),
          tipo: s.tipo,
          nombre: s.nombre,
          invernaderoId: String(s.invernaderoId),
          zonaRiegoId: "",
          estado: s.estado || "activo",
          ultimaLectura: latest ? Number(latest.valor) : 0,
          unidad: (latest?.unidad as string) || (s.unidad as string) || "",
          umbralMin: Number(s.umbralMin) || 0,
          umbralMax: Number(s.umbralMax) || 100,
          ultimaActualizacion: latest
            ? (latest.fecha_hora as string)
            : new Date().toISOString(),
          history: historyRows.reverse().map((h) => ({
            timestamp: h.timestamp,
            valor: Number(h.valor),
          })),
        }
      })
    )

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
