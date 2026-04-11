import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

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

    const rows = (await query(sqlText, params)) as Record<string, unknown>[]

    const alerts = rows.map((a) => ({
      id: String(a.id),
      tipo: mapNivel(a.nivel as string),
      mensaje: a.accion_recomendada || `${a.tipo_alerta}: valor ${a.valor_detectado}`,
      sensorId: String(a.sensorId || ""),
      invernaderoId: String(a.invernaderoId || ""),
      timestamp: a.timestamp,
      resuelta: (a.estado as string)?.toLowerCase() === "resuelta",
    }))

    return NextResponse.json(alerts)
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
