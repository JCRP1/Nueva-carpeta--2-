import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { isValidIotKey } from "@/lib/iot-auth"
import { registrarBitacora } from "@/lib/bitacora"
import { buildVirtualDeviceCodeExpression, hasPhysicalDeviceCodeColumn } from "@/lib/device-code"

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

export async function GET(req: Request) {
  const url = new URL(req.url)
  const baseUrl = url.origin

  return NextResponse.json({
    endpoint: `${baseUrl}/api/iot/readings`,
    method: "POST",
    authHeaders: ["x-iot-key", "x-api-key", "authorization"],
    acceptedIdentifiers: {
      sensorId: "Identificador interno del sensor",
      "codigoDispositivo + tipo": "Alternativa recomendada para firmware cuando se envia desde un equipo fisico",
      "deviceId + tipo": "Compatibilidad temporal con integraciones antiguas",
    },
    requiredFields: ["valor"],
    optionalFields: ["sensorId", "codigoDispositivo", "deviceId", "tipo", "unidad", "timestamp"],
    example: {
      codigoDispositivo: "ESP32-INV-A-01",
      tipo: "temperatura",
      valor: 27.4,
      unidad: "C",
      timestamp: "2026-04-05T14:30:00Z",
    },
  })
}

export async function POST(req: Request) {
  try {
    if (!isValidIotKey(req)) {
      return NextResponse.json({ error: "No autorizado para IoT" }, { status: 401 })
    }

    const hasDeviceCodeColumn = await hasPhysicalDeviceCodeColumn()

    const body = await req.json()
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

    if (!Number.isFinite(rawValue)) {
      return NextResponse.json({ error: "Valor de lectura invalido" }, { status: 400 })
    }

    let sensorRow: Record<string, unknown> | undefined

    if (rawSensorId) {
      const rows = (await query(
        `SELECT TOP 1
           s.id_sensor AS idSensor,
           s.id_dispositivo AS idDispositivo,
           s.tipo,
           s.rango_min AS umbralMin,
           s.rango_max AS umbralMax,
           s.unidad_medida AS unidad
         FROM Sensores s
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
               s.tipo,
               s.rango_min AS umbralMin,
               s.rango_max AS umbralMax,
               s.unidad_medida AS unidad
             FROM Sensores s
             INNER JOIN DispositivosIoT d ON d.id_dispositivo = s.id_dispositivo
             WHERE d.codigo_dispositivo = @codigoDispositivo AND s.tipo = @tipo`
          : `SELECT TOP 1
               s.id_sensor AS idSensor,
               s.id_dispositivo AS idDispositivo,
               s.tipo,
               s.rango_min AS umbralMin,
               s.rango_max AS umbralMax,
               s.unidad_medida AS unidad
             FROM Sensores s
             INNER JOIN DispositivosIoT d ON d.id_dispositivo = s.id_dispositivo
             WHERE ${buildVirtualDeviceCodeExpression("d")} = @codigoDispositivo AND s.tipo = @tipo`,
        { codigoDispositivo: rawDeviceCode, tipo }
      )) as Record<string, unknown>[]
      sensorRow = rows[0]
    } else if (rawDeviceId && tipo) {
      const rows = (await query(
        `SELECT TOP 1
           s.id_sensor AS idSensor,
           s.id_dispositivo AS idDispositivo,
           s.tipo,
           s.rango_min AS umbralMin,
           s.rango_max AS umbralMax,
           s.unidad_medida AS unidad
         FROM Sensores s
         WHERE s.id_dispositivo = @deviceId AND s.tipo = @tipo`,
        { deviceId: rawDeviceId, tipo }
      )) as Record<string, unknown>[]
      sensorRow = rows[0]
    } else {
      return NextResponse.json(
        { error: "Debe enviar sensorId, o bien codigoDispositivo + tipo, o deviceId + tipo" },
        { status: 400 }
      )
    }

    if (!sensorRow) {
      return NextResponse.json({ error: "Sensor no encontrado" }, { status: 404 })
    }

    const sensorId = Number(sensorRow.idSensor)
    const deviceId = sensorRow.idDispositivo != null ? Number(sensorRow.idDispositivo) : null
    const sensorTipo = String(sensorRow.tipo || tipo || "sensor")
    const umbralMin = sensorRow.umbralMin != null ? Number(sensorRow.umbralMin) : null
    const umbralMax = sensorRow.umbralMax != null ? Number(sensorRow.umbralMax) : null
    const unidad = unidadRaw || String(sensorRow.unidad || "")
    const fechaHora = timestampRaw ? new Date(timestampRaw) : new Date()

    if (Number.isNaN(fechaHora.getTime())) {
      return NextResponse.json({ error: "Timestamp invalido" }, { status: 400 })
    }

    await execute(
      `INSERT INTO LecturasSensores (id_sensor, valor, unidad, fecha_hora)
       VALUES (@sensorId, @valor, @unidad, @fechaHora)`,
      {
        sensorId,
        valor: rawValue,
        unidad,
        fechaHora: fechaHora.toISOString(),
      }
    )

    if (deviceId) {
      await execute(
        `UPDATE DispositivosIoT
         SET ultimo_reporte = @fechaHora
         WHERE id_dispositivo = @deviceId`,
        {
          fechaHora: fechaHora.toISOString(),
          deviceId,
        }
      )
    }

    const tipoAlerta = buildAlertType(sensorTipo, rawValue, umbralMin, umbralMax)
    let alertCreated = false

    if (tipoAlerta) {
      const alertRows = (await query(
        `SELECT TOP 1 id_alerta AS id, fecha_hora AS fechaHora
         FROM Alertas
         WHERE id_sensor = @sensorId
           AND tipo_alerta = @tipoAlerta
           AND estado IN ('Pendiente', 'Atendida')
         ORDER BY fecha_hora DESC`,
        { sensorId, tipoAlerta }
      )) as Record<string, unknown>[]

      const latest = alertRows[0]
      const now = Date.now()
      const latestTs = latest?.fechaHora ? new Date(String(latest.fechaHora)).getTime() : 0
      const shouldCreate = !latest || !latestTs || now - latestTs > 10 * 60 * 1000

      if (shouldCreate) {
        const nivel = buildAlertLevel(rawValue, umbralMin, umbralMax)
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
            accion:
              nivel === "critico"
                ? "Revisar sensor/dispositivo y ejecutar accion correctiva inmediata."
                : "Monitorear lectura y validar condiciones del cultivo.",
          }
        )
        alertCreated = true
      }
    }

    await registrarBitacora({
      req,
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
        tipo: sensorTipo,
        valor: rawValue,
        unidad,
        timestamp: fechaHora.toISOString(),
        alertCreated,
      },
    })

    return NextResponse.json({
      ok: true,
      sensorId,
      deviceId,
      codigoDispositivo: rawDeviceCode || null,
      valor: rawValue,
      unidad,
      alertCreated,
    })
  } catch (err) {
    console.error("[IoT Readings POST]", err)
    return NextResponse.json({ error: "No se pudo registrar la lectura" }, { status: 500 })
  }
}
