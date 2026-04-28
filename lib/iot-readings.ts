import { execute, query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"
import { buildVirtualDeviceCodeExpression, hasPhysicalDeviceCodeColumn } from "@/lib/device-code"
import { getSensorAlertSettings } from "@/lib/alert-config"
import { getSensorZoneColumn } from "@/lib/sensor-zone-column"

function buildAlertType(tipo: string, value: number, min: number | null, max: number | null) {
  if (min != null && value < min) return `${tipo}_baja`
  if (max != null && value > max) return `${tipo}_alta`
  return null
}

function buildAlertLevel(value: number, min: number | null, max: number | null): "critico" | "advertencia" {
  if (min != null && value < min) {
    const gap = min - value
    const ratio = min !== 0 ? gap / Math.abs(min) : gap
    return ratio > 0.15 ? "critico" : "advertencia"
  }
  if (max != null && value > max) {
    const gap = value - max
    const ratio = max !== 0 ? gap / Math.abs(max) : gap
    return ratio > 0.15 ? "critico" : "advertencia"
  }
  return "advertencia"
}

function buildAlertAction(tipo: string, value: number, min: number | null, max: number | null, nivel: "critico" | "advertencia") {
  if (min != null && value < min) {
    return nivel === "critico"
      ? `Lectura muy baja en ${tipo}. Revisar sensor, cultivo y ejecutar accion correctiva inmediata.`
      : `Lectura baja en ${tipo}. Monitorear y validar condiciones del cultivo.`
  }

  if (max != null && value > max) {
    return nivel === "critico"
      ? `Lectura muy alta en ${tipo}. Revisar sensor, cultivo y ejecutar accion correctiva inmediata.`
      : `Lectura alta en ${tipo}. Monitorear y validar condiciones del cultivo.`
  }

  return "Monitorear lectura y validar condiciones del cultivo."
}

async function resolveRecoveredAlerts(sensorId: number, userId: number | null = null) {
  await execute(
    `UPDATE Alertas
     SET estado = 'Resuelta',
         atendida_por = COALESCE(@userId, atendida_por),
         fecha_atencion = GETDATE()
     WHERE id_sensor = @sensorId
       AND estado IN ('Pendiente', 'Atendida')`,
    { sensorId, userId }
  )
}

function parseBooleanSetting(value: unknown, fallback: boolean) {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (["true", "1", "si", "sí", "yes", "on"].includes(normalized)) return true
  if (["false", "0", "no", "off"].includes(normalized)) return false
  return fallback
}

async function isAutomaticIrrigationEnabled(empresaId: number | null) {
  if (!empresaId) return true

  const rows = (await query(
    `SELECT parametro, valor
     FROM ConfiguracionesSistema
     WHERE id_empresa = @empresaId
       AND parametro IN ('autoIrrigation', 'riegoAutomatico')`,
    { empresaId }
  )) as Record<string, unknown>[]

  const setting = rows.find((row) => row.parametro === "autoIrrigation") || rows[0]
  return parseBooleanSetting(setting?.valor, true)
}

async function getSensorControlContext(sensorId: number) {
  const sensorZoneColumn = await getSensorZoneColumn()
  if (!sensorZoneColumn) return null

  const rows = (await query(
    `SELECT TOP 1
       s.${sensorZoneColumn} AS zonaId,
       s.id_dispositivo AS idDispositivo,
       z.estado AS estadoRiego,
       z.umbral_humedad AS umbralHumedad,
       z.caudal_litros_min AS caudalLitrosMin,
       z.umbral_tds AS umbralTds,
       z.umbral_ec AS umbralEc,
       z.umbral_ph AS umbralPh,
       i.id_empresa AS empresaId
     FROM Sensores s
     INNER JOIN ZonasRiego z ON z.id_zona = s.${sensorZoneColumn}
     INNER JOIN Invernaderos i ON i.id_invernadero = z.id_invernadero
     WHERE s.id_sensor = @sensorId`,
    { sensorId }
  )) as Record<string, unknown>[]

  return rows[0] || null
}

async function enqueueDeviceCommand(
  deviceId: number | null,
  command: string,
  payload: Record<string, unknown>
) {
  if (!deviceId) return null

  const rows = (await query(
    `INSERT INTO ComandosIoT (id_dispositivo, comando, parametros, fecha_envio, estado)
     VALUES (@deviceId, @command, @payload, GETDATE(), 'Pendiente');
     SELECT SCOPE_IDENTITY() AS idComando;`,
    {
      deviceId,
      command,
      payload: JSON.stringify(payload),
    }
  )) as Record<string, unknown>[]

  return rows[0]?.idComando ?? null
}

async function evaluateAutomationRules(args: {
  sensorId: number
  sensorTipo: string
  rawValue: number
  deviceId: number | null
  empresaId: number | null
  fechaHora: Date
}) {
  const context = await getSensorControlContext(args.sensorId)
  if (!context?.zonaId) return null

  const zonaId = Number(context.zonaId)
  const zoneDeviceId = context.idDispositivo != null ? Number(context.idDispositivo) : args.deviceId
  const automaticEnabled = await isAutomaticIrrigationEnabled(
    context.empresaId != null ? Number(context.empresaId) : args.empresaId
  )
  if (!automaticEnabled) return { action: "automation_disabled", zonaId }

  const estadoRiego = String(context.estadoRiego || "").toLowerCase()
  const isActive = estadoRiego === "activo" || estadoRiego === "activa"
  const now = args.fechaHora.toISOString()

  if (args.sensorTipo === "humedad_suelo") {
    const threshold = context.umbralHumedad != null ? Number(context.umbralHumedad) : null
    if (threshold == null) return null

    if (args.rawValue < threshold && !isActive) {
      const caudal = context.caudalLitrosMin != null ? Number(context.caudalLitrosMin) : 0
      const idComando = await enqueueDeviceCommand(zoneDeviceId, "START_IRRIGATION", {
        zonaId,
        sensorId: args.sensorId,
        valor: args.rawValue,
        umbral: threshold,
        caudalLitrosMin: caudal,
        solicitadoEn: now,
        motivo: "humedad_suelo_baja",
      })

      await execute("UPDATE ZonasRiego SET estado = 'activo' WHERE id_zona = @zonaId", { zonaId })
      await execute(
        `INSERT INTO Riegos (id_zona, tipo, duracion_min, volumen_litros, fecha_inicio)
         VALUES (@zonaId, 'automatico', 0, 0, GETDATE())`,
        { zonaId }
      )

      return { action: "start_irrigation", zonaId, idComando }
    }

    if (args.rawValue >= threshold + 5 && isActive) {
      const idComando = await enqueueDeviceCommand(zoneDeviceId, "STOP_IRRIGATION", {
        zonaId,
        sensorId: args.sensorId,
        valor: args.rawValue,
        umbral: threshold,
        solicitadoEn: now,
        motivo: "humedad_suelo_recuperada",
      })

      await execute("UPDATE ZonasRiego SET estado = 'inactivo' WHERE id_zona = @zonaId", { zonaId })
      await execute(
        `UPDATE Riegos
         SET fecha_fin = GETDATE(),
             duracion_min = DATEDIFF(MINUTE, fecha_inicio, GETDATE()),
             volumen_litros = CASE
               WHEN ISNULL(volumen_litros, 0) > 0 THEN volumen_litros
               ELSE DATEDIFF(MINUTE, fecha_inicio, GETDATE()) * (
                 SELECT ISNULL(caudal_litros_min, 0)
                 FROM ZonasRiego
                 WHERE id_zona = @zonaId
               )
             END
         WHERE id_riego = (
           SELECT TOP 1 id_riego
           FROM Riegos
           WHERE id_zona = @zonaId AND fecha_fin IS NULL
           ORDER BY fecha_inicio DESC
         )`,
        { zonaId }
      )

      return { action: "stop_irrigation", zonaId, idComando }
    }
  }

  if (args.sensorTipo === "tds" || args.sensorTipo === "ec" || args.sensorTipo === "ph") {
    const idComando = await enqueueDeviceCommand(zoneDeviceId, "CHECK_FERTIGATION", {
      zonaId,
      sensorId: args.sensorId,
      tipo: args.sensorTipo,
      valor: args.rawValue,
      umbralTds: context.umbralTds,
      umbralEc: context.umbralEc,
      umbralPh: context.umbralPh,
      solicitadoEn: now,
      motivo: "nutrientes_fuera_de_rango",
    })

    return { action: "check_fertigation", zonaId, idComando }
  }

  return null
}

export interface IotReadingPayload {
  sensorId?: number | string | null
  deviceId?: number | string | null
  codigoDispositivo?: string | null
  deviceCode?: string | null
  tipo?: string | null
  valor: number | string
  unidad?: string | null
  timestamp?: string | null
  ipLocal?: string | null
}

export function getIotReadingErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR"

  switch (message) {
    case "INVALID_READING_VALUE":
      return { body: { error: "Valor de lectura invalido" }, status: 400 }
    case "MISSING_SENSOR_IDENTIFIER":
      return {
        body: {
          error: "Debe enviar sensorId, o bien codigoDispositivo + tipo, o deviceId + tipo",
        },
        status: 400,
      }
    case "SENSOR_NOT_FOUND":
      return { body: { error: "Sensor no encontrado" }, status: 404 }
    case "INVALID_TIMESTAMP":
      return { body: { error: "Timestamp invalido" }, status: 400 }
    default:
      return { body: { error: "No se pudo registrar la lectura" }, status: 500 }
  }
}

