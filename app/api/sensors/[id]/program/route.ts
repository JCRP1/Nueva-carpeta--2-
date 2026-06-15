import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

type ProgramPayload = {
  sensorId: number
  intervaloSegundos: number
  modo: "automatico" | "manual"
  enviarAlertas: boolean
  activo: boolean
  actualizadoEn: string
}

function isUnauthorizedError(err: unknown) {
  return err instanceof Error && err.message === "UNAUTHORIZED"
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const sensorId = Number(id)

    if (!Number.isFinite(sensorId)) {
      return NextResponse.json({ error: "ID de sensor invalido" }, { status: 400 })
    }

    const sensorRows = (await query(
      `SELECT s.id_dispositivo AS idDispositivo
       FROM Sensores s
       INNER JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
       WHERE s.id_sensor = @sensorId AND i.id_empresa = @empresaId`,
      { sensorId, empresaId: session.empresaId }
    )) as Record<string, unknown>[]

    const sensor = sensorRows[0]
    if (!sensor) {
      return NextResponse.json({ error: "Sensor no encontrado" }, { status: 404 })
    }

    const idDispositivo = sensor.idDispositivo != null ? Number(sensor.idDispositivo) : null
    if (!idDispositivo) {
      return NextResponse.json({ programacion: null })
    }

    let commandRows: Record<string, unknown>[] = []

    try {
      commandRows = (await query(
        `SELECT TOP 20 parametros, fecha_envio AS fechaEnvio, estado
         FROM ComandosIoT
         WHERE id_dispositivo = @idDispositivo
           AND comando = 'CONFIG_SENSOR'
         ORDER BY fecha_envio DESC`,
        { idDispositivo }
      )) as Record<string, unknown>[]
    } catch (err) {
      console.warn("[Sensor Program GET] No se pudo leer ComandosIoT:", err)
      return NextResponse.json({ programacion: null })
    }

    let programacion: (ProgramPayload & { estadoComando: string; fechaEnvio: string }) | null = null

    for (const row of commandRows) {
      const rawParams = row.parametros
      if (!rawParams || typeof rawParams !== "string") continue

      let parsed: ProgramPayload | null = null
      try {
        parsed = JSON.parse(rawParams) as ProgramPayload
      } catch {
        continue
      }

      if (!parsed || Number(parsed.sensorId) !== sensorId) continue

      programacion = {
        ...parsed,
        estadoComando: String(row.estado || "Pendiente"),
        fechaEnvio: String(row.fechaEnvio || new Date().toISOString()),
      }
      break
    }

    return NextResponse.json({ programacion })
  } catch (err) {
    if (isUnauthorizedError(err)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    console.error("[Sensor Program GET]", err)
    return NextResponse.json({ error: "No se pudo obtener la programacion" }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    if (session.rol !== "administrador" && session.rol !== "tecnico") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const { id } = await params
    const sensorId = Number(id)

    if (!Number.isFinite(sensorId)) {
      return NextResponse.json({ error: "ID de sensor invalido" }, { status: 400 })
    }

    const body = await req.json()
    const intervaloSegundos = Number(body.intervaloSegundos)
    const modo = body.modo === "manual" ? "manual" : "automatico"
    const enviarAlertas = body.enviarAlertas !== false
    const activo = body.activo !== false

    if (!Number.isFinite(intervaloSegundos) || intervaloSegundos < 10 || intervaloSegundos > 86400) {
      return NextResponse.json(
        { error: "Intervalo invalido. Use un valor entre 10 y 86400 segundos." },
        { status: 400 }
      )
    }

    const sensorRows = (await query(
      `SELECT s.id_dispositivo AS idDispositivo
       FROM Sensores s
       INNER JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
       WHERE s.id_sensor = @sensorId AND i.id_empresa = @empresaId`,
      { sensorId, empresaId: session.empresaId }
    )) as Record<string, unknown>[]

    const sensor = sensorRows[0]
    if (!sensor) {
      return NextResponse.json({ error: "Sensor no encontrado" }, { status: 404 })
    }

    const idDispositivo = sensor.idDispositivo != null ? Number(sensor.idDispositivo) : null
    if (!idDispositivo) {
      return NextResponse.json(
        { error: "El sensor no tiene dispositivo IoT asignado. Asigne uno antes de programar." },
        { status: 400 }
      )
    }

    const payload: ProgramPayload = {
      sensorId,
      intervaloSegundos,
      modo,
      enviarAlertas,
      activo,
      actualizadoEn: new Date().toISOString(),
    }

    const insertRows = (await query(
      `INSERT INTO ComandosIoT (id_dispositivo, comando, parametros, enviado_por, fecha_envio, estado)
       VALUES (@idDispositivo, 'CONFIG_SENSOR', @parametros, @userId, GETDATE(), 'Pendiente');
       SELECT SCOPE_IDENTITY() AS idComando;`,
      {
        idDispositivo,
        parametros: JSON.stringify(payload),
        userId: session.userId,
      }
    )) as Record<string, unknown>[]

    await registrarBitacora({
      session,
      req,
      descripcion: `Se programo el sensor ${sensorId}`,
      modulo: "sensores",
      entidad: "ComandosIoT",
      entidadId: insertRows[0]?.idComando as string | number | undefined,
      accion: "CONFIG_SENSOR",
      idDispositivo,
      valorNuevo: payload,
      origen: "web",
    })

    return NextResponse.json({
      ok: true,
      idComando: insertRows[0]?.idComando,
      programacion: payload,
    })
  } catch (err) {
    if (isUnauthorizedError(err)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    console.error("[Sensor Program POST]", err)
    return NextResponse.json({ error: "No se pudo guardar la programacion" }, { status: 500 })
  }
}
