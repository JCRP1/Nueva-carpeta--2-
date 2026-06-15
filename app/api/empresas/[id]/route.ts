import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, requireAuth } from "@/lib/auth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const empresaId = parseInt(id)

    if (isNaN(empresaId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    if (empresaId !== Number(session.empresaId)) {
      return NextResponse.json({ error: "Empresa no pertenece a la sesion actual" }, { status: 403 })
    }

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
      WHERE id_empresa = @id
    `, { id: empresaId })

    if (empresas.length === 0) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 })
    }

    return NextResponse.json(empresas[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Error al obtener empresa" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin()
    const { id } = await params
    const empresaId = parseInt(id)
    const data = await request.json()

    if (isNaN(empresaId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    if (empresaId !== Number(session.empresaId)) {
      return NextResponse.json({ error: "Empresa no pertenece a la sesion actual" }, { status: 403 })
    }

    if (!data.nombre) {
      return NextResponse.json({ error: "El nombre de la empresa es obligatorio" }, { status: 400 })
    }

    const existing = await query<{ id_empresa: number }[]>(
      "SELECT id_empresa FROM Empresas WHERE LOWER(nombre) = LOWER(@nombre) AND id_empresa != @id",
      { nombre: data.nombre, id: empresaId }
    )

    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya existe otra empresa con este nombre" }, { status: 400 })
    }

    await query(`
      UPDATE Empresas 
      SET nombre = @nombre, 
          rnc = @rnc, 
          direccion = @direccion,
          telefono = @telefono,
          correo = @correo,
          estado = @estado
      WHERE id_empresa = @id
    `, {
      nombre: data.nombre,
      rnc: data.rnc || "",
      direccion: data.direccion || "",
      telefono: data.telefono || "",
      correo: data.correo || "",
      estado: data.estado || "Activa",
      id: empresaId
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Empresas PATCH error]", error)
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.json({ error: "Error al actualizar empresa: " + error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin()
    const { id } = await params
    const empresaId = parseInt(id)

    if (isNaN(empresaId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    if (empresaId !== Number(session.empresaId)) {
      return NextResponse.json({ error: "Empresa no pertenece a la sesion actual" }, { status: 403 })
    }

    await query("DELETE FROM Empresas WHERE id_empresa = @id", { id: empresaId })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Empresas DELETE error]", error)
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.json({ error: "Error al eliminar empresa: " + error.message }, { status: 500 })
  }
}
