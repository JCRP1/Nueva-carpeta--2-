import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"
import { registrarBitacora } from "@/lib/bitacora"

/* =========================
   CREAR
========================= */

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()

    const {
      tipo,
      modelo,
      estado,
      marca,
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
    } = body

    if (!tipo || !idInvernadero) {
      return NextResponse.json({ error: "Tipo e invernadero requeridos" }, { status: 400 })
    }

    await query(
      `INSERT INTO Sensores
      (id_invernadero, id_dispositivo, tipo, modelo, estado, marca, rango_min, rango_max, unidad_medida, precision, fecha_instalacion, ubicacion_fisica, ultimo_calibrado, observaciones)
      VALUES
      (@idInvernadero, @idDispositivo, @tipo, @modelo, @estado, @marca, @rangoMin, @rangoMax, @unidadMedida, @precision, @fechaInstalacion, @ubicacionFisica, @ultimoCalibrado, @observaciones)`,
      {
        idInvernadero,
        idDispositivo: idDispositivo ? Number(idDispositivo) : null,
        tipo,
        modelo: modelo || null,
        estado: estado || "activo",
        marca: marca || null,
        rangoMin: rangoMin ?? null,
        rangoMax: rangoMax ?? null,
        unidadMedida: unidadMedida || null,
        precision: precision ?? null,
        fechaInstalacion: fechaInstalacion || null,
        ubicacionFisica: ubicacionFisica || null,
        ultimoCalibrado: ultimoCalibrado || null,
        observaciones: observaciones || null,
      }
    )

    await registrarBitacora({
      session,
      req,
      descripcion: `Se creo el sensor ${tipo}`,
      modulo: "sensores",
      entidad: "Sensores",
      accion: "CREATE",
      idDispositivo: idDispositivo ? Number(idDispositivo) : null,
      valorNuevo: body,
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo crear el sensor" }, { status: 500 })
  }
}

/* =========================
   LISTAR
========================= */

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const gh = searchParams.get("greenhouse")

    let sqlText = `
      SELECT
        s.id_sensor AS id,
        s.tipo,
        COALESCE(s.ubicacion_fisica, s.tipo + ' ' + CAST(s.id_sensor AS VARCHAR)) AS nombre,
        s.id_invernadero AS invernaderoId,
        s.id_dispositivo AS idDispositivo,
        s.estado,
        s.marca,
        s.modelo,
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
      FROM Sensores s
    `
    const params: Record<string, unknown> = {}
    if (gh) {
      sqlText += " WHERE s.id_invernadero = @gh"
      params.gh = Number(gh)
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
          zonaRiegoId: "",
          estado: s.estado || "activo",
          marca: s.marca || undefined,
          modelo: s.modelo || undefined,
          ubicacionFisica: s.ubicacionFisica || undefined,
          rangoMin: s.rangoMin != null ? Number(s.rangoMin) : undefined,
          rangoMax: s.rangoMax != null ? Number(s.rangoMax) : undefined,
          unidadMedida: s.unidadMedida || undefined,
          precision: s.precision != null ? Number(s.precision) : undefined,
          fechaInstalacion: s.fechaInstalacion || undefined,
          ultimoCalibrado: s.ultimoCalibrado || undefined,
          observaciones: s.observaciones || undefined,
          idDispositivo: s.idDispositivo != null ? Number(s.idDispositivo) : undefined,
          ultimaLectura: latest ? Number(latest.valor) : 0,
          unidad: (latest?.unidad as string) || (s.unidad as string) || "",
          umbralMin: Number(s.umbralMin) || 0,
          umbralMax: Number(s.umbralMax) || 100,
          ultimoReporte: latest
            ? (latest.fecha_hora as string)
            : new Date().toISOString(),
          history: historyRows.reverse().map((h) => ({
            timestamp: h.timestamp,
            valor: Number(h.valor),
          })),
        }
      })
    )

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
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
      modelo,
      estado,
      marca,
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
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

    const existingRows = (await query(
      `SELECT
        s.id_sensor AS id,
        s.id_invernadero AS idInvernadero,
        s.id_dispositivo AS idDispositivo,
        s.tipo,
        s.modelo,
        s.estado,
        s.marca,
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

    await query(
      `UPDATE Sensores
       SET
        id_invernadero = @idInvernadero,
        id_dispositivo = @idDispositivo,
        tipo = @tipo,
        modelo = @modelo,
        estado = @estado,
        marca = @marca,
        rango_min = @rangoMin,
        rango_max = @rangoMax,
        unidad_medida = @unidadMedida,
        precision = @precision,
        fecha_instalacion = @fechaInstalacion,
        ubicacion_fisica = @ubicacionFisica,
        ultimo_calibrado = @ultimoCalibrado,
        observaciones = @observaciones
      WHERE id_sensor = @id`,
      {
        id: Number(id),
        idInvernadero: idInvernadero !== undefined ? Number(idInvernadero) : Number(existing.idInvernadero),
        idDispositivo: idDispositivo !== undefined
          ? (idDispositivo ? Number(idDispositivo) : null)
          : (existing.idDispositivo != null ? Number(existing.idDispositivo) : null),
        tipo: tipo !== undefined ? tipo : existing.tipo,
        modelo: modelo !== undefined ? modelo : existing.modelo,
        estado: estado !== undefined ? estado : existing.estado,
        marca: marca !== undefined ? marca : existing.marca,
        rangoMin: mergedRangoMin !== undefined ? mergedRangoMin : existing.rangoMin,
        rangoMax: mergedRangoMax !== undefined ? mergedRangoMax : existing.rangoMax,
        unidadMedida: unidadMedida !== undefined ? unidadMedida : existing.unidadMedida,
        precision: precision !== undefined ? precision : existing.precision,
        fechaInstalacion: fechaInstalacion !== undefined ? fechaInstalacion : existing.fechaInstalacion,
        ubicacionFisica: ubicacionFisica !== undefined ? ubicacionFisica : existing.ubicacionFisica,
        ultimoCalibrado: ultimoCalibrado !== undefined ? ultimoCalibrado : existing.ultimoCalibrado,
        observaciones: observaciones !== undefined ? observaciones : existing.observaciones,
      }
    )

    await registrarBitacora({
      session,
      req,
      descripcion: `Se actualizo el sensor ${existing.tipo || id}`,
      modulo: "sensores",
      entidad: "Sensores",
      entidadId: id,
      accion: "UPDATE",
      idDispositivo: idDispositivo !== undefined
        ? (idDispositivo ? Number(idDispositivo) : null)
        : (existing.idDispositivo != null ? Number(existing.idDispositivo) : null),
      valorAnterior: existing,
      valorNuevo: body,
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 })
  }
}
