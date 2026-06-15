import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"
import { getIrrigationMethodStorage, resolveIrrigationMethodValue } from "@/lib/irrigation-methods"
import { getSensorZoneColumn } from "@/lib/sensor-zone-column"

export const dynamic = "force-dynamic"

function normalizeSensorTypeSql(alias = "s") {
  return `LOWER(REPLACE(LTRIM(RTRIM(${alias}.tipo)), ' ', '_'))`
}

async function getIrrigationDeviceForZone(zoneId: number) {
  const sensorZoneColumn = await getSensorZoneColumn()

  if (sensorZoneColumn) {
    const sensorRows = await query<Array<{ idDispositivo: number | null }>>(
      `SELECT TOP 1
         s.id_dispositivo AS idDispositivo
       FROM Sensores s
       WHERE s.${sensorZoneColumn} = @zoneId
         AND s.id_dispositivo IS NOT NULL
       ORDER BY
         CASE
           WHEN ${normalizeSensorTypeSql("s")} IN ('humedad_suelo', 'humedad') THEN 0
           ELSE 1
         END,
         s.id_sensor ASC`,
      { zoneId }
    )

    if (sensorRows[0]?.idDispositivo != null) {
      return Number(sensorRows[0].idDispositivo)
    }
  }

  const deviceRows = await query<Array<{ idDispositivo: number | null }>>(
    `SELECT TOP 1
       d.id_dispositivo AS idDispositivo
     FROM DispositivosIoT d
     INNER JOIN ZonasRiego z ON z.id_invernadero = d.id_invernadero
     WHERE z.id_zona = @zoneId
     ORDER BY d.id_dispositivo ASC`,
    { zoneId }
  )

  return deviceRows[0]?.idDispositivo != null ? Number(deviceRows[0].idDispositivo) : null
}

async function enqueueIrrigationCommand(zoneId: number, command: "START_IRRIGATION" | "STOP_IRRIGATION", userId?: number | null) {
  const deviceId = await getIrrigationDeviceForZone(zoneId)
  if (!deviceId) {
    return null
  }

  const payload = {
    zonaId: zoneId,
    solicitadoEn: new Date().toISOString(),
    solicitadoPor: userId ?? null,
    motivo: command === "START_IRRIGATION" ? "riego_manual_iniciado" : "riego_manual_detenido",
  }

  const result = await execute(
    `INSERT INTO ComandosIoT (id_dispositivo, comando, parametros, enviado_por, fecha_envio, estado)
     OUTPUT INSERTED.id_comando
     VALUES (@deviceId, @command, @payload, @userId, GETDATE(), 'Pendiente')`,
    {
      deviceId,
      command,
      payload: JSON.stringify(payload),
      userId: userId ?? null,
    }
  )

  return {
    idComando: result.recordset?.[0]?.id_comando ?? null,
    idDispositivo: deviceId,
  }
}

async function cancelPendingStartCommandsForZone(zoneId: number) {
  await execute(
    `UPDATE ComandosIoT
     SET estado = 'Error'
     WHERE comando = 'START_IRRIGATION'
       AND estado = 'Pendiente'
       AND JSON_VALUE(parametros, '$.zonaId') = CONVERT(varchar(20), @zoneId)`,
    { zoneId }
  )
}

async function getGreenhouseAreaForCompany(invernaderoId: number, empresaId: number) {
  const rows = await query<Array<{ id: number; area: number | null }>>(
    `SELECT TOP 1
       id_invernadero AS id,
       superficie_m2 AS area
     FROM Invernaderos
     WHERE id_invernadero = @invernaderoId
       AND id_empresa = @empresaId`,
    { invernaderoId, empresaId }
  )

  return rows[0] ? { id: Number(rows[0].id), area: Number(rows[0].area || 0) } : null
}

function parsePositiveArea(value: unknown, fallback: number) {
  const area = Number(value ?? fallback)
  return Number.isFinite(area) ? area : 0
}

function parseNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

function parseNonNegativeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

