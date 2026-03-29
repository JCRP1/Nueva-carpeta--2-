import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { query, execute } from "@/lib/db"

export async function GET() {
  try {
    const session = await requireAdmin()

    const rows = await query(
      `SELECT 
        id_persona,
        nombre,
        telefono,
        puesto,
        cedula,
        registrado
       FROM Personas
       WHERE id_empresa = @empresaId`,
      { empresaId: session.empresaId }
    )
    

    const personas = rows.map((p: any) => ({
      id: p.id_persona.toString(),
      nombre: p.nombre,
      email: null,
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

    const result = await execute(
      `INSERT INTO Personas (nombre, telefono, puesto, cedula, id_empresa, registrado)
       OUTPUT INSERTED.*
       VALUES (@nombre, @telefono, @puesto, @cedula, @empresaId, GETDATE())`,
      {
        nombre: data.nombre,
        telefono: data.telefono || null,
        puesto: data.cargo || data.puesto || null,
        cedula: data.cedula || null,
        empresaId: session.empresaId,
      }
    )

    const newPerson = result.recordset[0] as any
    return NextResponse.json({
      id: newPerson.id_persona.toString(),
      nombre: newPerson.nombre,
      email: null,
      rol: "personal",
      activo: true,
      puesto: newPerson.puesto,
      telefono: newPerson.telefono,
      cedula: newPerson.cedula,
      registrado: newPerson.registrado,
    })
  } catch (e: any) {
    console.error("[People POST]", e)
    return NextResponse.json({ error: e.message || "Error creando persona" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin()
    const { id, ...data } = await request.json()

    await execute(
      `UPDATE Personas 
       SET nombre = @nombre,
           telefono = @telefono,
           puesto = @puesto,
           cedula = @cedula
       WHERE id_persona = @id AND id_empresa = @empresaId`,
      {
        id: Number(id),
        nombre: data.nombre,
        telefono: data.telefono || null,
        puesto: data.cargo || data.puesto || null,
        cedula: data.cedula || null,
        empresaId: session.empresaId,
      }
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[People PATCH]", e)
    return NextResponse.json({ error: e.message || "Error actualizando" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin()
    const { id } = await request.json()

    await execute(
      `DELETE FROM Personas 
       WHERE id_persona = @id AND id_empresa = @empresaId`,
      {
        id: Number(id),
        empresaId: session.empresaId,
      }
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[People DELETE]", e)
    return NextResponse.json({ error: e.message || "Error eliminando" }, { status: 500 })
  }
}
