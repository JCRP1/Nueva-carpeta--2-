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

async function hasZoneCropQuantityColumn() {
  const rows = await query<Array<{ exists: number }>>(
    `SELECT CASE WHEN COL_LENGTH('ZonasRiego', 'cantidad_cultivo') IS NULL THEN 0 ELSE 1 END AS [exists]`
  )

  return Number(rows[0]?.exists) === 1
}

async function getZoneProductionColumns() {
  const rows = await query<Array<{
    rendimientoPorMata: number
    unidadRendimiento: number
    produccionEstimada: number
    aguaEstimadaLitrosDia: number
    humedadSiembra: number
    temperaturaSiembra: number
    phSiembra: number
    ecSiembra: number
    tdsSiembra: number
    fertilizanteEstimado: number
    abonoEstimado: number
    recomendacionSiembra: number
    costoPorMata: number
    precioMercado: number
    costoTotalMatas: number
    ingresoEstimado: number
    margenEstimado: number
    margenPorcentaje: number
  }>>(
    `SELECT
       CASE WHEN COL_LENGTH('ZonasRiego', 'rendimiento_por_mata') IS NULL THEN 0 ELSE 1 END AS rendimientoPorMata,
       CASE WHEN COL_LENGTH('ZonasRiego', 'unidad_rendimiento') IS NULL THEN 0 ELSE 1 END AS unidadRendimiento,
       CASE WHEN COL_LENGTH('ZonasRiego', 'produccion_estimada') IS NULL THEN 0 ELSE 1 END AS produccionEstimada,
       CASE WHEN COL_LENGTH('ZonasRiego', 'agua_estimada_litros_dia') IS NULL THEN 0 ELSE 1 END AS aguaEstimadaLitrosDia,
       CASE WHEN COL_LENGTH('ZonasRiego', 'humedad_siembra') IS NULL THEN 0 ELSE 1 END AS humedadSiembra,
       CASE WHEN COL_LENGTH('ZonasRiego', 'temperatura_siembra') IS NULL THEN 0 ELSE 1 END AS temperaturaSiembra,
       CASE WHEN COL_LENGTH('ZonasRiego', 'ph_siembra') IS NULL THEN 0 ELSE 1 END AS phSiembra,
       CASE WHEN COL_LENGTH('ZonasRiego', 'ec_siembra') IS NULL THEN 0 ELSE 1 END AS ecSiembra,
       CASE WHEN COL_LENGTH('ZonasRiego', 'tds_siembra') IS NULL THEN 0 ELSE 1 END AS tdsSiembra,
       CASE WHEN COL_LENGTH('ZonasRiego', 'fertilizante_estimado') IS NULL THEN 0 ELSE 1 END AS fertilizanteEstimado,
       CASE WHEN COL_LENGTH('ZonasRiego', 'abono_estimado') IS NULL THEN 0 ELSE 1 END AS abonoEstimado,
       CASE WHEN COL_LENGTH('ZonasRiego', 'recomendacion_siembra') IS NULL THEN 0 ELSE 1 END AS recomendacionSiembra,
       CASE WHEN COL_LENGTH('ZonasRiego', 'costo_por_mata') IS NULL THEN 0 ELSE 1 END AS costoPorMata,
       CASE WHEN COL_LENGTH('ZonasRiego', 'precio_mercado') IS NULL THEN 0 ELSE 1 END AS precioMercado,
       CASE WHEN COL_LENGTH('ZonasRiego', 'costo_total_matas') IS NULL THEN 0 ELSE 1 END AS costoTotalMatas,
       CASE WHEN COL_LENGTH('ZonasRiego', 'ingreso_estimado') IS NULL THEN 0 ELSE 1 END AS ingresoEstimado,
       CASE WHEN COL_LENGTH('ZonasRiego', 'margen_estimado') IS NULL THEN 0 ELSE 1 END AS margenEstimado,
       CASE WHEN COL_LENGTH('ZonasRiego', 'margen_porcentaje') IS NULL THEN 0 ELSE 1 END AS margenPorcentaje`
  )

  return {
    rendimientoPorMata: Number(rows[0]?.rendimientoPorMata) === 1,
    unidadRendimiento: Number(rows[0]?.unidadRendimiento) === 1,
    produccionEstimada: Number(rows[0]?.produccionEstimada) === 1,
    aguaEstimadaLitrosDia: Number(rows[0]?.aguaEstimadaLitrosDia) === 1,
    humedadSiembra: Number(rows[0]?.humedadSiembra) === 1,
    temperaturaSiembra: Number(rows[0]?.temperaturaSiembra) === 1,
    phSiembra: Number(rows[0]?.phSiembra) === 1,
    ecSiembra: Number(rows[0]?.ecSiembra) === 1,
    tdsSiembra: Number(rows[0]?.tdsSiembra) === 1,
    fertilizanteEstimado: Number(rows[0]?.fertilizanteEstimado) === 1,
    abonoEstimado: Number(rows[0]?.abonoEstimado) === 1,
    recomendacionSiembra: Number(rows[0]?.recomendacionSiembra) === 1,
    costoPorMata: Number(rows[0]?.costoPorMata) === 1,
    precioMercado: Number(rows[0]?.precioMercado) === 1,
    costoTotalMatas: Number(rows[0]?.costoTotalMatas) === 1,
    ingresoEstimado: Number(rows[0]?.ingresoEstimado) === 1,
    margenEstimado: Number(rows[0]?.margenEstimado) === 1,
    margenPorcentaje: Number(rows[0]?.margenPorcentaje) === 1,
  }
}

function parseNullableDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scaleTextEstimate(value: unknown, cantidadMatas: number) {
  const text = String(value || "").trim()
  if (!text || cantidadMatas <= 0) return text
  return `${text}\nEstimado para ${cantidadMatas.toLocaleString("es-DO")} matas: ajustar proporcionalmente segun dosis tecnica.`
}

async function getCatalogCropByName(nombre: string) {
  const rows = await query<Record<string, unknown>[]>(
    `SELECT TOP 1
       nombre,
       variedad,
       umbral_humedad AS umbralHumedad,
       umbral_temperatura AS umbralTemperatura,
       umbral_ph AS umbralPh,
       umbral_ec AS umbralEc,
       umbral_tds AS umbralTds,
       agua_litros_por_mata_dia AS aguaLitrosPorMataDia,
       rendimiento_por_mata AS rendimientoPorMata,
       unidad_rendimiento AS unidadRendimiento,
       fertilizantes,
       abonos,
       mejores_meses AS mejoresMeses,
       recomendacion_siembra AS recomendacionSiembra
     FROM dbo.CatalogoCultivos
     WHERE OBJECT_ID('dbo.CatalogoCultivos', 'U') IS NOT NULL
       AND activo = 1
       AND LOWER(LTRIM(RTRIM(nombre))) = LOWER(LTRIM(RTRIM(@nombre)))
     ORDER BY id_catalogo`,
    { nombre }
  ).catch(() => [])

  return rows[0] || null
}

