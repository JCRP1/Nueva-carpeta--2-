import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { requireAdmin } from "@/lib/auth"
import { query, execute } from "@/lib/db"

export async function GET() {
  try {
    const session = await requireAdmin()
    const rows = (await query(
      `SELECT id_usuario, nombre, correo, rol, fecha_registro
       FROM Usuarios WHERE id_empresa = @empresaId`,
      { empresaId: session.empresaId }
    )) as Record<string, unknown>[]

    const users = rows.map((u) => ({
      id: String(u.id_usuario),
      nombre: u.nombre,
      email: u.correo,
      rol: u.rol,
      empresaId: String(session.empresaId),
      activo: true,
      ultimoAcceso: u.fecha_registro,
    }))

    return NextResponse.json(users)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin()
    const body = await req.json()
    const { nombre, email, password, rol } = body
    if (!nombre || !email || !password || !rol) {
      return NextResponse.json({ error: "Campos requeridos: nombre, email, password, rol" }, { status: 400 })
    }

    // Check if email already exists
    const existing = (await query(
      "SELECT id_usuario FROM Usuarios WHERE correo = @email",
      { email }
    )) as Record<string, unknown>[]
    if (existing.length > 0) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 })
    }

    const passwordHash = hashSync(password, 10)
    const result = await execute(
      `INSERT INTO Usuarios (id_empresa, nombre, correo, [contraseña], rol, fecha_registro)
       OUTPUT INSERTED.id_usuario
       VALUES (@empresaId, @nombre, @email, @pass, @rol, GETDATE())`,
      {
        empresaId: session.empresaId,
        nombre,
        email,
        pass: passwordHash,
        rol,
      }
    )
    const newId = result.recordset?.[0]?.id_usuario

    return NextResponse.json({
      id: String(newId),
      nombre,
      email,
      rol,
      empresaId: String(session.empresaId),
      activo: true,
      ultimoAcceso: "",
    }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    const setClauses: string[] = []
    const params: Record<string, unknown> = { id: Number(id) }

    if (updates.nombre !== undefined) {
      setClauses.push("nombre = @nombre")
      params.nombre = updates.nombre
    }
    if (updates.email !== undefined) {
      setClauses.push("correo = @correo")
      params.correo = updates.email
    }
    if (updates.rol !== undefined) {
      setClauses.push("rol = @rol")
      params.rol = updates.rol
    }
if (updates.activo !== undefined) {
  setClauses.push("activo = @activo")
  params.activo = updates.activo ? 1 : 0
    }
    if (updates.password) {
      setClauses.push("[contraseña] = @pass")
      params.pass = hashSync(updates.password, 10)
    }

    if (setClauses.length > 0) {
      await execute(
        `UPDATE Usuarios SET ${setClauses.join(", ")} WHERE id_usuario = @id`,
        params
      )
    }

    return NextResponse.json({ ok: true, id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
