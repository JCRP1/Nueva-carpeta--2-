import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requirePermission } from "@/lib/auth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("roles")
    const { id } = await params
    const rolId = parseInt(id)

    if (isNaN(rolId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const roles = await query(`
      SELECT 
        RolID, 
        Nombre, 
        COALESCE(Descripcion, '') AS Descripcion, 
        CAST(Activo AS INT) AS Activo,
        COALESCE(Permisos, '[]') AS Permisos
      FROM Roles
      WHERE RolID = @id
    `, { id: rolId })

    if (roles.length === 0) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 })
    }

    return NextResponse.json(roles[0])
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return NextResponse.json({ error: "Sin permiso" }, { status: 403 })
    if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: "Error al obtener rol" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("roles")
    const { id } = await params
    const rolId = parseInt(id)
    const data = await request.json()

    if (isNaN(rolId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    if (!data.nombre) {
      return NextResponse.json({ error: "El nombre del rol es obligatorio" }, { status: 400 })
    }

    const existing = await query<{ RolID: number }[]>(
      "SELECT RolID FROM Roles WHERE LOWER(Nombre) = LOWER(@nombre) AND RolID != @id",
      { nombre: data.nombre, id: rolId }
    )

    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya existe otro rol con este nombre" }, { status: 400 })
    }

    await query(`
      UPDATE Roles 
      SET Nombre = @nombre, 
          Descripcion = @descripcion, 
          Permisos = @permisos,
          Activo = @activo
      WHERE RolID = @id
    `, {
      nombre: data.nombre,
      descripcion: data.descripcion || "",
      permisos: JSON.stringify(Array.isArray(data.permisos) ? data.permisos : []),
      activo: data.activo !== undefined ? (data.activo ? 1 : 0) : 1,
      id: rolId
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Roles PATCH error]", error)
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.json({ error: "Error al actualizar rol: " + error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("roles")
    const { id } = await params
    const rolId = parseInt(id)

    if (isNaN(rolId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    await query("DELETE FROM Roles WHERE RolID = @id", { id: rolId })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Roles DELETE error]", error)
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.json({ error: "Error al eliminar rol: " + error.message }, { status: 500 })
  }
}