async function getCropProductionParams(cropName: string, greenhouseId: number) {
  const rows = await query<Record<string, unknown>[]>(
    `SELECT TOP 1
       rendimiento_por_mata AS rendimientoPorMata,
       unidad_rendimiento AS unidadRendimiento,
       agua_litros_por_mata_dia AS aguaLitrosPorMataDia
     FROM dbo.Cultivos
     WHERE id_invernadero = @greenhouseId
       AND LOWER(LTRIM(RTRIM(nombre))) = LOWER(LTRIM(RTRIM(@cropName)))
     ORDER BY id_cultivo DESC`,
    { cropName, greenhouseId }
  )
  if (rows[0]) {
    return {
      rendimientoPorMata: Number(rows[0].rendimientoPorMata) || 0,
      unidadRendimiento: String(rows[0].unidadRendimiento || "lb"),
      aguaLitrosPorMataDia: Number(rows[0].aguaLitrosPorMataDia) || 0,
    }
  }

  const catalogRows = await query<Record<string, unknown>[]>(
    `IF OBJECT_ID('dbo.CatalogoCultivos', 'U') IS NOT NULL
       SELECT TOP 1
         rendimiento_por_mata AS rendimientoPorMata,
         unidad_rendimiento AS unidadRendimiento,
         agua_litros_por_mata_dia AS aguaLitrosPorMataDia
       FROM dbo.CatalogoCultivos
       WHERE LOWER(LTRIM(RTRIM(nombre))) = LOWER(LTRIM(RTRIM(@cropName)))
       ORDER BY id_catalogo ASC`,
    { cropName }
  )

  return {
    rendimientoPorMata: Number(catalogRows[0]?.rendimientoPorMata) || 0,
    unidadRendimiento: String(catalogRows[0]?.unidadRendimiento || "lb"),
    aguaLitrosPorMataDia: Number(catalogRows[0]?.aguaLitrosPorMataDia) || 0,
  }
}

