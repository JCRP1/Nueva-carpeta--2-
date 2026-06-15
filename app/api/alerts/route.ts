import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

type AlertRow = Record<string, unknown>

function parseBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "si", "sí", "yes", "on"].includes(normalized)) return true
    if (["false", "0", "no", "off"].includes(normalized)) return false
  }
  return fallback
}

async function getAlertDisplaySettings(empresaId: number) {
  const rows = await query<Array<{ parametro: string; valor: string }>>(
    `SELECT parametro, valor
     FROM ConfiguracionesSistema
     WHERE id_empresa = @empresaId
       AND parametro IN ('alertaCritica')`,
    { empresaId }
  )
  const byKey = new Map(rows.map((row) => [row.parametro, row.valor]))
  return {
    criticalOnly: parseBool(byKey.get("alertaCritica"), false),
  }
}

function buildVirtualAlertType(tipo: string, valor: number, min: number | null, max: number | null) {
  if (min != null && valor < min) return `${tipo}_baja`
  if (max != null && valor > max) return `${tipo}_alta`
  return null
}

function buildVirtualAlertLevel(valor: number, min: number | null, max: number | null): "critica" | "advertencia" {
  if (min != null && valor < min) {
    const gap = min - valor
    const ratio = min !== 0 ? gap / Math.abs(min) : gap
    return ratio > 0.15 ? "critica" : "advertencia"
  }
  if (max != null && valor > max) {
    const gap = valor - max
    const ratio = max !== 0 ? gap / Math.abs(max) : gap
    return ratio > 0.15 ? "critica" : "advertencia"
  }
  return "advertencia"
}

function buildVirtualAlertMessage(tipo: string, valor: number, min: number | null, max: number | null) {
  if (min != null && valor < min) {
    return `${tipo} bajo: ${valor} (min ${min})`
  }
  if (max != null && valor > max) {
    return `${tipo} alto: ${valor} (max ${max})`
  }
  return `${tipo}: valor ${valor}`
}

function isIpv4(value: unknown) {
  if (typeof value !== "string") return false
  const parts = value.trim().split(".")
  if (parts.length !== 4) return false
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false
    const octet = Number(part)
    return octet >= 0 && octet <= 255
  })
}

