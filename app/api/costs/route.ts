import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouse = searchParams.get("greenhouse")

    const params: Record<string, unknown> = { empresaId: session.empresaId }
    let where = "WHERE (i.id_empresa = @empresaId OR iz.id_empresa = @empresaId)"
    if (greenhouse) {
      where += " AND (i.id_invernadero = @greenhouseId OR iz.id_invernadero = @greenhouseId)"
      params.greenhouseId = Number(greenhouse)
    }

    const rows = await query<Record<string, unknown>[]>(
      `
        SELECT
          cc.id_costo AS id,
          cc.id_zona AS idZona,
          cc.id_cultivo AS idCultivo,
          cc.concepto,
          cc.monto,
          cc.costo_mata AS costoMata,
          cc.cantidad_matas AS cantidadMatas,
          cc.precio_mercado AS precioMercado,
          cc.unidad_precio_mercado AS unidadPrecioMercado,
          CONVERT(char(10), cc.fecha, 23) AS fecha,
          cc.descripcion,
          z.nombre AS zonaNombre,
          c.nombre AS cultivoNombre,
          COALESCE(i.nombre, iz.nombre) AS invernaderoNombre
        FROM dbo.CostosCultivo cc
        LEFT JOIN dbo.ZonasRiego z ON z.id_zona = cc.id_zona
        LEFT JOIN dbo.Invernaderos iz ON iz.id_invernadero = z.id_invernadero
        LEFT JOIN dbo.Cultivos c ON c.id_cultivo = cc.id_cultivo
        LEFT JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        ${where}
        ORDER BY cc.fecha DESC, cc.id_costo DESC
      `,
      params
    )

    return NextResponse.json(rows.map((row) => ({
      id: String(row.id),
      idZona: row.idZona != null ? String(row.idZona) : "",
      idCultivo: row.idCultivo != null ? String(row.idCultivo) : "",
      concepto: String(row.concepto || ""),
      monto: Number(row.monto) || 0,
      costoMata: Number(row.costoMata) || 0,
      cantidadMatas: Number(row.cantidadMatas) || 0,
      precioMercado: Number(row.precioMercado) || 0,
      unidadPrecioMercado: String(row.unidadPrecioMercado || ""),
      margenEstimado: (Number(row.precioMercado) || 0) * (Number(row.cantidadMatas) || 0) - (Number(row.monto) || 0),
      fecha: row.fecha ? String(row.fecha) : "",
      descripcion: String(row.descripcion || ""),
      zonaNombre: String(row.zonaNombre || ""),
      cultivoNombre: String(row.cultivoNombre || ""),
      invernaderoNombre: String(row.invernaderoNombre || ""),
    })))
  } catch (err) {
    console.error("[costs] GET Error:", err)
    return NextResponse.json({ error: "No se pudieron cargar los costos" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth()
    const body = await req.json()
    const concepto = String(body.concepto || "").trim()
    const costoMata = Number(body.costoMata ?? body.costo_mata) || 0
    const cantidadMatas = Number(body.cantidadMatas ?? body.cantidad_matas) || 0
    const precioMercado = Number(body.precioMercado ?? body.precio_mercado) || 0
    const unidadPrecioMercado = String(body.unidadPrecioMercado ?? body.unidad_precio_mercado ?? "").trim()
    const monto = Number(body.monto) || costoMata * cantidadMatas
    const fecha = String(body.fecha || "")
    if (!concepto || monto < 0 || !fecha) {
      return NextResponse.json({ error: "Concepto, monto y fecha son requeridos" }, { status: 400 })
    }

    const result = await execute(
      `
        INSERT INTO dbo.CostosCultivo (
          id_zona, id_cultivo, concepto, monto, costo_mata, cantidad_matas,
          precio_mercado, unidad_precio_mercado, fecha, descripcion
        )
        OUTPUT INSERTED.id_costo
        VALUES (
          @idZona, @idCultivo, @concepto, @monto, @costoMata, @cantidadMatas,
          @precioMercado, @unidadPrecioMercado, @fecha, @descripcion
        )
      `,
      {
        idZona: body.idZona ? Number(body.idZona) : null,
        idCultivo: body.idCultivo ? Number(body.idCultivo) : null,
        concepto,
        monto,
        costoMata,
        cantidadMatas,
        precioMercado,
        unidadPrecioMercado,
        fecha,
        descripcion: body.descripcion || null,
      }
    )

    return NextResponse.json({ ok: true, id: String(result.recordset?.[0]?.id_costo || "") })
  } catch (err) {
    console.error("[costs] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar el costo" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    await requireAuth()
    const body = await req.json()
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    const costoMata = Number(body.costoMata ?? body.costo_mata) || 0
    const cantidadMatas = Number(body.cantidadMatas ?? body.cantidad_matas) || 0
    const precioMercado = Number(body.precioMercado ?? body.precio_mercado) || 0
    const unidadPrecioMercado = String(body.unidadPrecioMercado ?? body.unidad_precio_mercado ?? "").trim()
    const monto = Number(body.monto) || costoMata * cantidadMatas

    await execute(
      `
        UPDATE dbo.CostosCultivo
        SET id_zona = @idZona,
            id_cultivo = @idCultivo,
            concepto = @concepto,
            monto = @monto,
            costo_mata = @costoMata,
            cantidad_matas = @cantidadMatas,
            precio_mercado = @precioMercado,
            unidad_precio_mercado = @unidadPrecioMercado,
            fecha = @fecha,
            descripcion = @descripcion
        WHERE id_costo = @id
      `,
      {
        id,
        idZona: body.idZona ? Number(body.idZona) : null,
        idCultivo: body.idCultivo ? Number(body.idCultivo) : null,
        concepto: String(body.concepto || ""),
        monto,
        costoMata,
        cantidadMatas,
        precioMercado,
        unidadPrecioMercado,
        fecha: String(body.fecha || ""),
        descripcion: body.descripcion || null,
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[costs] PUT Error:", err)
    return NextResponse.json({ error: "No se pudo actualizar el costo" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAuth()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    await execute("DELETE FROM dbo.CostosCultivo WHERE id_costo = @id", { id: Number(id) })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[costs] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar el costo" }, { status: 500 })
  }
}
