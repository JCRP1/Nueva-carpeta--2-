import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

async function syncCommonCropCatalog(body: Record<string, unknown>) {
  const nombre = String(body.nombre || "").trim()
  if (!nombre) return

  await query(
    `IF OBJECT_ID('dbo.CatalogoCultivos', 'U') IS NOT NULL
     BEGIN
       MERGE dbo.CatalogoCultivos AS target
       USING (
         SELECT
           @nombre AS nombre,
           @variedad AS variedad
       ) AS src
       ON LOWER(LTRIM(RTRIM(target.nombre))) = LOWER(LTRIM(RTRIM(src.nombre)))
          AND LOWER(LTRIM(RTRIM(ISNULL(target.variedad, '')))) = LOWER(LTRIM(RTRIM(ISNULL(src.variedad, ''))))
       WHEN MATCHED THEN
         UPDATE SET
           umbral_humedad = @umbralHumedad,
           umbral_temperatura = @umbralTemperatura,
           umbral_ph = @umbralPh,
           umbral_ec = @umbralEc,
           umbral_tds = @umbralTds,
           agua_litros_por_mata_dia = @aguaLitrosPorMataDia,
           rendimiento_por_mata = @rendimientoPorMata,
           unidad_rendimiento = @unidadRendimiento,
           fertilizantes = @fertilizantes,
           abonos = @abonos,
           plagas_comunes = @plagasComunes,
           tratamiento_recomendado = @tratamientoRecomendado,
           mejores_meses = @mejoresMeses,
           recomendacion_siembra = @recomendacionSiembra,
           fecha_actualizacion = GETDATE()
       WHEN NOT MATCHED THEN
         INSERT (
           nombre, variedad, umbral_humedad, umbral_temperatura, umbral_ph, umbral_ec, umbral_tds,
           agua_litros_por_mata_dia, rendimiento_por_mata, unidad_rendimiento,
           fertilizantes, abonos, plagas_comunes, tratamiento_recomendado, mejores_meses, recomendacion_siembra
         )
         VALUES (
           @nombre, @variedad, @umbralHumedad, @umbralTemperatura, @umbralPh, @umbralEc, @umbralTds,
           @aguaLitrosPorMataDia, @rendimientoPorMata, @unidadRendimiento,
           @fertilizantes, @abonos, @plagasComunes, @tratamientoRecomendado, @mejoresMeses, @recomendacionSiembra
         );
     END`,
    {
      nombre,
      variedad: String(body.variedad || ""),
      umbralHumedad: body.umbral_humedad ?? null,
      umbralTemperatura: body.umbral_temperatura ?? null,
      umbralPh: body.umbral_ph ?? null,
      umbralEc: body.umbral_ec ?? null,
      umbralTds: body.umbral_tds ?? null,
      aguaLitrosPorMataDia: body.agua_litros_por_mata_dia ?? null,
      rendimientoPorMata: body.rendimiento_por_mata ?? null,
      unidadRendimiento: body.unidad_rendimiento || null,
      fertilizantes: body.fertilizantes || null,
      abonos: body.abonos || null,
      plagasComunes: body.plagas_comunes || null,
      tratamientoRecomendado: body.tratamiento_recomendado || null,
      mejoresMeses: body.mejores_meses || null,
      recomendacionSiembra: body.recomendacion_siembra || null,
    }
  )
}

