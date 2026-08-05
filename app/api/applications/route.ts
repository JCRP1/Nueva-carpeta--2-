import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

async function ensureApplicationInventoryColumns() {
  await execute(`
    IF OBJECT_ID('dbo.ControlPlagas', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.ControlPlagas', 'id_producto_inventario') IS NULL
    BEGIN
      ALTER TABLE dbo.ControlPlagas
      ADD id_producto_inventario INT NULL;
    END;

    IF OBJECT_ID('dbo.ControlPlagas', 'U') IS NOT NULL
       AND COL_LENGTH('dbo.ControlPlagas', 'cantidad_aplicada') IS NULL
    BEGIN
      ALTER TABLE dbo.ControlPlagas
      ADD cantidad_aplicada DECIMAL(14, 2) NULL;
    END;
  `)
}

async function getApplicationInventoryColumns() {
  await ensureApplicationInventoryColumns()
  const rows = await query<Array<{ idProductoInventario: number; idFertilizante: number; cantidadAplicada: number }>>(
    `SELECT
       CASE WHEN COL_LENGTH('dbo.ControlPlagas', 'id_producto_inventario') IS NULL THEN 0 ELSE 1 END AS idProductoInventario,
       CASE WHEN COL_LENGTH('dbo.ControlPlagas', 'id_fertilizante') IS NULL THEN 0 ELSE 1 END AS idFertilizante,
       CASE WHEN COL_LENGTH('dbo.ControlPlagas', 'cantidad_aplicada') IS NULL THEN 0 ELSE 1 END AS cantidadAplicada`
  )

  return {
    idProductoInventario: Number(rows[0]?.idProductoInventario) === 1,
    idFertilizante: Number(rows[0]?.idFertilizante) === 1,
    cantidadAplicada: Number(rows[0]?.cantidadAplicada) === 1,
  }
}

async function hasInventoryStockColumn() {
  const rows = await query<Array<{ exists: number }>>(
    `SELECT CASE WHEN COL_LENGTH('dbo.Inventario', 'cantidad_disponible') IS NULL THEN 0 ELSE 1 END AS [exists]`
  )

  return Number(rows[0]?.exists) === 1
}

async function getInventoryProduct(productId: number, empresaId: number) {
  const rows = await query<Array<{ id: number; nombre: string; cantidadDisponible: number | null }>>(
    `SELECT TOP 1
       id_producto AS id,
       nombre,
       ${await hasInventoryStockColumn() ? "cantidad_disponible" : "NULL"} AS cantidadDisponible
     FROM dbo.Inventario
     WHERE id_producto = @productId
       AND (id_empresa = @empresaId OR id_empresa IS NULL)`,
    { productId, empresaId }
  )

  return rows[0] || null
}

async function adjustInventory(productId: number | null, amount: number, operation: "deduct" | "restore") {
  if (!productId || amount <= 0 || !(await hasInventoryStockColumn())) return

  if (operation === "deduct") {
    await execute(
      `UPDATE dbo.Inventario
       SET cantidad_disponible = CASE
         WHEN ISNULL(cantidad_disponible, 0) - @amount < 0 THEN 0
         ELSE ISNULL(cantidad_disponible, 0) - @amount
       END
       WHERE id_producto = @productId`,
      { productId, amount }
    )
    return
  }

  await execute(
    `UPDATE dbo.Inventario
     SET cantidad_disponible = ISNULL(cantidad_disponible, 0) + @amount
     WHERE id_producto = @productId`,
    { productId, amount }
  )
}

