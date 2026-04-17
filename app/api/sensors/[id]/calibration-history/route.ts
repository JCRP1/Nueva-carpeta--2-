import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

const BYPASS_AUTH = true

interface BitacoraCalibracion {
  id_bitacora: number
  descripcion: string
  severidad: string
  fecha: string
  modulo: string | null
  entidad: string | null
  entidad_id: string | null
  accion: string | null
  valor_anterior: string | null
  valor_nuevo: string | null
  origen: string | null
  id_usuario: number | null
  nombre_usuario: string | null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const limit = searchParams.get("limit") || "50"

    const sqlText = `
      SELECT TOP (@limit)
        b.id_bitacora,
        b.descripcion,
        b.severidad,
        b.fecha,
        b.modulo,
        b.entidad,
        b.entidad_id,
        b.accion,
        b.valor_anterior,
        b.valor_nuevo,
        b.origen,
        b.id_usuario,
        u.nombre AS nombre_usuario
      FROM Bitacora b
      LEFT JOIN Usuarios u ON u.id_usuario = b.id_usuario
      WHERE b.entidad = 'Sensor' 
        AND b.entidad_id = @sensorId
        AND b.accion = 'CALIBRACION'
      ORDER BY b.fecha DESC
    `

    const results = (await query(sqlText, {
      sensorId: id,
      limit: Number(limit),
    })) as BitacoraCalibracion[]

    const calibraciones = results.map((r) => ({
      id: r.id_bitacora,
      descripcion: r.descripcion,
      severidad: r.severidad,
      fecha: r.fecha,
      modulo: r.modulo,
      entidad: r.entidad,
      entidadId: r.entidad_id,
      accion: r.accion,
      valorAnterior: r.valor_anterior,
      valorNuevo: r.valor_nuevo,
      origen: r.origen,
      usuarioId: r.id_usuario,
      usuarioNombre: r.nombre_usuario,
    }))

    return NextResponse.json(calibraciones)
  } catch (err: unknown) {
    console.error("[CALIBRATION HISTORY API] Error:", err)
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: "Error al obtener historial", details: errorMessage }, { status: 500 })
  }
}