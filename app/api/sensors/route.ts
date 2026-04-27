import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"
import { getSensorZoneColumn } from "@/lib/sensor-zone-column"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const gh = searchParams.get("greenhouse")
    const sensorZoneColumn = await getSensorZoneColumn()

    let sqlText = `
      SELECT
        s.id_sensor AS id,
        s.tipo,
        COALESCE(s.ubicacion_fisica, s.tipo + ' ' + CAST(s.id_sensor AS VARCHAR)) AS nombre,
        s.id_invernadero AS invernaderoId,
        s.id_dispositivo AS idDispositivo,
        s.estado,
        s.id_marca AS idMarca,
        s.id_modelo AS idModelo,
        ma.nombre AS marca,
        s.unidad_medida AS unidadMedida,
        s.rango_min AS rangoMin,
        s.rango_max AS rangoMax,
        s.precision,
        s.fecha_instalacion AS fechaInstalacion,
        s.ubicacion_fisica AS ubicacionFisica,
        s.ultimo_calibrado AS ultimoCalibrado,
        s.observaciones,
        s.unidad_medida AS unidad,
        s.rango_min AS umbralMin,
        s.rango_max AS umbralMax
        ${sensorZoneColumn ? `, s.${sensorZoneColumn} AS zonaRiegoId` : ""}
      FROM Sensores s
      LEFT JOIN Marcas ma ON ma.id_marca = s.id_marca
    `
    const params: Record<string, unknown> = {}
    if (gh) {
      sqlText += " WHERE s.id_invernadero = @gh"
      params.gh = Number(gh)
    } else {
      sqlText += ` WHERE s.id_invernadero IN (
        SELECT id_invernadero FROM Invernaderos WHERE id_empresa = @empresaId
      )`
      params.empresaId = session.empresaId
    }

    const sensors = (await query(sqlText, params)) as Record<string, unknown>[]

    const result = await Promise.all(
      sensors.map(async (s) => {
        const latestRows = (await query(
          `SELECT TOP 1 valor, unidad, fecha_hora
           FROM LecturasSensores
           WHERE id_sensor = @sensorId
           ORDER BY fecha_hora DESC`,
          { sensorId: s.id }
        )) as Record<string, unknown>[]

        const latest = latestRows[0]

        const historyRows = (await query(
          `SELECT TOP 48 valor, fecha_hora AS timestamp
           FROM LecturasSensores
           WHERE id_sensor = @sensorId
           ORDER BY fecha_hora DESC`,
          { sensorId: s.id }
        )) as Record<string, unknown>[]

        return {
          id: String(s.id),
          tipo: s.tipo,
          nombre: s.nombre,
          invernaderoId: String(s.invernaderoId),
          zonaRiegoId: s.zonaRiegoId != null ? String(s.zonaRiegoId) : "",
          estado: s.estado || "activo",
          idMarca: s.idMarca != null ? String(s.idMarca) : undefined,
          idModelo: s.idModelo != null ? String(s.idModelo) : undefined,
          marca: (s.marca as string) || undefined,
          ubicacionFisica: (s.ubicacionFisica as string) || undefined,
          rangoMin: s.rangoMin != null ? Number(s.rangoMin) : undefined,
          rangoMax: s.rangoMax != null ? Number(s.rangoMax) : undefined,
          unidadMedida: (s.unidadMedida as string) || undefined,
          precision: s.precision != null ? Number(s.precision) : undefined,
          fechaInstalacion: (s.fechaInstalacion as string) || undefined,
          ultimoCalibrado: (s.ultimoCalibrado as string) || undefined,
          observaciones: (s.observaciones as string) || undefined,
          idDispositivo: s.idDispositivo != null ? Number(s.idDispositivo) : undefined,
          ultimaLectura: latest ? Number(latest.valor) : undefined,
          unidad: (latest?.unidad as string) || (s.unidad as string) || "",
          umbralMin: Number(s.umbralMin) || 0,
          umbralMax: Number(s.umbralMax) || 100,
          ultimoReporte: latest ? latest.fecha_hora : undefined,
          history: historyRows.reverse().map((h) => ({
            timestamp: h.timestamp,
            valor: Number(h.valor),
          })),
        }
      })
    )

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error("[SENSORS API] GET Error:", err)
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
return NextResponse.json({ error: "No autorizado", details: errorMessage }, { status: 401 })
  }
}