/* =========================
   CREAR
========================= */

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    const { 
      nombre, 
      variedad, 
      invernaderoId, 
      umbral_humedad,
      umbral_temperatura,
      umbral_ph,
      umbral_ec,
      umbral_tds,
      agua_litros_por_mata_dia,
      rendimiento_por_mata,
      unidad_rendimiento,
      fertilizantes,
      abonos,
      plagas_comunes,
      tratamiento_recomendado,
      mejores_meses,
      recomendacion_siembra,
    } = body

    if (!nombre || !invernaderoId) {
      return NextResponse.json({ error: "Nombre e invernadero requeridos" }, { status: 400 })
    }

    const result = await query<{ id_cultivo: number }[]>(
      `INSERT INTO Cultivos (
         nombre, variedad, id_invernadero, umbral_humedad, umbral_temperatura, umbral_ph, umbral_ec, umbral_tds,
         agua_litros_por_mata_dia, rendimiento_por_mata, unidad_rendimiento,
         fertilizantes, abonos, plagas_comunes, tratamiento_recomendado, mejores_meses, recomendacion_siembra
       )
       OUTPUT INSERTED.id_cultivo
       VALUES (
         @nombre, @variedad, @invernaderoId, @umbralHumedad, @umbralTemperatura, @umbralPh, @umbralEc, @umbralTds,
         @aguaLitrosPorMataDia, @rendimientoPorMata, @unidadRendimiento,
         @fertilizantes, @abonos, @plagasComunes, @tratamientoRecomendado, @mejoresMeses, @recomendacionSiembra
       );
       SELECT SCOPE_IDENTITY() AS id_cultivo`,
      {
        nombre,
        variedad: variedad || "",
        invernaderoId: Number(invernaderoId),
        umbralHumedad: umbral_humedad || null,
        umbralTemperatura: umbral_temperatura || null,
        umbralPh: umbral_ph || null,
        umbralEc: umbral_ec || null,
        umbralTds: umbral_tds || null,
        aguaLitrosPorMataDia: agua_litros_por_mata_dia || null,
        rendimientoPorMata: rendimiento_por_mata || null,
        unidadRendimiento: unidad_rendimiento || null,
        fertilizantes: fertilizantes || null,
        abonos: abonos || null,
        plagasComunes: plagas_comunes || null,
        tratamientoRecomendado: tratamiento_recomendado || null,
        mejoresMeses: mejores_meses || null,
        recomendacionSiembra: recomendacion_siembra || null,
      }
    )

    const cultivoId = result[0]?.id_cultivo
    await syncCommonCropCatalog(body)

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
   LISTAR
