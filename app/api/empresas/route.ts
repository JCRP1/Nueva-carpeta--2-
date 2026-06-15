import { NextResponse } from "next/server"
import { requireAdmin, requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const session = await requireAuth()
    const empresas = await query(`
      SELECT 
        id_empresa,
        nombre,
        COALESCE(rnc, '') AS rnc,
        COALESCE(direccion, '') AS direccion,
        COALESCE(telefono, '') AS telefono,
        COALESCE(correo, '') AS correo,
        COALESCE(estado, 'Activa') AS estado,
        fecha_creacion
      FROM Empresas
      WHERE id_empresa = @empresaId
      ORDER BY nombre
    `, { empresaId: session.empresaId })

    return NextResponse.json(empresas)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Error al obtener empresas" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const data = await request.json()

    if (!data.nombre) {
      return NextResponse.json({ error: "El nombre de la empresa es obligatorio" }, { status: 400 })
    }

    const nombre = String(data.nombre).trim()
    
    const existing = await query<{ id_empresa: number }[]>(
      "SELECT id_empresa FROM Empresas WHERE LOWER(nombre) = LOWER(@nombre)",
      { nombre }
    )

    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya existe una empresa con este nombre" }, { status: 400 })
    }

    const result = await query(`
      INSERT INTO Empresas (nombre, rnc, direccion, telefono, correo, estado)
      VALUES (@nombre, @rnc, @direccion, @telefono, @correo, @estado);
      SELECT SCOPE_IDENTITY() AS id_empresa;
    `, {
      nombre,
      rnc: data.rnc || "",
      direccion: data.direccion || "",
      telefono: data.telefono || "",
      correo: data.correo || "",
      estado: data.estado || "Activa"
    })

    const newEmpresa = result[0]

    return NextResponse.json({ 
      success: true, 
      empresa: { id_empresa: newEmpresa.id_empresa, nombre }
    })
  } catch (error: any) {
    console.error("[Empresas POST error]", error)
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.json({ error: "Error al crear empresa: " + error.message }, { status: 500 })
  }
}
