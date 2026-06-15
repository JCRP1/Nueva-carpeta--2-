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
      greenhouseFilter = " AND z.id_invernadero = @greenhouseId"
      params.greenhouseId = Number(greenhouse)
    }

    const rows = await query<Record<string, unknown>[]>(
      `
        SELECT
          CONCAT('tarea-', t.id_tarea) AS id,
          t.titulo,
          t.descripcion,
          t.frecuencia AS tipo,
          CONVERT(char(10), t.proxima_ejecucion, 23) AS fecha,
          t.estado,
          t.responsable,
          NULL AS zonaNombre,
          NULL AS cultivoNombre
        FROM dbo.TareasProgramadas t
        WHERE t.id_empresa = @empresaId

        UNION ALL

        SELECT
          CONCAT('cosecha-', z.id_zona) AS id,
          CONCAT('Cosecha estimada: ', z.nombre) AS titulo,
          z.notas_cultivo AS descripcion,
          'cosecha' AS tipo,
          CONVERT(char(10), z.fecha_cosecha_estimada, 23) AS fecha,
          z.estado,
          NULL AS responsable,
          z.nombre AS zonaNombre,
          z.tipo_cultivo AS cultivoNombre
        FROM dbo.ZonasRiego z
        WHERE z.id_empresa = @empresaId
          AND z.fecha_cosecha_estimada IS NOT NULL
          ${greenhouseFilter}

        ORDER BY fecha ASC
      `,
      params
    )

    return NextResponse.json(rows.map((row) => ({
      id: String(row.id),
      titulo: String(row.titulo || ""),
      descripcion: String(row.descripcion || ""),
      tipo: String(row.tipo || ""),
      fecha: row.fecha ? String(row.fecha) : "",
      estado: String(row.estado || ""),
      responsable: row.responsable != null ? String(row.responsable) : "",
      zonaNombre: String(row.zonaNombre || ""),
      cultivoNombre: String(row.cultivoNombre || ""),
    })))
  } catch (err) {
    console.error("[farm-calendar] GET Error:", err)
    return NextResponse.json({ error: "No se pudo cargar el calendario agricola" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    if (!body.titulo || !body.frecuencia || !body.proximaEjecucion) {
      return NextResponse.json({ error: "Titulo, frecuencia y fecha son requeridos" }, { status: 400 })
    }

    const result = await execute(
      `
        INSERT INTO dbo.TareasProgramadas (
          id_empresa, titulo, descripcion, frecuencia, proxima_ejecucion, responsable, estado
        )
        OUTPUT INSERTED.id_tarea
        VALUES (@empresaId, @titulo, @descripcion, @frecuencia, @proximaEjecucion, @responsable, @estado)
      `,
      {
        empresaId: session.empresaId,
        titulo: body.titulo,
        descripcion: body.descripcion || null,
        frecuencia: body.frecuencia,
        proximaEjecucion: body.proximaEjecucion,
        responsable: body.responsable ? Number(body.responsable) : session.userId,
        estado: body.estado || "Activa",
      }
    )

    return NextResponse.json({ ok: true, id: String(result.recordset?.[0]?.id_tarea || "") })
  } catch (err) {
    console.error("[farm-calendar] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar la tarea" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const id = Number(String(body.id || "").replace("tarea-", ""))
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    await execute(
      `
        UPDATE dbo.TareasProgramadas
        SET titulo = @titulo,
            descripcion = @descripcion,
            frecuencia = @frecuencia,
            proxima_ejecucion = @proximaEjecucion,
            responsable = @responsable,
            estado = @estado
        WHERE id_tarea = @id
          AND id_empresa = @empresaId
      `,
      {
        id,
        empresaId: session.empresaId,
        titulo: body.titulo,
        descripcion: body.descripcion || null,
        frecuencia: body.frecuencia,
        proximaEjecucion: body.proximaEjecucion,
        responsable: body.responsable ? Number(body.responsable) : session.userId,
        estado: body.estado || "Activa",
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[farm-calendar] PUT Error:", err)
    return NextResponse.json({ error: "No se pudo actualizar la tarea" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    const { id } = await req.json()
    const numericId = Number(String(id || "").replace("tarea-", ""))
    if (!numericId) return NextResponse.json({ error: "Solo se pueden eliminar tareas programadas" }, { status: 400 })
    await execute(
      "DELETE FROM dbo.TareasProgramadas WHERE id_tarea = @id AND id_empresa = @empresaId",
      { id: numericId, empresaId: session.empresaId }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[farm-calendar] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar la tarea" }, { status: 500 })
  }
}
