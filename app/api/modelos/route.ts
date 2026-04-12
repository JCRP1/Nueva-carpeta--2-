import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

/* =========================
   LISTAR
========================= */

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const marcaId = searchParams.get("marca")

    console.log("[modelos] marcaId:", marcaId)

    let sqlText = `
      SELECT 
        m.id_modelo AS id,
        m.nombre,
        m.especificaciones,
        m.rango_min_por_defecto AS rangoMin,
        m.rango_max_por_defecto AS rangoMax,
        m.precision_por_defecto AS precision,
        m.unidad_medida_por_defecto AS unidadMedida,
        m.fecha_lanzamiento AS fechaLanzamiento,
        m.activo,
        m.id_marca AS marcaId,
        ma.nombre AS nombreMarca
      FROM Modelos m
      LEFT JOIN Marcas ma ON ma.id_marca = m.id_marca
      WHERE 1=1
    `
    const params: Record<string, unknown> = {}

    if (marcaId) {
      sqlText += " AND m.id_marca = @marcaId"
      params.marcaId = Number(marcaId)
    }

    sqlText += " ORDER BY m.nombre ASC"

    console.log("[modelos] sql:", sqlText)
    console.log("[modelos] params:", params)

    const rows = (await query(sqlText, params)) as Record<string, unknown>[]

    console.log("[modelos] rows:", rows)

    return NextResponse.json(rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error al cargar modelos" }, { status: 500 })
  }
}

/* =========================
   CREAR
========================= */

export async function POST(req: Request) {
  try {
    await requireAuth()
    const body = await req.json()

    const {
      nombre,
      idMarca,
      especificaciones,
      rangoMin,
      rangoMax,
      precision,
      unidadMedida,
      fechaLanzamiento,
    } = body

    if (!nombre || !idMarca) {
      return NextResponse.json({ error: "Nombre y marca requeridos" }, { status: 400 })
    }

    const existingRows = (await query(
      `SELECT id_modelo FROM Modelos WHERE id_marca = @idMarca AND nombre = @nombre`,
      { idMarca: Number(idMarca), nombre }
    )) as Record<string, unknown>[]

    if (existingRows.length > 0) {
      return NextResponse.json({ error: "Ya existe un modelo con ese nombre para esta marca" }, { status: 409 })
    }

    const result = (await query(
      `INSERT INTO Modelos 
       (id_marca, nombre, especificaciones, rango_min_por_defecto, rango_max_por_defecto, precision_por_defecto, unidad_medida_por_defecto, fecha_lanzamiento)
       VALUES (@idMarca, @nombre, @especificaciones, @rangoMin, @rangoMax, @precision, @unidadMedida, @fechaLanzamiento);
       SELECT SCOPE_IDENTITY() AS id;`,
      {
        idMarca: Number(idMarca),
        nombre,
        especificaciones: especificaciones || null,
        rangoMin: rangoMin ?? null,
        rangoMax: rangoMax ?? null,
        precision: precision ?? null,
        unidadMedida: unidadMedida || null,
        fechaLanzamiento: fechaLanzamiento || null,
      }
    )) as Record<string, unknown>[]

    const newId = result[0]?.id

    return NextResponse.json({
      ok: true,
      id: newId,
      nombre,
      idMarca: Number(idMarca),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo crear el modelo" }, { status: 500 })
  }
}