import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import bcrypt from "bcryptjs"

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

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    const data = await request.json()

    const { nombre, email, password, rol, id_persona } = data

    if (!nombre || !email || !password || !rol) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await execute(
      `INSERT INTO Usuarios (nombre, correo, contraseña, rol, id_empresa, id_persona, activo, fecha_registro)
       OUTPUT INSERTED.id_usuario, INSERTED.nombre, INSERTED.correo, INSERTED.rol, INSERTED.activo, INSERTED.fecha_registro
       VALUES (@nombre, @email, @password, @rol, @empresaId, @idPersona, 1, GETDATE())`,
      {
        nombre,
        email,
        password: hashedPassword,
        rol,
        empresaId: session.empresaId,
        idPersona: id_persona ? Number(id_persona) : null,
      }
    )

    const newUser = result.recordset[0]

    return NextResponse.json({
      id: newUser.id_usuario,
      nombre: newUser.nombre,
      email: newUser.correo,
      rol: newUser.rol,
      activo: newUser.activo,
      registrado: newUser.fecha_registro,
    }, { status: 201 })

  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }
    console.error("[Users POST]", e)
    return NextResponse.json({ error: e.message || "Error al crear usuario" }, { status: 500 })
  }
}