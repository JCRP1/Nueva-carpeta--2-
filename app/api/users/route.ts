import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { requireAdmin } from "@/lib/auth"
import { query, execute } from "@/lib/db"
<<<<<<< HEAD
import { registrarBitacora } from "@/lib/bitacora"

function normalizeRole(value: unknown) {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "admin") return "administrador"
  if (raw === "administrador" || raw === "tecnico" || raw === "agricultor") return raw
  return "agricultor"
}

function mapUser(u: Record<string, unknown>) {
  return {
    id: String(u.id_usuario),
    nombre: String(u.nombre || "Sin nombre"),
    email: String(u.correo || ""),
    rol: normalizeRole(u.rol),
    empresaId: String(u.id_empresa ?? ""),
    activo: u.activo == null ? true : Boolean(u.activo),
    ultimoAcceso: u.fecha_registro ?? null,
  }
}

function handleAuthError(e: { message?: string }) {
  if (e.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
  }

  if (e.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  return null
}

const USER_SELECT = `SELECT
  u.id_usuario,
  CAST((SELECT TOP 1 id_empresa FROM Empresas ORDER BY id_empresa) AS INT) AS id_empresa,
  u.nombre,
  u.correo,
  u.rol,
  u.activo,
  u.fecha_registro
 FROM Usuarios u`
=======
import bcrypt from "bcryptjs"
>>>>>>> eb86f77922ddcc4e11358d8b3bb01000f284cb94

export async function GET() {
  try {
    await requireAdmin()

    const result = await query<Record<string, unknown>[]>(
      `${USER_SELECT}
       ORDER BY u.nombre, u.correo`
    )

    return NextResponse.json(result.map(mapUser))
  } catch (e: any) {
    const authError = handleAuthError(e)
    if (authError) return authError

    console.error("[Users GET]", e)
    return NextResponse.json({ error: "Error cargando usuarios" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
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
    const personaIdRaw = data.personaId ?? data.idPersona ?? data.nombre

    if ((!nombre || /^\d+$/.test(nombre)) && personaIdRaw) {
      const personaId = Number(personaIdRaw)
      if (!Number.isNaN(personaId)) {
        const personaResult = await query<Array<{ nombre: string }>>(
          `SELECT TOP 1 nombre
           FROM Personas
           WHERE id_persona = @id`,
          { id: personaId }
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

    const result = await execute(
      `INSERT INTO Usuarios (nombre, correo, [contraseña], rol, activo, fecha_registro)
       OUTPUT INSERTED.id_usuario
       VALUES (@nombre, @correo, @password, @rol, 1, GETDATE())`,
      {
        nombre,
        correo: String(data.email).trim(),
        password: hashedPassword,
        rol: normalizeRole(data.rol),
      }
    )

    const insertedId = result.recordset[0]?.id_usuario

    const rows = await query<Record<string, unknown>[]>(
      `${USER_SELECT}
       WHERE u.id_usuario = @id`,
      { id: Number(insertedId) }
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
        email: String(data.email).trim(),
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

<<<<<<< HEAD
export async function PATCH(request: Request) {
=======
export async function POST(request: Request) {
>>>>>>> eb86f77922ddcc4e11358d8b3bb01000f284cb94
  try {
    const session = await requireAdmin()
    const data = await request.json()

<<<<<<< HEAD
    if (!data.id) {
      return NextResponse.json({ error: "Id de usuario requerido" }, { status: 400 })
    }

    const previousRows = await query<Record<string, unknown>[]>(
      `${USER_SELECT}
       WHERE u.id_usuario = @id`,
      { id: Number(data.id) }
    )

    const updates: string[] = []
    const params: Record<string, unknown> = { id: Number(data.id) }

    if (data.nombre !== undefined) {
      updates.push("nombre = @nombre")
      params.nombre = String(data.nombre).trim()
    }

    if (data.email !== undefined) {
      updates.push("correo = @correo")
      params.correo = String(data.email).trim()
    }

    if (data.rol !== undefined) {
      updates.push("rol = @rol")
      params.rol = normalizeRole(data.rol)
    }

    if (data.activo !== undefined) {
      updates.push("activo = @activo")
      params.activo = Boolean(data.activo)
    }

    if (data.password !== undefined) {
      if (String(data.password).length < 8) {
        return NextResponse.json(
          { error: "La contrasena debe tener al menos 8 caracteres" },
          { status: 400 }
        )
      }
      updates.push("[contraseña] = @password")
      params.password = hashSync(String(data.password), 10)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 })
    }

    const updateResult = await execute(
      `UPDATE Usuarios
       SET ${updates.join(", ")}
       WHERE id_usuario = @id`,
      params
    )

    if (!updateResult.rowsAffected?.[0]) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const rows = await query<Record<string, unknown>[]>(
      `${USER_SELECT}
       WHERE u.id_usuario = @id`,
      { id: Number(data.id) }
    )

    await registrarBitacora({
      session,
      req: request,
      descripcion: `Se actualizo el usuario ${rows[0]?.nombre || data.id}`,
      modulo: "usuarios",
      entidad: "Usuarios",
      entidadId: data.id,
      accion: "UPDATE",
      valorAnterior: previousRows[0] || null,
      valorNuevo: {
        ...data,
        password: data.password !== undefined ? "[PROTEGIDA]" : undefined,
      },
    })

    return NextResponse.json(mapUser(rows[0]))
  } catch (e: any) {
    const authError = handleAuthError(e)
    if (authError) return authError

    console.error("[Users PATCH]", e)

    if (e.number === 2601 || e.number === 2627) {
      return NextResponse.json({ error: "El email ya existe" }, { status: 400 })
    }

    return NextResponse.json({ error: "Error actualizando usuario" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin()
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Id de usuario requerido" }, { status: 400 })
    }

    const previousRows = await query<Record<string, unknown>[]>(
      `${USER_SELECT}
       WHERE u.id_usuario = @id`,
      { id: Number(id) }
    )

    const result = await execute(
      `DELETE FROM Usuarios
       WHERE id_usuario = @id`,
      { id: Number(id) }
    )

    if (!result.rowsAffected?.[0]) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    await registrarBitacora({
      session,
      req: request,
      descripcion: `Se elimino el usuario ${previousRows[0]?.nombre || id}`,
      modulo: "usuarios",
      entidad: "Usuarios",
      entidadId: id,
      accion: "DELETE",
      valorAnterior: previousRows[0] || null,
      severidad: "advertencia",
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    const authError = handleAuthError(e)
    if (authError) return authError

    console.error("[Users DELETE]", e)
    return NextResponse.json({ error: "Error eliminando usuario" }, { status: 500 })
  }
}
=======
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
>>>>>>> eb86f77922ddcc4e11358d8b3bb01000f284cb94
