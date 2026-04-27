import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"
import { getIrrigationMethodStorage, resolveIrrigationMethodValue } from "@/lib/irrigation-methods"
import { getSensorZoneColumn } from "@/lib/sensor-zone-column"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const gh = searchParams.get("greenhouse")

    const methodStorage = await getIrrigationMethodStorage()
    const sensorZoneColumn = await getSensorZoneColumn()
    let sqlText = `
      SELECT
        z.id_zona AS id,
        z.nombre,
        z.id_invernadero AS invernaderoId,
        z.tipo_cultivo AS cultivoActual,
        z.estado AS estadoRiego,
        z.umbral_humedad AS umbralHumedad,
        ${methodStorage === "table" ? "m.nombre" : "z.metodo_riego"} AS modoRiego,
        ISNULL(z.area_m2, 100) AS area_m2,
        ISNULL(z.caudal_litros_min, 10) AS caudal_litros_min,
        ISNULL(z.umbral_ph, 6.0) AS umbral_ph,
        ISNULL(z.umbral_ec, 1.5) AS umbral_ec,
        ISNULL(z.umbral_tds, 800) AS umbral_tds,
        ISNULL(z.observaciones, '') AS observaciones
      FROM ZonasRiego z
      ${methodStorage === "table" ? "LEFT JOIN MetodoRiego m ON z.id_metodo_riego = m.id_metodo_riego" : ""}
    `
    const params: Record<string, unknown> = {}
    if (gh) {
      sqlText += ` WHERE z.id_invernadero = @gh
        AND z.id_invernadero IN (
          SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId
        )`
      params.gh = Number(gh)
      params.empresaId = session.empresaId
    } else {
      sqlText += ` WHERE z.id_invernadero IN (
        SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId
      )`
      params.empresaId = session.empresaId
    }

    const rows = (await query(sqlText, params)) as Record<string, unknown>[]

    const zones = await Promise.all(
      rows.map(async (z) => {
        const sensorTypes = ["humedad_suelo", "ph", "tds", "temperatura"]
        const sensorReadings: Record<string, { valor: number; unidad: string; estado: string; rangoMin: number; rangoMax: number; ultimaActualizacion: string }> = {}
        let lastRiego: Record<string, unknown> | undefined

        try {
          const riegoRows = (await query(
            `SELECT TOP 1 fecha_inicio, fecha_fin, duracion_min, volumen_litros
             FROM Riegos WHERE id_zona = @zoneId ORDER BY fecha_inicio DESC`,
            { zoneId: z.id }
          )) as Record<string, unknown>[]
          lastRiego = riegoRows[0]
        } catch (err) {
          console.error("[zones] Last irrigation query failed:", { zoneId: z.id, err })
        }

        for (const tipo of sensorTypes) {
          try {
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
              WHERE ${sensorZoneColumn ? `s.${sensorZoneColumn} = @zoneId` : "s.id_invernadero = @invId"}
                AND s.tipo = @tipo
              ORDER BY ls.fecha_hora DESC`,
              { zoneId: z.id, invId: z.invernaderoId, tipo }
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
          } catch (err) {
            console.error("[zones] Sensor query failed:", { zoneId: z.id, invernaderoId: z.invernaderoId, tipo, err })
          }
        }

        return {
          id: String(z.id),
          nombre: z.nombre,
          invernaderoId: String(z.invernaderoId),
          cultivoActual: z.cultivoActual || "",
          estadoRiego: (z.estadoRiego as string)?.toLowerCase() === "activa" ? "activo" : ((z.estadoRiego as string)?.toLowerCase() === "inactiva" ? "inactivo" : (z.estadoRiego as string)?.toLowerCase() || "inactivo"),
          modoRiego: (z.modoRiego as string) || "goteo",
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
  } catch (err) {
    console.error("[zones] GET Error:", err)
    return NextResponse.json({ error: "No se pudieron cargar las zonas" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (session.rol === "agricultor") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const body = await req.json()
    const methodValue = await resolveIrrigationMethodValue(body.id_metodo_riego ?? body.modoRiego)
    const insertSql = methodValue.storage === "table"
      ? `INSERT INTO ZonasRiego (nombre, id_invernadero, umbral_humedad, tipo_cultivo, id_metodo_riego, estado, area_m2, caudal_litros_min, umbral_ph, umbral_ec, umbral_tds, observaciones)
         OUTPUT INSERTED.id_zona
         VALUES (@nombre, @invId, @umbral, @cultivo, @metodoId, 'Activa', @area, @caudal, @ph, @ec, @tds, @obs)`
      : `INSERT INTO ZonasRiego (nombre, id_invernadero, umbral_humedad, tipo_cultivo, metodo_riego, estado, area_m2, caudal_litros_min, umbral_ph, umbral_ec, umbral_tds, observaciones)
         OUTPUT INSERTED.id_zona
         VALUES (@nombre, @invId, @umbral, @cultivo, @metodoRiego, 'Activa', @area, @caudal, @ph, @ec, @tds, @obs)`

    const result = await execute(insertSql, {
      nombre: body.nombre || "Nueva Zona",
      invId: Number(body.invernaderoId) || 1,
      umbral: body.umbralHumedad || 40,
      cultivo: body.cultivoActual || "",
      metodoId: methodValue.id_metodo_riego,
      metodoRiego: methodValue.metodo_riego,
      area: body.area_m2 || 100,
      caudal: body.caudal_litros_min || 10,
      ph: body.umbral_ph || 6.0,
      ec: body.umbral_ec || 1.5,
      tds: body.umbral_tds || 800,
      obs: body.observaciones || "",
    })
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
    const methodName = methodValue.metodo_riego || body.modoRiego || body.id_metodo_riego || "goteo"

    return NextResponse.json({
      id: String(newId),
      nombre: body.nombre || "Nueva Zona",
      invernaderoId: String(body.invernaderoId || 1),
      cultivoActual: body.cultivoActual || "",
      estadoRiego: "inactivo",
      modoRiego: String(methodName),
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
      `SELECT z.nombre, z.umbral_humedad AS umbralHumedad, z.tipo_cultivo AS cultivoActual, ${await getIrrigationMethodStorage() === "table" ? "m.nombre" : "z.metodo_riego"} AS modoRiego, z.estado AS estadoRiego, z.area_m2, z.caudal_litros_min, z.umbral_ph, z.umbral_ec, z.umbral_tds, z.observaciones
       FROM ZonasRiego z
       ${await getIrrigationMethodStorage() === "table" ? "LEFT JOIN MetodoRiego m ON z.id_metodo_riego = m.id_metodo_riego" : ""}
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
      const methodValue = await resolveIrrigationMethodValue(updates.modoRiego)
      if (methodValue.storage === "table" && methodValue.id_metodo_riego) {
        await execute(
          `UPDATE ZonasRiego SET id_metodo_riego = @metodoId WHERE id_zona = @id`,
          { metodoId: methodValue.id_metodo_riego, id: Number(id) }
        )
      } else if (methodValue.storage === "column") {
        await execute(
          `UPDATE ZonasRiego SET metodo_riego = @metodoRiego WHERE id_zona = @id`,
          { metodoRiego: methodValue.metodo_riego, id: Number(id) }
        )
      }
    }

    if (updates.estadoRiego === "activo") {
      await execute(
        `INSERT INTO Riegos (id_zona, id_usuario, tipo, duracion_min, fecha_inicio)
         VALUES (@zoneId, @userId, @tipo, 0, GETDATE())`,
        { zoneId: Number(id), userId: session.userId, tipo: updates.modoRiego || "automatico" }
      )
    } else if (updates.estadoRiego === "inactivo") {
      await execute(
        `UPDATE Riegos
         SET fecha_fin = GETDATE(),
             duracion_min = DATEDIFF(MINUTE, fecha_inicio, GETDATE()),
             volumen_litros = CASE
               WHEN ISNULL(volumen_litros, 0) > 0 THEN volumen_litros
               ELSE DATEDIFF(MINUTE, fecha_inicio, GETDATE()) * (
                 SELECT ISNULL(caudal_litros_min, 0)
                 FROM ZonasRiego
                 WHERE id_zona = @zoneId
               )
             END
         WHERE id_riego = (
           SELECT TOP 1 id_riego
           FROM Riegos
           WHERE id_zona = @zoneId AND fecha_fin IS NULL
           ORDER BY fecha_inicio DESC
         )`,
        { zoneId: Number(id) }
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
