import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

/* =========================
   CREAR (incluye CultivoDetalle)
========================= */

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    const { 
      nombre, 
      variedad, 
      invernaderoId, 
      fecha_siembra,
      fecha_cosecha_estimada,
      tiempo_germinacion_dias,
      tiempo_crecimiento_dias,
      tiempo_cosecha_dias,
      notas
    } = body

    if (!nombre || !invernaderoId) {
      return NextResponse.json({ error: "Nombre e invernadero requeridos" }, { status: 400 })
    }

    // Insertar cultivo y obtener ID
    const result = await query<{ id_cultivo: number }[]>(
      `INSERT INTO Cultivos (nombre, variedad, id_invernadero, fecha_siembra)
       OUTPUT INSERTED.id_cultivo
       VALUES (@nombre, @variedad, @invernaderoId, @fechaSiembra);
       SELECT SCOPE_IDENTITY() AS id_cultivo`,
      {
        nombre,
        variedad: variedad || "",
        invernaderoId: Number(invernaderoId),
        fechaSiembra: fecha_siembra || null,
      }
    )

    const cultivoId = result[0]?.id_cultivo

    // Insertar CultivoDetalle si hay datos
    if (cultivoId && fecha_siembra) {
      await query(
        `INSERT INTO CultivoDetalle 
         (id_cultivo, fecha_siembra, fecha_cosecha_estimada, variedad, tiempo_germinacion_dias, tiempo_crecimiento_dias, tiempo_cosecha_dias, notas)
         VALUES (@cultivoId, @fechaSiembra, @fechaCosecha, @variedad, @germinacion, @crecimiento, @cosecha, @notas)`,
        {
          cultivoId,
          fechaSiembra: fecha_siembra,
          fechaCosecha: fecha_cosecha_estimada || null,
          variedad: variedad || "",
          germinacion: tiempo_germinacion_dias || null,
          crecimiento: tiempo_crecimiento_dias || null,
          cosecha: tiempo_cosecha_dias || null,
          notas: notas || "",
        }
      )
    }

    await registrarBitacora({
      session,
      req,
      descripcion: `Se creo el cultivo ${nombre}`,
      modulo: "cultivos",
      entidad: "Cultivos",
      entidadId: cultivoId,
      accion: "CREATE",
      valorNuevo: body,
    })

    return NextResponse.json({ ok: true, id: String(cultivoId) })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No se pudo guardar" },
      { status: 500 }
    )
  }
}

/* =========================
   LISTAR (con CultivoDetalle)
========================= */

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouseId = searchParams.get("greenhouse")

    console.log("[CROPS API] Session empresaId:", session.empresaId)
    console.log("[CROPS API] GreenhouseId param:", greenhouseId)

    let sqlText = `
      SELECT
        c.id_cultivo AS id,
        c.nombre,
        c.variedad,
        c.id_invernadero AS invernaderoId,
        CONVERT(char(10), c.fecha_siembra, 23) AS fechaSiembra,
        d.id_detalle AS detalleId,
        CONVERT(char(10), d.fecha_cosecha_estimada, 23) AS fechaCosechaEstimada,
        d.tiempo_germinacion_dias AS tiempoGerminacionDias,
        d.tiempo_crecimiento_dias AS tiempoCrecimientoDias,
        d.tiempo_cosecha_dias AS tiempoCosechaDias,
        d.notas
      FROM Cultivos c
      LEFT JOIN CultivoDetalle d ON d.id_cultivo = c.id_cultivo
      WHERE c.id_invernadero IN (
        SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId
      )
    `
    const params: Record<string, unknown> = { empresaId: session.empresaId }

    if (greenhouseId) {
      sqlText += " AND c.id_invernadero = @greenhouseId"
      params.greenhouseId = Number(greenhouseId)
    }

    sqlText += " ORDER BY c.id_cultivo DESC"

    console.log("[CROPS API] SQL:", sqlText)
    console.log("[CROPS API] Params:", params)

    const rows = await query<Record<string, unknown>[]>(sqlText, params)

    console.log("[CROPS API] Rows found:", rows.length)

    // Convertir filas a cultivos con detalle embebido
    const cropsMap = new Map<string, Record<string, unknown>>()
    
    for (const row of rows) {
      const rowId = String(row.id)
      if (!cropsMap.has(rowId)) {
        cropsMap.set(rowId, {
          id: rowId,
          nombre: String(row.nombre || ""),
          variedad: String(row.variedad || ""),
          invernaderoId: String(row.invernaderoId),
          fechaSiembra: row.fechaSiembra ? String(row.fechaSiembra) : "",
          detalle: undefined as Record<string, unknown> | undefined,
        })
      }
      
      if (row.detalleId) {
        (cropsMap.get(rowId) as Record<string, unknown>).detalle = {
          id: String(row.detalleId),
          fechaCosechaEstimada: row.fechaCosechaEstimada ? String(row.fechaCosechaEstimada) : "",
          tiempoGerminacionDias: row.tiempoGerminacionDias,
          tiempoCrecimientoDias: row.tiempoCrecimientoDias,
          tiempoCosechaDias: row.tiempoCosechaDias,
          notas: String(row.notas || ""),
        }
      }
    }

    return NextResponse.json(Array.from(cropsMap.values()))

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    )
  }
}

