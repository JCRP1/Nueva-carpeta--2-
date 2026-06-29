import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

async function hasHarvestAvailableColumn() {
  const rows = await query<Array<{ exists: number }>>(
    `SELECT CASE WHEN COL_LENGTH('dbo.Cosechas', 'cantidad_disponible_kg') IS NULL THEN 0 ELSE 1 END AS [exists]`
  )

  return Number(rows[0]?.exists) === 1
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouse = searchParams.get("greenhouse")
    const mode = searchParams.get("mode")
    const hasDisponible = await hasHarvestAvailableColumn()

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
            ISNULL(ventas.kgVendidos, 0) AS kgVendidos,
            ${
              hasDisponible
                ? "ISNULL(co.cantidad_disponible_kg, co.cantidad_cosechada_kg - ISNULL(ventas.kgVendidos, 0))"
                : "co.cantidad_cosechada_kg - ISNULL(ventas.kgVendidos, 0)"
            } AS kgDisponible,
            c.nombre AS cultivoNombre,
            i.nombre AS invernaderoNombre
          FROM dbo.Cosechas co
          INNER JOIN dbo.CultivoDetalle cd ON cd.id_detalle = co.id_detalle
          INNER JOIN dbo.Cultivos c ON c.id_cultivo = cd.id_cultivo
          INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
          OUTER APPLY (
            SELECT SUM(v.cantidad_kg) AS kgVendidos
            FROM dbo.VentasCosecha v
            WHERE v.id_cosecha = co.id_cosecha
          ) ventas
          ${where}
          ORDER BY co.fecha_cosecha DESC, co.id_cosecha DESC
        `,
        params
      )

      return NextResponse.json(rows.map((row) => ({
        id: String(row.id),
        fechaCosecha: row.fechaCosecha ? String(row.fechaCosecha) : "",
        cantidadKg: Number(row.cantidadKg) || 0,
        kgVendidos: Number(row.kgVendidos) || 0,
        kgDisponible: Math.max(0, Number(row.kgDisponible) || 0),
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
    const session = await requireAuth()
    const body = await req.json()
    const idCosecha = Number(body.idCosecha)
    const fechaVenta = String(body.fechaVenta || "")
    const cantidadKg = Number(body.cantidadKg)
    const precioKg = Number(body.precioKg)

    if (!idCosecha || !fechaVenta || cantidadKg < 0 || precioKg < 0) {
      return NextResponse.json({ error: "Cosecha, fecha, cantidad y precio son requeridos" }, { status: 400 })
    }

    const hasDisponible = await hasHarvestAvailableColumn()
    const availableRows = await query<Array<{ cosechadoKg: number; vendidoKg: number; disponibleKg: number | null }>>(
      `SELECT
         ISNULL(co.cantidad_cosechada_kg, 0) AS cosechadoKg,
         ${hasDisponible ? "co.cantidad_disponible_kg" : "NULL"} AS disponibleKg,
         ISNULL(SUM(v.cantidad_kg), 0) AS vendidoKg
       FROM dbo.Cosechas co
       LEFT JOIN dbo.VentasCosecha v ON v.id_cosecha = co.id_cosecha
       WHERE co.id_cosecha = @idCosecha
       GROUP BY co.id_cosecha, co.cantidad_cosechada_kg${hasDisponible ? ", co.cantidad_disponible_kg" : ""}`,
      { idCosecha }
    )
    const available = availableRows[0]
    if (!available) {
      return NextResponse.json({ error: "Cosecha no encontrada" }, { status: 404 })
    }
    const kgDisponible = Math.max(
      0,
      hasDisponible && available.disponibleKg != null
        ? Number(available.disponibleKg)
        : Number(available.cosechadoKg) - Number(available.vendidoKg)
    )
    if (cantidadKg > kgDisponible) {
      return NextResponse.json(
        { error: `No hay suficiente cosecha disponible. Disponible: ${kgDisponible} kg` },
        { status: 400 }
      )
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
    const newId = Number(result.recordset?.[0]?.id_venta || 0)

    if (hasDisponible) {
      await execute(
        `UPDATE dbo.Cosechas
         SET cantidad_disponible_kg = CASE
           WHEN ISNULL(cantidad_disponible_kg, cantidad_cosechada_kg) - @cantidadKg < 0 THEN 0
           ELSE ISNULL(cantidad_disponible_kg, cantidad_cosechada_kg) - @cantidadKg
         END
         WHERE id_cosecha = @idCosecha`,
        { idCosecha, cantidadKg }
      )
    }

    await registrarBitacora({
      session,
      req,
      descripcion: `Se registro la venta ${newId} y se rebajaron ${cantidadKg} kg de la cosecha ${idCosecha}`,
      modulo: "ventas",
      entidad: "VentasCosecha",
      entidadId: newId,
      accion: "CREATE",
      valorNuevo: { ...body, kgDisponibleAnterior: kgDisponible, kgDisponibleNuevo: Math.max(0, kgDisponible - cantidadKg) },
    })

    return NextResponse.json({ ok: true, id: String(newId || "") })
  } catch (err) {
    console.error("[sales] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar la venta" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    const idCosecha = Number(body.idCosecha)
    const cantidadKg = Number(body.cantidadKg)
    const precioKg = Number(body.precioKg)
    const hasDisponible = await hasHarvestAvailableColumn()

    const previousRows = await query<Array<{ id_cosecha: number; cantidad_kg: number }>>(
      `SELECT id_cosecha, cantidad_kg
       FROM dbo.VentasCosecha
       WHERE id_venta = @id`,
      { id }
    )
    const previous = previousRows[0]
    if (!previous) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })

    const availableRows = await query<Array<{ cosechadoKg: number; vendidoOtrosKg: number; disponibleKg: number | null }>>(
      `SELECT
         ISNULL(co.cantidad_cosechada_kg, 0) AS cosechadoKg,
         ${hasDisponible ? "co.cantidad_disponible_kg" : "NULL"} AS disponibleKg,
         ISNULL(SUM(CASE WHEN v.id_venta <> @id THEN v.cantidad_kg ELSE 0 END), 0) AS vendidoOtrosKg
       FROM dbo.Cosechas co
       LEFT JOIN dbo.VentasCosecha v ON v.id_cosecha = co.id_cosecha
       WHERE co.id_cosecha = @idCosecha
       GROUP BY co.id_cosecha, co.cantidad_cosechada_kg${hasDisponible ? ", co.cantidad_disponible_kg" : ""}`,
      { id, idCosecha }
    )
    const available = availableRows[0]
    if (!available) {
      return NextResponse.json({ error: "Cosecha no encontrada" }, { status: 404 })
    }
    const kgDisponibleBase =
      hasDisponible && available.disponibleKg != null
        ? Number(available.disponibleKg) + (Number(previous.id_cosecha) === idCosecha ? Number(previous.cantidad_kg) : 0)
        : Number(available.cosechadoKg) - Number(available.vendidoOtrosKg)
    const kgDisponible = Math.max(0, kgDisponibleBase)
    if (cantidadKg > kgDisponible) {
      return NextResponse.json(
        { error: `No hay suficiente cosecha disponible. Disponible: ${kgDisponible} kg` },
        { status: 400 }
      )
    }

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
        idCosecha,
        fechaVenta: String(body.fechaVenta || ""),
        cantidadKg,
        precioKg,
        comprador: body.comprador || null,
        observaciones: body.observaciones || null,
      }
    )

    if (hasDisponible) {
      await execute(
        `UPDATE dbo.Cosechas
         SET cantidad_disponible_kg = CASE
           WHEN ISNULL(cantidad_disponible_kg, cantidad_cosechada_kg) + @cantidadAnterior > cantidad_cosechada_kg
           THEN cantidad_cosechada_kg
           ELSE ISNULL(cantidad_disponible_kg, cantidad_cosechada_kg) + @cantidadAnterior
         END
         WHERE id_cosecha = @idCosechaAnterior`,
        { idCosechaAnterior: Number(previous.id_cosecha), cantidadAnterior: Number(previous.cantidad_kg) }
      )
      await execute(
        `UPDATE dbo.Cosechas
         SET cantidad_disponible_kg = CASE
           WHEN ISNULL(cantidad_disponible_kg, cantidad_cosechada_kg) - @cantidadKg < 0 THEN 0
           ELSE ISNULL(cantidad_disponible_kg, cantidad_cosechada_kg) - @cantidadKg
         END
         WHERE id_cosecha = @idCosecha`,
        { idCosecha, cantidadKg }
      )
    }

    await registrarBitacora({
      session,
      req,
      descripcion: `Se actualizo la venta ${id} y el disponible de cosecha`,
      modulo: "ventas",
      entidad: "VentasCosecha",
      entidadId: id,
      accion: "UPDATE",
      valorAnterior: previous,
      valorNuevo: body,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[sales] PUT Error:", err)
    return NextResponse.json({ error: "No se pudo actualizar la venta" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    const previousRows = await query<Array<{ id_cosecha: number; cantidad_kg: number }>>(
      `SELECT id_cosecha, cantidad_kg
       FROM dbo.VentasCosecha
       WHERE id_venta = @id`,
      { id: Number(id) }
    )
    const previous = previousRows[0]

    await execute("DELETE FROM dbo.VentasCosecha WHERE id_venta = @id", { id: Number(id) })
    if (previous && (await hasHarvestAvailableColumn())) {
      await execute(
        `UPDATE dbo.Cosechas
         SET cantidad_disponible_kg = CASE
           WHEN ISNULL(cantidad_disponible_kg, cantidad_cosechada_kg) + @cantidadKg > cantidad_cosechada_kg
           THEN cantidad_cosechada_kg
           ELSE ISNULL(cantidad_disponible_kg, cantidad_cosechada_kg) + @cantidadKg
         END
         WHERE id_cosecha = @idCosecha`,
        { idCosecha: Number(previous.id_cosecha), cantidadKg: Number(previous.cantidad_kg) }
      )
    }

    await registrarBitacora({
      session,
      req,
      descripcion: `Se elimino la venta ${id} y se devolvieron kg disponibles a la cosecha`,
      modulo: "ventas",
      entidad: "VentasCosecha",
      entidadId: id,
      accion: "DELETE",
      valorAnterior: previous,
      severidad: "advertencia",
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[sales] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar la venta" }, { status: 500 })
  }
}
