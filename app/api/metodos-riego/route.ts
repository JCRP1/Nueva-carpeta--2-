import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { registrarBitacora } from "@/lib/bitacora"
import { createIrrigationMethod, listIrrigationMethods } from "@/lib/irrigation-methods"

export const dynamic = "force-dynamic"

const BYPASS_AUTH = true

export async function GET(req: Request) {
  try {
    if (!BYPASS_AUTH) {
      await requireAuth()
    }

    const rows = await listIrrigationMethods()
    return NextResponse.json(rows)
  } catch (err) {
    console.error("[metodos-riego] GET Error:", err)
    return NextResponse.json({ error: "No se pudieron cargar los metodos de riego" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
    }

    const created = await createIrrigationMethod({
      nombre: body.nombre,
      descripcion: body.descripcion,
      eficiencia: body.eficiencia,
    })

    await registrarBitacora({
      session,
      req,
      descripcion: `Se creo metodo de riego: ${body.nombre}`,
      modulo: "metodos-riego",
      entidad: "MetodoRiego",
      entidadId: created.id,
      accion: "CREATE",
      valorNuevo: created,
    })

    return NextResponse.json({
      id: String(created.id),
      nombre: created.nombre,
      descripcion: created.descripcion,
      eficiencia: created.eficiencia,
      activo: true,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