async function ensureLocalCropForZone(invernaderoId: number, cropName: string) {
  const nombre = cropName.trim()
  if (!nombre) return null

  const existing = await query<Array<{ id_cultivo: number }>>(
    `SELECT TOP 1 id_cultivo
     FROM dbo.Cultivos
     WHERE id_invernadero = @invernaderoId
       AND LOWER(LTRIM(RTRIM(nombre))) = LOWER(LTRIM(RTRIM(@nombre)))
     ORDER BY id_cultivo DESC`,
    { invernaderoId, nombre }
  )
  if (existing[0]?.id_cultivo) return Number(existing[0].id_cultivo)

  const catalog = await getCatalogCropByName(nombre)
  const inserted = await execute(
    `INSERT INTO dbo.Cultivos (
       nombre,
       variedad,
       id_invernadero,
       umbral_humedad,
       umbral_temperatura,
       umbral_ph,
       umbral_ec,
       umbral_tds,
       agua_litros_por_mata_dia,
       rendimiento_por_mata,
       unidad_rendimiento,
       fertilizantes,
       abonos,
       mejores_meses,
       recomendacion_siembra
     )
     OUTPUT INSERTED.id_cultivo
     VALUES (
       @nombre,
       @variedad,
       @invernaderoId,
       @umbralHumedad,
       @umbralTemperatura,
       @umbralPh,
       @umbralEc,
       @umbralTds,
       @aguaLitrosPorMataDia,
       @rendimientoPorMata,
       @unidadRendimiento,
       @fertilizantes,
       @abonos,
       @mejoresMeses,
       @recomendacionSiembra
     )`,
    {
      nombre,
      variedad: String(catalog?.variedad || ""),
      invernaderoId,
      umbralHumedad: catalog?.umbralHumedad ?? null,
      umbralTemperatura: catalog?.umbralTemperatura ?? null,
      umbralPh: catalog?.umbralPh ?? null,
      umbralEc: catalog?.umbralEc ?? null,
      umbralTds: catalog?.umbralTds ?? null,
      aguaLitrosPorMataDia: catalog?.aguaLitrosPorMataDia ?? null,
      rendimientoPorMata: catalog?.rendimientoPorMata ?? null,
      unidadRendimiento: catalog?.unidadRendimiento ?? null,
      fertilizantes: catalog?.fertilizantes ?? null,
      abonos: catalog?.abonos ?? null,
      mejoresMeses: catalog?.mejoresMeses ?? null,
      recomendacionSiembra: catalog?.recomendacionSiembra ?? null,
    }
  ).catch(() => null)

  return Number(inserted?.recordset?.[0]?.id_cultivo || 0) || null
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const gh = searchParams.get("greenhouse")

    const methodStorage = await getIrrigationMethodStorage()
    const sensorZoneColumn = await getSensorZoneColumn()
    const hasCantidadCultivo = await hasZoneCropQuantityColumn()
    const productionColumns = await getZoneProductionColumns()
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
        ${productionColumns.rendimientoPorMata ? "z.rendimiento_por_mata" : "NULL"} AS rendimientoPorMata,
        ${productionColumns.unidadRendimiento ? "z.unidad_rendimiento" : "NULL"} AS unidadRendimiento,
        ${productionColumns.produccionEstimada ? "z.produccion_estimada" : "NULL"} AS produccionEstimada,
        ${productionColumns.aguaEstimadaLitrosDia ? "z.agua_estimada_litros_dia" : "NULL"} AS aguaEstimadaLitrosDia,
        ${productionColumns.humedadSiembra ? "z.humedad_siembra" : "NULL"} AS humedadSiembra,
        ${productionColumns.temperaturaSiembra ? "z.temperatura_siembra" : "NULL"} AS temperaturaSiembra,
        ${productionColumns.phSiembra ? "z.ph_siembra" : "NULL"} AS phSiembra,
        ${productionColumns.ecSiembra ? "z.ec_siembra" : "NULL"} AS ecSiembra,
        ${productionColumns.tdsSiembra ? "z.tds_siembra" : "NULL"} AS tdsSiembra,
        ${productionColumns.fertilizanteEstimado ? "z.fertilizante_estimado" : "NULL"} AS fertilizanteEstimado,
        ${productionColumns.abonoEstimado ? "z.abono_estimado" : "NULL"} AS abonoEstimado,
        ${productionColumns.recomendacionSiembra ? "z.recomendacion_siembra" : "NULL"} AS recomendacionSiembra,
        ${productionColumns.costoPorMata ? "z.costo_por_mata" : "NULL"} AS costoPorMata,
        ${productionColumns.precioMercado ? "z.precio_mercado" : "NULL"} AS precioMercado,
        ${productionColumns.costoTotalMatas ? "z.costo_total_matas" : "NULL"} AS costoTotalMatas,
        ${productionColumns.ingresoEstimado ? "z.ingreso_estimado" : "NULL"} AS ingresoEstimado,
        ${productionColumns.margenEstimado ? "z.margen_estimado" : "NULL"} AS margenEstimado,
        ${productionColumns.margenPorcentaje ? "z.margen_porcentaje" : "NULL"} AS margenPorcentaje,
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
          rendimientoPorMata: z.rendimientoPorMata != null ? Number(z.rendimientoPorMata) : null,
          unidadRendimiento: z.unidadRendimiento ? String(z.unidadRendimiento) : "",
          produccionEstimada: z.produccionEstimada != null ? Number(z.produccionEstimada) : null,
          aguaEstimadaLitrosDia: z.aguaEstimadaLitrosDia != null ? Number(z.aguaEstimadaLitrosDia) : null,
          humedadSiembra: z.humedadSiembra != null ? Number(z.humedadSiembra) : null,
          temperaturaSiembra: z.temperaturaSiembra != null ? Number(z.temperaturaSiembra) : null,
          phSiembra: z.phSiembra != null ? Number(z.phSiembra) : null,
          ecSiembra: z.ecSiembra != null ? Number(z.ecSiembra) : null,
          tdsSiembra: z.tdsSiembra != null ? Number(z.tdsSiembra) : null,
          fertilizanteEstimado: z.fertilizanteEstimado ? String(z.fertilizanteEstimado) : "",
          abonoEstimado: z.abonoEstimado ? String(z.abonoEstimado) : "",
          recomendacionSiembra: z.recomendacionSiembra ? String(z.recomendacionSiembra) : "",
          costoPorMata: z.costoPorMata != null ? Number(z.costoPorMata) : null,
          precioMercado: z.precioMercado != null ? Number(z.precioMercado) : null,
          costoTotalMatas: z.costoTotalMatas != null ? Number(z.costoTotalMatas) : null,
          ingresoEstimado: z.ingresoEstimado != null ? Number(z.ingresoEstimado) : null,
          margenEstimado: z.margenEstimado != null ? Number(z.margenEstimado) : null,
          margenPorcentaje: z.margenPorcentaje != null ? Number(z.margenPorcentaje) : null,
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
    const productionColumns = await getZoneProductionColumns()
    const catalogCrop = await getCatalogCropByName(String(body.cultivoActual || ""))
    const rendimientoPorMata = parseNullableDecimal(body.rendimientoPorMata)
    const unidadRendimiento = body.unidadRendimiento ? String(body.unidadRendimiento) : null
    const produccionEstimada = parseNullableDecimal(body.produccionEstimada)
    const aguaPorMataDia = parseNullableDecimal(catalogCrop?.aguaLitrosPorMataDia)
    const aguaEstimadaLitrosDia = parseNullableDecimal(body.aguaEstimadaLitrosDia) ?? (aguaPorMataDia != null ? aguaPorMataDia * cantidadCultivo : null)
    const humedadSiembra = parseNullableDecimal(body.humedadSiembra ?? body.humedad_siembra ?? body.umbralHumedad ?? catalogCrop?.umbralHumedad)
    const temperaturaSiembra = parseNullableDecimal(body.temperaturaSiembra ?? body.temperatura_siembra ?? catalogCrop?.umbralTemperatura)
    const phSiembra = parseNullableDecimal(body.phSiembra ?? body.ph_siembra ?? body.umbral_ph ?? catalogCrop?.umbralPh)
    const ecSiembra = parseNullableDecimal(body.ecSiembra ?? body.ec_siembra ?? body.umbral_ec ?? catalogCrop?.umbralEc)
    const tdsSiembra = parseNullableDecimal(body.tdsSiembra ?? body.tds_siembra ?? body.umbral_tds ?? catalogCrop?.umbralTds)
    const fertilizanteEstimado = String(body.fertilizanteEstimado || body.fertilizante_estimado || scaleTextEstimate(catalogCrop?.fertilizantes, cantidadCultivo) || "")
    const abonoEstimado = String(body.abonoEstimado || body.abono_estimado || scaleTextEstimate(catalogCrop?.abonos, cantidadCultivo) || "")
    const recomendacionSiembra = String(body.recomendacionSiembra || body.recomendacion_siembra || catalogCrop?.recomendacionSiembra || "")
    const costoPorMata = parseNullableDecimal(body.costoPorMata)
    const precioMercado = parseNullableDecimal(body.precioMercado)
    const costoTotalMatas = parseNullableDecimal(body.costoTotalMatas)
    const ingresoEstimado = parseNullableDecimal(body.ingresoEstimado)
    const margenEstimado = parseNullableDecimal(body.margenEstimado)
    const margenPorcentaje = parseNullableDecimal(body.margenPorcentaje)
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
      ...(productionColumns.rendimientoPorMata ? ["rendimiento_por_mata"] : []),
      ...(productionColumns.unidadRendimiento ? ["unidad_rendimiento"] : []),
      ...(productionColumns.produccionEstimada ? ["produccion_estimada"] : []),
      ...(productionColumns.aguaEstimadaLitrosDia ? ["agua_estimada_litros_dia"] : []),
      ...(productionColumns.humedadSiembra ? ["humedad_siembra"] : []),
      ...(productionColumns.temperaturaSiembra ? ["temperatura_siembra"] : []),
      ...(productionColumns.phSiembra ? ["ph_siembra"] : []),
      ...(productionColumns.ecSiembra ? ["ec_siembra"] : []),
      ...(productionColumns.tdsSiembra ? ["tds_siembra"] : []),
      ...(productionColumns.fertilizanteEstimado ? ["fertilizante_estimado"] : []),
      ...(productionColumns.abonoEstimado ? ["abono_estimado"] : []),
      ...(productionColumns.recomendacionSiembra ? ["recomendacion_siembra"] : []),
      ...(productionColumns.costoPorMata ? ["costo_por_mata"] : []),
      ...(productionColumns.precioMercado ? ["precio_mercado"] : []),
      ...(productionColumns.costoTotalMatas ? ["costo_total_matas"] : []),
      ...(productionColumns.ingresoEstimado ? ["ingreso_estimado"] : []),
      ...(productionColumns.margenEstimado ? ["margen_estimado"] : []),
      ...(productionColumns.margenPorcentaje ? ["margen_porcentaje"] : []),
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
      ...(productionColumns.rendimientoPorMata ? ["@rendimientoPorMata"] : []),
      ...(productionColumns.unidadRendimiento ? ["@unidadRendimiento"] : []),
      ...(productionColumns.produccionEstimada ? ["@produccionEstimada"] : []),
      ...(productionColumns.aguaEstimadaLitrosDia ? ["@aguaEstimadaLitrosDia"] : []),
      ...(productionColumns.humedadSiembra ? ["@humedadSiembra"] : []),
      ...(productionColumns.temperaturaSiembra ? ["@temperaturaSiembra"] : []),
      ...(productionColumns.phSiembra ? ["@phSiembra"] : []),
      ...(productionColumns.ecSiembra ? ["@ecSiembra"] : []),
      ...(productionColumns.tdsSiembra ? ["@tdsSiembra"] : []),
      ...(productionColumns.fertilizanteEstimado ? ["@fertilizanteEstimado"] : []),
      ...(productionColumns.abonoEstimado ? ["@abonoEstimado"] : []),
      ...(productionColumns.recomendacionSiembra ? ["@recomendacionSiembra"] : []),
      ...(productionColumns.costoPorMata ? ["@costoPorMata"] : []),
      ...(productionColumns.precioMercado ? ["@precioMercado"] : []),
      ...(productionColumns.costoTotalMatas ? ["@costoTotalMatas"] : []),
      ...(productionColumns.ingresoEstimado ? ["@ingresoEstimado"] : []),
      ...(productionColumns.margenEstimado ? ["@margenEstimado"] : []),
      ...(productionColumns.margenPorcentaje ? ["@margenPorcentaje"] : []),
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
      rendimientoPorMata,
      unidadRendimiento,
      produccionEstimada,
      aguaEstimadaLitrosDia,
      humedadSiembra,
      temperaturaSiembra,
      phSiembra,
      ecSiembra,
      tdsSiembra,
      fertilizanteEstimado,
      abonoEstimado,
      recomendacionSiembra,
      costoPorMata,
      precioMercado,
      costoTotalMatas,
      ingresoEstimado,
      margenEstimado,
      margenPorcentaje,
      notasCultivo: body.notasCultivo || "",
      obs: body.observaciones || "",
    })
    const newId = result.recordset?.[0]?.id_zona
    await ensureLocalCropForZone(invId, String(body.cultivoActual || ""))
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
      rendimientoPorMata,
      unidadRendimiento: unidadRendimiento || "",
      produccionEstimada,
      aguaEstimadaLitrosDia,
      humedadSiembra,
      temperaturaSiembra,
      phSiembra,
      ecSiembra,
      tdsSiembra,
      fertilizanteEstimado,
      abonoEstimado,
      recomendacionSiembra,
      costoPorMata,
      precioMercado,
      costoTotalMatas,
      ingresoEstimado,
      margenEstimado,
      margenPorcentaje,
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
    const productionColumns = await getZoneProductionColumns()
    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT z.nombre, z.id_invernadero AS invernaderoId, i.superficie_m2 AS invernaderoArea, z.umbral_humedad AS umbralHumedad, z.tipo_cultivo AS cultivoActual, ${methodStorage === "table" ? "m.nombre" : "z.metodo_riego"} AS modoRiego, z.estado AS estadoRiego, z.area_m2, z.caudal_litros_min, z.umbral_ph, z.umbral_ec, z.umbral_tds, z.fecha_siembra, z.fecha_cosecha_estimada, z.tiempo_germinacion_dias, z.tiempo_crecimiento_dias, z.tiempo_cosecha_dias, ${hasCantidadCultivo ? "z.cantidad_cultivo" : "0 AS cantidad_cultivo"}, ${productionColumns.rendimientoPorMata ? "z.rendimiento_por_mata" : "NULL"} AS rendimiento_por_mata, ${productionColumns.unidadRendimiento ? "z.unidad_rendimiento" : "NULL"} AS unidad_rendimiento, ${productionColumns.produccionEstimada ? "z.produccion_estimada" : "NULL"} AS produccion_estimada, ${productionColumns.costoPorMata ? "z.costo_por_mata" : "NULL"} AS costo_por_mata, ${productionColumns.precioMercado ? "z.precio_mercado" : "NULL"} AS precio_mercado, ${productionColumns.costoTotalMatas ? "z.costo_total_matas" : "NULL"} AS costo_total_matas, ${productionColumns.ingresoEstimado ? "z.ingreso_estimado" : "NULL"} AS ingreso_estimado, ${productionColumns.margenEstimado ? "z.margen_estimado" : "NULL"} AS margen_estimado, ${productionColumns.margenPorcentaje ? "z.margen_porcentaje" : "NULL"} AS margen_porcentaje, z.notas_cultivo, z.observaciones
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
    if (updates.rendimientoPorMata !== undefined) {
      updates.rendimientoPorMata = parseNullableDecimal(updates.rendimientoPorMata)
    }
    if (updates.produccionEstimada !== undefined) {
      updates.produccionEstimada = parseNullableDecimal(updates.produccionEstimada)
    }
    if (updates.aguaEstimadaLitrosDia !== undefined) {
      updates.aguaEstimadaLitrosDia = parseNullableDecimal(updates.aguaEstimadaLitrosDia)
    }
    if (updates.humedadSiembra !== undefined) {
      updates.humedadSiembra = parseNullableDecimal(updates.humedadSiembra)
    }
    if (updates.temperaturaSiembra !== undefined) {
      updates.temperaturaSiembra = parseNullableDecimal(updates.temperaturaSiembra)
    }
    if (updates.phSiembra !== undefined) {
      updates.phSiembra = parseNullableDecimal(updates.phSiembra)
    }
    if (updates.ecSiembra !== undefined) {
      updates.ecSiembra = parseNullableDecimal(updates.ecSiembra)
    }
    if (updates.tdsSiembra !== undefined) {
      updates.tdsSiembra = parseNullableDecimal(updates.tdsSiembra)
    }
    if (updates.costoPorMata !== undefined) {
      updates.costoPorMata = parseNullableDecimal(updates.costoPorMata)
    }
    if (updates.precioMercado !== undefined) {
      updates.precioMercado = parseNullableDecimal(updates.precioMercado)
    }
    if (updates.costoTotalMatas !== undefined) {
      updates.costoTotalMatas = parseNullableDecimal(updates.costoTotalMatas)
    }
    if (updates.ingresoEstimado !== undefined) {
      updates.ingresoEstimado = parseNullableDecimal(updates.ingresoEstimado)
    }
    if (updates.margenEstimado !== undefined) {
      updates.margenEstimado = parseNullableDecimal(updates.margenEstimado)
    }
    if (updates.margenPorcentaje !== undefined) {
      updates.margenPorcentaje = parseNullableDecimal(updates.margenPorcentaje)
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
      rendimientoPorMata: "rendimiento_por_mata",
      unidadRendimiento: "unidad_rendimiento",
      produccionEstimada: "produccion_estimada",
      aguaEstimadaLitrosDia: "agua_estimada_litros_dia",
      humedadSiembra: "humedad_siembra",
      temperaturaSiembra: "temperatura_siembra",
      phSiembra: "ph_siembra",
      ecSiembra: "ec_siembra",
      tdsSiembra: "tds_siembra",
      fertilizanteEstimado: "fertilizante_estimado",
      abonoEstimado: "abono_estimado",
      recomendacionSiembra: "recomendacion_siembra",
      costoPorMata: "costo_por_mata",
      precioMercado: "precio_mercado",
      costoTotalMatas: "costo_total_matas",
      ingresoEstimado: "ingreso_estimado",
      margenEstimado: "margen_estimado",
      margenPorcentaje: "margen_porcentaje",
      notasCultivo: "notas_cultivo",
      observaciones: "observaciones",
    }
    if (hasCantidadCultivo) {
      fieldMap.cantidadCultivo = "cantidad_cultivo"
    } else {
      delete updates.cantidadCultivo
    }
    if (!productionColumns.rendimientoPorMata) delete updates.rendimientoPorMata
    if (!productionColumns.unidadRendimiento) delete updates.unidadRendimiento
    if (!productionColumns.produccionEstimada) delete updates.produccionEstimada
    if (!productionColumns.aguaEstimadaLitrosDia) delete updates.aguaEstimadaLitrosDia
    if (!productionColumns.humedadSiembra) delete updates.humedadSiembra
    if (!productionColumns.temperaturaSiembra) delete updates.temperaturaSiembra
    if (!productionColumns.phSiembra) delete updates.phSiembra
    if (!productionColumns.ecSiembra) delete updates.ecSiembra
    if (!productionColumns.tdsSiembra) delete updates.tdsSiembra
    if (!productionColumns.fertilizanteEstimado) delete updates.fertilizanteEstimado
    if (!productionColumns.abonoEstimado) delete updates.abonoEstimado
    if (!productionColumns.recomendacionSiembra) delete updates.recomendacionSiembra
    if (!productionColumns.costoPorMata) delete updates.costoPorMata
    if (!productionColumns.precioMercado) delete updates.precioMercado
    if (!productionColumns.costoTotalMatas) delete updates.costoTotalMatas
    if (!productionColumns.ingresoEstimado) delete updates.ingresoEstimado
    if (!productionColumns.margenEstimado) delete updates.margenEstimado
    if (!productionColumns.margenPorcentaje) delete updates.margenPorcentaje

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

    if (updates.cultivoActual !== undefined) {
      await ensureLocalCropForZone(Number(previousRows[0].invernaderoId), String(updates.cultivoActual || ""))
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
