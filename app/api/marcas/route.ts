import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

/* =========================
   LISTAR
========================= */

export async function GET() {
  try {
    await requireAuth()

    const rows = (await query(`
      SELECT 
        id_marca AS id,
        nombre,
        descripcion,
        pais_origen AS paisOrigen,
        sitio_web AS sitioWeb,
        fecha_registro AS fechaRegistro
      FROM Marcas
      WHERE nombre IS NOT NULL
      ORDER BY nombre ASC
    `)) as Record<string, unknown>[]

    return NextResponse.json(rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error al cargar marcas" }, { status: 500 })
  }
}

/* =========================
   CREAR
========================= */

export async function POST(req: Request) {
  try {
    await requireAuth()
    const body = await req.json()

    const { nombre, descripcion, paisOrigen, sitioWeb } = body

    if (!nombre) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
    }

    const existingRows = (await query(
      `SELECT id_marca FROM Marcas WHERE nombre = @nombre`,
      { nombre }
    )) as Record<string, unknown>[]

    if (existingRows.length > 0) {
      return NextResponse.json({ error: "Ya existe una marca con ese nombre" }, { status: 409 })
    }

    const result = (await query(
      `INSERT INTO Marcas (nombre, descripcion, pais_origen, sitio_web)
       VALUES (@nombre, @descripcion, @paisOrigen, @sitioWeb);
       SELECT SCOPE_IDENTITY() AS id;`,
      {
        nombre,
        descripcion: descripcion || null,
        paisOrigen: paisOrigen || null,
        sitioWeb: sitioWeb || null,
      }
    )) as Record<string, unknown>[]

    const newId = result[0]?.id

    return NextResponse.json({
      ok: true,
      id: newId,
      nombre,
      descripcion,
      paisOrigen,
      sitioWeb,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo crear la marca" }, { status: 500 })
  }
}