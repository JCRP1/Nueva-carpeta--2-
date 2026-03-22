import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

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
          ultimaLectura: latest ? Number(latest.valor) : 0,
          unidad: (latest?.unidad as string) || (s.unidad as string) || "",
          umbralMin: Number(s.umbralMin) || 0,
          umbralMax: Number(s.umbralMax) || 100,
          ultimaActualizacion: latest
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
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 })
    }

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
        id,
        idInvernadero,
        idDispositivo: idDispositivo ? Number(idDispositivo) : null,
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
      }
    )

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 })
  }
}
