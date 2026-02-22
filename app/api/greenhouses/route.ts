import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const session = await requireAuth()
    const rows = await query(
      `SELECT
        i.id_invernadero AS id,
        i.nombre,
        i.ubicacion,
        i.superficie_m2 AS area,
        e.nombre AS empresaNombre
      FROM Invernaderos i
      JOIN Empresas e ON e.id_empresa = i.id_empresa
      WHERE i.id_empresa = @empresaId`,
      { empresaId: session.empresaId }
    )
    // Map to frontend shape
    const greenhouses = (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      nombre: r.nombre,
      empresaId: String(session.empresaId),
      ubicacion: r.ubicacion || "",
      area: Number(r.area) || 0,
      estado: "activo",
    }))
    return NextResponse.json(greenhouses)
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