========================= */

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouseId = searchParams.get("greenhouse")

    console.log("[CROPS API] GreenhouseId param:", greenhouseId)

    let sqlText = `
      SELECT
        CONVERT(nvarchar(30), c.id_cultivo) AS id,
        c.nombre,
        c.variedad,
        c.id_invernadero AS invernaderoId,
        CONVERT(char(10), c.fecha_siembra, 23) AS fechaSiembra,
        c.umbral_humedad AS umbralHumedad,
        c.umbral_temperatura AS umbralTemperatura,
        c.umbral_ph AS umbralPh,
        c.umbral_ec AS umbralEc,
        c.umbral_tds AS umbralTds,
        c.agua_litros_por_mata_dia AS aguaLitrosPorMataDia,
        c.rendimiento_por_mata AS rendimientoPorMata,
        c.unidad_rendimiento AS unidadRendimiento,
        c.fertilizantes,
        c.abonos,
        c.plagas_comunes AS plagasComunes,
        c.tratamiento_recomendado AS tratamientoRecomendado,
        c.mejores_meses AS mejoresMeses,
        c.recomendacion_siembra AS recomendacionSiembra,
        CAST(0 AS bit) AS esCatalogo
      FROM Cultivos c
    `
    const params: Record<string, unknown> = {}

    if (greenhouseId) {
      sqlText += " WHERE c.id_invernadero = @greenhouseId"
      params.greenhouseId = Number(greenhouseId)
    }

    if (greenhouseId) {
      sqlText += `
        UNION ALL
        SELECT
          CONCAT('catalog:', cc.id_catalogo) AS id,
          cc.nombre,
          cc.variedad,
          @greenhouseId AS invernaderoId,
          NULL AS fechaSiembra,
          cc.umbral_humedad AS umbralHumedad,
          cc.umbral_temperatura AS umbralTemperatura,
          cc.umbral_ph AS umbralPh,
          cc.umbral_ec AS umbralEc,
          cc.umbral_tds AS umbralTds,
          cc.agua_litros_por_mata_dia AS aguaLitrosPorMataDia,
          cc.rendimiento_por_mata AS rendimientoPorMata,
          cc.unidad_rendimiento AS unidadRendimiento,
          cc.fertilizantes,
          cc.abonos,
          cc.plagas_comunes AS plagasComunes,
          cc.tratamiento_recomendado AS tratamientoRecomendado,
          cc.mejores_meses AS mejoresMeses,
          cc.recomendacion_siembra AS recomendacionSiembra,
          CAST(1 AS bit) AS esCatalogo
        FROM CatalogoCultivos cc
        WHERE cc.activo = 1
          AND NOT EXISTS (
            SELECT 1
            FROM Cultivos existing
            WHERE existing.id_invernadero = @greenhouseId
              AND LOWER(LTRIM(RTRIM(existing.nombre))) = LOWER(LTRIM(RTRIM(cc.nombre)))
              AND LOWER(LTRIM(RTRIM(ISNULL(existing.variedad, '')))) = LOWER(LTRIM(RTRIM(ISNULL(cc.variedad, ''))))
          )
      `
    }

    sqlText += " ORDER BY esCatalogo ASC, nombre ASC"

    console.log("[CROPS API] SQL:", sqlText)
    console.log("[CROPS API] Params:", params)

    const rows = await query<Record<string, unknown>[]>(sqlText, params)

    console.log("[CROPS API] Rows found:", rows.length)

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
          umbralHumedad: row.umbralHumedad != null ? Number(row.umbralHumedad) : undefined,
          umbralTemperatura: row.umbralTemperatura != null ? Number(row.umbralTemperatura) : undefined,
          umbralPh: row.umbralPh != null ? Number(row.umbralPh) : undefined,
          umbralEc: row.umbralEc != null ? Number(row.umbralEc) : undefined,
          umbralTds: row.umbralTds != null ? Number(row.umbralTds) : undefined,
          aguaLitrosPorMataDia: row.aguaLitrosPorMataDia != null ? Number(row.aguaLitrosPorMataDia) : undefined,
          rendimientoPorMata: row.rendimientoPorMata != null ? Number(row.rendimientoPorMata) : undefined,
          unidadRendimiento: String(row.unidadRendimiento || ""),
          fertilizantes: String(row.fertilizantes || ""),
          abonos: String(row.abonos || ""),
          plagasComunes: String(row.plagasComunes || ""),
          tratamientoRecomendado: String(row.tratamientoRecomendado || ""),
          mejoresMeses: String(row.mejoresMeses || ""),
          recomendacionSiembra: String(row.recomendacionSiembra || ""),
          esCatalogo: Boolean(row.esCatalogo),
        })
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
   EDITAR
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
      umbral_humedad,
      umbral_temperatura,
      umbral_ph,
      umbral_ec,
      umbral_tds,
      agua_litros_por_mata_dia,
      rendimiento_por_mata,
      unidad_rendimiento,
      fertilizantes,
      abonos,
      plagas_comunes,
      tratamiento_recomendado,
      mejores_meses,
      recomendacion_siembra
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, variedad, id_invernadero AS invernaderoId, fecha_siembra AS fechaSiembra, umbral_humedad AS umbralHumedad, umbral_ph AS umbralPh, umbral_ec AS umbralEc, umbral_tds AS umbralTds
       FROM Cultivos
       WHERE id_cultivo = @id`,
      { id }
    )

    await query(
      `UPDATE Cultivos
       SET nombre = @nombre,
           variedad = @variedad,
           id_invernadero = @invernaderoId,
           umbral_humedad = @umbralHumedad,
           umbral_temperatura = @umbralTemperatura,
           umbral_ph = @umbralPh,
           umbral_ec = @umbralEc,
           umbral_tds = @umbralTds,
           agua_litros_por_mata_dia = @aguaLitrosPorMataDia,
           rendimiento_por_mata = @rendimientoPorMata,
           unidad_rendimiento = @unidadRendimiento,
           fertilizantes = @fertilizantes,
           abonos = @abonos,
           plagas_comunes = @plagasComunes,
           tratamiento_recomendado = @tratamientoRecomendado,
           mejores_meses = @mejoresMeses,
           recomendacion_siembra = @recomendacionSiembra
       WHERE id_cultivo = @id`,
      {
        id,
        nombre,
        variedad: variedad || "",
        invernaderoId: Number(invernaderoId),
        umbralHumedad: umbral_humedad || null,
        umbralTemperatura: umbral_temperatura || null,
        umbralPh: umbral_ph || null,
        umbralEc: umbral_ec || null,
        umbralTds: umbral_tds || null,
        aguaLitrosPorMataDia: agua_litros_por_mata_dia || null,
        rendimientoPorMata: rendimiento_por_mata || null,
        unidadRendimiento: unidad_rendimiento || null,
        fertilizantes: fertilizantes || null,
        abonos: abonos || null,
        plagasComunes: plagas_comunes || null,
        tratamientoRecomendado: tratamiento_recomendado || null,
        mejoresMeses: mejores_meses || null,
        recomendacionSiembra: recomendacion_siembra || null,
      }
    )
    await syncCommonCropCatalog(body)

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
       WHERE id_cultivo = @id`,
      { id }
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
