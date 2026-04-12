import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { requireAdmin } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

const mapUser = (row: any): any => ({
  id: String(row.id_usuario),
  id_usuario: Number(row.id_usuario),
  nombre: row.nombre || "",
  email: row.correo || row.email || "",
  correo: row.correo || "",
  contraseña: row.contraseña || "",
  rol: normalizeRole(row.rol),
  activo: row.activo !== 0 && row.activo !== false && row.activo !== "false",
  ultimoAcceso: row.fecha_registro?.toString() || new Date().toISOString(),
  fecha_registro: row.fecha_registro?.toString() || new Date().toISOString(),
})

function normalizeRole(rol: string | null | undefined): string {
  const r = String(rol || "").toLowerCase()
  if (r === "admin" || r === "administrador") return "administrador"
  if (r === "tecnico" || r === "técnico") return "tecnico"
  return "agricultor"
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

export async function GET() {
  try {
    const session = await requireAdmin()

    const result = await query<Record<string, unknown>[]>(
      `SELECT 
        u.id_usuario,
        u.nombre,
        u.correo,
        u.contraseña,
        u.rol,
        u.activo,
        u.fecha_registro
       FROM Usuarios u
       ORDER BY u.nombre, u.correo`
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
      `SELECT 
        u.id_usuario,
        u.id_empresa,
        u.nombre,
        u.correo,
        u.contraseña,
        u.rol,
        u.activo,
        u.fecha_registro
       FROM Usuarios u
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