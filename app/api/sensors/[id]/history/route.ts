import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params

    const rows = (await query(
      `DECLARE @referenceDate DATETIME = (
         SELECT MAX(fecha_hora)
         FROM LecturasSensores
         WHERE id_sensor = @sensorId
       );
       DECLARE @monthStart DATE = DATEFROMPARTS(
         YEAR(COALESCE(@referenceDate, GETDATE())),
         MONTH(COALESCE(@referenceDate, GETDATE())),
         1
       );

       SELECT l.valor, l.fecha_hora AS timestamp
       FROM LecturasSensores l
       INNER JOIN Sensores s ON l.id_sensor = s.id_sensor
       INNER JOIN Invernaderos i ON s.id_invernadero = i.id_invernadero
       WHERE l.id_sensor = @sensorId
         AND i.id_empresa = @empresaId
         AND l.fecha_hora >= @monthStart
         AND l.fecha_hora < DATEADD(MONTH, 1, @monthStart)
       ORDER BY l.fecha_hora ASC`,
      { sensorId: Number(id), empresaId: session.empresaId }
    )) as Record<string, unknown>[]

    const result = rows.map((h) => ({
      timestamp: h.timestamp,
      valor: Number(h.valor),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 })
  }
}