async function resolveDetailIdFromZone(zoneId: number, date: string, empresaId: number) {
  const zoneRows = await query<Record<string, unknown>[]>(
    `SELECT TOP 1
       z.id_invernadero,
       z.tipo_cultivo,
       z.fecha_siembra,
       z.fecha_cosecha_estimada,
       z.tiempo_germinacion_dias,
       z.tiempo_crecimiento_dias,
       z.tiempo_cosecha_dias,
       z.notas_cultivo
     FROM dbo.ZonasRiego z
     INNER JOIN dbo.Invernaderos i ON i.id_invernadero = z.id_invernadero
     WHERE z.id_zona = @zoneId
       AND i.id_empresa = @empresaId`,
    { zoneId, empresaId }
  )
  const zone = zoneRows[0]
  if (!zone) return 0

  const cropRows = await query<Record<string, unknown>[]>(
    `SELECT TOP 1 id_cultivo, variedad
     FROM dbo.Cultivos
     WHERE id_invernadero = @greenhouseId
       AND LTRIM(RTRIM(LOWER(nombre))) = LTRIM(RTRIM(LOWER(@cropName)))
     ORDER BY id_cultivo DESC`,
    {
      greenhouseId: Number(zone.id_invernadero),
      cropName: String(zone.tipo_cultivo || ""),
    }
  )
  const crop = cropRows[0]
  if (!crop) return 0

  const detailRows = await query<Record<string, unknown>[]>(
    `SELECT TOP 1 id_detalle
     FROM dbo.CultivoDetalle
     WHERE id_cultivo = @cropId
     ORDER BY id_detalle DESC`,
    { cropId: Number(crop.id_cultivo) }
  )
  if (detailRows[0]?.id_detalle != null) {
    return Number(detailRows[0].id_detalle)
  }

  const inserted = await execute(
    `INSERT INTO dbo.CultivoDetalle (
       id_cultivo,
       fecha_siembra,
       fecha_cosecha_estimada,
       variedad,
       tiempo_germinacion_dias,
       tiempo_crecimiento_dias,
       tiempo_cosecha_dias,
       notas
     )
     OUTPUT INSERTED.id_detalle
     VALUES (
       @cropId,
       COALESCE(@fechaSiembra, TRY_CONVERT(date, @date), CAST(GETDATE() AS date)),
       @fechaCosechaEstimada,
       @variedad,
       @germinacion,
       @crecimiento,
       @cosecha,
       @notas
     )`,
    {
      cropId: Number(crop.id_cultivo),
      date,
      fechaSiembra: zone.fecha_siembra || null,
      fechaCosechaEstimada: zone.fecha_cosecha_estimada || null,
      variedad: String(crop.variedad || ""),
      germinacion: zone.tiempo_germinacion_dias || null,
      crecimiento: zone.tiempo_crecimiento_dias || null,
      cosecha: zone.tiempo_cosecha_dias || null,
      notas: zone.notas_cultivo || "Detalle creado desde zona de riego para aplicacion",
    }
  )

  return Number(inserted.recordset?.[0]?.id_detalle || 0)
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
          ${
            inventoryColumns.idProductoInventario
              ? "cp.id_producto_inventario"
              : inventoryColumns.idFertilizante
                ? "cp.id_fertilizante"
                : "NULL"
          } AS idProducto,
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
    const idZona = Number(body.idZona ?? body.id_zona) || 0
    const idDetalle = Number(body.idDetalle) || (idZona ? await resolveDetailIdFromZone(idZona, String(body.fecha || ""), session.empresaId) : 0)
    if (!idDetalle || !body.producto || !body.fecha) {
      return NextResponse.json({ error: "Zona/cultivo, producto y fecha son requeridos" }, { status: 400 })
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
      ...(inventoryColumns.idProductoInventario ? ["id_producto_inventario"] : []),
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
      ...(inventoryColumns.idProductoInventario ? ["@idProducto"] : []),
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
    const previousRows = await query<Array<{ id_producto_inventario: number | null; cantidad_aplicada: number | null }>>(
      `SELECT
         ${
           inventoryColumns.idProductoInventario
             ? "id_producto_inventario"
             : inventoryColumns.idFertilizante
               ? "id_fertilizante"
               : "NULL"
         } AS id_producto_inventario,
         ${inventoryColumns.cantidadAplicada ? "cantidad_aplicada" : "NULL"} AS cantidad_aplicada
       FROM dbo.ControlPlagas
       WHERE id_plaga = @id
         AND id_empresa = @empresaId`,
      { id, empresaId: session.empresaId }
    )
    const previous = previousRows[0]
    if (!previous) return NextResponse.json({ error: "Aplicacion no encontrada" }, { status: 404 })

    const idZona = Number(body.idZona ?? body.id_zona) || 0
    const idDetalle = Number(body.idDetalle) || (idZona ? await resolveDetailIdFromZone(idZona, String(body.fecha || ""), session.empresaId) : 0)
    if (!idDetalle) return NextResponse.json({ error: "Zona/cultivo requerido" }, { status: 400 })
    const idProducto = Number(body.idProducto || body.id_fertilizante) || 0
    const cantidadAplicada = Number(body.cantidad || body.cantidadAplicada || 0)
    const previousProductId = Number(previous.id_producto_inventario || 0)
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
            ${inventoryColumns.idProductoInventario ? "id_producto_inventario = @idProducto," : ""}
            dosis = @dosis,
            ${inventoryColumns.cantidadAplicada ? "cantidad_aplicada = @cantidadAplicada," : ""}
            fecha_aplicacion = @fecha,
            notas = @notas
        WHERE id_plaga = @id
          AND id_empresa = @empresaId
      `,
      {
        id,
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
    const previousRows = await query<Array<{ id_producto_inventario: number | null; cantidad_aplicada: number | null }>>(
      `SELECT
         ${
           inventoryColumns.idProductoInventario
             ? "id_producto_inventario"
             : inventoryColumns.idFertilizante
               ? "id_fertilizante"
               : "NULL"
         } AS id_producto_inventario,
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
    if (previous?.id_producto_inventario) {
      await adjustInventory(Number(previous.id_producto_inventario), Number(previous.cantidad_aplicada || 0), "restore")
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
