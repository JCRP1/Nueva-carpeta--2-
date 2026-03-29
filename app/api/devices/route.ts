import { NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/auth"
import { query } from "@/lib/db"

/* =========================
   LISTAR
========================= */

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouseId = searchParams.get("greenhouse")

    let sqlText = `
      SELECT 
        d.id_dispositivo AS id,
        d.id_invernadero AS invernaderoId,
        i.nombre AS nombreInvernadero,
        d.nombre,
        d.tipo,
        d.estado,
        d.firmware_version AS firmwareVersion,
        d.ip_local AS ipLocal,
        d.ultimo_reporte AS ultimoReporte
      FROM DispositivosIoT d
      LEFT JOIN Invernaderos i ON d.id_invernadero = i.id_invernadero
    `
    const params: Record<string, unknown> = {}

    if (greenhouseId) {
      sqlText += " WHERE d.id_invernadero = @greenhouseId"
      params.greenhouseId = Number(greenhouseId)
    }

    sqlText += " ORDER BY d.nombre"

    const devices = await query(sqlText, params)

    return NextResponse.json(devices)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudieron obtener los dispositivos" }, { status: 500 })
  }
}

/* =========================
   CREAR
========================= */

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()

    const {
      nombre,
      tipo,
      estado,
      idInvernadero,
      firmwareVersion,
      ipLocal,
    } = body

    if (!nombre || !idInvernadero) {
      return NextResponse.json({ error: "Nombre e invernadero son requeridos" }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO DispositivosIoT 
      (id_invernadero, nombre, tipo, estado, firmware_version, ip_local)
      VALUES 
      (@idInvernadero, @nombre, @tipo, @estado, @firmwareVersion, @ipLocal);
      SELECT SCOPE_IDENTITY() AS id;`,
      {
        idInvernadero,
        nombre,
        tipo: tipo || "gateway",
        estado: estado || "Activo",
        firmwareVersion: firmwareVersion || null,
        ipLocal: ipLocal || null,
      }
    )

    const insertResult = result as Record<string, unknown>[]
    const newId = insertResult[0]?.id

    return NextResponse.json({ ok: true, id: newId })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo crear el dispositivo" }, { status: 500 })
  }
}

/* =========================
   ACTUALIZAR
========================= */

export async function PUT(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()

    const {
      id,
      nombre,
      tipo,
      estado,
      idInvernadero,
      firmwareVersion,
      ipLocal,
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    await query(
      `UPDATE DispositivosIoT SET
        id_invernadero = @idInvernadero,
        nombre = @nombre,
        tipo = @tipo,
        estado = @estado,
        firmware_version = @firmwareVersion,
        ip_local = @ipLocal
      WHERE id_dispositivo = @id`,
      {
        id,
        idInvernadero,
        nombre,
        tipo: tipo || "gateway",
        estado: estado || "Activo",
        firmwareVersion: firmwareVersion || null,
        ipLocal: ipLocal || null,
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo actualizar el dispositivo" }, { status: 500 })
  }
}

/* =========================
   ELIMINAR
========================= */

export async function DELETE(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    await query("DELETE FROM DispositivosIoT WHERE id_dispositivo = @id", { id })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo eliminar el dispositivo" }, { status: 500 })
  }
}
