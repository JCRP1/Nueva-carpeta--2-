import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { cultivosRDData, getAllCultivos, getPerfilAgronomico } from "@/lib/cultivos-rd-data"

type EtapaCultivo = "germinacion" | "crecimiento" | "cosecha"

const ETAPAS: EtapaCultivo[] = ["germinacion", "crecimiento", "cosecha"]

type PerfilBase = {
  idPerfil?: number
  idCultivo?: number
  cultivoNombre?: string
  variedad?: string | null
  densidadPlantasM2?: string | null
  sustratoSuelo?: string | null
  observaciones?: string | null
}

type FertilizacionRow = {
  etapa: string
  recomendacion: string
  npk?: string | null
  calcio?: string | null
  magnesio?: string | null
  micronutrientes?: string | null
  ecObjetivo?: number | null
  phObjetivo?: number | null
  frecuenciaDias?: number | null
}

type ManejoRow = {
  etapa: string
  recomendacion: string
  labores?: string | null
}

type SanidadRow = {
  nombre: string
  tipo: string
  etapaRiesgo?: string | null
  sintomas?: string | null
  prevencion?: string | null
  accionRecomendada?: string | null
  nivelRiesgo?: string | null
}

function normalizeEtapa(value?: string | null): EtapaCultivo | null {
  const etapa = value?.trim().toLowerCase()
  return ETAPAS.includes(etapa as EtapaCultivo) ? (etapa as EtapaCultivo) : null
}

function emptyEtapas<T>() {
  return {
    germinacion: null,
    crecimiento: null,
    cosecha: null,
  } as Record<EtapaCultivo, T | null>
}

function getLocalPerfil(nombre: string) {
  const perfil = getPerfilAgronomico(nombre)
  if (!perfil) return null

  return {
    fuente: "catalogo",
    cultivoNombre: nombre,
    densidadPlantasM2: perfil.densidadPlantasM2,
    sustratoSuelo: perfil.sustratoSuelo,
    fertilizacion: perfil.fertilizacion,
    manejo: perfil.manejo,
    sanidad: perfil.sanidad,
    plagas: perfil.sanidad.map((nombrePlaga) => ({
      nombre: nombrePlaga,
      tipo: "referencia",
      nivelRiesgo: null,
    })),
  }
}

