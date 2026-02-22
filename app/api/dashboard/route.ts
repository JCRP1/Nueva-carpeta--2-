import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const gh = searchParams.get("greenhouse")

    // If greenhouse is specified, use it; otherwise get the first one
    let invernaderoId: number
    if (gh) {
      invernaderoId = Number(gh)
    } else {
      const firstGh = (await query(
        "SELECT TOP 1 id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId",
        { empresaId: session.empresaId }
      )) as Record<string, unknown>[]
      invernaderoId = firstGh[0] ? Number(firstGh[0].id_invernadero) : 0
    }

    // Sensors for this greenhouse with latest readings
    const sensorsRows = (await query(
      `SELECT
        s.id_sensor AS id,
        s.tipo,
        COALESCE(s.ubicacion_fisica, s.tipo) AS nombre,
        s.estado,
        s.unidad_medida AS unidad,
        s.rango_min AS umbralMin,
        s.rango_max AS umbralMax,
        (SELECT TOP 1 valor FROM LecturasSensores WHERE id_sensor = s.id_sensor ORDER BY fecha_hora DESC) AS ultimaLectura,
        (SELECT TOP 1 fecha_hora FROM LecturasSensores WHERE id_sensor = s.id_sensor ORDER BY fecha_hora DESC) AS ultimaActualizacion
      FROM Sensores s
      WHERE s.id_invernadero = @invId`,
      { invId: invernaderoId }
    )) as Record<string, unknown>[]

    const sensors = sensorsRows.map((s) => ({
      id: String(s.id),
      tipo: s.tipo,
      nombre: s.nombre,
      invernaderoId: String(invernaderoId),
      zonaRiegoId: "",
      estado: s.estado || "activo",
      ultimaLectura: s.ultimaLectura ? Number(s.ultimaLectura) : 0,
      unidad: s.unidad || "",
      umbralMin: Number(s.umbralMin) || 0,
      umbralMax: Number(s.umbralMax) || 100,
      ultimaActualizacion: s.ultimaActualizacion || new Date().toISOString(),
    }))

    // Zones
    const zonesRows = (await query(
      `SELECT id_zona AS id, nombre, estado, tipo_cultivo AS cultivoActual, umbral_humedad AS umbralHumedad
       FROM ZonasRiego WHERE id_invernadero = @invId`,
      { invId: invernaderoId }
    )) as Record<string, unknown>[]

    const zones = zonesRows.map((z) => ({
      id: String(z.id),
      nombre: z.nombre,
      invernaderoId: String(invernaderoId),
      cultivoActual: z.cultivoActual || "",
      estadoRiego: z.estado || "inactivo",
      umbralHumedad: Number(z.umbralHumedad) || 40,
    }))

    // Active alerts count
    const alertCountRows = (await query(
      `SELECT COUNT(*) AS cnt FROM Alertas
       WHERE estado != 'Resuelta'
       AND id_sensor IN (SELECT id_sensor FROM Sensores WHERE id_invernadero = @invId)`,
      { invId: invernaderoId }
    )) as Record<string, unknown>[]
    const activeAlerts = Number(alertCountRows[0]?.cnt) || 0

    // Recent irrigation events
    const riegoRows = (await query(
      `SELECT TOP 5
        r.id_riego AS id,
        z.nombre AS zonaNombre,
        r.tipo,
        r.duracion_min AS duracion,
        r.volumen_litros AS volumen,
        r.fecha_inicio AS inicio,
        r.fecha_fin AS fin,
        CASE WHEN r.fecha_fin IS NULL THEN 'en_curso' ELSE 'completado' END AS estado
      FROM Riegos r
      JOIN ZonasRiego z ON z.id_zona = r.id_zona
      WHERE z.id_invernadero = @invId
      ORDER BY r.fecha_inicio DESC`,
      { invId: invernaderoId }
    )) as Record<string, unknown>[]

    const recentEvents = riegoRows.map((r) => ({
      id: String(r.id),
      zonaRiegoId: "",
      zonaNombre: r.zonaNombre,
      tipo: r.tipo,
      inicio: r.inicio,
      fin: r.fin || "",
      duracion: Number(r.duracion) || 0,
      volumen: Number(r.volumen) || 0,
      estado: r.estado,
    }))

    // Water consumption per day of week from Riegos
    const consumoRows = (await query(
      `SELECT
        DATENAME(WEEKDAY, r.fecha_inicio) AS dia,
        SUM(ISNULL(r.volumen_litros, 0)) AS litros
      FROM Riegos r
      JOIN ZonasRiego z ON z.id_zona = r.id_zona
      WHERE z.id_invernadero = @invId
        AND r.fecha_inicio >= DATEADD(DAY, -7, GETDATE())
      GROUP BY DATENAME(WEEKDAY, r.fecha_inicio), DATEPART(WEEKDAY, r.fecha_inicio)
      ORDER BY DATEPART(WEEKDAY, r.fecha_inicio)`,
      { invId: invernaderoId }
    )) as Record<string, unknown>[]

    const dayMap: Record<string, string> = {
      Monday: "Lun", Tuesday: "Mar", Wednesday: "Mie",
      Thursday: "Jue", Friday: "Vie", Saturday: "Sab", Sunday: "Dom",
    }
    const consumoAgua = consumoRows.map((c) => ({
      dia: dayMap[c.dia as string] || (c.dia as string),
      litros: Number(c.litros) || 0,
    }))

    // Greenhouse info
    const ghRows = (await query(
      "SELECT nombre, ubicacion, superficie_m2 FROM Invernaderos WHERE id_invernadero = @invId",
      { invId: invernaderoId }
    )) as Record<string, unknown>[]
    const greenhouse = ghRows[0]
      ? {
          id: String(invernaderoId),
          nombre: ghRows[0].nombre,
          ubicacion: ghRows[0].ubicacion,
          area: Number(ghRows[0].superficie_m2) || 0,
        }
      : null

    return NextResponse.json({
      sensors,
      zones,
      activeAlerts,
      activeIrrigation: zones.filter((z) => z.estadoRiego === "activo").length,
      recentEvents,
      consumoAgua,
      greenhouse,
    })
  } catch (err) {
    console.error("[GreenSense] Dashboard error:", err)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
