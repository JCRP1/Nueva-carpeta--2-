import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouse = searchParams.get("greenhouse")
    const mode = searchParams.get("mode")

    const params: Record<string, unknown> = { empresaId: session.empresaId }
    let where = "WHERE i.id_empresa = @empresaId"
    if (greenhouse) {
      where += " AND i.id_invernadero = @greenhouseId"
      params.greenhouseId = Number(greenhouse)
    }

    if (mode === "harvests") {
      const rows = await query<Record<string, unknown>[]>(
        `
          SELECT
            co.id_cosecha AS id,
            CONVERT(char(10), co.fecha_cosecha, 23) AS fechaCosecha,
            co.cantidad_cosechada_kg AS cantidadKg,
            c.nombre AS cultivoNombre,
            i.nombre AS invernaderoNombre
          FROM dbo.Cosechas co
          INNER JOIN dbo.CultivoDetalle cd ON cd.id_detalle = co.id_detalle
          INNER JOIN dbo.Cultivos c ON c.id_cultivo = cd.id_cultivo
          INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
          ${where}
          ORDER BY co.fecha_cosecha DESC, co.id_cosecha DESC
        `,
        params
      )

      return NextResponse.json(rows.map((row) => ({
        id: String(row.id),
        fechaCosecha: row.fechaCosecha ? String(row.fechaCosecha) : "",
        cantidadKg: Number(row.cantidadKg) || 0,
        cultivoNombre: String(row.cultivoNombre || ""),
        invernaderoNombre: String(row.invernaderoNombre || ""),
      })))
    }

    const rows = await query<Record<string, unknown>[]>(
      `
        SELECT
          v.id_venta AS id,
          v.id_cosecha AS idCosecha,
          CONVERT(char(10), v.fecha_venta, 23) AS fechaVenta,
          v.cantidad_kg AS cantidadKg,
          v.precio_kg AS precioKg,
          v.ingreso_total AS ingresoTotal,
          v.comprador,
          v.observaciones,
          c.nombre AS cultivoNombre,
          i.nombre AS invernaderoNombre,
          co.fecha_cosecha AS fechaCosecha
        FROM dbo.VentasCosecha v
        INNER JOIN dbo.Cosechas co ON co.id_cosecha = v.id_cosecha
        INNER JOIN dbo.CultivoDetalle cd ON cd.id_detalle = co.id_detalle
        INNER JOIN dbo.Cultivos c ON c.id_cultivo = cd.id_cultivo
        INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        ${where}
        ORDER BY v.fecha_venta DESC, v.id_venta DESC
      `,
      params
    )

    return NextResponse.json(rows.map((row) => ({
      id: String(row.id),
      idCosecha: String(row.idCosecha),
      fechaVenta: row.fechaVenta ? String(row.fechaVenta) : "",
      cantidadKg: Number(row.cantidadKg) || 0,
      precioKg: Number(row.precioKg) || 0,
      ingresoTotal: Number(row.ingresoTotal) || 0,
      comprador: String(row.comprador || ""),
      observaciones: String(row.observaciones || ""),
      cultivoNombre: String(row.cultivoNombre || ""),
      invernaderoNombre: String(row.invernaderoNombre || ""),
      fechaCosecha: row.fechaCosecha ? String(row.fechaCosecha) : "",
    })))
  } catch (err) {
    console.error("[sales] GET Error:", err)
    return NextResponse.json({ error: "No se pudieron cargar las ventas" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth()
    const body = await req.json()
    const idCosecha = Number(body.idCosecha)
    const fechaVenta = String(body.fechaVenta || "")
    const cantidadKg = Number(body.cantidadKg)
    const precioKg = Number(body.precioKg)

    if (!idCosecha || !fechaVenta || cantidadKg < 0 || precioKg < 0) {
      return NextResponse.json({ error: "Cosecha, fecha, cantidad y precio son requeridos" }, { status: 400 })
    }

    const result = await execute(
      `
        INSERT INTO dbo.VentasCosecha (id_cosecha, fecha_venta, cantidad_kg, precio_kg, comprador, observaciones)
        OUTPUT INSERTED.id_venta
        VALUES (@idCosecha, @fechaVenta, @cantidadKg, @precioKg, @comprador, @observaciones)
      `,
      {
        idCosecha,
        fechaVenta,
        cantidadKg,
        precioKg,
        comprador: body.comprador || null,
        observaciones: body.observaciones || null,
      }
    )

    return NextResponse.json({ ok: true, id: String(result.recordset?.[0]?.id_venta || "") })
  } catch (err) {
    console.error("[sales] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar la venta" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    await requireAuth()
    const body = await req.json()
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    await execute(
      `
        UPDATE dbo.VentasCosecha
        SET id_cosecha = @idCosecha,
            fecha_venta = @fechaVenta,
            cantidad_kg = @cantidadKg,
            precio_kg = @precioKg,
            comprador = @comprador,
            observaciones = @observaciones
        WHERE id_venta = @id
      `,
      {
        id,
        idCosecha: Number(body.idCosecha),
        fechaVenta: String(body.fechaVenta || ""),
        cantidadKg: Number(body.cantidadKg),
        precioKg: Number(body.precioKg),
        comprador: body.comprador || null,
        observaciones: body.observaciones || null,
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[sales] PUT Error:", err)
    return NextResponse.json({ error: "No se pudo actualizar la venta" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAuth()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    await execute("DELETE FROM dbo.VentasCosecha WHERE id_venta = @id", { id: Number(id) })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[sales] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar la venta" }, { status: 500 })
  }
}
