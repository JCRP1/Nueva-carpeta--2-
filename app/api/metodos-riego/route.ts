import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

export async function GET(req: Request) {
  try {
    await requireAuth()

    const rows = await query(
      `SELECT id_metodo_riego AS id, nombre, descripcion, eficiencia, activo
       FROM MetodoRiego ORDER BY nombre`
    )

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
    }

    const result = await execute(
      `INSERT INTO MetodoRiego (nombre, descripcion, eficiencia, activo)
       OUTPUT INSERTED.id_metodo_riego
       VALUES (@nombre, @descripcion, @eficiencia, 1)`,
      {
        nombre: body.nombre.trim(),
        descripcion: body.descripcion || "",
        eficiencia: body.eficiencia || 0.80,
      }
    )

    const newId = result.recordset?.[0]?.id_metodo_riego

    await registrarBitacora({
      session,
      req,
      descripcion: `Se creo metodo de riego: ${body.nombre}`,
      modulo: "metodos-riego",
      entidad: "MetodoRiego",
      entidadId: newId as string | number | undefined,
      accion: "CREATE",
      valorNuevo: body,
    })

    return NextResponse.json({
      id: String(newId),
      nombre: body.nombre.trim(),
      descripcion: body.descripcion || "",
      eficiencia: body.eficiencia || 0.80,
      activo: true,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}