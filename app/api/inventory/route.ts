import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"

export async function GET() {
  try {
    const session = await requireAuth()
    const rows = await query<Record<string, unknown>[]>(
      `
        SELECT
          id_fertilizante AS id,
          nombre,
          tipo,
          composicion,
          fabricante,
          ph,
          nitrogeno,
          fosforo,
          potasio,
          micronutrientes,
          forma_aplicacion AS formaAplicacion,
          riesgos
        FROM dbo.Fertilizantes
        WHERE id_empresa = @empresaId OR id_empresa IS NULL
        ORDER BY nombre ASC
      `,
      { empresaId: session.empresaId }
    )

    return NextResponse.json(rows.map((row) => ({
      id: String(row.id),
      nombre: String(row.nombre || ""),
      tipo: String(row.tipo || ""),
      composicion: String(row.composicion || ""),
      fabricante: String(row.fabricante || ""),
      ph: row.ph != null ? Number(row.ph) : null,
      nitrogeno: row.nitrogeno != null ? Number(row.nitrogeno) : null,
      fosforo: row.fosforo != null ? Number(row.fosforo) : null,
      potasio: row.potasio != null ? Number(row.potasio) : null,
      micronutrientes: String(row.micronutrientes || ""),
      formaAplicacion: String(row.formaAplicacion || ""),
      riesgos: String(row.riesgos || ""),
    })))
  } catch (err) {
    console.error("[inventory] GET Error:", err)
    return NextResponse.json({ error: "No se pudo cargar el inventario" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    if (!body.nombre || !body.tipo) {
      return NextResponse.json({ error: "Nombre y tipo son requeridos" }, { status: 400 })
    }

    const result = await execute(
      `
        INSERT INTO dbo.Fertilizantes (
          nombre, tipo, composicion, fabricante, ph, nitrogeno, fosforo, potasio,
          micronutrientes, forma_aplicacion, riesgos, id_empresa
        )
        OUTPUT INSERTED.id_fertilizante
        VALUES (
          @nombre, @tipo, @composicion, @fabricante, @ph, @nitrogeno, @fosforo, @potasio,
          @micronutrientes, @formaAplicacion, @riesgos, @empresaId
        )
      `,
      {
        nombre: body.nombre,
        tipo: body.tipo,
        composicion: body.composicion || null,
        fabricante: body.fabricante || null,
        ph: body.ph ? Number(body.ph) : null,
        nitrogeno: body.nitrogeno ? Number(body.nitrogeno) : null,
        fosforo: body.fosforo ? Number(body.fosforo) : null,
        potasio: body.potasio ? Number(body.potasio) : null,
        micronutrientes: body.micronutrientes || null,
        formaAplicacion: body.formaAplicacion || null,
        riesgos: body.riesgos || null,
        empresaId: session.empresaId,
      }
    )

    return NextResponse.json({ ok: true, id: String(result.recordset?.[0]?.id_fertilizante || "") })
  } catch (err) {
    console.error("[inventory] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar el producto" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    await execute(
      `
        UPDATE dbo.Fertilizantes
        SET nombre = @nombre,
            tipo = @tipo,
            composicion = @composicion,
            fabricante = @fabricante,
            ph = @ph,
            nitrogeno = @nitrogeno,
            fosforo = @fosforo,
            potasio = @potasio,
            micronutrientes = @micronutrientes,
            forma_aplicacion = @formaAplicacion,
            riesgos = @riesgos
        WHERE id_fertilizante = @id
          AND (id_empresa = @empresaId OR id_empresa IS NULL)
      `,
      {
        id,
        nombre: body.nombre,
        tipo: body.tipo,
        composicion: body.composicion || null,
        fabricante: body.fabricante || null,
        ph: body.ph ? Number(body.ph) : null,
        nitrogeno: body.nitrogeno ? Number(body.nitrogeno) : null,
        fosforo: body.fosforo ? Number(body.fosforo) : null,
        potasio: body.potasio ? Number(body.potasio) : null,
        micronutrientes: body.micronutrientes || null,
        formaAplicacion: body.formaAplicacion || null,
        riesgos: body.riesgos || null,
        empresaId: session.empresaId,
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[inventory] PUT Error:", err)
    return NextResponse.json({ error: "No se pudo actualizar el producto" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    await execute(
      "DELETE FROM dbo.Fertilizantes WHERE id_fertilizante = @id AND (id_empresa = @empresaId OR id_empresa IS NULL)",
      { id: Number(id), empresaId: session.empresaId }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[inventory] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar el producto" }, { status: 500 })
  }
}