export async function processIotReading(body: IotReadingPayload, source: "http" | "mqtt" = "http") {
  const hasDeviceCodeColumn = await hasPhysicalDeviceCodeColumn()

  const rawValue = Number(body.valor)
  const rawSensorId = body.sensorId != null ? Number(body.sensorId) : null
  const rawDeviceId = body.deviceId != null ? Number(body.deviceId) : null
  const rawDeviceCode =
    typeof body.codigoDispositivo === "string"
      ? body.codigoDispositivo.trim().toUpperCase()
      : typeof body.deviceCode === "string"
        ? body.deviceCode.trim().toUpperCase()
        : null
  const tipo = typeof body.tipo === "string" ? body.tipo : null
  const unidadRaw = typeof body.unidad === "string" ? body.unidad : null
  const timestampRaw = typeof body.timestamp === "string" ? body.timestamp : null
  const ipLocal = typeof body.ipLocal === "string" ? body.ipLocal.trim() : null

  if (!Number.isFinite(rawValue)) {
    throw new Error("INVALID_READING_VALUE")
  }

  let sensorRow: Record<string, unknown> | undefined

  if (rawSensorId) {
    const rows = (await query(
      `SELECT TOP 1
         s.id_sensor AS idSensor,
         s.id_dispositivo AS idDispositivo,
         i.id_empresa AS empresaId,
         s.tipo,
         s.rango_min AS umbralMin,
         s.rango_max AS umbralMax,
         s.unidad_medida AS unidad
       FROM Sensores s
       LEFT JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
       WHERE s.id_sensor = @sensorId`,
      { sensorId: rawSensorId }
    )) as Record<string, unknown>[]
    sensorRow = rows[0]
  } else if (rawDeviceCode && tipo) {
    const rows = (await query(
      hasDeviceCodeColumn
        ? `SELECT TOP 1
             s.id_sensor AS idSensor,
             s.id_dispositivo AS idDispositivo,
             i.id_empresa AS empresaId,
             s.tipo,
             s.rango_min AS umbralMin,
             s.rango_max AS umbralMax,
             s.unidad_medida AS unidad
           FROM Sensores s
           INNER JOIN DispositivosIoT d ON d.id_dispositivo = s.id_dispositivo
           LEFT JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
           WHERE d.codigo_dispositivo = @codigoDispositivo AND s.tipo = @tipo`
        : `SELECT TOP 1
             s.id_sensor AS idSensor,
             s.id_dispositivo AS idDispositivo,
             i.id_empresa AS empresaId,
             s.tipo,
             s.rango_min AS umbralMin,
             s.rango_max AS umbralMax,
             s.unidad_medida AS unidad
           FROM Sensores s
           INNER JOIN DispositivosIoT d ON d.id_dispositivo = s.id_dispositivo
           LEFT JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
           WHERE ${buildVirtualDeviceCodeExpression("d")} = @codigoDispositivo AND s.tipo = @tipo`,
      { codigoDispositivo: rawDeviceCode, tipo }
    )) as Record<string, unknown>[]
    sensorRow = rows[0]
  } else if (rawDeviceId && tipo) {
    const rows = (await query(
      `SELECT TOP 1
         s.id_sensor AS idSensor,
         s.id_dispositivo AS idDispositivo,
         i.id_empresa AS empresaId,
         s.tipo,
         s.rango_min AS umbralMin,
         s.rango_max AS umbralMax,
         s.unidad_medida AS unidad
       FROM Sensores s
       LEFT JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
       WHERE s.id_dispositivo = @deviceId AND s.tipo = @tipo`,
      { deviceId: rawDeviceId, tipo }
    )) as Record<string, unknown>[]
    sensorRow = rows[0]
  } else {
    throw new Error("MISSING_SENSOR_IDENTIFIER")
  }

  if (!sensorRow) {
    throw new Error("SENSOR_NOT_FOUND")
  }

  const sensorId = Number(sensorRow.idSensor)
  const deviceId = sensorRow.idDispositivo != null ? Number(sensorRow.idDispositivo) : null
  const empresaId = sensorRow.empresaId != null ? Number(sensorRow.empresaId) : null
  const sensorTipo = String(sensorRow.tipo || tipo || "sensor")
  const umbralMin = sensorRow.umbralMin != null ? Number(sensorRow.umbralMin) : null
  const umbralMax = sensorRow.umbralMax != null ? Number(sensorRow.umbralMax) : null
  const unidad = unidadRaw || String(sensorRow.unidad || "")
  const fechaHora = timestampRaw ? new Date(timestampRaw) : new Date()

  if (Number.isNaN(fechaHora.getTime())) {
    throw new Error("INVALID_TIMESTAMP")
  }

  await execute(
    `INSERT INTO LecturasSensores (id_sensor, valor, unidad, fecha_hora)
     VALUES (@sensorId, @valor, @unidad, @fechaHora)`,
    {
      sensorId,
      valor: rawValue,
      unidad,
      fechaHora,
    }
  )

  if (deviceId) {
    await execute(
      `UPDATE DispositivosIoT
       SET ultimo_reporte = @fechaHora,
           ip_local = COALESCE(@ipLocal, ip_local)
      WHERE id_dispositivo = @deviceId`,
      {
        fechaHora,
        deviceId,
        ipLocal: ipLocal || null,
      }
    )
  }

  const tipoAlerta = buildAlertType(sensorTipo, rawValue, umbralMin, umbralMax)
  let alertCreated = false

  if (tipoAlerta) {
    const alertSettings = await getSensorAlertSettings(sensorId, empresaId)
    const nivel = buildAlertLevel(rawValue, umbralMin, umbralMax)
    const shouldEvaluateAlerts =
      alertSettings.sensorAlertsEnabled &&
      (!alertSettings.onlyCritical || nivel === "critico")

    if (shouldEvaluateAlerts) {
      const alertRows = (await query(
        `SELECT TOP 1 id_alerta AS id
         FROM Alertas
         WHERE id_sensor = @sensorId
           AND tipo_alerta = @tipoAlerta
           AND estado IN ('Pendiente', 'Atendida')
         ORDER BY fecha_hora DESC`,
        { sensorId, tipoAlerta }
      )) as Record<string, unknown>[]

      const latest = alertRows[0]
      const accion = buildAlertAction(sensorTipo, rawValue, umbralMin, umbralMax, nivel)

      if (latest?.id != null) {
        await execute(
          `UPDATE Alertas
           SET valor_detectado = @valor,
               fecha_hora = GETDATE(),
               umbral_min = @umbralMin,
               umbral_max = @umbralMax,
               nivel = @nivel,
               accion_recomendada = @accion,
               estado = 'Pendiente'
           WHERE id_alerta = @id`,
          {
            id: Number(latest.id),
            valor: rawValue,
            umbralMin,
            umbralMax,
            nivel,
            accion,
          }
        )
      } else {
        await execute(
          `INSERT INTO Alertas
            (id_sensor, tipo_alerta, valor_detectado, fecha_hora, estado, umbral_min, umbral_max, nivel, accion_recomendada)
           VALUES
            (@sensorId, @tipoAlerta, @valor, GETDATE(), 'Pendiente', @umbralMin, @umbralMax, @nivel, @accion)`,
          {
            sensorId,
            tipoAlerta,
            valor: rawValue,
            umbralMin,
            umbralMax,
            nivel,
            accion,
          }
        )
        alertCreated = true
      }
    }
  } else {
    await resolveRecoveredAlerts(sensorId)
  }

  const automation =
    tipoAlerta || sensorTipo === "humedad_suelo"
      ? await evaluateAutomationRules({
          sensorId,
          sensorTipo,
          rawValue,
          deviceId,
          empresaId,
          fechaHora,
        })
      : null

  await registrarBitacora({
    descripcion: `Lectura IoT recibida para sensor ${sensorId}`,
    modulo: "iot",
    entidad: "LecturasSensores",
    entidadId: sensorId,
    accion: "INSERT_READING",
    severidad: alertCreated ? "advertencia" : "info",
    idDispositivo: deviceId,
    origen: "iot",
    valorNuevo: {
      sensorId,
      deviceId,
      codigoDispositivo: rawDeviceCode || null,
      ipLocal,
      tipo: sensorTipo,
      valor: rawValue,
      unidad,
      timestamp: fechaHora.toISOString(),
      alertCreated,
      automation,
      source,
    },
  })

  return {
    ok: true,
    sensorId,
    deviceId,
    codigoDispositivo: rawDeviceCode || null,
    ipLocal,
    valor: rawValue,
    unidad,
    alertCreated,
    automation,
  }
}

export function normalizeIotReadingsPayload(body: unknown): IotReadingPayload[] {
  if (Array.isArray(body)) {
    return body as IotReadingPayload[]
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>

    if (Array.isArray(record.readings)) {
      return record.readings as IotReadingPayload[]
    }

    if (Array.isArray(record.lecturas)) {
      return record.lecturas as IotReadingPayload[]
    }

    return [record as unknown as IotReadingPayload]
  }

  return []
}
