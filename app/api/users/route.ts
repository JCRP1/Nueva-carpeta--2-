import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { findEmailCompanyAssignment, requirePermission } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

const mapUser = (row: any): any => ({
  id: String(row.id_usuario),
  id_usuario: Number(row.id_usuario),
  nombre: row.nombre || "",
  email: row.correo || row.email || "",
  correo: row.correo || "",
  rol: normalizeRole(row.rol),
  empresaId: String(row.id_empresa ?? ""),
  activo: row.activo !== 0 && row.activo !== false && row.activo !== "false",
  ultimoAcceso: row.fecha_registro?.toString() || new Date().toISOString(),
  fechaCreacion: row.fecha_registro?.toString() || new Date().toISOString(),
  fecha_registro: row.fecha_registro?.toString() || new Date().toISOString(),
})

function normalizeRole(rol: string | null | undefined): string {
  const raw = String(rol || "").trim()
  const r = raw.toLowerCase()
  if (r === "admin" || r === "administrador") return "administrador"
  if (r === "tecnico" || r === "técnico") return "tecnico"
  if (r === "agricultor") return "agricultor"
  return raw || "agricultor"
}

function handleAuthError(e: any): NextResponse | null {
  if (e.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
  }
  if (e.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  return null
}

async function ensureEmailAvailableForCompany(
  email: string,
  empresaId: number,
  excludeUserId?: number | null
): Promise<NextResponse | null> {
  const assigned = await findEmailCompanyAssignment(email, excludeUserId)
  if (!assigned) return null

  const assignedCompanyId = assigned.id_empresa == null ? null : Number(assigned.id_empresa)
  if (assignedCompanyId === Number(empresaId)) {
    return NextResponse.json({ error: "El email ya existe en esta empresa" }, { status: 400 })
  }

  return NextResponse.json(
    { error: "Este correo ya esta asignado a otra empresa. Use un correo diferente." },
    { status: 400 }
  )
}

export async function GET() {
  try {
    const session = await requirePermission("usuarios")

    const result = await query<Record<string, unknown>[]>(
      `SELECT 
        u.id_usuario,
        u.id_empresa,
        u.nombre,
        u.correo,
        u.rol,
        u.activo,
        u.fecha_registro
       FROM Usuarios u
       WHERE u.id_empresa = @empresaId
       ORDER BY u.nombre, u.correo`,
      { empresaId: session.empresaId }
    )

    return NextResponse.json(result.map(mapUser))
  } catch (e: any) {
    const authError = handleAuthError(e)
    if (authError) return authError

    console.error("[Users GET error]", e.message || e.toString())
    return NextResponse.json({ error: "Error: " + (e.message || "Unknown") }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission("usuarios")
    const data = await request.json()

    if (!data.email || !data.password) {
      return NextResponse.json(
        { error: "Email y contrasena son obligatorios" },
        { status: 400 }
      )
    }

    if (String(data.password).length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres" },
        { status: 400 }
      )
    }

    let nombre = String(data.nombre || "").trim()
    const personaIdRaw = data.personaId ?? data.idPersona ?? data.id_persona ?? data.nombre

    if ((!nombre || /^\d+$/.test(nombre)) && personaIdRaw) {
      const personaId = Number(personaIdRaw)
      if (!Number.isNaN(personaId)) {
        const personaResult = await query<Array<{ nombre: string }>>(
          `SELECT TOP 1 nombre
           FROM Personas
           WHERE id_persona = @id
             AND (id_empresa = @empresaId OR id_invernadero IN (
               SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId
             ))`,
          { id: personaId, empresaId: session.empresaId }
        )
        if (personaResult[0]?.nombre) {
          nombre = String(personaResult[0].nombre).trim()
        }
      }
    }

    if (!nombre) {
      return NextResponse.json(
        { error: "Nombre es obligatorio" },
        { status: 400 }
      )
    }

    const hashedPassword = hashSync(String(data.password), 10)
    const correo = String(data.email).trim()

    const emailError = await ensureEmailAvailableForCompany(correo, session.empresaId)
    if (emailError) return emailError

    const result = await execute(
      `INSERT INTO Usuarios (id_empresa, nombre, correo, [contraseña], rol, activo, fecha_registro)
       OUTPUT INSERTED.id_usuario
       VALUES (@empresaId, @nombre, @correo, @password, @rol, 1, GETDATE())`,
      {
        empresaId: session.empresaId,
        nombre,
        correo,
        password: hashedPassword,
        rol: normalizeRole(data.rol),
      }
    )

    const insertedId = result.recordset[0]?.id_usuario

    const rows = await query<Record<string, unknown>[]>(
      `SELECT 
        u.id_usuario,
        u.id_empresa,
        u.nombre,
        u.correo,
        u.rol,
        u.activo,
        u.fecha_registro
       FROM Usuarios u
       WHERE u.id_usuario = @id AND u.id_empresa = @empresaId`,
      { id: Number(insertedId), empresaId: session.empresaId }
    )

    await registrarBitacora({
      session,
      req: request,
      descripcion: `Se creo el usuario ${nombre}`,
      modulo: "usuarios",
      entidad: "Usuarios",
      entidadId: insertedId as string | number | undefined,
      accion: "CREATE",
      valorNuevo: {
        nombre,
        email: correo,
        rol: normalizeRole(data.rol),
        personaId: data.personaId ?? data.idPersona ?? null,
      },
    })

    return NextResponse.json(mapUser(rows[0]))
  } catch (e: any) {
    const authError = handleAuthError(e)
    if (authError) return authError

    console.error("[Users POST]", e)

    if (e.number === 2601 || e.number === 2627) {
      return NextResponse.json({ error: "El email ya existe" }, { status: 400 })
    }

    return NextResponse.json({ error: "Error creando usuario" }, { status: 500 })
  }
}

/* =========================
   ACTUALIZAR (PATCH)
   ========================= */

export async function PATCH(req: Request) {
  try {
    const session = await requirePermission("usuarios")
    const body = await req.json()
    const { id, activo, nombre, rol, email } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const updates: string[] = []
    const params: Record<string, unknown> = { id: Number(id), empresaId: session.empresaId }

    if (activo !== undefined) {
      updates.push("activo = @activo")
      params.activo = activo ? 1 : 0
    }
    if (nombre !== undefined) {
      updates.push("nombre = @nombre")
      params.nombre = nombre
    }
    if (rol !== undefined) {
      updates.push("rol = @rol")
      params.rol = rol
    }
    if (email !== undefined) {
      const nextEmail = String(email).trim()
      if (!nextEmail) {
        return NextResponse.json({ error: "Email es obligatorio" }, { status: 400 })
      }
      const emailError = await ensureEmailAvailableForCompany(nextEmail, session.empresaId, Number(id))
      if (emailError) return emailError
      updates.push("correo = @email")
      params.email = nextEmail
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 })
    }

    await query(
      `UPDATE Usuarios SET ${updates.join(", ")} WHERE id_usuario = @id AND id_empresa = @empresaId`,
      params
    )

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const authError = handleAuthError(e)
    if (authError) return authError
    console.error("[Users PATCH]", e)
    return NextResponse.json({ error: "Error actualizando usuario" }, { status: 500 })
  }
}