async function getDbPerfil(nombre: string) {
  const perfiles = await query<PerfilBase[]>(
    `
      SELECT TOP 1
        p.id_perfil AS idPerfil,
        p.id_cultivo AS idCultivo,
        c.nombre AS cultivoNombre,
        c.variedad,
        p.densidad_plantas_m2 AS densidadPlantasM2,
        p.sustrato_suelo AS sustratoSuelo,
        p.observaciones
      FROM dbo.CultivoPerfilAgronomico p
      INNER JOIN dbo.Cultivos c ON c.id_cultivo = p.id_cultivo
      WHERE LOWER(LTRIM(RTRIM(c.nombre))) = LOWER(LTRIM(RTRIM(@nombre)))
      ORDER BY
        p.fecha_actualizacion DESC,
        p.fecha_creacion DESC,
        p.id_perfil DESC
    `,
    { nombre }
  )

  const perfil = perfiles[0]
  if (!perfil?.idPerfil) return null

  const [fertilizacionRows, manejoRows, sanidadRows] = await Promise.all([
    query<FertilizacionRow[]>(
      `
        SELECT
          etapa,
          recomendacion,
          npk,
          calcio,
          magnesio,
          micronutrientes,
          ec_objetivo AS ecObjetivo,
          ph_objetivo AS phObjetivo,
          frecuencia_dias AS frecuenciaDias
        FROM dbo.CultivoFertilizacionEtapa
        WHERE id_perfil = @idPerfil
        ORDER BY CASE etapa WHEN 'germinacion' THEN 1 WHEN 'crecimiento' THEN 2 WHEN 'cosecha' THEN 3 ELSE 4 END
      `,
      { idPerfil: perfil.idPerfil }
    ),
    query<ManejoRow[]>(
      `
        SELECT etapa, recomendacion, labores
        FROM dbo.CultivoManejoEtapa
        WHERE id_perfil = @idPerfil
        ORDER BY CASE etapa WHEN 'germinacion' THEN 1 WHEN 'crecimiento' THEN 2 WHEN 'cosecha' THEN 3 ELSE 4 END
      `,
      { idPerfil: perfil.idPerfil }
    ),
    query<SanidadRow[]>(
      `
        SELECT
          nombre,
          tipo,
          etapa_riesgo AS etapaRiesgo,
          sintomas,
          prevencion,
          accion_recomendada AS accionRecomendada,
          nivel_riesgo AS nivelRiesgo
        FROM dbo.CultivoPlagasEnfermedades
        WHERE id_perfil = @idPerfil
        ORDER BY CASE nivel_riesgo WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 WHEN 'medio' THEN 3 WHEN 'bajo' THEN 4 ELSE 5 END, nombre
      `,
      { idPerfil: perfil.idPerfil }
    ),
  ])

  const fertilizacion = emptyEtapas<Record<string, unknown>>()
  const manejo = emptyEtapas<Record<string, unknown>>()

  fertilizacionRows.forEach((row) => {
    const etapa = normalizeEtapa(row.etapa)
    if (!etapa) return
    fertilizacion[etapa] = {
      recomendacion: row.recomendacion,
      npk: row.npk,
      calcio: row.calcio,
      magnesio: row.magnesio,
      micronutrientes: row.micronutrientes,
      ecObjetivo: row.ecObjetivo,
      phObjetivo: row.phObjetivo,
      frecuenciaDias: row.frecuenciaDias,
    }
  })

  manejoRows.forEach((row) => {
    const etapa = normalizeEtapa(row.etapa)
    if (!etapa) return
    manejo[etapa] = {
      recomendacion: row.recomendacion,
      labores: row.labores,
    }
  })

  return {
    fuente: "base_datos",
    ...perfil,
    fertilizacion,
    manejo,
    sanidad: sanidadRows.map((row) => row.nombre),
    plagas: sanidadRows,
  }
}

async function resolvePerfil(nombre: string) {
  try {
    const perfilDb = await getDbPerfil(nombre)
    if (perfilDb) return perfilDb
  } catch (error) {
    console.warn("[cultivosRD] Perfil SQL no disponible, usando catalogo local:", error)
  }

  return getLocalPerfil(nombre)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const categoria = searchParams.get("categoria")
  const nombre = searchParams.get("nombre")
  const mode = searchParams.get("mode")
  const includePerfil = searchParams.get("includePerfil") === "true"

  if (mode === "perfil") {
    if (!nombre) return NextResponse.json({ error: "Nombre de cultivo requerido" }, { status: 400 })

    const perfil = await resolvePerfil(nombre)
    if (!perfil) return NextResponse.json({ error: "Perfil agronomico no encontrado" }, { status: 404 })
    return NextResponse.json(perfil)
  }

  if (nombre) {
    const cultivo = getAllCultivos().find((c) => c.nombre.toLowerCase() === nombre.toLowerCase())
    if (!cultivo) return NextResponse.json({ error: "Cultivo no encontrado" }, { status: 404 })
    if (includePerfil) {
      return NextResponse.json({
        ...cultivo,
        perfilAgronomico: await resolvePerfil(nombre),
      })
    }
    return NextResponse.json(cultivo)
  }

  if (categoria) {
    const filtered = cultivosRDData.find((c) => c.categoria.toLowerCase() === categoria.toLowerCase())
    if (!filtered) return NextResponse.json({ error: "Categoria no encontrada" }, { status: 404 })
    return NextResponse.json(filtered)
  }

  return NextResponse.json(cultivosRDData)
}