async function probeEsp32Status(ipLocal: string) {
  const probePaths = ["/status", "/health", "/"]
  const timeoutMs = 1200

  for (const path of probePaths) {
    try {
      const response = await fetch(`http://${ipLocal}${path}`, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: "application/json, text/plain;q=0.9, text/html;q=0.8",
        },
      })

      if (!response.ok) continue

      const text = await response.text()
      const normalized = text.toLowerCase()
      if (path === "/" || normalized.includes("esp32") || normalized.includes("greensense") || normalized.includes("ok")) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const sensorId = searchParams.get("sensor")
    const displaySettings = await getAlertDisplaySettings(session.empresaId)

    let sqlText = `
      SELECT
        a.id_alerta AS id,
        a.tipo_alerta,
        a.nivel,
        a.valor_detectado,
        a.fecha_hora AS fecha_hora,
        a.fecha_hora AS timestamp,
        a.estado,
        a.accion_recomendada,
        a.id_sensor AS sensorId,
        s.id_invernadero AS invernaderoId
      FROM Alertas a
      LEFT JOIN Sensores s ON s.id_sensor = a.id_sensor
      LEFT JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
      WHERE i.id_empresa = @empresaId
    `
    const params: Record<string, unknown> = { empresaId: session.empresaId }

    if (sensorId) {
      sqlText += " AND a.id_sensor = @sensorId"
      params.sensorId = Number(sensorId)
    }

    sqlText += " ORDER BY a.fecha_hora DESC"

    const rows = (await query(sqlText, params)) as AlertRow[]

    const alerts = rows.map((a) => ({
      id: String(a.id),
      tipo: mapNivel(a.nivel as string),
      mensaje: a.accion_recomendada || `${a.tipo_alerta}: valor ${a.valor_detectado}`,
      sensorId: String(a.sensorId || ""),
      invernaderoId: String(a.invernaderoId || ""),
      timestamp: a.timestamp,
      resuelta: (a.estado as string)?.toLowerCase() === "resuelta",
    }))

    let readingsSql = `
      SELECT
        l.id_sensor AS sensorId,
        s.id_invernadero AS invernaderoId,
        s.tipo,
        s.rango_min AS umbralMin,
        s.rango_max AS umbralMax,
        l.valor,
        l.fecha_hora AS timestamp
      FROM LecturasSensores l
      INNER JOIN Sensores s ON s.id_sensor = l.id_sensor
      INNER JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
      INNER JOIN (
        SELECT id_sensor, MAX(fecha_hora) AS fecha_hora
        FROM LecturasSensores
        GROUP BY id_sensor
      ) latest ON latest.id_sensor = l.id_sensor AND latest.fecha_hora = l.fecha_hora
      WHERE i.id_empresa = @empresaId
    `

    if (sensorId) {
      readingsSql += " AND l.id_sensor = @sensorId"
    }

    readingsSql += " ORDER BY l.fecha_hora DESC"

    const latestReadings = (await query(readingsSql, params)) as AlertRow[]
    const activeAlertKeys = new Set(
      alerts
        .filter((alert) => !alert.resuelta)
        .map((alert) => `${alert.sensorId}|${alert.mensaje}`)
    )

    const virtualAlerts = latestReadings
      .map((row) => {
        const valor = Number(row.valor)
        const tipo = String(row.tipo || "sensor")
        const umbralMin = row.umbralMin != null ? Number(row.umbralMin) : null
        const umbralMax = row.umbralMax != null ? Number(row.umbralMax) : null
        const tipoAlerta = buildVirtualAlertType(tipo, valor, umbralMin, umbralMax)

        if (!tipoAlerta) return null

        const mensaje = buildVirtualAlertMessage(tipo, valor, umbralMin, umbralMax)
        const dedupeKey = `${String(row.sensorId || "")}|${mensaje}`
        if (activeAlertKeys.has(dedupeKey)) return null

        const nivel = buildVirtualAlertLevel(valor, umbralMin, umbralMax)
        if (displaySettings.criticalOnly && nivel !== "critica") return null

        return {
          id: `live-${String(row.sensorId)}-${tipoAlerta}`,
          tipo: nivel,
          mensaje,
          sensorId: String(row.sensorId || ""),
          invernaderoId: String(row.invernaderoId || ""),
          timestamp: row.timestamp,
          resuelta: false,
        }
      })
      .filter(Boolean)

    let deviceAlerts: Array<Record<string, unknown>> = []
    if (!sensorId) {
      const harvestReadyRows = (await query(
        `SELECT
           z.id_zona AS id,
           z.nombre,
           z.tipo_cultivo AS cultivoActual,
           z.fecha_cosecha_estimada AS fechaCosechaEstimada,
           z.id_invernadero AS invernaderoId,
           i.nombre AS invernaderoNombre
         FROM dbo.ZonasRiego z
         INNER JOIN dbo.Invernaderos i ON i.id_invernadero = z.id_invernadero
         WHERE i.id_empresa = @empresaId
           AND z.fecha_cosecha_estimada IS NOT NULL
           AND CONVERT(date, z.fecha_cosecha_estimada) <= CONVERT(date, GETDATE())
           AND NOT EXISTS (
             SELECT 1
             FROM dbo.Cosechas c
             WHERE COL_LENGTH('dbo.Cosechas', 'id_zona') IS NOT NULL
               AND c.id_zona = z.id_zona
               AND CONVERT(date, c.fecha_cosecha) >= CONVERT(date, DATEADD(day, -7, GETDATE()))
           )
         ORDER BY z.fecha_cosecha_estimada ASC`,
        { empresaId: session.empresaId }
      )) as AlertRow[]

      harvestReadyRows.forEach((zone) => {
        virtualAlerts.push({
          id: `harvest-ready-${String(zone.id)}`,
          tipo: "advertencia",
          mensaje: `Cosecha lista: ${String(zone.nombre || "zona")} - ${String(zone.cultivoActual || "cultivo")}`,
          sensorId: "",
          invernaderoId: String(zone.invernaderoId || ""),
          timestamp: zone.fechaCosechaEstimada || new Date().toISOString(),
          resuelta: false,
        })
      })

      const devices = (await query(
        `SELECT
           d.id_dispositivo AS id,
           d.nombre,
           d.tipo,
           d.ip_local AS ipLocal,
           d.id_invernadero AS invernaderoId,
           i.nombre AS invernaderoNombre
         FROM DispositivosIoT d
         INNER JOIN Invernaderos i ON i.id_invernadero = d.id_invernadero
         WHERE i.id_empresa = @empresaId
           AND LOWER(ISNULL(d.estado, 'Activo')) IN ('activo', 'active')
         ORDER BY d.nombre ASC`,
        { empresaId: session.empresaId }
      )) as AlertRow[]

      const networkResults = await Promise.all(
        devices.map(async (device) => {
          const ipLocal = String(device.ipLocal || "").trim()
          const online = isIpv4(ipLocal) ? await probeEsp32Status(ipLocal) : false
          return { device, ipLocal, online }
        })
      )

      deviceAlerts = networkResults.filter((result) => !result.online).map(({ device, ipLocal }) => {
        return {
          id: `device-offline-${String(device.id)}`,
          tipo: "critica",
          mensaje: isIpv4(ipLocal)
            ? `Dispositivo sin conexion por red: ${device.nombre} no responde en ${ipLocal}.`
            : `Dispositivo sin conexion por red: ${device.nombre} no tiene IP local valida registrada.`,
          sensorId: "",
          dispositivoId: String(device.id),
          invernaderoId: String(device.invernaderoId || ""),
          timestamp: new Date().toISOString(),
          resuelta: false,
        }
      })
    }

    const storedAlerts = displaySettings.criticalOnly
      ? alerts.filter((alert) => alert.tipo === "critica" || alert.resuelta)
      : alerts

    return NextResponse.json([...deviceAlerts, ...virtualAlerts, ...storedAlerts])
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

function mapNivel(nivel: string | null): string {
  if (!nivel) return "info"
  const n = nivel.toLowerCase()
  if (n === "critico" || n === "critica" || n === "critical") return "critica"
  if (n === "advertencia" || n === "warning") return "advertencia"
  return "info"
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth()
    if (session.rol === "agricultor") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const body = await req.json()

    // Bulk resolve all
    if (body.action === "resolve_all") {
      if (session.rol !== "administrador") {
        return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
      }
      await execute(
        `UPDATE Alertas SET estado = 'Resuelta', atendida_por = @userId, fecha_atencion = GETDATE()
         WHERE estado != 'Resuelta'
         AND id_sensor IN (SELECT id_sensor FROM Sensores WHERE id_invernadero IN
           (SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId))`,
        { userId: session.userId, empresaId: session.empresaId }
      )
      await registrarBitacora({
        session,
        req,
        descripcion: "Se resolvieron todas las alertas activas",
        modulo: "alertas",
        entidad: "Alertas",
        accion: "RESOLVE_ALL",
        severidad: "advertencia",
      })
      return NextResponse.json({ ok: true })
    }

    // Clear resolved (delete them)
    if (body.action === "clear_resolved") {
      if (session.rol !== "administrador") {
        return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
      }
      await execute(
        `DELETE FROM Alertas WHERE estado = 'Resuelta'
         AND id_sensor IN (SELECT id_sensor FROM Sensores WHERE id_invernadero IN
           (SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId))`,
        { empresaId: session.empresaId }
      )
      await registrarBitacora({
        session,
        req,
        descripcion: "Se limpio el historial de alertas resueltas",
        modulo: "alertas",
        entidad: "Alertas",
        accion: "CLEAR_RESOLVED",
        severidad: "advertencia",
      })
      return NextResponse.json({ ok: true })
    }

    // Single alert resolve
    const { id } = body
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    if (typeof id === "string" && (id.startsWith("live-") || id.startsWith("device-offline-"))) {
      return NextResponse.json({
        ok: true,
        id,
        virtual: true,
        message: "La alerta se cerrara automaticamente cuando la condicion vuelva a la normalidad.",
      })
    }

    await execute(
      `UPDATE Alertas SET estado = 'Resuelta', atendida_por = @userId, fecha_atencion = GETDATE()
       WHERE id_alerta = @id`,
      { id: Number(id), userId: session.userId }
    )
    await registrarBitacora({
      session,
      req,
      descripcion: `Se resolvio la alerta ${id}`,
      modulo: "alertas",
      entidad: "Alertas",
      entidadId: id,
      accion: "RESOLVE",
      severidad: "advertencia",
    })
    return NextResponse.json({ ok: true, id })
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
