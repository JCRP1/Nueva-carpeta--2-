import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const session = await requireAdmin()

    const rows = await query(
      `SELECT 
        id_usuario,
        nombre,
        correo,
        rol,
        activo,
        fecha_registro
       FROM Usuarios
       WHERE id_empresa = @empresaId`,
      { empresaId: session.empresaId }
    )

    const usuarios = rows.map((u: any) => ({
      id: u.id_usuario,
      nombre: u.nombre,
      email: u.correo,
      rol: u.rol,
      activo: u.activo,
      registrado: u.fecha_registro
    }))

    return NextResponse.json(usuarios)

  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Solo administradores" },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    )
  }
}