/* =========================
   CREAR
 ========================= */

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    const {
      tipo,
      idMarca,
      idModelo,
      estado,
      rangoMin,
      rangoMax,
      unidadMedida,
      precision,
      fechaInstalacion,
      ubicacionFisica,
      ultimoCalibrado,
      observaciones,
      idInvernadero,
      idDispositivo,
      idZona,
      zonaRiegoId,
    } = body

    if (!tipo || !idInvernadero) {
      return NextResponse.json({ error: "Tipo e invernadero requeridos" }, { status: 400 })
    }

    const sensorZoneColumn = await getSensorZoneColumn()
    const resolvedZoneId = idZona ?? zonaRiegoId
    const insertColumns = [
      "tipo",
      "id_invernadero",
      "id_marca",
      "id_modelo",
      "estado",
      "rango_min",
      "rango_max",
      "unidad_medida",
      "precision",
      "fecha_instalacion",
      "ubicacion_fisica",
      "ultimo_calibrado",
      "observaciones",
      "id_dispositivo",
    ]
    const insertValues = [
      "@tipo",
      "@idInvernadero",
      "@idMarca",
      "@idModelo",
      "@estado",
      "@rangoMin",
      "@rangoMax",
      "@unidadMedida",
      "@precision",
      "@fechaInstalacion",
      "@ubicacionFisica",
      "@ultimoCalibrado",
      "@observaciones",
      "@idDispositivo",
    ]

    if (sensorZoneColumn) {
      insertColumns.push(sensorZoneColumn)
      insertValues.push("@idZona")
    }

    const result = (await query(
      `INSERT INTO Sensores 
       (${insertColumns.join(", ")})
       VALUES (${insertValues.join(", ")});
       SELECT SCOPE_IDENTITY() AS id;`,
      {
        tipo,
        idInvernadero: Number(idInvernadero),
        idMarca: idMarca ? Number(idMarca) : null,
        idModelo: idModelo ? Number(idModelo) : null,
        estado: estado || "activo",
        rangoMin: rangoMin ?? null,
        rangoMax: rangoMax ?? null,
        unidadMedida: unidadMedida || null,
        precision: precision ?? null,
        fechaInstalacion: fechaInstalacion || null,
        ubicacionFisica: ubicacionFisica || null,
        ultimoCalibrado: ultimoCalibrado || null,
        observaciones: observaciones || null,
        idDispositivo: idDispositivo ? Number(idDispositivo) : null,
        idZona: resolvedZoneId ? Number(resolvedZoneId) : null,
      }
    )) as Record<string, unknown>[]

    const newId = result[0]?.id

    return NextResponse.json({ ok: true, id: newId })
  } catch (err) {
    console.error("[SENSORS API] POST Error:", err)
    return NextResponse.json({ error: "No se pudo crear el sensor" }, { status: 500 })
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
      tipo,
      estado,
      idMarca,
      idModelo,
      rangoMin,
      rangoMax,
      unidadMedida,
      precision,
      fechaInstalacion,
      ubicacionFisica,
      ultimoCalibrado,
      observaciones,
      idInvernadero,
      idDispositivo,
      umbralMin,
      umbralMax,
      idZona,
      zonaRiegoId,
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const sensorZoneColumn = await getSensorZoneColumn()
    const existingRows = (await query(
      `SELECT
        s.id_sensor AS id,
        s.id_invernadero AS idInvernadero,
        s.id_dispositivo AS idDispositivo,
        ${sensorZoneColumn ? `s.${sensorZoneColumn} AS idZona,` : ""}
        s.tipo,
        s.id_marca AS idMarca,
        s.id_modelo AS idModelo,
        s.estado,
        s.rango_min AS rangoMin,
        s.rango_max AS rangoMax,
        s.unidad_medida AS unidadMedida,
        s.precision,
        s.fecha_instalacion AS fechaInstalacion,
        s.ubicacion_fisica AS ubicacionFisica,
        s.ultimo_calibrado AS ultimoCalibrado,
        s.observaciones
       FROM Sensores s
       INNER JOIN Invernaderos i ON i.id_invernadero = s.id_invernadero
       WHERE s.id_sensor = @id AND i.id_empresa = @empresaId`,
      { id: Number(id), empresaId: session.empresaId }
    )) as Record<string, unknown>[]

    const existing = existingRows[0]
    if (!existing) {
      return NextResponse.json({ error: "Sensor no encontrado" }, { status: 404 })
    }

const mergedRangoMin = rangoMin !== undefined ? rangoMin : umbralMin
    const mergedRangoMax = rangoMax !== undefined ? rangoMax : umbralMax
    const mergedZonaId = idZona !== undefined ? idZona : zonaRiegoId

    const newUltimoCalibrado = ultimoCalibrado !== undefined ? ultimoCalibrado : existing.ultimoCalibrado

    const updateSetClauses = [
      "id_invernadero = @idInvernadero",
      "id_dispositivo = @idDispositivo",
      "tipo = @tipo",
      "id_marca = @idMarca",
      "id_modelo = @idModelo",
      "estado = @estado",
      "rango_min = @rangoMin",
      "rango_max = @rangoMax",
      "unidad_medida = @unidadMedida",
      "precision = @precision",
      "fecha_instalacion = @fechaInstalacion",
      "ubicacion_fisica = @ubicacionFisica",
      "ultimo_calibrado = @ultimoCalibrado",
      "observaciones = @observaciones",
    ]

    if (sensorZoneColumn) {
      updateSetClauses.push(`${sensorZoneColumn} = @idZona`)
    }

    await query(
      `UPDATE Sensores
       SET
        ${updateSetClauses.join(",\n        ")}
       WHERE id_sensor = @id`,
      {
        id: Number(id),
        idInvernadero: idInvernadero !== undefined ? Number(idInvernadero) : Number(existing.idInvernadero),
        idDispositivo: idDispositivo !== undefined
          ? (idDispositivo ? Number(idDispositivo) : null)
          : (existing.idDispositivo != null ? Number(existing.idDispositivo) : null),
        tipo: tipo !== undefined ? tipo : existing.tipo,
        idMarca: idMarca !== undefined ? (idMarca ? Number(idMarca) : null) : (existing.idMarca != null ? Number(existing.idMarca) : null),
        idModelo: idModelo !== undefined ? (idModelo ? Number(idModelo) : null) : (existing.idModelo != null ? Number(existing.idModelo) : null),
        estado: estado !== undefined ? estado : existing.estado,
        rangoMin: mergedRangoMin !== undefined ? mergedRangoMin : existing.rangoMin,
        rangoMax: mergedRangoMax !== undefined ? mergedRangoMax : existing.rangoMax,
        unidadMedida: unidadMedida !== undefined ? unidadMedida : existing.unidadMedida,
        precision: precision !== undefined ? precision : existing.precision,
        fechaInstalacion: fechaInstalacion !== undefined ? fechaInstalacion : existing.fechaInstalacion,
        ubicacionFisica: ubicacionFisica !== undefined ? ubicacionFisica : existing.ubicacionFisica,
        ultimoCalibrado: newUltimoCalibrado,
        observaciones: observaciones !== undefined ? observaciones : existing.observaciones,
        idZona: mergedZonaId !== undefined
          ? (mergedZonaId ? Number(mergedZonaId) : null)
          : (existing.idZona != null ? Number(existing.idZona) : null),
      }
    )

    if (ultimoCalibrado !== undefined && ultimoCalibrado !== existing.ultimoCalibrado) {
      let userId: number | null = null
      const authUser = await requireAuth()
      userId = (authUser as { userId?: number }).userId || null

      await query(
        `INSERT INTO Bitacora 
         (id_dispositivo, descripcion, severidad, fecha, id_usuario, modulo, entidad, entidad_id, accion, valor_anterior, valor_nuevo, origen)
         VALUES (@idDispositivo, @descripcion, @severidad, GETDATE(), @idUsuario, @modulo, @entidad, @entidadId, @accion, @valorAnterior, @valorNuevo, @origen)`,
        {
          idDispositivo: existing.idDispositivo != null ? Number(existing.idDispositivo) : null,
          descripcion: `Calibración del sensor ${existing.tipo} - Nueva fecha: ${ultimoCalibrado}`,
          severidad: "info",
          idUsuario: userId,
          modulo: "Sensores",
          entidad: "Sensor",
          entidadId: String(id),
          accion: "CALIBRACION",
          valorAnterior: existing.ultimoCalibrado || "Sin fecha anterior",
          valorNuevo: ultimoCalibrado,
          origen: "usuario",
        }
      )
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 })
  }
}
