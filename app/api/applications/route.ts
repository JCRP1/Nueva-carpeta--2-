import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouse = searchParams.get("greenhouse")

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
          cp.dosis,
          NULL AS cantidad,
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

    const result = await execute(
      `
        INSERT INTO dbo.ControlPlagas (
          id_detalle, tipo_plaga, producto_usado, dosis, fecha_aplicacion, notas, id_empresa
        )
        OUTPUT INSERTED.id_plaga
        VALUES (@idDetalle, @tipoPlaga, @producto, @dosis, @fecha, @notas, @empresaId)
      `,
      {
        idDetalle,
        tipoPlaga: body.tipoPlaga || "Preventivo",
        producto: body.producto,
        dosis: body.dosis || null,
        fecha: body.fecha,
        notas: body.notas || null,
        empresaId: session.empresaId,
      }
    )

    return NextResponse.json({ ok: true, id: `plaga-${result.recordset?.[0]?.id_plaga || ""}` })
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

    await execute(
      `
        UPDATE dbo.ControlPlagas
        SET id_detalle = @idDetalle,
            tipo_plaga = @tipoPlaga,
            producto_usado = @producto,
            dosis = @dosis,
            fecha_aplicacion = @fecha,
            notas = @notas
        WHERE id_plaga = @id
          AND id_empresa = @empresaId
      `,
      {
        id,
        idDetalle: Number(body.idDetalle),
        tipoPlaga: body.tipoPlaga || "Preventivo",
        producto: body.producto,
        dosis: body.dosis || null,
        fecha: body.fecha,
        notas: body.notas || null,
        empresaId: session.empresaId,
      }
    )

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

    await execute(
      "DELETE FROM dbo.ControlPlagas WHERE id_plaga = @id AND id_empresa = @empresaId",
      { id: plagaId, empresaId: session.empresaId }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[applications] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar la aplicacion" }, { status: 500 })
  }
}
