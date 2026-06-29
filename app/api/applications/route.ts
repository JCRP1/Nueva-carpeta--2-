import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

async function getApplicationInventoryColumns() {
  const rows = await query<Array<{ idFertilizante: number; cantidadAplicada: number }>>(
    `SELECT
       CASE WHEN COL_LENGTH('dbo.ControlPlagas', 'id_fertilizante') IS NULL THEN 0 ELSE 1 END AS idFertilizante,
       CASE WHEN COL_LENGTH('dbo.ControlPlagas', 'cantidad_aplicada') IS NULL THEN 0 ELSE 1 END AS cantidadAplicada`
  )

  return {
    idFertilizante: Number(rows[0]?.idFertilizante) === 1,
    cantidadAplicada: Number(rows[0]?.cantidadAplicada) === 1,
  }
}

async function hasInventoryStockColumn() {
  const rows = await query<Array<{ exists: number }>>(
    `SELECT CASE WHEN COL_LENGTH('dbo.Fertilizantes', 'cantidad_disponible') IS NULL THEN 0 ELSE 1 END AS [exists]`
  )

  return Number(rows[0]?.exists) === 1
}

async function getInventoryProduct(productId: number, empresaId: number) {
  const rows = await query<Array<{ id: number; nombre: string; cantidadDisponible: number | null }>>(
    `SELECT TOP 1
       id_fertilizante AS id,
       nombre,
       ${await hasInventoryStockColumn() ? "cantidad_disponible" : "NULL"} AS cantidadDisponible
     FROM dbo.Fertilizantes
     WHERE id_fertilizante = @productId
       AND (id_empresa = @empresaId OR id_empresa IS NULL)`,
    { productId, empresaId }
  )

  return rows[0] || null
}

