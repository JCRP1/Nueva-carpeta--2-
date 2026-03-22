import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {

  try {

    const session = await requireAdmin()

    const rows = await query(
      `SELECT 
        id_persona,
        nombre,
        correo,
        puesto
       FROM Personas
       WHERE id_empresa = @empresaId`,
      { empresaId: session.empresaId }
    )

    const personas = rows.map((p:any) => ({
      id: p.id_persona,
      nombre: p.nombre,
      correo: p.correo,
      puesto: p.puesto
    }))

    return NextResponse.json(personas)

  } catch (e:any) {

    if (e.message === "FORBIDDEN")
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })

    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

}