import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

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
        m.nombre AS modoRiego,
        z.area_m2,
        z.caudal_litros_min,
        z.umbral_ph,
        z.umbral_ec,
        z.umbral_tds,
        z.observaciones
      FROM ZonasRiego z
      LEFT JOIN MetodoRiego m ON z.id_metodo_riego = m.id_metodo_riego
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
          modoRiego: z.modoRiego || "goteo",
          umbralHumedad: Number(z.umbralHumedad) || 40,
          area_m2: Number(z.area_m2) || 100,
          caudal_litros_min: Number(z.caudal_litros_min) || 10,
          umbral_ph: Number(z.umbral_ph) || 6.0,
          umbral_ec: Number(z.umbral_ec) || 1.5,
          umbral_tds: Number(z.umbral_tds) || 800,
          observaciones: z.observaciones || "",
          humedadActual: sensorReadings.humedad_suelo?.valor ?? 0,
          ultimoRiego: lastRiego?.fecha_inicio ? String(lastRiego.fecha_inicio) : "",
          duracionUltimoRiego: lastRiego ? Number(lastRiego.duracion_min) : 0,
          volumenUltimoRiego: lastRiego ? Number(lastRiego.volumen_litros) : 0,
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
      `INSERT INTO ZonasRiego (nombre, id_invernadero, umbral_humedad, tipo_cultivo, id_metodo_riego, estado, area_m2, caudal_litros_min, umbral_ph, umbral_ec, umbral_tds, observaciones)
       OUTPUT INSERTED.id_zona
       VALUES (@nombre, @invId, @umbral, @cultivo, @metodoId, 'Activa', @area, @caudal, @ph, @ec, @tds, @obs)`,
      {
        nombre: body.nombre || "Nueva Zona",
        invId: Number(body.invernaderoId) || 1,
        umbral: body.umbralHumedad || 40,
        cultivo: body.cultivoActual || "",
        metodoId: Number(body.id_metodo_riego) || 1,
        area: body.area_m2 || 100,
        caudal: body.caudal_litros_min || 10,
        ph: body.umbral_ph || 6.0,
        ec: body.umbral_ec || 1.5,
        tds: body.umbral_tds || 800,
        obs: body.observaciones || "",
      }
    )
    const newId = result.recordset?.[0]?.id_zona
    await registrarBitacora({
      session,
      req,
      descripcion: `Se creo la zona ${body.nombre || "Nueva Zona"}`,
      modulo: "zonas",
      entidad: "ZonasRiego",
      entidadId: newId as string | number | undefined,
      accion: "CREATE",
      valorNuevo: body,
    })
    const metodoRows = (await query(
      `SELECT nombre FROM MetodoRiego WHERE id_metodo_riego = @id`,
      { id: Number(body.id_metodo_riego) || 1 }
    )) as Record<string, unknown>[]

    return NextResponse.json({
      id: String(newId),
      nombre: body.nombre || "Nueva Zona",
      invernaderoId: String(body.invernaderoId || 1),
      cultivoActual: body.cultivoActual || "",
      estadoRiego: "inactivo",
      modoRiego: (metodoRows[0]?.nombre as string) || "Goteo",
      umbralHumedad: body.umbralHumedad || 40,
      area_m2: body.area_m2 || 100,
      caudal_litros_min: body.caudal_litros_min || 10,
      umbral_ph: body.umbral_ph || 6.0,
      umbral_ec: body.umbral_ec || 1.5,
      umbral_tds: body.umbral_tds || 800,
      observaciones: body.observaciones || "",
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

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT z.nombre, z.umbral_humedad AS umbralHumedad, z.tipo_cultivo AS cultivoActual, m.nombre AS modoRiego, z.estado AS estadoRiego, z.area_m2, z.caudal_litros_min, z.umbral_ph, z.umbral_ec, z.umbral_tds, z.observaciones
       FROM ZonasRiego z
       LEFT JOIN MetodoRiego m ON z.id_metodo_riego = m.id_metodo_riego
       WHERE z.id_zona = @id`,
      { id: Number(id) }
    )

    const fieldMap: Record<string, string> = {
      nombre: "nombre",
      umbralHumedad: "umbral_humedad",
      cultivoActual: "tipo_cultivo",
      estadoRiego: "estado",
      area_m2: "area_m2",
      caudal_litros_min: "caudal_litros_min",
      umbral_ph: "umbral_ph",
      umbral_ec: "umbral_ec",
      umbral_tds: "umbral_tds",
      observaciones: "observaciones",
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

    if (updates.modoRiego !== undefined) {
      const metodoRows = (await query(
        `SELECT id_metodo_riego FROM MetodoRiego WHERE nombre = @nombre`,
        { nombre: updates.modoRiego }
      )) as Record<string, unknown>[]
      if (metodoRows[0]) {
        await execute(
          `UPDATE ZonasRiego SET id_metodo_riego = @metodoId WHERE id_zona = @id`,
          { metodoId: Number(metodoRows[0].id_metodo_riego), id: Number(id) }
        )
      }
    }

    if (updates.estadoRiego === "activo") {
      await execute(
        `INSERT INTO Riegos (id_zona, id_usuario, tipo, duracion_min, fecha_inicio)
         VALUES (@zoneId, @userId, @tipo, 0, GETDATE())`,
        { zoneId: Number(id), userId: session.userId, tipo: updates.modoRiego || "automatico" }
      )
    }

    await registrarBitacora({
      session,
      req,
      descripcion: `Se actualizo la zona ${id}`,
      modulo: "zonas",
      entidad: "ZonasRiego",
      entidadId: id,
      accion: "UPDATE",
      valorAnterior: previousRows[0] || null,
      valorNuevo: updates,
    })

    return NextResponse.json({ ok: true, id })
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