async function adjustInventory(productId: number | null, amount: number, operation: "deduct" | "restore") {
  if (!productId || amount <= 0 || !(await hasInventoryStockColumn())) return

  if (operation === "deduct") {
    await execute(
      `UPDATE dbo.Fertilizantes
       SET cantidad_disponible = CASE
         WHEN ISNULL(cantidad_disponible, 0) - @amount < 0 THEN 0
         ELSE ISNULL(cantidad_disponible, 0) - @amount
       END
       WHERE id_fertilizante = @productId`,
      { productId, amount }
    )
    return
  }

  await execute(
    `UPDATE dbo.Fertilizantes
     SET cantidad_disponible = ISNULL(cantidad_disponible, 0) + @amount
     WHERE id_fertilizante = @productId`,
    { productId, amount }
  )
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouse = searchParams.get("greenhouse")
    const inventoryColumns = await getApplicationInventoryColumns()

    const params: Record<string, unknown> = { empresaId: session.empresaId }
    let greenhouseFilter = ""
    if (greenhouse) {
      greenhouseFilter = " AND c.id_invernadero = @greenhouseId"
      params.greenhouseId = Number(greenhouse)
    }

    const rows = await query<Record<string, unknown>[]>(
      `
        SELECT
          CONCAT('fert-', af.id_aplicacion) AS id,
          'Fertilizacion' AS tipo,
          NULL AS idDetalle,
          NULL AS tipoPlaga,
          CONVERT(char(10), af.fecha_aplicacion, 23) AS fecha,
          c.nombre AS cultivoNombre,
          i.nombre AS invernaderoNombre,
          f.nombre AS producto,
          NULL AS idProducto,
          pf.dosis,
          af.cantidad_aplicada AS cantidad,
          af.notas
        FROM dbo.AplicacionesFertilizantes af
        INNER JOIN dbo.PlanFertilizacion pf ON pf.id_plan = af.id_plan
        INNER JOIN dbo.Fertilizantes f ON f.id_fertilizante = pf.id_fertilizante
        INNER JOIN dbo.CultivoDetalle cd ON cd.id_detalle = pf.id_detalle
        INNER JOIN dbo.Cultivos c ON c.id_cultivo = cd.id_cultivo
        INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        WHERE af.id_empresa = @empresaId ${greenhouseFilter}

        UNION ALL

        SELECT
          CONCAT('plaga-', cp.id_plaga) AS id,
          'Control de plagas' AS tipo,
          cp.id_detalle AS idDetalle,
          cp.tipo_plaga AS tipoPlaga,
          CONVERT(char(10), cp.fecha_aplicacion, 23) AS fecha,
          c.nombre AS cultivoNombre,
          i.nombre AS invernaderoNombre,
          cp.producto_usado AS producto,
          ${inventoryColumns.idFertilizante ? "cp.id_fertilizante" : "NULL"} AS idProducto,
          cp.dosis,
          ${inventoryColumns.cantidadAplicada ? "cp.cantidad_aplicada" : "NULL"} AS cantidad,
          cp.notas
        FROM dbo.ControlPlagas cp
        INNER JOIN dbo.CultivoDetalle cd ON cd.id_detalle = cp.id_detalle
        INNER JOIN dbo.Cultivos c ON c.id_cultivo = cd.id_cultivo
        INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        WHERE cp.id_empresa = @empresaId ${greenhouseFilter}

        ORDER BY fecha DESC
      `,
      params
    )

    return NextResponse.json(rows.map((row) => ({
      id: String(row.id),
      tipo: String(row.tipo || ""),
      idDetalle: row.idDetalle != null ? String(row.idDetalle) : "",
      tipoPlaga: String(row.tipoPlaga || ""),
      fecha: row.fecha ? String(row.fecha) : "",
      cultivoNombre: String(row.cultivoNombre || ""),
      invernaderoNombre: String(row.invernaderoNombre || ""),
      producto: String(row.producto || ""),
      idProducto: row.idProducto != null ? String(row.idProducto) : "",
      dosis: String(row.dosis || ""),
      cantidad: String(row.cantidad || ""),
      notas: String(row.notas || ""),
    })))
  } catch (err) {
    console.error("[applications] GET Error:", err)
    return NextResponse.json({ error: "No se pudieron cargar las aplicaciones" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const idDetalle = Number(body.idDetalle)
    if (!idDetalle || !body.producto || !body.fecha) {
      return NextResponse.json({ error: "Cultivo, producto y fecha son requeridos" }, { status: 400 })
    }
    const inventoryColumns = await getApplicationInventoryColumns()
    const idProducto = Number(body.idProducto || body.id_fertilizante) || 0
    const cantidadAplicada = Number(body.cantidad || body.cantidadAplicada || 0)
    const product = idProducto ? await getInventoryProduct(idProducto, session.empresaId) : null
    if (idProducto && !product) {
      return NextResponse.json({ error: "Producto de inventario no encontrado" }, { status: 404 })
    }
    if (idProducto && cantidadAplicada <= 0) {
      return NextResponse.json({ error: "La cantidad aplicada debe ser mayor que 0" }, { status: 400 })
    }
    if (idProducto && product?.cantidadDisponible != null && cantidadAplicada > Number(product.cantidadDisponible)) {
      return NextResponse.json(
        { error: `Inventario insuficiente. Disponible: ${Number(product.cantidadDisponible)}` },
        { status: 400 }
      )
    }
    const insertColumns = [
      "id_detalle",
      "tipo_plaga",
      "producto_usado",
      ...(inventoryColumns.idFertilizante ? ["id_fertilizante"] : []),
      "dosis",
      ...(inventoryColumns.cantidadAplicada ? ["cantidad_aplicada"] : []),
      "fecha_aplicacion",
      "notas",
      "id_empresa",
    ]
    const insertValues = [
      "@idDetalle",
      "@tipoPlaga",
      "@producto",
      ...(inventoryColumns.idFertilizante ? ["@idProducto"] : []),
      "@dosis",
      ...(inventoryColumns.cantidadAplicada ? ["@cantidadAplicada"] : []),
      "@fecha",
      "@notas",
      "@empresaId",
    ]

    const result = await execute(
      `
        INSERT INTO dbo.ControlPlagas (${insertColumns.join(", ")})
        OUTPUT INSERTED.id_plaga
        VALUES (${insertValues.join(", ")})
      `,
      {
        idDetalle,
        tipoPlaga: body.tipoPlaga || "Preventivo",
        producto: product?.nombre || body.producto,
        idProducto: idProducto || null,
        dosis: body.dosis || null,
        cantidadAplicada: cantidadAplicada || null,
        fecha: body.fecha,
        notas: body.notas || null,
        empresaId: session.empresaId,
      }
    )
    const newId = Number(result.recordset?.[0]?.id_plaga || 0)
    await adjustInventory(idProducto || null, cantidadAplicada, "deduct")

    await registrarBitacora({
      session,
      req,
      descripcion: `Se registro aplicacion ${newId} y se desconto inventario`,
      modulo: "aplicaciones",
      entidad: "ControlPlagas",
      entidadId: newId,
      accion: "CREATE",
      valorNuevo: { ...body, idProducto, cantidadAplicada },
    })

    return NextResponse.json({ ok: true, id: `plaga-${newId || ""}` })
  } catch (err) {
    console.error("[applications] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar la aplicacion" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const id = Number(String(body.id || "").replace("plaga-", ""))
    if (!id) return NextResponse.json({ error: "Solo se pueden editar aplicaciones de control de plagas" }, { status: 400 })
    const inventoryColumns = await getApplicationInventoryColumns()
    const previousRows = await query<Array<{ id_fertilizante: number | null; cantidad_aplicada: number | null }>>(
      `SELECT
         ${inventoryColumns.idFertilizante ? "id_fertilizante" : "NULL"} AS id_fertilizante,
         ${inventoryColumns.cantidadAplicada ? "cantidad_aplicada" : "NULL"} AS cantidad_aplicada
       FROM dbo.ControlPlagas
       WHERE id_plaga = @id
         AND id_empresa = @empresaId`,
      { id, empresaId: session.empresaId }
    )
    const previous = previousRows[0]
    if (!previous) return NextResponse.json({ error: "Aplicacion no encontrada" }, { status: 404 })

    const idProducto = Number(body.idProducto || body.id_fertilizante) || 0
    const cantidadAplicada = Number(body.cantidad || body.cantidadAplicada || 0)
    const previousProductId = Number(previous.id_fertilizante || 0)
    const previousAmount = Number(previous.cantidad_aplicada || 0)
    const product = idProducto ? await getInventoryProduct(idProducto, session.empresaId) : null
    if (idProducto && !product) {
      return NextResponse.json({ error: "Producto de inventario no encontrado" }, { status: 404 })
    }
    if (idProducto && cantidadAplicada <= 0) {
      return NextResponse.json({ error: "La cantidad aplicada debe ser mayor que 0" }, { status: 400 })
    }
    const restoredSameProduct = previousProductId === idProducto ? previousAmount : 0
    const available = Number(product?.cantidadDisponible ?? 0) + restoredSameProduct
    if (idProducto && product?.cantidadDisponible != null && cantidadAplicada > available) {
      return NextResponse.json(
        { error: `Inventario insuficiente. Disponible: ${available}` },
        { status: 400 }
      )
    }

    await execute(
      `
        UPDATE dbo.ControlPlagas
        SET id_detalle = @idDetalle,
            tipo_plaga = @tipoPlaga,
            producto_usado = @producto,
            ${inventoryColumns.idFertilizante ? "id_fertilizante = @idProducto," : ""}
            dosis = @dosis,
            ${inventoryColumns.cantidadAplicada ? "cantidad_aplicada = @cantidadAplicada," : ""}
            fecha_aplicacion = @fecha,
            notas = @notas
        WHERE id_plaga = @id
          AND id_empresa = @empresaId
      `,
      {
        id,
        idDetalle: Number(body.idDetalle),
        tipoPlaga: body.tipoPlaga || "Preventivo",
        producto: product?.nombre || body.producto,
        idProducto: idProducto || null,
        dosis: body.dosis || null,
        cantidadAplicada: cantidadAplicada || null,
        fecha: body.fecha,
        notas: body.notas || null,
        empresaId: session.empresaId,
      }
    )
    if (previousProductId) await adjustInventory(previousProductId, previousAmount, "restore")
    await adjustInventory(idProducto || null, cantidadAplicada, "deduct")

    await registrarBitacora({
      session,
      req,
      descripcion: `Se actualizo aplicacion ${id} y se ajusto inventario`,
      modulo: "aplicaciones",
      entidad: "ControlPlagas",
      entidadId: id,
      accion: "UPDATE",
      valorAnterior: previous,
      valorNuevo: { ...body, idProducto, cantidadAplicada },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[applications] PUT Error:", err)
    return NextResponse.json({ error: "No se pudo actualizar la aplicacion" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    const { id } = await req.json()
    const plagaId = Number(String(id || "").replace("plaga-", ""))
    if (!plagaId) return NextResponse.json({ error: "Solo se pueden eliminar aplicaciones de control de plagas" }, { status: 400 })
    const inventoryColumns = await getApplicationInventoryColumns()
    const previousRows = await query<Array<{ id_fertilizante: number | null; cantidad_aplicada: number | null }>>(
      `SELECT
         ${inventoryColumns.idFertilizante ? "id_fertilizante" : "NULL"} AS id_fertilizante,
         ${inventoryColumns.cantidadAplicada ? "cantidad_aplicada" : "NULL"} AS cantidad_aplicada
       FROM dbo.ControlPlagas
       WHERE id_plaga = @id
         AND id_empresa = @empresaId`,
      { id: plagaId, empresaId: session.empresaId }
    )
    const previous = previousRows[0]

    await execute(
      "DELETE FROM dbo.ControlPlagas WHERE id_plaga = @id AND id_empresa = @empresaId",
      { id: plagaId, empresaId: session.empresaId }
    )
    if (previous?.id_fertilizante) {
      await adjustInventory(Number(previous.id_fertilizante), Number(previous.cantidad_aplicada || 0), "restore")
    }

    await registrarBitacora({
      session,
      req,
      descripcion: `Se elimino aplicacion ${plagaId} y se restauro inventario`,
      modulo: "aplicaciones",
      entidad: "ControlPlagas",
      entidadId: plagaId,
      accion: "DELETE",
      valorAnterior: previous,
      severidad: "advertencia",
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[applications] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar la aplicacion" }, { status: 500 })
  }
}
