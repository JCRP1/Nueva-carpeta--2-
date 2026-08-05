import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"

async function ensureInventoryTable() {
  await execute(`
    IF OBJECT_ID('dbo.Inventario', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Inventario (
        id_producto INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_fertilizante_origen INT NULL,
        nombre NVARCHAR(150) NOT NULL,
        tipo NVARCHAR(80) NOT NULL,
        categoria NVARCHAR(80) NULL,
        composicion NVARCHAR(MAX) NULL,
        fabricante NVARCHAR(150) NULL,
        ph DECIMAL(6, 2) NULL,
        nitrogeno DECIMAL(6, 2) NULL,
        fosforo DECIMAL(6, 2) NULL,
        potasio DECIMAL(6, 2) NULL,
        micronutrientes NVARCHAR(MAX) NULL,
        forma_aplicacion NVARCHAR(150) NULL,
        riesgos NVARCHAR(MAX) NULL,
        cantidad_disponible DECIMAL(14, 2) NOT NULL CONSTRAINT DF_Inventario_CantidadDisponible DEFAULT (0),
        unidad_medida NVARCHAR(30) NULL,
        ubicacion NVARCHAR(150) NULL,
        notas NVARCHAR(MAX) NULL,
        id_empresa INT NULL,
        fecha_registro DATETIME NOT NULL CONSTRAINT DF_Inventario_FechaRegistro DEFAULT (GETDATE())
      );
    END;
  `)
}

export async function GET() {
  try {
    const session = await requireAuth()
    await ensureInventoryTable()
    const rows = await query<Record<string, unknown>[]>(
      `
        SELECT
          id_producto AS id,
          nombre,
          tipo,
          categoria,
          composicion,
          fabricante,
          ph,
          nitrogeno,
          fosforo,
          potasio,
          micronutrientes,
          forma_aplicacion AS formaAplicacion,
          riesgos,
          cantidad_disponible AS cantidadDisponible,
          unidad_medida AS unidadMedida,
          ubicacion,
          notas
        FROM dbo.Inventario
        WHERE id_empresa = @empresaId OR id_empresa IS NULL
        ORDER BY nombre ASC
      `,
      { empresaId: session.empresaId }
    )

    return NextResponse.json(rows.map((row) => ({
      id: String(row.id),
      nombre: String(row.nombre || ""),
      tipo: String(row.tipo || ""),
      categoria: String(row.categoria || ""),
      composicion: String(row.composicion || ""),
      fabricante: String(row.fabricante || ""),
      ph: row.ph != null ? Number(row.ph) : null,
      nitrogeno: row.nitrogeno != null ? Number(row.nitrogeno) : null,
      fosforo: row.fosforo != null ? Number(row.fosforo) : null,
      potasio: row.potasio != null ? Number(row.potasio) : null,
      micronutrientes: String(row.micronutrientes || ""),
      formaAplicacion: String(row.formaAplicacion || ""),
      riesgos: String(row.riesgos || ""),
      cantidadDisponible: row.cantidadDisponible != null ? Number(row.cantidadDisponible) : 0,
      unidadMedida: String(row.unidadMedida || ""),
      ubicacion: String(row.ubicacion || ""),
      notas: String(row.notas || ""),
    })))
  } catch (err) {
    console.error("[inventory] GET Error:", err)
    return NextResponse.json({ error: "No se pudo cargar el inventario" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    await ensureInventoryTable()
    const body = await req.json()
    if (!body.nombre || !body.tipo) {
      return NextResponse.json({ error: "Nombre y tipo son requeridos" }, { status: 400 })
    }

    const result = await execute(
      `
        INSERT INTO dbo.Inventario (
          nombre,
          tipo,
          categoria,
          composicion,
          fabricante,
          ph,
          nitrogeno,
          fosforo,
          potasio,
          micronutrientes,
          forma_aplicacion,
          riesgos,
          cantidad_disponible,
          unidad_medida,
          ubicacion,
          notas,
          id_empresa
        )
        OUTPUT INSERTED.id_producto
        VALUES (
          @nombre,
          @tipo,
          @categoria,
          @composicion,
          @fabricante,
          @ph,
          @nitrogeno,
          @fosforo,
          @potasio,
          @micronutrientes,
          @formaAplicacion,
          @riesgos,
          @cantidadDisponible,
          @unidadMedida,
          @ubicacion,
          @notas,
          @empresaId
        )
      `,
      {
        nombre: body.nombre,
        tipo: body.tipo,
        categoria: body.categoria || null,
        composicion: body.composicion || null,
        fabricante: body.fabricante || null,
        ph: body.ph ? Number(body.ph) : null,
        nitrogeno: body.nitrogeno ? Number(body.nitrogeno) : null,
        fosforo: body.fosforo ? Number(body.fosforo) : null,
        potasio: body.potasio ? Number(body.potasio) : null,
        micronutrientes: body.micronutrientes || null,
        formaAplicacion: body.formaAplicacion || null,
        riesgos: body.riesgos || null,
        cantidadDisponible: body.cantidadDisponible != null && body.cantidadDisponible !== "" ? Number(body.cantidadDisponible) : 0,
        unidadMedida: body.unidadMedida || null,
        ubicacion: body.ubicacion || null,
        notas: body.notas || null,
        empresaId: session.empresaId,
      }
    )

    return NextResponse.json({ ok: true, id: String(result.recordset?.[0]?.id_producto || "") })
  } catch (err) {
    console.error("[inventory] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar el producto" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    await ensureInventoryTable()
    const body = await req.json()
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    await execute(
      `
        UPDATE dbo.Inventario
        SET nombre = @nombre,
            tipo = @tipo,
            categoria = @categoria,
            composicion = @composicion,
            fabricante = @fabricante,
            ph = @ph,
            nitrogeno = @nitrogeno,
            fosforo = @fosforo,
            potasio = @potasio,
            micronutrientes = @micronutrientes,
            forma_aplicacion = @formaAplicacion,
            riesgos = @riesgos,
            cantidad_disponible = @cantidadDisponible,
            unidad_medida = @unidadMedida,
            ubicacion = @ubicacion,
            notas = @notas
        WHERE id_producto = @id
          AND (id_empresa = @empresaId OR id_empresa IS NULL)
      `,
      {
        id,
        nombre: body.nombre,
        tipo: body.tipo,
        categoria: body.categoria || null,
        composicion: body.composicion || null,
        fabricante: body.fabricante || null,
        ph: body.ph ? Number(body.ph) : null,
        nitrogeno: body.nitrogeno ? Number(body.nitrogeno) : null,
        fosforo: body.fosforo ? Number(body.fosforo) : null,
        potasio: body.potasio ? Number(body.potasio) : null,
        micronutrientes: body.micronutrientes || null,
        formaAplicacion: body.formaAplicacion || null,
        riesgos: body.riesgos || null,
        cantidadDisponible: body.cantidadDisponible != null && body.cantidadDisponible !== "" ? Number(body.cantidadDisponible) : 0,
        unidadMedida: body.unidadMedida || null,
        ubicacion: body.ubicacion || null,
        notas: body.notas || null,
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
    await ensureInventoryTable()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    await execute(
      "DELETE FROM dbo.Inventario WHERE id_producto = @id AND (id_empresa = @empresaId OR id_empresa IS NULL)",
      { id: Number(id), empresaId: session.empresaId }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[inventory] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar el producto" }, { status: 500 })
  }
}
