import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db"

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const gh = searchParams.get("greenhouse")

    let sqlText = `
      SELECT
        z.id_zona AS id,
        z.nombre,
        z.id_invernadero AS invernaderoId,
        z.tipo_cultivo AS cultivoActual,
        z.estado AS estadoRiego,
        z.umbral_humedad AS umbralHumedad,
        z.metodo_riego AS modoRiego,
        z.area_m2,
        z.caudal_litros_min
      FROM ZonasRiego z
    `
    const params: Record<string, unknown> = {}
    if (gh) {
      sqlText += " WHERE z.id_invernadero = @gh"
      params.gh = Number(gh)
    }

    const rows = (await query(sqlText, params)) as Record<string, unknown>[]

    const zones = await Promise.all(
      rows.map(async (z) => {
        // Latest irrigation event
        const riegoRows = (await query(
          `SELECT TOP 1 fecha_inicio, fecha_fin, duracion_min, volumen_litros
           FROM Riegos WHERE id_zona = @zoneId ORDER BY fecha_inicio DESC`,
          { zoneId: z.id }
        )) as Record<string, unknown>[]
        const lastRiego = riegoRows[0]

        // Get latest reading for each of the 4 sensor types in this greenhouse
        const sensorTypes = ["humedad_suelo", "ph", "tds", "temperatura"]
        const sensorReadings: Record<string, { valor: number; unidad: string; estado: string; rangoMin: number; rangoMax: number; ultimaActualizacion: string }> = {}

        for (const tipo of sensorTypes) {
          const sRows = (await query(
            `SELECT TOP 1
              s.id_sensor,
              s.estado,
              s.rango_min,
              s.rango_max,
              s.unidad_medida,
              ls.valor,
              ls.unidad,
              ls.fecha_hora
            FROM Sensores s
            LEFT JOIN LecturasSensores ls ON ls.id_sensor = s.id_sensor
              AND ls.fecha_hora = (SELECT MAX(fecha_hora) FROM LecturasSensores WHERE id_sensor = s.id_sensor)
            WHERE s.id_invernadero = @invId AND s.tipo = @tipo
            ORDER BY ls.fecha_hora DESC`,
            { invId: z.invernaderoId, tipo }
          )) as Record<string, unknown>[]

          if (sRows[0]) {
            sensorReadings[tipo] = {
              valor: sRows[0].valor ? Number(sRows[0].valor) : 0,
              unidad: (sRows[0].unidad as string) || (sRows[0].unidad_medida as string) || "",
              estado: (sRows[0].estado as string) || "activo",
              rangoMin: Number(sRows[0].rango_min) || 0,
              rangoMax: Number(sRows[0].rango_max) || 100,
              ultimaActualizacion: sRows[0].fecha_hora ? String(sRows[0].fecha_hora) : "",
            }
          }
        }

        return {
          id: String(z.id),
          nombre: z.nombre,
          invernaderoId: String(z.invernaderoId),
          cultivoActual: z.cultivoActual || "",
          estadoRiego: (z.estadoRiego as string)?.toLowerCase() === "activa" ? "inactivo" : (z.estadoRiego as string) || "inactivo",
          modoRiego: z.modoRiego || "automatico",
          umbralHumedad: Number(z.umbralHumedad) || 40,
          humedadActual: sensorReadings.humedad_suelo?.valor ?? 0,
          ultimoRiego: lastRiego?.fecha_inicio ? String(lastRiego.fecha_inicio) : "",
          duracionUltimoRiego: lastRiego ? Number(lastRiego.duracion_min) : 0,
          volumenUltimoRiego: lastRiego ? Number(lastRiego.volumen_litros) : 0,
          // New: all 4 sensor readings
          sensores: sensorReadings,
        }
      })
    )

    return NextResponse.json(zones)
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (session.rol === "agricultor") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const body = await req.json()
    const result = await execute(
      `INSERT INTO ZonasRiego (nombre, id_invernadero, umbral_humedad, tipo_cultivo, metodo_riego, estado)
       OUTPUT INSERTED.id_zona
       VALUES (@nombre, @invId, @umbral, @cultivo, @metodo, 'Activa')`,
      {
        nombre: body.nombre || "Nueva Zona",
        invId: Number(body.invernaderoId) || 1,
        umbral: body.umbralHumedad || 40,
        cultivo: body.cultivoActual || "",
        metodo: body.modoRiego || "automatico",
      }
    )
    const newId = result.recordset?.[0]?.id_zona
    return NextResponse.json({
      id: String(newId),
      nombre: body.nombre || "Nueva Zona",
      invernaderoId: String(body.invernaderoId || 1),
      cultivoActual: body.cultivoActual || "",
      estadoRiego: "inactivo",
      modoRiego: body.modoRiego || "automatico",
      umbralHumedad: body.umbralHumedad || 40,
      humedadActual: 0,
      ultimoRiego: "",
      duracionUltimoRiego: 0,
      volumenUltimoRiego: 0,
      sensores: {},
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    if (session.rol === "agricultor") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const fieldMap: Record<string, string> = {
      nombre: "nombre",
      umbralHumedad: "umbral_humedad",
      cultivoActual: "tipo_cultivo",
      modoRiego: "metodo_riego",
      estadoRiego: "estado",
    }

    const setClauses: string[] = []
    const params: Record<string, unknown> = { id: Number(id) }

    for (const [frontKey, dbCol] of Object.entries(fieldMap)) {
      if (updates[frontKey] !== undefined) {
        const paramName = `p_${frontKey}`
        setClauses.push(`${dbCol} = @${paramName}`)
        params[paramName] = updates[frontKey]
      }
    }

    if (setClauses.length > 0) {
      await execute(
        `UPDATE ZonasRiego SET ${setClauses.join(", ")} WHERE id_zona = @id`,
        params
      )
    }

    if (updates.estadoRiego === "activo") {
      await execute(
        `INSERT INTO Riegos (id_zona, id_usuario, tipo, duracion_min, fecha_inicio)
         VALUES (@zoneId, @userId, @tipo, 0, GETDATE())`,
        { zoneId: Number(id), userId: session.userId, tipo: updates.modoRiego || "automatico" }
      )
    }

    return NextResponse.json({ ok: true, id })
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
