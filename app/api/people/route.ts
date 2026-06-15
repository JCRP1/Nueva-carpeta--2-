import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

async function hasPersonasEmpresaColumn(): Promise<boolean> {
  const rows = await query<Array<{ total: number }>>(
    `SELECT COUNT(1) AS total
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Personas')
       AND name = 'id_empresa'`
  )
  return Number(rows[0]?.total || 0) > 0
}

async function hasPersonasInvernaderoColumn(): Promise<boolean> {
  const rows = await query<Array<{ total: number }>>(
    `SELECT COUNT(1) AS total
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Personas')
       AND name = 'id_invernadero'`
  )
  return Number(rows[0]?.total || 0) > 0
}

async function buildPersonasCompanyFilter(alias = "p") {
  const hasEmpresaColumn = await hasPersonasEmpresaColumn()
  const hasInvernaderoColumn = await hasPersonasInvernaderoColumn()

  if (hasEmpresaColumn) {
    return `${alias}.id_empresa = @empresaId`
  }

  if (hasInvernaderoColumn) {
    return `${alias}.id_invernadero IN (
      SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId
    )`
  }

  return "1 = 0"
}

export async function GET() {
  try {
    const session = await requireAdmin()
    const companyFilter = await buildPersonasCompanyFilter()

    const result = await query(
      `SELECT 
        p.id_persona,
        p.nombre,
        p.telefono,
        p.puesto,
        p.cedula,
        p.registrado,
        p.email
       FROM Personas p
       WHERE ${companyFilter}
       ORDER BY p.nombre`,
      { empresaId: session.empresaId }
    )

    const personas = result.map((p: any) => ({
      id: p.id_persona.toString(),
      nombre: p.nombre,
      email: p.email,
      rol: "personal",
      activo: true,
      puesto: p.puesto,
      telefono: p.telefono,
      cedula: p.cedula,
      registrado: p.registrado,
    }))

    return NextResponse.json(personas)
  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }
    console.error("[People GET]", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    const data = await request.json()
    const hasEmpresaColumn = await hasPersonasEmpresaColumn()

    if (!data.nombre) {
      throw new Error("El nombre es obligatorio")
    }

    const result = await execute(
      hasEmpresaColumn
        ? `INSERT INTO Personas (id_empresa, nombre, telefono, puesto, cedula, registrado, email)
           OUTPUT INSERTED.*
           VALUES (@empresaId, @nombre, @telefono, @puesto, @cedula, GETDATE(), @email)`
        : `INSERT INTO Personas (nombre, telefono, puesto, cedula, registrado, email)
           OUTPUT INSERTED.*
           VALUES (@nombre, @telefono, @puesto, @cedula, GETDATE(), @email)`,
      {
        empresaId: session.empresaId,
        nombre: data.nombre,
        telefono: data.telefono || null,
        puesto: data.cargo || data.puesto || null,
        cedula: data.cedula || null,
        email: data.email || null,
      }
    )

    const newPerson = result.recordset[0] as any

    await registrarBitacora({
      session,
      req: request,
      descripcion: `Se creo la persona ${newPerson.nombre}`,
      modulo: "personal",
      entidad: "Personas",
      entidadId: newPerson.id_persona,
      accion: "CREATE",
      valorNuevo: {
        nombre: newPerson.nombre,
        email: newPerson.email,
        telefono: newPerson.telefono,
        puesto: newPerson.puesto,
        cedula: newPerson.cedula,
      },
    })

    return NextResponse.json({
      id: newPerson.id_persona.toString(),
      nombre: newPerson.nombre,
      email: newPerson.email,
      rol: "personal",
      activo: true,
      puesto: newPerson.puesto,
      telefono: newPerson.telefono,
      cedula: newPerson.cedula,
      registrado: newPerson.registrado,
    })

  } catch (e: any) {
    console.error("[People POST]", e)

    if (e.number === 2601 || e.number === 2627) {
      return NextResponse.json({ error: "El email ya existe" }, { status: 400 })
    }

    return NextResponse.json(
      { error: e.message || "Error creando persona" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin()
    const { id, ...data } = await request.json()
    const companyFilter = await buildPersonasCompanyFilter()

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, telefono, puesto, cedula, email
       FROM Personas p
       WHERE p.id_persona = @id AND ${companyFilter}`,
      { id: Number(id), empresaId: session.empresaId }
    )

    if (previousRows.length === 0) {
      return NextResponse.json({ error: "Persona no encontrada para la empresa actual" }, { status: 404 })
    }

    await execute(
      `UPDATE Personas 
       SET nombre = @nombre,
           telefono = @telefono,
           puesto = @puesto,
           cedula = @cedula,
           email = @email
       WHERE id_persona = @id AND id_persona IN (
         SELECT p.id_persona FROM Personas p WHERE ${companyFilter}
       )`,
      {
        id: Number(id),
        empresaId: session.empresaId,
        nombre: data.nombre,
        telefono: data.telefono || null,
        puesto: data.cargo || data.puesto || null,
        cedula: data.cedula || null,
        email: data.email || null,
      }
    )

    await registrarBitacora({
      session,
      req: request,
      descripcion: `Se actualizo la persona ${data.nombre || id}`,
      modulo: "personal",
      entidad: "Personas",
      entidadId: id,
      accion: "UPDATE",
      valorAnterior: previousRows[0] || null,
      valorNuevo: data,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[People PATCH]", e)

    if (e.number === 2601 || e.number === 2627) {
      return NextResponse.json({ error: "El email ya existe" }, { status: 400 })
    }

    return NextResponse.json(
      { error: e.message || "Error actualizando" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin()
    const { id } = await request.json()
    const companyFilter = await buildPersonasCompanyFilter()

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, telefono, puesto, cedula, email
       FROM Personas p
       WHERE p.id_persona = @id AND ${companyFilter}`,
      { id: Number(id), empresaId: session.empresaId }
    )

    if (previousRows.length === 0) {
      return NextResponse.json({ error: "Persona no encontrada para la empresa actual" }, { status: 404 })
    }

    await execute(
      `DELETE FROM Personas 
       WHERE id_persona = @id AND id_persona IN (
         SELECT p.id_persona FROM Personas p WHERE ${companyFilter}
       )`,
      {
        id: Number(id),
        empresaId: session.empresaId,
      }
    )

    await registrarBitacora({
      session,
      req: request,
      descripcion: `Se elimino la persona ${previousRows[0]?.nombre || id}`,
      modulo: "personal",
      entidad: "Personas",
      entidadId: id,
      accion: "DELETE",
      valorAnterior: previousRows[0] || null,
      severidad: "advertencia",
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[People DELETE]", e)
    return NextResponse.json(
      { error: e.message || "Error eliminando" },
      { status: 500 }
    )
  }
}
