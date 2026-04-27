import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

type AlertRow = Record<string, unknown>

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

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const sensorId = searchParams.get("sensor")

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

        return {
          id: `live-${String(row.sensorId)}-${tipoAlerta}`,
          tipo: buildVirtualAlertLevel(valor, umbralMin, umbralMax),
          mensaje,
          sensorId: String(row.sensorId || ""),
          invernaderoId: String(row.invernaderoId || ""),
          timestamp: row.timestamp,
          resuelta: false,
        }
      })
      .filter(Boolean)

    return NextResponse.json([...virtualAlerts, ...alerts])
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
