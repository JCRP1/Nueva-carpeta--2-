import { NextResponse } from "next/server"
import { isValidIotKey } from "@/lib/iot-auth"
import { buildVirtualDeviceCodeExpression, hasPhysicalDeviceCodeColumn } from "@/lib/device-code"
import { execute, query } from "@/lib/db"

interface CommandRow {
  id_comando: number
  comando: string
  parametros: string | null
}

function parseParametros(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export async function GET(req: Request) {
  try {
    if (!isValidIotKey(req)) {
      return NextResponse.json({ error: "No autorizado para IoT" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const codigoDispositivo = String(
      searchParams.get("codigoDispositivo") || searchParams.get("deviceCode") || ""
    ).trim().toUpperCase()
    const peek = searchParams.get("peek") === "true"

    if (!codigoDispositivo) {
      return NextResponse.json({ error: "codigoDispositivo requerido" }, { status: 400 })
    }

    const hasDeviceCodeColumn = await hasPhysicalDeviceCodeColumn()
    const deviceCodeFilter = hasDeviceCodeColumn
      ? "UPPER(d.codigo_dispositivo) = @codigoDispositivo"
      : `UPPER(${buildVirtualDeviceCodeExpression("d")}) = @codigoDispositivo`

    const rows = await query<CommandRow[]>(
      `SELECT TOP 5
         c.id_comando,
         c.comando,
         c.parametros
       FROM ComandosIoT c
       INNER JOIN DispositivosIoT d ON d.id_dispositivo = c.id_dispositivo
       WHERE ${deviceCodeFilter}
         AND c.estado = 'Pendiente'
       ORDER BY c.fecha_envio ASC, c.id_comando ASC`,
      { codigoDispositivo }
    )

    if (rows.length > 0 && !peek) {
      await execute(
        `UPDATE ComandosIoT
         SET estado = 'Enviado'
         WHERE id_comando IN (${rows.map((_, index) => `@id${index}`).join(", ")})`,
        Object.fromEntries(rows.map((row, index) => [`id${index}`, row.id_comando]))
      )
    }

    return NextResponse.json({
      peek,
      commands: rows.map((row) => ({
        id: row.id_comando,
        comando: row.comando,
        parametros: parseParametros(row.parametros),
      })),
    })
  } catch (error) {
    console.error("[IoT Commands GET]", error)
    return NextResponse.json({ error: "Error al obtener comandos" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    if (!isValidIotKey(req)) {
      return NextResponse.json({ error: "No autorizado para IoT" }, { status: 401 })
    }

    const body = await req.json()
    const id = Number(body.id || body.id_comando)
    const estado = String(body.estado || "Ejecutado")

    if (!id) {
      return NextResponse.json({ error: "id de comando requerido" }, { status: 400 })
    }

    if (!["Ejecutado", "Error"].includes(estado)) {
      return NextResponse.json({ error: "estado invalido" }, { status: 400 })
    }

    await execute(
      `UPDATE ComandosIoT
       SET estado = @estado
       WHERE id_comando = @id`,
      { id, estado }
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[IoT Commands PATCH]", error)
    return NextResponse.json({ error: "Error al actualizar comando" }, { status: 500 })
  }
}
