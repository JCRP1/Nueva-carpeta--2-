import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

type PerfilAgronomicoPayload = {
  aguaAproximada: string
  fertilizantes: string[]
  abonos: string[]
  rendimientoPorMata: string
  plagas: string[]
  mesesRecomendados: string[]
}

type CropCatalogPayload = {
  nombre: string
  variedad?: string
  umbralHumedad?: number | null
  umbralTemperatura?: number | null
  umbralPh?: number | null
  umbralEc?: number | null
  umbralTds?: number | null
  perfilAgronomico?: unknown
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizePerfilAgronomico(value: unknown): PerfilAgronomicoPayload {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>

  return {
    aguaAproximada: String(source.aguaAproximada || "").trim(),
    fertilizantes: normalizeList(source.fertilizantes),
    abonos: normalizeList(source.abonos),
    rendimientoPorMata: String(source.rendimientoPorMata || "").trim(),
    plagas: normalizeList(source.plagas),
    mesesRecomendados: normalizeList(source.mesesRecomendados),
  }
}

function hasPerfilAgronomicoData(perfil: PerfilAgronomicoPayload): boolean {
  return Boolean(
    perfil.aguaAproximada ||
      perfil.rendimientoPorMata ||
      perfil.fertilizantes.length ||
      perfil.abonos.length ||
      perfil.plagas.length ||
      perfil.mesesRecomendados.length
  )
}

function parsePerfilAgronomico(value: unknown): PerfilAgronomicoPayload | null {
  if (!value) return null

  try {
    const parsed = typeof value === "object" ? value : JSON.parse(String(value))
    const perfil = normalizePerfilAgronomico(parsed)
    return hasPerfilAgronomicoData(perfil) ? perfil : null
  } catch {
    return null
  }
}

function parseNullableDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function getCropColumns() {
  const rows = await query<Array<{
    umbralTemperatura: number
    aguaLitrosPorMataDia: number
    rendimientoPorMata: number
    unidadRendimiento: number
    fertilizantes: number
    abonos: number
    plagasComunes: number
    tratamientoRecomendado: number
    mejoresMeses: number
    recomendacionSiembra: number
  }>>(
    `SELECT
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'umbral_temperatura') IS NULL THEN 0 ELSE 1 END AS umbralTemperatura,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'agua_litros_por_mata_dia') IS NULL THEN 0 ELSE 1 END AS aguaLitrosPorMataDia,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'rendimiento_por_mata') IS NULL THEN 0 ELSE 1 END AS rendimientoPorMata,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'unidad_rendimiento') IS NULL THEN 0 ELSE 1 END AS unidadRendimiento,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'fertilizantes') IS NULL THEN 0 ELSE 1 END AS fertilizantes,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'abonos') IS NULL THEN 0 ELSE 1 END AS abonos,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'plagas_comunes') IS NULL THEN 0 ELSE 1 END AS plagasComunes,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'tratamiento_recomendado') IS NULL THEN 0 ELSE 1 END AS tratamientoRecomendado,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'mejores_meses') IS NULL THEN 0 ELSE 1 END AS mejoresMeses,
       CASE WHEN COL_LENGTH('dbo.Cultivos', 'recomendacion_siembra') IS NULL THEN 0 ELSE 1 END AS recomendacionSiembra`
  )
  const row = rows[0]
  return {
    umbralTemperatura: Number(row?.umbralTemperatura || 0) === 1,
    aguaLitrosPorMataDia: Number(row?.aguaLitrosPorMataDia || 0) === 1,
    rendimientoPorMata: Number(row?.rendimientoPorMata || 0) === 1,
    unidadRendimiento: Number(row?.unidadRendimiento || 0) === 1,
    fertilizantes: Number(row?.fertilizantes || 0) === 1,
    abonos: Number(row?.abonos || 0) === 1,
    plagasComunes: Number(row?.plagasComunes || 0) === 1,
    tratamientoRecomendado: Number(row?.tratamientoRecomendado || 0) === 1,
    mejoresMeses: Number(row?.mejoresMeses || 0) === 1,
    recomendacionSiembra: Number(row?.recomendacionSiembra || 0) === 1,
  }
}

async function hasCatalogTable() {
  const rows = await query<Array<{ existsFlag: number }>>(
    `SELECT CASE WHEN OBJECT_ID('dbo.CatalogoCultivos', 'U') IS NULL THEN 0 ELSE 1 END AS existsFlag`
  )
  return Number(rows[0]?.existsFlag || 0) === 1
}

function getCatalogDataFromPerfil(value: unknown) {
  const perfil = normalizePerfilAgronomico(value)
  const waterNumbers = perfil.aguaAproximada
    .match(/\d+(?:[.,]\d+)?/g)
    ?.map((item) => Number(item.replace(",", ".")))
    .filter((item) => Number.isFinite(item) && item > 0) || []
  const rendimientoNumbers = perfil.rendimientoPorMata
    .match(/\d+(?:[.,]\d+)?/g)
    ?.map((item) => Number(item.replace(",", ".")))
    .filter((item) => Number.isFinite(item) && item > 0) || []

  return {
    aguaLitrosPorMataDia: waterNumbers.length >= 2 ? (waterNumbers[0] + waterNumbers[1]) / 2 : waterNumbers[0] ?? null,
    rendimientoPorMata: rendimientoNumbers.length >= 2 ? (rendimientoNumbers[0] + rendimientoNumbers[1]) / 2 : rendimientoNumbers[0] ?? null,
    unidadRendimiento: perfil.rendimientoPorMata.toLowerCase().includes("lb") ? "lb" : "unidad",
    fertilizantes: perfil.fertilizantes.join("\n") || null,
    abonos: perfil.abonos.join("\n") || null,
    plagasComunes: perfil.plagas.join("\n") || null,
    mejoresMeses: perfil.mesesRecomendados.join(", ") || null,
  }
}

async function upsertCatalogCrop(payload: CropCatalogPayload) {
  if (!payload.nombre || !(await hasCatalogTable())) return
  const catalogData = getCatalogDataFromPerfil(payload.perfilAgronomico)

  await query(
    `MERGE dbo.CatalogoCultivos AS target
     USING (SELECT @nombre AS nombre, @variedad AS variedad) AS src
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
         mejores_meses = @mejoresMeses,
         activo = 1,
         fecha_actualizacion = GETDATE()
     WHEN NOT MATCHED THEN
       INSERT (
         nombre, variedad, umbral_humedad, umbral_temperatura, umbral_ph, umbral_ec, umbral_tds,
         agua_litros_por_mata_dia, rendimiento_por_mata, unidad_rendimiento,
         fertilizantes, abonos, plagas_comunes, mejores_meses, activo
       )
       VALUES (
         @nombre, @variedad, @umbralHumedad, @umbralTemperatura, @umbralPh, @umbralEc, @umbralTds,
         @aguaLitrosPorMataDia, @rendimientoPorMata, @unidadRendimiento,
         @fertilizantes, @abonos, @plagasComunes, @mejoresMeses, 1
       );`,
    {
      nombre: payload.nombre,
      variedad: payload.variedad || "",
      umbralHumedad: payload.umbralHumedad,
      umbralTemperatura: payload.umbralTemperatura,
      umbralPh: payload.umbralPh,
      umbralEc: payload.umbralEc,
      umbralTds: payload.umbralTds,
      ...catalogData,
    }
  )
}

async function hasPerfilExtraColumns() {
  const rows = await query<Array<{ ready: number }>>(
    `SELECT CASE
      WHEN COL_LENGTH('dbo.CultivoPerfilAgronomico', 'agua_aproximada') IS NOT NULL
       AND COL_LENGTH('dbo.CultivoPerfilAgronomico', 'fertilizantes') IS NOT NULL
       AND COL_LENGTH('dbo.CultivoPerfilAgronomico', 'abonos') IS NOT NULL
       AND COL_LENGTH('dbo.CultivoPerfilAgronomico', 'rendimiento_por_mata') IS NOT NULL
       AND COL_LENGTH('dbo.CultivoPerfilAgronomico', 'plagas') IS NOT NULL
       AND COL_LENGTH('dbo.CultivoPerfilAgronomico', 'meses_recomendados') IS NOT NULL
      THEN 1 ELSE 0 END AS ready`
  )
  return Number(rows[0]?.ready || 0) === 1
}

async function savePerfilAgronomico(cultivoId: number | string | undefined, value: unknown) {
  if (!cultivoId) return

  const perfil = normalizePerfilAgronomico(value)
  if (!hasPerfilAgronomicoData(perfil)) return
  const hasExtraColumns = await hasPerfilExtraColumns()

  const existing = await query<Array<{ id_perfil: number }>>(
    `SELECT TOP 1 id_perfil
     FROM CultivoPerfilAgronomico
     WHERE id_cultivo = @cultivoId
     ORDER BY fecha_actualizacion DESC, fecha_creacion DESC, id_perfil DESC`,
    { cultivoId: Number(cultivoId) }
  )

  const perfilParams = {
    aguaAproximada: perfil.aguaAproximada || null,
    fertilizantes: perfil.fertilizantes.join("\n") || null,
    abonos: perfil.abonos.join("\n") || null,
    rendimientoPorMata: perfil.rendimientoPorMata || null,
    plagas: perfil.plagas.join("\n") || null,
    mesesRecomendados: perfil.mesesRecomendados.join("\n") || null,
    perfilJson: JSON.stringify(perfil),
  }

  if (!hasExtraColumns) {
    if (existing[0]?.id_perfil) {
      await query(
        `UPDATE CultivoPerfilAgronomico
         SET observaciones = @perfilJson,
             fecha_actualizacion = GETDATE()
         WHERE id_perfil = @idPerfil`,
        { idPerfil: existing[0].id_perfil, perfilJson: perfilParams.perfilJson }
      )
      return
    }

    await query(
      `INSERT INTO CultivoPerfilAgronomico (
         id_cultivo,
         densidad_plantas_m2,
         sustrato_suelo,
         observaciones,
         fecha_creacion,
         fecha_actualizacion
       )
       VALUES (
         @cultivoId,
         NULL,
         NULL,
         @perfilJson,
         GETDATE(),
         GETDATE()
       )`,
      { cultivoId: Number(cultivoId), perfilJson: perfilParams.perfilJson }
    )
    return
  }

  if (existing[0]?.id_perfil) {
    await query(
      `UPDATE CultivoPerfilAgronomico
       SET agua_aproximada = @aguaAproximada,
           fertilizantes = @fertilizantes,
           abonos = @abonos,
           rendimiento_por_mata = @rendimientoPorMata,
           plagas = @plagas,
           meses_recomendados = @mesesRecomendados,
           fecha_actualizacion = GETDATE()
       WHERE id_perfil = @idPerfil`,
      { idPerfil: existing[0].id_perfil, ...perfilParams }
    )
    return
  }

  await query(
    `INSERT INTO CultivoPerfilAgronomico (
       id_cultivo,
       densidad_plantas_m2,
       sustrato_suelo,
       observaciones,
       agua_aproximada,
       fertilizantes,
       abonos,
       rendimiento_por_mata,
       plagas,
       meses_recomendados,
       fecha_creacion,
       fecha_actualizacion
     )
     VALUES (
       @cultivoId,
       NULL,
       NULL,
       NULL,
       @aguaAproximada,
       @fertilizantes,
       @abonos,
       @rendimientoPorMata,
       @plagas,
       @mesesRecomendados,
       GETDATE(),
       GETDATE()
     )`,
    { cultivoId: Number(cultivoId), ...perfilParams }
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
      perfilAgronomico,
    } = body

    if (!nombre || !invernaderoId) {
      return NextResponse.json({ error: "Nombre e invernadero requeridos" }, { status: 400 })
    }

    const cropColumns = await getCropColumns()
    const catalogData = getCatalogDataFromPerfil(perfilAgronomico)
    const insertColumns = [
      "nombre",
      "variedad",
      "id_invernadero",
      "umbral_humedad",
      ...(cropColumns.umbralTemperatura ? ["umbral_temperatura"] : []),
      "umbral_ph",
      "umbral_ec",
      "umbral_tds",
      ...(cropColumns.aguaLitrosPorMataDia ? ["agua_litros_por_mata_dia"] : []),
      ...(cropColumns.rendimientoPorMata ? ["rendimiento_por_mata"] : []),
      ...(cropColumns.unidadRendimiento ? ["unidad_rendimiento"] : []),
      ...(cropColumns.fertilizantes ? ["fertilizantes"] : []),
      ...(cropColumns.abonos ? ["abonos"] : []),
      ...(cropColumns.plagasComunes ? ["plagas_comunes"] : []),
      ...(cropColumns.mejoresMeses ? ["mejores_meses"] : []),
    ]
    const insertValues = [
      "@nombre",
      "@variedad",
      "@invernaderoId",
      "@umbralHumedad",
      ...(cropColumns.umbralTemperatura ? ["@umbralTemperatura"] : []),
      "@umbralPh",
      "@umbralEc",
      "@umbralTds",
      ...(cropColumns.aguaLitrosPorMataDia ? ["@aguaLitrosPorMataDia"] : []),
      ...(cropColumns.rendimientoPorMata ? ["@rendimientoPorMata"] : []),
      ...(cropColumns.unidadRendimiento ? ["@unidadRendimiento"] : []),
      ...(cropColumns.fertilizantes ? ["@fertilizantes"] : []),
      ...(cropColumns.abonos ? ["@abonos"] : []),
      ...(cropColumns.plagasComunes ? ["@plagasComunes"] : []),
      ...(cropColumns.mejoresMeses ? ["@mejoresMeses"] : []),
    ]

    const result = await query<{ id_cultivo: number }[]>(
      `INSERT INTO Cultivos (${insertColumns.join(", ")})
       OUTPUT INSERTED.id_cultivo
       VALUES (${insertValues.join(", ")});
       SELECT SCOPE_IDENTITY() AS id_cultivo`,
      {
        nombre,
        variedad: variedad || "",
        invernaderoId: Number(invernaderoId),
        umbralHumedad: parseNullableDecimal(umbral_humedad),
        umbralTemperatura: parseNullableDecimal(umbral_temperatura),
        umbralPh: parseNullableDecimal(umbral_ph),
        umbralEc: parseNullableDecimal(umbral_ec),
        umbralTds: parseNullableDecimal(umbral_tds),
        ...catalogData,
      }
    )

    const cultivoId = result[0]?.id_cultivo
    await savePerfilAgronomico(cultivoId, perfilAgronomico)
    await upsertCatalogCrop({
      nombre,
      variedad,
      umbralHumedad: parseNullableDecimal(umbral_humedad),
      umbralTemperatura: parseNullableDecimal(umbral_temperatura),
      umbralPh: parseNullableDecimal(umbral_ph),
      umbralEc: parseNullableDecimal(umbral_ec),
      umbralTds: parseNullableDecimal(umbral_tds),
      perfilAgronomico,
    })

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
    const hasExtraColumns = await hasPerfilExtraColumns()
    const cropColumns = await getCropColumns()
    const includeCatalog = searchParams.get("includeCatalog") !== "false"

    console.log("[CROPS API] GreenhouseId param:", greenhouseId)

    let sqlText = `
      SELECT
        c.id_cultivo AS id,
        c.nombre,
        c.variedad,
        c.id_invernadero AS invernaderoId,
        CONVERT(char(10), c.fecha_siembra, 23) AS fechaSiembra,
        c.umbral_humedad AS umbralHumedad,
        ${cropColumns.umbralTemperatura ? "c.umbral_temperatura" : "NULL"} AS umbralTemperatura,
        c.umbral_ph AS umbralPh,
        c.umbral_ec AS umbralEc,
        c.umbral_tds AS umbralTds,
        ${cropColumns.aguaLitrosPorMataDia ? "c.agua_litros_por_mata_dia" : "NULL"} AS aguaLitrosPorMataDia,
        ${cropColumns.rendimientoPorMata ? "c.rendimiento_por_mata" : "NULL"} AS cropRendimientoPorMata,
        ${cropColumns.unidadRendimiento ? "c.unidad_rendimiento" : "NULL"} AS unidadRendimiento,
        ${cropColumns.fertilizantes ? "c.fertilizantes" : "NULL"} AS cropFertilizantes,
        ${cropColumns.abonos ? "c.abonos" : "NULL"} AS cropAbonos,
        ${cropColumns.plagasComunes ? "c.plagas_comunes" : "NULL"} AS plagasComunes,
        ${cropColumns.tratamientoRecomendado ? "c.tratamiento_recomendado" : "NULL"} AS tratamientoRecomendado,
        ${cropColumns.mejoresMeses ? "c.mejores_meses" : "NULL"} AS mejoresMeses,
        ${cropColumns.recomendacionSiembra ? "c.recomendacion_siembra" : "NULL"} AS recomendacionSiembra,
        perfil.observaciones AS perfilObservaciones,
        ${hasExtraColumns ? "perfil.agua_aproximada" : "NULL"} AS aguaAproximada,
        ${hasExtraColumns ? "perfil.fertilizantes" : "NULL"} AS fertilizantes,
        ${hasExtraColumns ? "perfil.abonos" : "NULL"} AS abonos,
        ${hasExtraColumns ? "perfil.rendimiento_por_mata" : "NULL"} AS rendimientoPorMata,
        ${hasExtraColumns ? "perfil.plagas" : "NULL"} AS plagas,
        ${hasExtraColumns ? "perfil.meses_recomendados" : "NULL"} AS mesesRecomendados
      FROM Cultivos c
      OUTER APPLY (
        SELECT TOP 1
          p.observaciones,
          ${hasExtraColumns ? "p.agua_aproximada" : "NULL AS agua_aproximada"},
          ${hasExtraColumns ? "p.fertilizantes" : "NULL AS fertilizantes"},
          ${hasExtraColumns ? "p.abonos" : "NULL AS abonos"},
          ${hasExtraColumns ? "p.rendimiento_por_mata" : "NULL AS rendimiento_por_mata"},
          ${hasExtraColumns ? "p.plagas" : "NULL AS plagas"},
          ${hasExtraColumns ? "p.meses_recomendados" : "NULL AS meses_recomendados"}
        FROM CultivoPerfilAgronomico p
        WHERE p.id_cultivo = c.id_cultivo
        ORDER BY p.fecha_actualizacion DESC, p.fecha_creacion DESC, p.id_perfil DESC
      ) perfil
    `
    const params: Record<string, unknown> = {}

    if (greenhouseId) {
      sqlText += " WHERE c.id_invernadero = @greenhouseId"
      params.greenhouseId = Number(greenhouseId)
    }

    sqlText += " ORDER BY c.id_cultivo DESC"

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
          rendimientoPorMata: row.cropRendimientoPorMata != null ? Number(row.cropRendimientoPorMata) : undefined,
          unidadRendimiento: row.unidadRendimiento ? String(row.unidadRendimiento) : undefined,
          fertilizantes: row.cropFertilizantes ? String(row.cropFertilizantes) : undefined,
          abonos: row.cropAbonos ? String(row.cropAbonos) : undefined,
          plagasComunes: row.plagasComunes ? String(row.plagasComunes) : undefined,
          tratamientoRecomendado: row.tratamientoRecomendado ? String(row.tratamientoRecomendado) : undefined,
          mejoresMeses: row.mejoresMeses ? String(row.mejoresMeses) : undefined,
          recomendacionSiembra: row.recomendacionSiembra ? String(row.recomendacionSiembra) : undefined,
          esCatalogo: false,
          perfilAgronomico: parsePerfilAgronomico({
            aguaAproximada: row.aguaAproximada,
            fertilizantes: row.fertilizantes,
            abonos: row.abonos,
            rendimientoPorMata: row.rendimientoPorMata,
            plagas: row.plagas,
            mesesRecomendados: row.mesesRecomendados,
          }) || parsePerfilAgronomico(row.perfilObservaciones),
        })
      }
    }

    if (includeCatalog && await hasCatalogTable()) {
      const catalogRows = await query<Record<string, unknown>[]>(
        `SELECT
           id_catalogo AS id,
           nombre,
           variedad,
           umbral_humedad AS umbralHumedad,
           umbral_temperatura AS umbralTemperatura,
           umbral_ph AS umbralPh,
           umbral_ec AS umbralEc,
           umbral_tds AS umbralTds,
           agua_litros_por_mata_dia AS aguaLitrosPorMataDia,
           rendimiento_por_mata AS rendimientoPorMata,
           unidad_rendimiento AS unidadRendimiento,
           fertilizantes,
           abonos,
           plagas_comunes AS plagasComunes,
           tratamiento_recomendado AS tratamientoRecomendado,
           mejores_meses AS mejoresMeses,
           recomendacion_siembra AS recomendacionSiembra
         FROM dbo.CatalogoCultivos
         WHERE activo = 1
         ORDER BY nombre ASC, variedad ASC`
      )

      for (const row of catalogRows) {
        const alreadyLocal = Array.from(cropsMap.values()).some((crop) =>
          String(crop.nombre || "").toLowerCase() === String(row.nombre || "").toLowerCase() &&
          String(crop.variedad || "").toLowerCase() === String(row.variedad || "").toLowerCase()
        )
        if (alreadyLocal) continue

        cropsMap.set(`catalog:${row.id}`, {
          id: `catalog:${row.id}`,
          nombre: String(row.nombre || ""),
          variedad: String(row.variedad || ""),
          invernaderoId: greenhouseId || "",
          fechaSiembra: "",
          umbralHumedad: row.umbralHumedad != null ? Number(row.umbralHumedad) : undefined,
          umbralTemperatura: row.umbralTemperatura != null ? Number(row.umbralTemperatura) : undefined,
          umbralPh: row.umbralPh != null ? Number(row.umbralPh) : undefined,
          umbralEc: row.umbralEc != null ? Number(row.umbralEc) : undefined,
          umbralTds: row.umbralTds != null ? Number(row.umbralTds) : undefined,
          aguaLitrosPorMataDia: row.aguaLitrosPorMataDia != null ? Number(row.aguaLitrosPorMataDia) : undefined,
          rendimientoPorMata: row.rendimientoPorMata != null ? Number(row.rendimientoPorMata) : undefined,
          unidadRendimiento: row.unidadRendimiento ? String(row.unidadRendimiento) : undefined,
          fertilizantes: row.fertilizantes ? String(row.fertilizantes) : undefined,
          abonos: row.abonos ? String(row.abonos) : undefined,
          plagasComunes: row.plagasComunes ? String(row.plagasComunes) : undefined,
          tratamientoRecomendado: row.tratamientoRecomendado ? String(row.tratamientoRecomendado) : undefined,
          mejoresMeses: row.mejoresMeses ? String(row.mejoresMeses) : undefined,
          recomendacionSiembra: row.recomendacionSiembra ? String(row.recomendacionSiembra) : undefined,
          esCatalogo: true,
          perfilAgronomico: parsePerfilAgronomico({
            aguaAproximada: row.aguaLitrosPorMataDia ? `${row.aguaLitrosPorMataDia} L por mata/dia` : "",
            fertilizantes: row.fertilizantes,
            abonos: row.abonos,
            rendimientoPorMata: row.rendimientoPorMata ? `${row.rendimientoPorMata} ${row.unidadRendimiento || "unidad"} por mata` : "",
            plagas: row.plagasComunes,
            mesesRecomendados: row.mejoresMeses,
          }),
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
      perfilAgronomico
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const cropColumns = await getCropColumns()
    const previousRows = await query<Record<string, unknown>[]>(
      `SELECT nombre, variedad, id_invernadero AS invernaderoId, fecha_siembra AS fechaSiembra, umbral_humedad AS umbralHumedad, ${cropColumns.umbralTemperatura ? "umbral_temperatura" : "NULL"} AS umbralTemperatura, umbral_ph AS umbralPh, umbral_ec AS umbralEc, umbral_tds AS umbralTds
       FROM Cultivos
       WHERE id_cultivo = @id`,
      { id }
    )

    const catalogData = getCatalogDataFromPerfil(perfilAgronomico)
    const updateSet = [
      "nombre = @nombre",
      "variedad = @variedad",
      "id_invernadero = @invernaderoId",
      "umbral_humedad = @umbralHumedad",
      ...(cropColumns.umbralTemperatura ? ["umbral_temperatura = @umbralTemperatura"] : []),
      "umbral_ph = @umbralPh",
      "umbral_ec = @umbralEc",
      "umbral_tds = @umbralTds",
      ...(cropColumns.aguaLitrosPorMataDia ? ["agua_litros_por_mata_dia = @aguaLitrosPorMataDia"] : []),
      ...(cropColumns.rendimientoPorMata ? ["rendimiento_por_mata = @rendimientoPorMata"] : []),
      ...(cropColumns.unidadRendimiento ? ["unidad_rendimiento = @unidadRendimiento"] : []),
      ...(cropColumns.fertilizantes ? ["fertilizantes = @fertilizantes"] : []),
      ...(cropColumns.abonos ? ["abonos = @abonos"] : []),
      ...(cropColumns.plagasComunes ? ["plagas_comunes = @plagasComunes"] : []),
      ...(cropColumns.mejoresMeses ? ["mejores_meses = @mejoresMeses"] : []),
    ]

    await query(
      `UPDATE Cultivos
       SET ${updateSet.join(", ")}
       WHERE id_cultivo = @id`,
      {
        id,
        nombre,
        variedad: variedad || "",
        invernaderoId: Number(invernaderoId),
        umbralHumedad: parseNullableDecimal(umbral_humedad),
        umbralTemperatura: parseNullableDecimal(umbral_temperatura),
        umbralPh: parseNullableDecimal(umbral_ph),
        umbralEc: parseNullableDecimal(umbral_ec),
        umbralTds: parseNullableDecimal(umbral_tds),
        ...catalogData,
      }
    )

    await savePerfilAgronomico(id, perfilAgronomico)
    await upsertCatalogCrop({
      nombre,
      variedad,
      umbralHumedad: parseNullableDecimal(umbral_humedad),
      umbralTemperatura: parseNullableDecimal(umbral_temperatura),
      umbralPh: parseNullableDecimal(umbral_ph),
      umbralEc: parseNullableDecimal(umbral_ec),
      umbralTds: parseNullableDecimal(umbral_tds),
      perfilAgronomico,
    })

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

    await query(
      `DELETE f
       FROM CultivoFertilizacionEtapa f
       INNER JOIN CultivoPerfilAgronomico p ON p.id_perfil = f.id_perfil
       WHERE p.id_cultivo = @id`,
      { id }
    )

    await query(
      `DELETE m
       FROM CultivoManejoEtapa m
       INNER JOIN CultivoPerfilAgronomico p ON p.id_perfil = m.id_perfil
       WHERE p.id_cultivo = @id`,
      { id }
    )

    await query(
      `DELETE s
       FROM CultivoPlagasEnfermedades s
       INNER JOIN CultivoPerfilAgronomico p ON p.id_perfil = s.id_perfil
       WHERE p.id_cultivo = @id`,
      { id }
    )

    await query("DELETE FROM CultivoPerfilAgronomico WHERE id_cultivo = @id", { id })

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