async function hasZoneCropQuantityColumn() {
  const rows = await query<Array<{ exists: number }>>(
    `SELECT CASE WHEN COL_LENGTH('ZonasRiego', 'cantidad_cultivo') IS NULL THEN 0 ELSE 1 END AS [exists]`
  )

  return Number(rows[0]?.exists) === 1
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const gh = searchParams.get("greenhouse")

    const methodStorage = await getIrrigationMethodStorage()
    const sensorZoneColumn = await getSensorZoneColumn()
    const hasCantidadCultivo = await hasZoneCropQuantityColumn()
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
        CONVERT(char(10), z.fecha_siembra, 23) AS fechaSiembra,
        CONVERT(char(10), z.fecha_cosecha_estimada, 23) AS fechaCosechaEstimada,
        ISNULL(z.tiempo_germinacion_dias, 0) AS tiempoGerminacionDias,
        ISNULL(z.tiempo_crecimiento_dias, 0) AS tiempoCrecimientoDias,
        ISNULL(z.tiempo_cosecha_dias, 0) AS tiempoCosechaDias,
        ${hasCantidadCultivo ? "ISNULL(z.cantidad_cultivo, 0)" : "0"} AS cantidadCultivo,
        ISNULL(z.rendimiento_estimado, 0) AS rendimientoEstimado,
        ISNULL(z.unidad_rendimiento, '') AS unidadRendimiento,
        ISNULL(z.agua_estimada_litros_dia, 0) AS aguaEstimadaLitrosDia,
        z.humedad_siembra AS humedadSiembra,
        z.temperatura_siembra AS temperaturaSiembra,
        z.ph_siembra AS phSiembra,
        z.ec_siembra AS ecSiembra,
        z.tds_siembra AS tdsSiembra,
        ISNULL(z.notas_cultivo, '') AS notasCultivo,
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
          fechaSiembra: z.fechaSiembra ? String(z.fechaSiembra) : "",
          fechaCosechaEstimada: z.fechaCosechaEstimada ? String(z.fechaCosechaEstimada) : "",
          tiempoGerminacionDias: Number(z.tiempoGerminacionDias) || 0,
          tiempoCrecimientoDias: Number(z.tiempoCrecimientoDias) || 0,
          tiempoCosechaDias: Number(z.tiempoCosechaDias) || 0,
          cantidadCultivo: Number(z.cantidadCultivo) || 0,
          rendimientoEstimado: Number(z.rendimientoEstimado) || 0,
          unidadRendimiento: String(z.unidadRendimiento || ""),
          aguaEstimadaLitrosDia: Number(z.aguaEstimadaLitrosDia) || 0,
          humedadSiembra: z.humedadSiembra != null ? Number(z.humedadSiembra) : null,
          temperaturaSiembra: z.temperaturaSiembra != null ? Number(z.temperaturaSiembra) : null,
          phSiembra: z.phSiembra != null ? Number(z.phSiembra) : null,
          ecSiembra: z.ecSiembra != null ? Number(z.ecSiembra) : null,
          tdsSiembra: z.tdsSiembra != null ? Number(z.tdsSiembra) : null,
          notasCultivo: String(z.notasCultivo || ""),
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
    const invId = Number(body.invernaderoId) || 0
    const area = parsePositiveArea(body.area_m2, 100)
    const cantidadCultivo = parseNonNegativeInteger(body.cantidadCultivo, 0)
    const cropProduction = await getCropProductionParams(String(body.cultivoActual || ""), invId)
    const rendimientoEstimado = parseNonNegativeNumber(body.rendimientoEstimado, cantidadCultivo * cropProduction.rendimientoPorMata)
    const aguaEstimadaLitrosDia = parseNonNegativeNumber(body.aguaEstimadaLitrosDia, cantidadCultivo * cropProduction.aguaLitrosPorMataDia)

    if (!invId) {
      return NextResponse.json({ error: "Invernadero requerido" }, { status: 400 })
    }

    if (area <= 0) {
      return NextResponse.json({ error: "El área de la zona debe ser mayor a 0" }, { status: 400 })
    }

    const greenhouse = await getGreenhouseAreaForCompany(invId, session.empresaId)
    if (!greenhouse) {
      return NextResponse.json({ error: "Invernadero no encontrado para esta empresa" }, { status: 403 })
    }

    if (greenhouse.area > 0 && area > greenhouse.area) {
      return NextResponse.json(
        { error: `La zona no puede ser mayor al tamaño del invernadero (${greenhouse.area} m²)` },
        { status: 400 }
      )
    }

    const methodValue = await resolveIrrigationMethodValue(body.id_metodo_riego ?? body.modoRiego)
    const hasCantidadCultivo = await hasZoneCropQuantityColumn()
    const methodColumn = methodValue.storage === "table" ? "id_metodo_riego" : "metodo_riego"
    const methodParam = methodValue.storage === "table" ? "@metodoId" : "@metodoRiego"
    const insertColumns = [
      "nombre",
      "id_invernadero",
      "umbral_humedad",
      "tipo_cultivo",
      methodColumn,
      "estado",
      "area_m2",
      "caudal_litros_min",
      "umbral_ph",
      "umbral_ec",
      "umbral_tds",
      "fecha_siembra",
      "fecha_cosecha_estimada",
      "tiempo_germinacion_dias",
      "tiempo_crecimiento_dias",
      "tiempo_cosecha_dias",
      ...(hasCantidadCultivo ? ["cantidad_cultivo"] : []),
      "rendimiento_estimado",
      "unidad_rendimiento",
      "agua_estimada_litros_dia",
      "humedad_siembra",
      "temperatura_siembra",
      "ph_siembra",
      "ec_siembra",
      "tds_siembra",
      "notas_cultivo",
      "observaciones",
    ]
    const insertValues = [
      "@nombre",
      "@invId",
      "@umbral",
      "@cultivo",
      methodParam,
      "'Activa'",
      "@area",
      "@caudal",
      "@ph",
      "@ec",
      "@tds",
      "@fechaSiembra",
      "@fechaCosecha",
      "@germinacion",
      "@crecimiento",
      "@cosecha",
      ...(hasCantidadCultivo ? ["@cantidadCultivo"] : []),
      "@rendimientoEstimado",
      "@unidadRendimiento",
      "@aguaEstimadaLitrosDia",
      "@humedadSiembra",
      "@temperaturaSiembra",
      "@phSiembra",
      "@ecSiembra",
      "@tdsSiembra",
      "@notasCultivo",
      "@obs",
    ]
    const insertSql = `INSERT INTO ZonasRiego (${insertColumns.join(", ")})
       OUTPUT INSERTED.id_zona
       VALUES (${insertValues.join(", ")})`

    const result = await execute(insertSql, {
      nombre: body.nombre || "Nueva Zona",
      invId,
      umbral: body.umbralHumedad || 40,
      cultivo: body.cultivoActual || "",
      metodoId: methodValue.id_metodo_riego,
      metodoRiego: methodValue.metodo_riego,
      area,
      caudal: body.caudal_litros_min || 10,
      ph: body.umbral_ph || 6.0,
      ec: body.umbral_ec || 1.5,
      tds: body.umbral_tds || 800,
      fechaSiembra: body.fechaSiembra || null,
      fechaCosecha: body.fechaCosechaEstimada || null,
      germinacion: body.tiempoGerminacionDias || null,
      crecimiento: body.tiempoCrecimientoDias || null,
      cosecha: body.tiempoCosechaDias || null,
      cantidadCultivo,
      rendimientoEstimado,
      unidadRendimiento: body.unidadRendimiento || cropProduction.unidadRendimiento,
      aguaEstimadaLitrosDia,
      humedadSiembra: body.humedadSiembra || null,
      temperaturaSiembra: body.temperaturaSiembra || null,
      phSiembra: body.phSiembra || null,
      ecSiembra: body.ecSiembra || null,
      tdsSiembra: body.tdsSiembra || null,
      notasCultivo: body.notasCultivo || "",
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
      invernaderoId: String(invId),
      cultivoActual: body.cultivoActual || "",
      estadoRiego: "inactivo",
      modoRiego: String(methodName),
      umbralHumedad: body.umbralHumedad || 40,
      area_m2: area,
      caudal_litros_min: body.caudal_litros_min || 10,
      umbral_ph: body.umbral_ph || 6.0,
      umbral_ec: body.umbral_ec || 1.5,
      umbral_tds: body.umbral_tds || 800,
      fechaSiembra: body.fechaSiembra || "",
      fechaCosechaEstimada: body.fechaCosechaEstimada || "",
      tiempoGerminacionDias: body.tiempoGerminacionDias || 0,
      tiempoCrecimientoDias: body.tiempoCrecimientoDias || 0,
      tiempoCosechaDias: body.tiempoCosechaDias || 0,
      cantidadCultivo,
      rendimientoEstimado,
      unidadRendimiento: body.unidadRendimiento || cropProduction.unidadRendimiento,
      aguaEstimadaLitrosDia,
      humedadSiembra: body.humedadSiembra ?? null,
      temperaturaSiembra: body.temperaturaSiembra ?? null,
      phSiembra: body.phSiembra ?? null,
      ecSiembra: body.ecSiembra ?? null,
      tdsSiembra: body.tdsSiembra ?? null,
      notasCultivo: body.notasCultivo || "",
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

    const methodStorage = await getIrrigationMethodStorage()
    const hasCantidadCultivo = await hasZoneCropQuantityColumn()
    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT z.nombre, z.id_invernadero AS invernaderoId, i.superficie_m2 AS invernaderoArea, z.umbral_humedad AS umbralHumedad, z.tipo_cultivo AS cultivoActual, ${methodStorage === "table" ? "m.nombre" : "z.metodo_riego"} AS modoRiego, z.estado AS estadoRiego, z.area_m2, z.caudal_litros_min, z.umbral_ph, z.umbral_ec, z.umbral_tds, z.fecha_siembra, z.fecha_cosecha_estimada, z.tiempo_germinacion_dias, z.tiempo_crecimiento_dias, z.tiempo_cosecha_dias, ${hasCantidadCultivo ? "z.cantidad_cultivo" : "0 AS cantidad_cultivo"}, z.notas_cultivo, z.observaciones
       FROM ZonasRiego z
       INNER JOIN Invernaderos i ON i.id_invernadero = z.id_invernadero
       ${methodStorage === "table" ? "LEFT JOIN MetodoRiego m ON z.id_metodo_riego = m.id_metodo_riego" : ""}
       WHERE z.id_zona = @id
         AND i.id_empresa = @empresaId`,
      { id: Number(id), empresaId: session.empresaId }
    )

    if (previousRows.length === 0) {
      return NextResponse.json({ error: "Zona no encontrada para esta empresa" }, { status: 404 })
    }

    if (updates.area_m2 !== undefined) {
      const nextArea = parsePositiveArea(updates.area_m2, 0)
      const greenhouseArea = Number(previousRows[0].invernaderoArea || 0)

      if (nextArea <= 0) {
        return NextResponse.json({ error: "El área de la zona debe ser mayor a 0" }, { status: 400 })
      }

      if (greenhouseArea > 0 && nextArea > greenhouseArea) {
        return NextResponse.json(
          { error: `La zona no puede ser mayor al tamaño del invernadero (${greenhouseArea} m²)` },
          { status: 400 }
        )
      }

      updates.area_m2 = nextArea
    }

    if (updates.cantidadCultivo !== undefined) {
      updates.cantidadCultivo = parseNonNegativeInteger(updates.cantidadCultivo, 0)
    }

    if (
      updates.cantidadCultivo !== undefined ||
      updates.cultivoActual !== undefined ||
      updates.rendimientoEstimado === undefined ||
      updates.aguaEstimadaLitrosDia === undefined
    ) {
      const nextCrop = String(updates.cultivoActual ?? previousRows[0].cultivoActual ?? "")
      const nextQty = parseNonNegativeInteger(updates.cantidadCultivo ?? previousRows[0].cantidad_cultivo, 0)
      const production = await getCropProductionParams(nextCrop, Number(previousRows[0].invernaderoId))
      if (updates.rendimientoEstimado === undefined) {
        updates.rendimientoEstimado = nextQty * production.rendimientoPorMata
      }
      if (updates.aguaEstimadaLitrosDia === undefined) {
        updates.aguaEstimadaLitrosDia = nextQty * production.aguaLitrosPorMataDia
      }
      if (updates.unidadRendimiento === undefined) {
        updates.unidadRendimiento = production.unidadRendimiento
      }
    }

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
      fechaSiembra: "fecha_siembra",
      fechaCosechaEstimada: "fecha_cosecha_estimada",
      tiempoGerminacionDias: "tiempo_germinacion_dias",
      tiempoCrecimientoDias: "tiempo_crecimiento_dias",
      tiempoCosechaDias: "tiempo_cosecha_dias",
      cantidadCultivo: "cantidad_cultivo",
      rendimientoEstimado: "rendimiento_estimado",
      unidadRendimiento: "unidad_rendimiento",
      aguaEstimadaLitrosDia: "agua_estimada_litros_dia",
      humedadSiembra: "humedad_siembra",
      temperaturaSiembra: "temperatura_siembra",
      phSiembra: "ph_siembra",
      ecSiembra: "ec_siembra",
      tdsSiembra: "tds_siembra",
      notasCultivo: "notas_cultivo",
      observaciones: "observaciones",
    }
    if (hasCantidadCultivo) {
      fieldMap.cantidadCultivo = "cantidad_cultivo"
    } else {
      delete updates.cantidadCultivo
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

    let iotCommand: Awaited<ReturnType<typeof enqueueIrrigationCommand>> = null

    if (updates.estadoRiego === "activo") {
      await execute(
        `INSERT INTO Riegos (id_zona, id_usuario, tipo, duracion_min, fecha_inicio)
         VALUES (@zoneId, @userId, @tipo, 0, GETDATE())`,
        { zoneId: Number(id), userId: session.userId, tipo: updates.modoRiego || "automatico" }
      )
      iotCommand = await enqueueIrrigationCommand(Number(id), "START_IRRIGATION", session.userId)
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
      await cancelPendingStartCommandsForZone(Number(id))
      iotCommand = await enqueueIrrigationCommand(Number(id), "STOP_IRRIGATION", session.userId)
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
      valorNuevo: { ...updates, iotCommand },
    })

    return NextResponse.json({ ok: true, id, iotCommand })
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
