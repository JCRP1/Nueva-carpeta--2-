import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

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

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    )
  }
}

/* =========================
   EDITAR
========================= */

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

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No se pudo actualizar" },
      { status: 500 }
    )
  }
}