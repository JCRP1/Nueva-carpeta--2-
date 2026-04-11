import { NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/auth"
import { query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"
import { buildVirtualDeviceCodeExpression, hasPhysicalDeviceCodeColumn } from "@/lib/device-code"

function normalizeDeviceCode(value: unknown) {
  return String(value || "").trim().toUpperCase()
}

/* =========================
   LISTAR
========================= */

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouseId = searchParams.get("greenhouse")
    const hasDeviceCodeColumn = await hasPhysicalDeviceCodeColumn()
    const deviceCodeSelect = hasDeviceCodeColumn
      ? "d.codigo_dispositivo"
      : buildVirtualDeviceCodeExpression("d")

    let sqlText = `
      SELECT 
        d.id_dispositivo AS id,
        d.id_invernadero AS invernaderoId,
        i.nombre AS nombreInvernadero,
        d.nombre,
        d.tipo,
        ${deviceCodeSelect} AS codigoDispositivo,
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
    const session = await requireAdmin()
    const body = await req.json()
    const hasDeviceCodeColumn = await hasPhysicalDeviceCodeColumn()

    const {
      nombre,
      tipo,
      estado,
      idInvernadero,
      codigoDispositivo,
      firmwareVersion,
      ipLocal,
    } = body

    const normalizedCode = normalizeDeviceCode(codigoDispositivo)

    if (!nombre || !idInvernadero || (!normalizedCode && hasDeviceCodeColumn)) {
      return NextResponse.json(
        { error: "Nombre, invernadero y codigo de dispositivo son requeridos" },
        { status: 400 }
      )
    }

    const result = await query(
      hasDeviceCodeColumn
        ? `INSERT INTO DispositivosIoT 
           (id_invernadero, nombre, tipo, codigo_dispositivo, estado, firmware_version, ip_local)
           VALUES 
           (@idInvernadero, @nombre, @tipo, @codigoDispositivo, @estado, @firmwareVersion, @ipLocal);
           SELECT SCOPE_IDENTITY() AS id;`
        : `INSERT INTO DispositivosIoT 
           (id_invernadero, nombre, tipo, estado, firmware_version, ip_local)
           VALUES 
           (@idInvernadero, @nombre, @tipo, @estado, @firmwareVersion, @ipLocal);
           SELECT SCOPE_IDENTITY() AS id;`,
      {
        idInvernadero,
        nombre,
        tipo: tipo || "gateway",
        codigoDispositivo: normalizedCode,
        estado: estado || "Activo",
        firmwareVersion: firmwareVersion || null,
        ipLocal: ipLocal || null,
      }
    )

    const insertResult = result as Record<string, unknown>[]
    const newId = insertResult[0]?.id

    await registrarBitacora({
      session,
      req,
      descripcion: `Se creo el dispositivo ${nombre}`,
      modulo: "dispositivos",
      entidad: "DispositivosIoT",
      entidadId: newId as string | number | undefined,
      accion: "CREATE",
      idDispositivo: newId != null ? Number(newId) : null,
      valorNuevo: {
        nombre,
        tipo: tipo || "gateway",
        codigoDispositivo: normalizedCode,
        estado: estado || "Activo",
        idInvernadero,
        firmwareVersion: firmwareVersion || null,
        ipLocal: ipLocal || null,
      },
    })

    return NextResponse.json({ ok: true, id: newId })
  } catch (err) {
    console.error(err)
    if ((err as { number?: number })?.number === 2601 || (err as { number?: number })?.number === 2627) {
      return NextResponse.json({ error: "El codigo de dispositivo ya existe" }, { status: 400 })
    }
    return NextResponse.json({ error: "No se pudo crear el dispositivo" }, { status: 500 })
  }
}

/* =========================
   ACTUALIZAR
========================= */

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin()
    const body = await req.json()
    const hasDeviceCodeColumn = await hasPhysicalDeviceCodeColumn()

    const {
      id,
      nombre,
      tipo,
      estado,
      idInvernadero,
      codigoDispositivo,
      firmwareVersion,
      ipLocal,
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const normalizedCode = normalizeDeviceCode(codigoDispositivo)

    if (!nombre || !idInvernadero || (!normalizedCode && hasDeviceCodeColumn)) {
      return NextResponse.json(
        { error: "Nombre, invernadero y codigo de dispositivo son requeridos" },
        { status: 400 }
      )
    }

    const previousRows = await query<Record<string, unknown>[]>(
      hasDeviceCodeColumn
        ? `SELECT
            id_invernadero AS idInvernadero,
            nombre,
            tipo,
            codigo_dispositivo AS codigoDispositivo,
            estado,
            firmware_version AS firmwareVersion,
            ip_local AS ipLocal
           FROM DispositivosIoT
           WHERE id_dispositivo = @id`
        : `SELECT
            id_invernadero AS idInvernadero,
            nombre,
            tipo,
            ${buildVirtualDeviceCodeExpression()} AS codigoDispositivo,
            estado,
            firmware_version AS firmwareVersion,
            ip_local AS ipLocal
           FROM DispositivosIoT d
           WHERE id_dispositivo = @id`,
      { id }
    )

    await query(
      hasDeviceCodeColumn
        ? `UPDATE DispositivosIoT SET
            id_invernadero = @idInvernadero,
            nombre = @nombre,
            tipo = @tipo,
            codigo_dispositivo = @codigoDispositivo,
            estado = @estado,
            firmware_version = @firmwareVersion,
            ip_local = @ipLocal
           WHERE id_dispositivo = @id`
        : `UPDATE DispositivosIoT SET
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
        codigoDispositivo: normalizedCode,
        estado: estado || "Activo",
        firmwareVersion: firmwareVersion || null,
        ipLocal: ipLocal || null,
      }
    )

    await registrarBitacora({
      session,
      req,
      descripcion: `Se actualizo el dispositivo ${nombre}`,
      modulo: "dispositivos",
      entidad: "DispositivosIoT",
      entidadId: id,
      accion: "UPDATE",
      idDispositivo: Number(id),
      valorAnterior: previousRows[0] || null,
      valorNuevo: {
        nombre,
        tipo: tipo || "gateway",
        codigoDispositivo: normalizedCode,
        estado: estado || "Activo",
        idInvernadero,
        firmwareVersion: firmwareVersion || null,
        ipLocal: ipLocal || null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    if ((err as { number?: number })?.number === 2601 || (err as { number?: number })?.number === 2627) {
      return NextResponse.json({ error: "El codigo de dispositivo ya existe" }, { status: 400 })
    }
    return NextResponse.json({ error: "No se pudo actualizar el dispositivo" }, { status: 500 })
  }
}

/* =========================
   ELIMINAR
========================= */

export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin()
    const body = await req.json()
    const { id } = body
    const hasDeviceCodeColumn = await hasPhysicalDeviceCodeColumn()

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const previousRows = await query<Record<string, unknown>[]>(
      hasDeviceCodeColumn
        ? `SELECT nombre, tipo, codigo_dispositivo AS codigoDispositivo
           FROM DispositivosIoT
           WHERE id_dispositivo = @id`
        : `SELECT nombre, tipo, ${buildVirtualDeviceCodeExpression()} AS codigoDispositivo
           FROM DispositivosIoT d
           WHERE id_dispositivo = @id`,
      { id }
    )

    await query("DELETE FROM DispositivosIoT WHERE id_dispositivo = @id", { id })

    await registrarBitacora({
      session,
      req,
      descripcion: `Se elimino el dispositivo ${previousRows[0]?.nombre || id}`,
      modulo: "dispositivos",
      entidad: "DispositivosIoT",
      entidadId: id,
      accion: "DELETE",
      idDispositivo: Number(id),
      valorAnterior: previousRows[0] || null,
      severidad: "advertencia",
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo eliminar el dispositivo" }, { status: 500 })
  }
}
