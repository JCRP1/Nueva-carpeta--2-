import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"

export async function GET() {
  try {
    const roles = await query(`
      SELECT 
        RolID, 
        Nombre, 
        COALESCE(Descripcion, '') AS Descripcion, 
        CAST(Activo AS INT) AS Activo
      FROM Roles
      ORDER BY Nombre
    `)

    return NextResponse.json(roles)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Error al obtener roles" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const data = await request.json()

    if (!data.nombre) {
      return NextResponse.json({ error: "El nombre del rol es obligatorio" }, { status: 400 })
    }

    const nombre = String(data.nombre).trim()
    
    const existing = await query<{ RolID: number }[]>(
      "SELECT RolID FROM Roles WHERE LOWER(Nombre) = LOWER(@nombre)",
      { nombre }
    )

    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya existe un rol con este nombre" }, { status: 400 })
    }

    const result = await query(`
      INSERT INTO Roles (Nombre, Descripcion, Permisos, Activo)
      VALUES (@nombre, @descripcion, @permisos, 1);
      SELECT SCOPE_IDENTITY() AS RolID;
    `, {
      nombre,
      descripcion: data.descripcion || "",
      permisos: data.permisos || "[]"
    })

    const newRole = result[0]

    return NextResponse.json({ 
      success: true, 
      rol: { RolID: newRole.RolID, Nombre: nombre }
    })
  } catch (error: any) {
    console.error("[Roles POST error]", error)
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.json({ error: "Error al crear rol: " + error.message }, { status: 500 })
  }
}