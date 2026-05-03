import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

/* =========================
   CREAR
========================= */

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    const { nombre, ubicacion, area, estado } = body

    if (!nombre) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
    }

    await query(
      `INSERT INTO Invernaderos
      (id_empresa, nombre, ubicacion, superficie_m2, estado)
      VALUES
      (@empresaId, @nombre, @ubicacion, @area, @estado)`,
      {
        empresaId: session.empresaId,
        nombre,
        ubicacion: ubicacion || "",
        area: area || 0,
        estado: estado || "activo",
      }
    )

    await registrarBitacora({
      session,
      req,
      descripcion: `Se creo el invernadero ${nombre}`,
      modulo: "invernaderos",
      entidad: "Invernaderos",
      accion: "CREATE",
      valorNuevo: { nombre, ubicacion, area, estado: estado || "activo" },
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No se pudo guardar" },
      { status: 500 }
    )
  }
}

/* =========================
   LISTAR
========================= */

export async function GET() {
  try {
    const session = await requireAuth()

    const rows = await query(
      `SELECT
        id_invernadero AS id,
        nombre,
        ubicacion,
        superficie_m2 AS area,
        estado
      FROM Invernaderos
      WHERE id_empresa = @empresaId`,
      { empresaId: session.empresaId }
    )

    return NextResponse.json(rows)

  } catch (err: unknown) {
    console.error("[GREENHOUSES API] Error:", err)
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: "No autorizado", details: errorMessage }, { status: 401 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    const { id, nombre, ubicacion, area, estado } = body

    if (!id) {
      return NextResponse.json(
        { error: "ID requerido" },
        { status: 400 }
      )
    }

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, ubicacion, superficie_m2 AS area, estado
       FROM Invernaderos
       WHERE id_invernadero = @id AND id_empresa = @empresaId`,
      { id, empresaId: session.empresaId }
    )

    await query(
      `UPDATE Invernaderos
       SET
        nombre = @nombre,
        ubicacion = @ubicacion,
        superficie_m2 = @area,
        estado = @estado
       WHERE id_invernadero = @id
       AND id_empresa = @empresaId`,
      {
        id,
        nombre,
        ubicacion,
        area,
        estado,
        empresaId: session.empresaId,
      }
    )

    await registrarBitacora({
      session,
      req,
      descripcion: `Se actualizo el invernadero ${nombre || id}`,
      modulo: "invernaderos",
      entidad: "Invernaderos",
      entidadId: id,
      accion: "UPDATE",
      valorAnterior: previousRows[0] || null,
      valorNuevo: { nombre, ubicacion, area, estado },
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No se pudo actualizar" },
      { status: 500 }
    )
  }
}

/* =========================
   ELIMINAR
========================= */

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: "ID requerido" },
        { status: 400 }
      )
    }

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre
       FROM Invernaderos
       WHERE id_invernadero = @id AND id_empresa = @empresaId`,
      { id, empresaId: session.empresaId }
    )

    await query(
      `DELETE FROM Invernaderos
       WHERE id_invernadero = @id
       AND id_empresa = @empresaId`,
      { id, empresaId: session.empresaId }
    )

    await registrarBitacora({
      session,
      req,
      descripcion: `Se elimino el invernadero ${previousRows[0]?.nombre || id}`,
      modulo: "invernaderos",
      entidad: "Invernaderos",
      entidadId: id,
      accion: "DELETE",
      valorAnterior: previousRows[0] || null,
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No se pudo eliminar" },
      { status: 500 }
    )
  }
}
