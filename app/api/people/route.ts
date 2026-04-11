import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { query, execute } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

export async function GET() {
  try {
    await requireAdmin()

    const result = await query(
      `SELECT 
        id_persona,
        nombre,
        telefono,
        puesto,
        cedula,
        registrado,
        email
       FROM Personas`
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

    if (!data.nombre) {
      throw new Error("El nombre es obligatorio")
    }

    const result = await execute(
      `INSERT INTO Personas (nombre, telefono, puesto, cedula, registrado, email)
       OUTPUT INSERTED.*
       VALUES (@nombre, @telefono, @puesto, @cedula, GETDATE(), @email)`,
      {
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

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, telefono, puesto, cedula, email
       FROM Personas
       WHERE id_persona = @id`,
      { id: Number(id) }
    )

    await execute(
      `UPDATE Personas 
       SET nombre = @nombre,
           telefono = @telefono,
           puesto = @puesto,
           cedula = @cedula,
           email = @email
       WHERE id_persona = @id`,
      {
        id: Number(id),
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

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, telefono, puesto, cedula, email
       FROM Personas
       WHERE id_persona = @id`,
      { id: Number(id) }
    )

    await execute(
      `DELETE FROM Personas 
       WHERE id_persona = @id`,
      {
        id: Number(id),
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
