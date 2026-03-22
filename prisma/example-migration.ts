/**
 * EJEMPLO: Cómo migrar de mssql a Prisma
 * 
 * Este archivo muestra cómo convertir las rutas API actuales
 * que usan lib/db.ts (mssql) a usar Prisma.
 * 
 * Archivo original: app/api/users/route.ts
 */

import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ==================== GET ====================
// ANTES (mssql):
/*
export async function GET() {
  const rows = await query(
    `SELECT id_usuario, nombre, correo, rol, fecha_registro
     FROM Usuarios WHERE id_empresa = @empresaId`,
    { empresaId: session.empresaId }
  )
  return NextResponse.json(rows)
}
*/

// DESPUÉS (Prisma):
export async function GET() {
  try {
    const session = await requireAdmin()
    
    const users = await prisma.usuarios.findMany({
      where: { id_empresa: session.empresaId },
      select: {
        id_usuario: true,
        nombre: true,
        correo: true,
        rol: true,
        fecha_registro: true,
      },
      orderBy: { nombre: 'asc' }
    })

    const formattedUsers = users.map((u) => ({
      id: String(u.id_usuario),
      nombre: u.nombre,
      email: u.correo,
      rol: u.rol,
      empresaId: String(session.empresaId),
      activo: true,
      ultimoAcceso: u.fecha_registro,
    }))

    return NextResponse.json(formattedUsers)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

// ==================== POST ====================
// ANTES (mssql):
/*
const result = await execute(
  `INSERT INTO Usuarios (id_empresa, nombre, correo, [contraseña], rol, fecha_registro)
   OUTPUT INSERTED.id_usuario
   VALUES (@empresaId, @nombre, @email, @pass, @rol, GETDATE())`,
  { empresaId, nombre, email, pass: passwordHash, rol }
)
const newId = result.recordset?.[0]?.id_usuario
*/

// DESPUÉS (Prisma):
export async function POST(req: Request) {
  try {
    const session = await requireAdmin()
    const body = await req.json()
    const { nombre, email, password, rol } = body

    if (!nombre || !email || !password || !rol) {
      return NextResponse.json(
        { error: "Campos requeridos: nombre, email, password, rol" }, 
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await prisma.usuarios.findUnique({
      where: { correo: email }
    })
    
    if (existing) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 })
    }

    const passwordHash = hashSync(password, 10)
    
    const newUser = await prisma.usuarios.create({
      data: {
        id_empresa: session.empresaId,
        nombre,
        correo: email,
        contraseña: passwordHash,
        rol,
      }
    })

    return NextResponse.json({
      id: String(newUser.id_usuario),
      nombre,
      email,
      rol,
      empresaId: String(session.empresaId),
      activo: true,
      ultimoAcceso: newUser.fecha_registro,
    }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

// ==================== PATCH ====================
// ANTES (mssql):
/*
const setClauses = []
const params = { id: Number(id) }
if (updates.nombre) { setClauses.push("nombre = @nombre"); params.nombre = updates.nombre }
if (updates.email) { setClauses.push("correo = @correo"); params.correo = updates.email }
// ...etc
await execute(`UPDATE Usuarios SET ${setClauses.join(", ")} WHERE id_usuario = @id`, params)
*/

// DESPUÉS (Prisma):
export async function PATCH(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { id, ...updates } = body
    
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    
    if (updates.nombre !== undefined) updateData.nombre = updates.nombre
    if (updates.email !== undefined) updateData.correo = updates.email
    if (updates.rol !== undefined) updateData.rol = updates.rol
    if (updates.activo !== undefined) updateData.activo = updates.activo
    if (updates.password) updateData.contraseña = hashSync(updates.password, 10)

    if (Object.keys(updateData).length > 0) {
      await prisma.usuarios.update({
        where: { id_usuario: Number(id) },
        data: updateData
      })
    }

    return NextResponse.json({ ok: true, id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

// ==================== EJEMPLOS ADICIONALES ====================

// Consultas con relaciones (JOINs)
export async function getGreenhouseWithZones(id: number) {
  return await prisma.invernaderos.findUnique({
    where: { id_invernadero: id },
    include: {
      zonas: {
        include: {
          sensores: true,
          riegos: {
            orderBy: { inicio: 'desc' },
            take: 10
          }
        }
      },
      sensores: true
    }
  })
}

// Agregaciones y conteos
export async function getDashboardStats(empresaId: number) {
  const [invernaderos, sensores, riegos, alertas] = await Promise.all([
    prisma.invernaderos.count({ where: { id_empresa: empresaId } }),
    prisma.sensores.count({
      where: { invernaderos: { id_empresa: empresaId } }
    }),
    prisma.riegos.count({
      where: { zonaRiego: { invernaderos: { id_empresa: empresaId } } }
    }),
    prisma.alertas.count({
      where: { resuelta: false }
    })
  ])
  
  return { invernaderos, sensores, riegos, alertas }
}

// Transacciones
export async function createGreenhouseWithZones(data: {
  id_empresa: number
  nombre: string
  ubicacion?: string
  zonas: string[]
}) {
  return await prisma.$transaction(async (tx) => {
    const greenhouse = await tx.invernaderos.create({
      data: {
        id_empresa: data.id_empresa,
        nombre: data.nombre,
        ubicacion: data.ubicacion,
      }
    })

    if (data.zonas.length > 0) {
      await tx.zonasRiego.createMany({
        data: data.zonas.map((zona) => ({
          id_invernadero: greenhouse.id_invernadero,
          nombre: zona,
        }))
      })
    }

    return greenhouse
  })
}
