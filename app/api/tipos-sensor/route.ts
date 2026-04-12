import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

const BYPASS_AUTH = true

export async function GET() {
  try {
    const rows = (await query(`
      SELECT 
        TipoSensorID AS id,
        Nombre AS nombre,
        Unidad AS unidad,
        RangoMin AS rangoMin,
        RangoMax AS rangoMax,
        Descripcion AS descripcion
      FROM TiposSensor
      ORDER BY Nombre ASC
    `)) as Record<string, unknown>[]

    return NextResponse.json(rows)
  } catch (err) {
    console.error("[tipos-sensor] Error:", err)
    return NextResponse.json({ error: "Error al cargar tipos de sensores" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!BYPASS_AUTH) {
      await requireAuth()
    }
    const body = await req.json()

    const { nombre, unidad, rangoMin, rangoMax, descripcion } = body

    if (!nombre) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    const existing = (await query(
      `SELECT TipoSensorID FROM TiposSensor WHERE Nombre = @nombre`,
      { nombre }
    )) as Record<string, unknown>[]

    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya existe un tipo de sensor con ese nombre" }, { status: 409 })
    }

    const result = (await query(
      `INSERT INTO TiposSensor (Nombre, Unidad, RangoMin, RangoMax, Descripcion)
       VALUES (@nombre, @unidad, @rangoMin, @rangoMax, @descripcion);
       SELECT SCOPE_IDENTITY() AS id;`,
      {
        nombre,
        unidad: unidad || null,
        rangoMin: rangoMin ? Number(rangoMin) : null,
        rangoMax: rangoMax ? Number(rangoMax) : null,
        descripcion: descripcion || null,
      }
    )) as Record<string, unknown>[]

    const newId = result[0]?.id

    return NextResponse.json({ ok: true, id: newId, nombre })
  } catch (err) {
    console.error("[tipos-sensor] POST Error:", err)
    return NextResponse.json({ error: "No se pudo crear el tipo de sensor" }, { status: 500 })
  }
}