/* =========================
   EDITAR (incluye CultivoDetalle)
========================= */

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    const { 
      id, 
      nombre, 
      variedad, 
      invernaderoId, 
      fecha_siembra,
      detalle
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, variedad, id_invernadero AS invernaderoId, fecha_siembra AS fechaSiembra
       FROM Cultivos
       WHERE id_cultivo = @id`,
      { id }
    )

    // Actualizar Cultivos
    await query(
      `UPDATE Cultivos
       SET nombre = @nombre, variedad = @variedad, id_invernadero = @invernaderoId, fecha_siembra = @fechaSiembra
       WHERE id_cultivo = @id
       AND id_invernadero IN (SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId)`,
      {
        id,
        nombre,
        variedad: variedad || "",
        invernaderoId: Number(invernaderoId),
        fechaSiembra: fecha_siembra || null,
        empresaId: session.empresaId,
      }
    )

    // Verificar si existe CultivoDetalle
    const existingDetalle = await query<{ id_detalle: number }[]>(
      "SELECT id_detalle FROM CultivoDetalle WHERE id_cultivo = @id",
      { id }
    )

    if (detalle) {
      if (existingDetalle.length > 0) {
        // Actualizar detalle existente
        await query(
          `UPDATE CultivoDetalle
           SET fecha_siembra = @fechaSiembra,
               fecha_cosecha_estimada = @fechaCosecha,
               variedad = @variedad,
               tiempo_germinacion_dias = @germinacion,
               tiempo_crecimiento_dias = @crecimiento,
               tiempo_cosecha_dias = @cosecha,
               notas = @notas
           WHERE id_cultivo = @id`,
          {
            id,
            fechaSiembra: fecha_siembra || null,
            fechaCosecha: detalle.fecha_cosecha_estimada || null,
            variedad: variedad || "",
            germinacion: detalle.tiempo_germinacion_dias || null,
            crecimiento: detalle.tiempo_crecimiento_dias || null,
            cosecha: detalle.tiempo_cosecha_dias || null,
            notas: detalle.notas || "",
          }
        )
      } else {
        // Crear nuevo detalle
        await query(
          `INSERT INTO CultivoDetalle
           (id_cultivo, fecha_siembra, fecha_cosecha_estimada, variedad, tiempo_germinacion_dias, tiempo_crecimiento_dias, tiempo_cosecha_dias, notas)
           VALUES (@id, @fechaSiembra, @fechaCosecha, @variedad, @germinacion, @crecimiento, @cosecha, @notas)`,
          {
            id,
            fechaSiembra: fecha_siembra || null,
            fechaCosecha: detalle.fecha_cosecha_estimada || null,
            variedad: variedad || "",
            germinacion: detalle.tiempo_germinacion_dias || null,
            crecimiento: detalle.tiempo_crecimiento_dias || null,
            cosecha: detalle.tiempo_cosecha_dias || null,
            notas: detalle.notas || "",
          }
        )
      }
    }

    await registrarBitacora({
      session,
      req,
      descripcion: `Se actualizo el cultivo ${nombre || id}`,
      modulo: "cultivos",
      entidad: "Cultivos",
      entidadId: id,
      accion: "UPDATE",
      valorAnterior: previousRows[0] || null,
      valorNuevo: body,
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No se pudo actualizar" },
      { status: 500 }
    )
  }
}

/* =========================
   ELIMINAR
========================= */

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, variedad, id_invernadero AS invernaderoId, fecha_siembra AS fechaSiembra
       FROM Cultivos
       WHERE id_cultivo = @id`,
      { id }
    )

    // Eliminar detalle primero (FK)
    await query("DELETE FROM CultivoDetalle WHERE id_cultivo = @id", { id })

    // Eliminar cultivo
    await query(
      `DELETE FROM Cultivos
       WHERE id_cultivo = @id
       AND id_invernadero IN (SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId)`,
      { id, empresaId: session.empresaId }
    )

    await registrarBitacora({
      session,
      req,
      descripcion: `Se elimino el cultivo ${previousRows[0]?.nombre || id}`,
      modulo: "cultivos",
      entidad: "Cultivos",
      entidadId: id,
      accion: "DELETE",
      valorAnterior: previousRows[0] || null,
      severidad: "advertencia",
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "No se pudo eliminar" },
      { status: 500 }
    )
  }
}
