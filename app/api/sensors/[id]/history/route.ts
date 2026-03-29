import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const rows = (await query(
      `SELECT TOP 48 valor, fecha_hora AS timestamp
       FROM LecturasSensores
       WHERE id_sensor = @sensorId
       ORDER BY fecha_hora DESC`,
      { sensorId: Number(id) }
    )) as Record<string, unknown>[]

    const result = rows.reverse().map((h) => ({
      timestamp: h.timestamp,
      valor: Number(h.valor),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 })
  }
}
