import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"
import { getAllCultivos } from "@/lib/cultivos-rd-data"

export const dynamic = "force-dynamic"

function parsePositiveNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function calculateYield(cantidadKg: number, perdidaKg: number, areaM2: number) {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return 0
  return Math.max(0, (cantidadKg - perdidaKg) / areaM2)
}

function normalizeCropName(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

function getIdealYieldForCrop(cropName: unknown) {
  const normalized = normalizeCropName(cropName)
  if (!normalized) return 0

  const crop = getAllCultivos().find((item) => normalizeCropName(item.nombre) === normalized)
  return Number(crop?.rendimiento_kg_m2) || 0
}

function normalizeDate(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

async function hasHarvestZoneColumn() {
  const rows = await query<Array<{ exists: number }>>(
    `SELECT CASE WHEN COL_LENGTH('Cosechas', 'id_zona') IS NULL THEN 0 ELSE 1 END AS [exists]`
  )

  return Number(rows[0]?.exists) === 1
}

async function resolveDetailId(value: unknown, date: string) {
  const raw = String(value || "")
  if (raw.startsWith("crop:")) {
    const cropId = Number(raw.replace("crop:", ""))
    if (!cropId) return 0

    const inserted = await execute(
      `INSERT INTO CultivoDetalle (id_cultivo, fecha_siembra, variedad, notas)
       OUTPUT INSERTED.id_detalle
       SELECT
         c.id_cultivo,
         COALESCE(c.fecha_siembra, TRY_CONVERT(date, @date), CAST(GETDATE() AS date)),
         ISNULL(c.variedad, ''),
         'Detalle creado para registro de cosecha'
       FROM Cultivos c
       WHERE c.id_cultivo = @cropId`,
      { cropId, date }
    )

    return Number(inserted.recordset?.[0]?.id_detalle || 0)
  }

  return Number(value) || 0
}

async function resolveDetailIdFromZone(zoneId: number, date: string, empresaId: number) {
  const zoneRows = await query<Record<string, unknown>[]>(
    `SELECT TOP 1
       z.id_zona,
       z.id_invernadero,
       z.tipo_cultivo,
       z.fecha_siembra,
       z.fecha_cosecha_estimada,
       z.tiempo_germinacion_dias,
       z.tiempo_crecimiento_dias,
       z.tiempo_cosecha_dias,
       z.notas_cultivo
     FROM ZonasRiego z
     INNER JOIN Invernaderos i ON i.id_invernadero = z.id_invernadero
     WHERE z.id_zona = @zoneId
       AND i.id_empresa = @empresaId`,
    { zoneId, empresaId }
  )
  const zone = zoneRows[0]
  if (!zone) return 0

  const cropRows = await query<Record<string, unknown>[]>(
    `SELECT TOP 1 id_cultivo, variedad
     FROM Cultivos
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
     FROM CultivoDetalle
     WHERE id_cultivo = @cropId
     ORDER BY id_detalle DESC`,
    { cropId: Number(crop.id_cultivo) }
  )
  if (detailRows[0]?.id_detalle != null) {
    return Number(detailRows[0].id_detalle)
  }

  const inserted = await execute(
    `INSERT INTO CultivoDetalle (
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
      notas: zone.notas_cultivo || "Detalle creado desde zona de riego para registro de cosecha",
    }
  )

  return Number(inserted.recordset?.[0]?.id_detalle || 0)
}

async function getZoneArea(zoneId: number, empresaId: number) {
  const rows = await query<Array<{ areaM2: number | null }>>(
    `SELECT TOP 1 z.area_m2 AS areaM2
     FROM ZonasRiego z
     INNER JOIN Invernaderos i ON i.id_invernadero = z.id_invernadero
     WHERE z.id_zona = @zoneId
       AND i.id_empresa = @empresaId`,
    { zoneId, empresaId }
  )

  return Number(rows[0]?.areaM2) || 0
}

async function getHarvestById(id: number, empresaId: number, hasZona: boolean) {
  const rows = await query<Record<string, unknown>[]>(
    `SELECT TOP 1
       co.id_cosecha AS id,
       co.id_detalle AS idDetalle,
       ${hasZona ? "co.id_zona" : "NULL"} AS idZona,
       CONVERT(char(10), co.fecha_cosecha, 23) AS fechaCosecha,
       co.cantidad_cosechada_kg AS cantidadCosechadaKg,
       co.cantidad_unidades AS cantidadUnidades,
       co.unidad_cosecha AS unidadCosecha,
       co.calidad,
       co.rendimiento_m2 AS rendimientoM2,
       co.perdida_kg AS perdidaKg,
       co.observaciones,
       co.registrado_por AS registradoPor,
       co.fecha_registro AS fechaRegistro,
       c.nombre AS cultivoNombre,
       ISNULL(cd.variedad, c.variedad) AS variedad,
       i.nombre AS invernaderoNombre,
       ${hasZona ? "z.nombre" : "NULL"} AS zonaNombre
     FROM Cosechas co
     INNER JOIN CultivoDetalle cd ON cd.id_detalle = co.id_detalle
     INNER JOIN Cultivos c ON c.id_cultivo = cd.id_cultivo
     ${hasZona ? "LEFT JOIN ZonasRiego z ON z.id_zona = co.id_zona" : ""}
     INNER JOIN Invernaderos i ON i.id_invernadero = c.id_invernadero
     WHERE co.id_cosecha = @id
       AND i.id_empresa = @empresaId`,
    { id, empresaId }
  )

  return rows[0] || null
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get("mode")
    const greenhouse = searchParams.get("greenhouse")
    const hasZona = await hasHarvestZoneColumn()

    if (mode === "zones") {
      const params: Record<string, unknown> = { empresaId: session.empresaId }
      let where = "WHERE i.id_empresa = @empresaId"
      if (greenhouse) {
        where += " AND z.id_invernadero = @greenhouseId"
        params.greenhouseId = Number(greenhouse)
      }

      const zones = await query<Record<string, unknown>[]>(
        `SELECT
           z.id_zona AS id,
           z.nombre,
           z.tipo_cultivo AS cultivoActual,
           i.nombre AS invernaderoNombre,
           ISNULL(z.area_m2, 0) AS areaM2,
           CONVERT(char(10), z.fecha_siembra, 23) AS fechaSiembra,
           CONVERT(char(10), z.fecha_cosecha_estimada, 23) AS fechaCosechaEstimada
         FROM ZonasRiego z
         INNER JOIN Invernaderos i ON i.id_invernadero = z.id_invernadero
         ${where}
         ORDER BY z.nombre ASC`,
        params
      )

      return NextResponse.json(zones.map((zone) => {
        const areaM2 = Number(zone.areaM2) || 0
        const rendimientoIdealM2 = getIdealYieldForCrop(zone.cultivoActual)

        return {
          id: String(zone.id),
          nombre: String(zone.nombre || ""),
          cultivoActual: String(zone.cultivoActual || ""),
          invernaderoNombre: String(zone.invernaderoNombre || ""),
          areaM2,
          rendimientoIdealM2,
          cosechaEsperadaKg: areaM2 * rendimientoIdealM2,
          fechaSiembra: zone.fechaSiembra ? String(zone.fechaSiembra) : "",
          fechaCosechaEstimada: zone.fechaCosechaEstimada ? String(zone.fechaCosechaEstimada) : "",
        }
      }))
    }

    if (mode === "details") {
      const params: Record<string, unknown> = { empresaId: session.empresaId }
      let where = "WHERE i.id_empresa = @empresaId"
      if (greenhouse) {
        where += " AND c.id_invernadero = @greenhouseId"
        params.greenhouseId = Number(greenhouse)
      }

      const details = await query<Record<string, unknown>[]>(
        `SELECT
           COALESCE(CONVERT(nvarchar(30), cd.id_detalle), CONCAT('crop:', c.id_cultivo)) AS id,
           c.nombre AS cultivoNombre,
           ISNULL(cd.variedad, c.variedad) AS variedad,
           i.nombre AS invernaderoNombre,
           CONVERT(char(10), cd.fecha_siembra, 23) AS fechaSiembra,
           CONVERT(char(10), cd.fecha_cosecha_estimada, 23) AS fechaCosechaEstimada
         FROM Cultivos c
         OUTER APPLY (
           SELECT TOP 1 *
           FROM CultivoDetalle detail
           WHERE detail.id_cultivo = c.id_cultivo
           ORDER BY detail.id_detalle DESC
         ) cd
         INNER JOIN Invernaderos i ON i.id_invernadero = c.id_invernadero
         ${where}
         ORDER BY COALESCE(cd.id_detalle, c.id_cultivo) DESC`,
        params
      )

      return NextResponse.json(details.map((detail) => ({
        id: String(detail.id),
        cultivoNombre: String(detail.cultivoNombre || ""),
        variedad: String(detail.variedad || ""),
        invernaderoNombre: String(detail.invernaderoNombre || ""),
        fechaSiembra: detail.fechaSiembra ? String(detail.fechaSiembra) : "",
        fechaCosechaEstimada: detail.fechaCosechaEstimada ? String(detail.fechaCosechaEstimada) : "",
      })))
    }

    const params: Record<string, unknown> = { empresaId: session.empresaId }
    let where = "WHERE i.id_empresa = @empresaId"
    if (greenhouse) {
      where += ` AND ${hasZona ? "COALESCE(z.id_invernadero, c.id_invernadero)" : "c.id_invernadero"} = @greenhouseId`
      params.greenhouseId = Number(greenhouse)
    }

    const rows = await query<Record<string, unknown>[]>(
      `SELECT
         co.id_cosecha AS id,
         co.id_detalle AS idDetalle,
         ${hasZona ? "co.id_zona" : "NULL"} AS idZona,
         CONVERT(char(10), co.fecha_cosecha, 23) AS fechaCosecha,
         co.cantidad_cosechada_kg AS cantidadCosechadaKg,
         co.cantidad_unidades AS cantidadUnidades,
         co.unidad_cosecha AS unidadCosecha,
         co.calidad,
         co.rendimiento_m2 AS rendimientoM2,
         co.perdida_kg AS perdidaKg,
         co.observaciones,
         co.registrado_por AS registradoPor,
         co.fecha_registro AS fechaRegistro,
         c.nombre AS cultivoNombre,
         ISNULL(cd.variedad, c.variedad) AS variedad,
         i.nombre AS invernaderoNombre,
         ${hasZona ? "z.nombre" : "NULL"} AS zonaNombre
       FROM Cosechas co
       INNER JOIN CultivoDetalle cd ON cd.id_detalle = co.id_detalle
       INNER JOIN Cultivos c ON c.id_cultivo = cd.id_cultivo
       ${hasZona ? "LEFT JOIN ZonasRiego z ON z.id_zona = co.id_zona" : ""}
       INNER JOIN Invernaderos i ON i.id_invernadero = c.id_invernadero
       ${where}
       ORDER BY co.fecha_cosecha DESC, co.id_cosecha DESC`,
      params
    )

    return NextResponse.json(rows.map((row) => ({
      id: String(row.id),
      idDetalle: String(row.idDetalle),
      idZona: row.idZona != null ? String(row.idZona) : "",
      fechaCosecha: row.fechaCosecha ? String(row.fechaCosecha) : "",
      cantidadCosechadaKg: Number(row.cantidadCosechadaKg) || 0,
      cantidadUnidades: Number(row.cantidadUnidades) || 0,
      unidadCosecha: String(row.unidadCosecha || ""),
      calidad: String(row.calidad || ""),
      rendimientoM2: Number(row.rendimientoM2) || 0,
      perdidaKg: Number(row.perdidaKg) || 0,
      observaciones: String(row.observaciones || ""),
      registradoPor: row.registradoPor != null ? String(row.registradoPor) : "",
      fechaRegistro: row.fechaRegistro ? String(row.fechaRegistro) : "",
      cultivoNombre: String(row.cultivoNombre || ""),
      variedad: String(row.variedad || ""),
      invernaderoNombre: String(row.invernaderoNombre || ""),
      zonaNombre: String(row.zonaNombre || ""),
    })))
  } catch (err) {
    console.error("[harvests] GET Error:", err)
    return NextResponse.json({ error: "No se pudieron cargar las cosechas" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    if (session.rol === "agricultor") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const body = await req.json()
    const fechaCosecha = normalizeDate(body.fechaCosecha ?? body.fecha_cosecha)
    const idZona = Number(body.idZona ?? body.id_zona) || 0

    if (!idZona || !fechaCosecha) {
      return NextResponse.json({ error: "Zona de riego y fecha de cosecha requeridas" }, { status: 400 })
    }
    const idDetalle = await resolveDetailIdFromZone(idZona, fechaCosecha, session.empresaId)
    if (!idDetalle) {
      return NextResponse.json({ error: "No se pudo resolver el cultivo asignado a la zona" }, { status: 400 })
    }
    const hasZona = await hasHarvestZoneColumn()
    const cantidadCosechadaKg = parsePositiveNumber(body.cantidadCosechadaKg ?? body.cantidad_cosechada_kg)
    const cantidadUnidades = parsePositiveNumber(body.cantidadUnidades ?? body.cantidad_unidades)
    const unidadCosecha = String(body.unidadCosecha ?? body.unidad_cosecha ?? "").trim()
    const perdidaKg = parsePositiveNumber(body.perdidaKg ?? body.perdida_kg)
    const areaM2 = await getZoneArea(idZona, session.empresaId)
    const rendimientoM2 = calculateYield(cantidadCosechadaKg, perdidaKg, areaM2)
    const insertColumns = [
      "id_detalle",
      ...(hasZona ? ["id_zona"] : []),
      "fecha_cosecha",
      "cantidad_cosechada_kg",
      "cantidad_unidades",
      "unidad_cosecha",
      "calidad",
      "rendimiento_m2",
      "perdida_kg",
      "observaciones",
      "registrado_por",
      "fecha_registro",
    ]
    const insertValues = [
      "@idDetalle",
      ...(hasZona ? ["@idZona"] : []),
      "@fechaCosecha",
      "@cantidadCosechadaKg",
      "@cantidadUnidades",
      "@unidadCosecha",
      "@calidad",
      "@rendimientoM2",
      "@perdidaKg",
      "@observaciones",
      "@registradoPor",
      "GETDATE()",
    ]

    const result = await execute(
      `INSERT INTO Cosechas (${insertColumns.join(", ")})
       OUTPUT INSERTED.id_cosecha
       VALUES (${insertValues.join(", ")})`,
      {
        idDetalle,
        idZona,
        fechaCosecha,
        cantidadCosechadaKg,
        cantidadUnidades,
        unidadCosecha,
        calidad: body.calidad || "",
        rendimientoM2,
        perdidaKg,
        observaciones: body.observaciones || "",
        registradoPor: session.userId,
      }
    )

    const newId = Number(result.recordset?.[0]?.id_cosecha || 0)
    await registrarBitacora({
      session,
      req,
      descripcion: `Se registro la cosecha ${newId}`,
      modulo: "cosechas",
      entidad: "Cosechas",
      entidadId: newId,
      accion: "CREATE",
      valorNuevo: body,
    })

    return NextResponse.json({ ok: true, id: String(newId) }, { status: 201 })
  } catch (err) {
    console.error("[harvests] POST Error:", err)
    return NextResponse.json({ error: "No se pudo registrar la cosecha" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAuth()
    if (session.rol === "agricultor") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const body = await req.json()
    const id = Number(body.id)
    const fechaCosecha = normalizeDate(body.fechaCosecha ?? body.fecha_cosecha)
    const idZona = Number(body.idZona ?? body.id_zona) || 0

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }
    if (!idZona || !fechaCosecha) {
      return NextResponse.json({ error: "Zona de riego y fecha de cosecha requeridas" }, { status: 400 })
    }
    const idDetalle = await resolveDetailIdFromZone(idZona, fechaCosecha, session.empresaId)
    if (!idDetalle) {
      return NextResponse.json({ error: "No se pudo resolver el cultivo asignado a la zona" }, { status: 400 })
    }

    const hasZona = await hasHarvestZoneColumn()
    const cantidadCosechadaKg = parsePositiveNumber(body.cantidadCosechadaKg ?? body.cantidad_cosechada_kg)
    const cantidadUnidades = parsePositiveNumber(body.cantidadUnidades ?? body.cantidad_unidades)
    const unidadCosecha = String(body.unidadCosecha ?? body.unidad_cosecha ?? "").trim()
    const perdidaKg = parsePositiveNumber(body.perdidaKg ?? body.perdida_kg)
    const areaM2 = await getZoneArea(idZona, session.empresaId)
    const rendimientoM2 = calculateYield(cantidadCosechadaKg, perdidaKg, areaM2)
    const previous = await getHarvestById(id, session.empresaId, hasZona)
    if (!previous) {
      return NextResponse.json({ error: "Cosecha no encontrada para esta empresa" }, { status: 404 })
    }

    await execute(
      `UPDATE Cosechas
       SET id_detalle = @idDetalle,
           ${hasZona ? "id_zona = @idZona," : ""}
           fecha_cosecha = @fechaCosecha,
           cantidad_cosechada_kg = @cantidadCosechadaKg,
           cantidad_unidades = @cantidadUnidades,
           unidad_cosecha = @unidadCosecha,
           calidad = @calidad,
           rendimiento_m2 = @rendimientoM2,
           perdida_kg = @perdidaKg,
           observaciones = @observaciones
       WHERE id_cosecha = @id`,
      {
        id,
        idDetalle,
        idZona,
        fechaCosecha,
        cantidadCosechadaKg,
        cantidadUnidades,
        unidadCosecha,
        calidad: body.calidad || "",
        rendimientoM2,
        perdidaKg,
        observaciones: body.observaciones || "",
      }
    )

    await registrarBitacora({
      session,
      req,
      descripcion: `Se actualizo la cosecha ${id}`,
      modulo: "cosechas",
      entidad: "Cosechas",
      entidadId: id,
      accion: "UPDATE",
      valorAnterior: previous,
      valorNuevo: body,
    })

    return NextResponse.json({ ok: true, id: String(id) })
  } catch (err) {
    console.error("[harvests] PUT Error:", err)
    return NextResponse.json({ error: "No se pudo actualizar la cosecha" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    if (session.rol === "agricultor") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const body = await req.json()
    const id = Number(body.id)
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const hasZona = await hasHarvestZoneColumn()
    const previous = await getHarvestById(id, session.empresaId, hasZona)
    if (!previous) {
      return NextResponse.json({ error: "Cosecha no encontrada para esta empresa" }, { status: 404 })
    }

    await execute("DELETE FROM Cosechas WHERE id_cosecha = @id", { id })
    await registrarBitacora({
      session,
      req,
      descripcion: `Se elimino la cosecha ${id}`,
      modulo: "cosechas",
      entidad: "Cosechas",
      entidadId: id,
      accion: "DELETE",
      valorAnterior: previous,
      severidad: "advertencia",
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[harvests] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar la cosecha" }, { status: 500 })
  }
}
