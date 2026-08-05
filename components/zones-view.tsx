"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Droplets,
  Play,
  Square,
  Clock,
  Sprout,
  Settings,
  Plus,
  Loader2,
  Lock,
  Thermometer,
  FlaskConical,
  TestTubes,
} from "lucide-react"
import type { UserRole } from "@/lib/greensense-data"
import { api, fetcher } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { Invernadero } from "@/lib/greensense-data"
import type { Cultivo } from "@/lib/greensense-data"
import { getAllCultivos, getPerfilAgronomico } from "@/lib/cultivos-rd-data"

type CultivoReferencia = ReturnType<typeof getAllCultivos>[number]
type EtapaCultivo = "germinacion" | "crecimiento" | "cosecha"
type EtapaApiValue = string | { recomendacion?: string | null; labores?: string | null } | null

interface PerfilAgronomicoApi {
  densidadPlantasM2?: string | null
  sustratoSuelo?: string | null
  aguaAproximada?: string | null
  fertilizantes?: string[]
  abonos?: string[]
  rendimientoPorMata?: string | null
  mesesRecomendados?: string[]
  fertilizacion?: Partial<Record<EtapaCultivo, EtapaApiValue>>
  manejo?: Partial<Record<EtapaCultivo, EtapaApiValue>>
  sanidad?: string[]
  plagas?: Array<{ nombre?: string | null }>
}

interface SensorReading {
  valor: number
  unidad: string
  estado: string
  rangoMin: number
  rangoMax: number
  ultimaActualizacion: string
}

interface ZoneData {
  id: string
  nombre: string
  invernaderoId: string
  cultivoActual: string
  estadoRiego: string
  modoRiego: string
  umbralHumedad: number
  area_m2: number
  caudal_litros_min: number
  umbral_ph: number
  umbral_ec: number
  umbral_tds: number
  observaciones: string
  fechaSiembra: string
  fechaCosechaEstimada: string
  tiempoGerminacionDias: number
  tiempoCrecimientoDias: number
  tiempoCosechaDias: number
  cantidadCultivo: number
  rendimientoPorMata?: number | null
  unidadRendimiento?: string
  produccionEstimada?: number | null
  aguaEstimadaLitrosDia?: number | null
  humedadSiembra?: number | null
  temperaturaSiembra?: number | null
  phSiembra?: number | null
  ecSiembra?: number | null
  tdsSiembra?: number | null
  fertilizanteEstimado?: string
  abonoEstimado?: string
  recomendacionSiembra?: string
  costoPorMata?: number | null
  precioMercado?: number | null
  costoTotalMatas?: number | null
  ingresoEstimado?: number | null
  margenEstimado?: number | null
  margenPorcentaje?: number | null
  notasCultivo: string
  humedadActual: number
  ultimoRiego: string
  duracionUltimoRiego: number
  volumenUltimoRiego: number
  sensores?: Record<string, SensorReading>
}

// -- Sensor type config (labels, icons, colors, descriptions) --
const SENSOR_CONFIG: Record<string, {
  label: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  barColor: string
  formatValue: (v: number, u: string) => string
}> = {
  humedad_suelo: {
    label: "Humedad del Suelo",
    description: "Define cuando regar",
    icon: Droplets,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    barColor: "bg-blue-500",
    formatValue: (v, u) => `${v}${u || "%"}`,
  },
  ph: {
    label: "pH Agua/Sustrato",
    description: "Controla absorcion de nutrientes",
    icon: FlaskConical,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    barColor: "bg-violet-500",
    formatValue: (v) => v.toFixed(1),
  },
  tds: {
    label: "EC / TDS",
    description: "Concentracion de fertilizante",
    icon: TestTubes,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    barColor: "bg-emerald-500",
    formatValue: (v, u) => `${v} ${u || "ppm"}`,
  },
  temperatura: {
    label: "Temperatura Ambiental",
    description: "Ajusta riego y fertirriego",
    icon: Thermometer,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    barColor: "bg-orange-500",
    formatValue: (v) => `${v}\u00B0C`,
  },
}

const SENSOR_ORDER = ["humedad_suelo", "ph", "tds", "temperatura"]

function formatTime(ts: string) {
  if (!ts) return "--"
  return new Date(ts).toLocaleString("es-DO", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getStatus(valor: number, min: number, max: number): "bajo" | "alto" | "normal" {
  if (valor < min) return "bajo"
  if (valor > max) return "alto"
  return "normal"
}

function formatArea(value?: number) {
  return `${Number(value || 0).toLocaleString("es-DO")} m²`
}

function findCropReference(cropName?: string) {
  const normalized = cropName?.trim().toLowerCase()
  if (!normalized) return null
  return getAllCultivos().find((item) => item.nombre.toLowerCase() === normalized) || null
}

function getReferenceAsCrop(reference: CultivoReferencia): Cultivo {
  const thresholds = reference.etapas.crecimiento || reference.etapas.germinacion || reference.etapas.cosecha

  return {
    id: `catalog:${reference.nombre}:${reference.variedad}`,
    nombre: reference.nombre,
    variedad: reference.variedad,
    invernaderoId: "",
    fechaSiembra: "",
    umbralHumedad: thresholds?.umbral_humedad,
    umbralPh: thresholds?.umbral_ph,
    umbralEc: thresholds?.umbral_ec,
    umbralTds: thresholds?.umbral_tds,
    esCatalogo: true,
    detalle: {
      id: `catalog:${reference.nombre}:${reference.variedad}:detalle`,
      fechaCosechaEstimada: "",
      tiempoGerminacionDias: reference.germinacion,
      tiempoCrecimientoDias: reference.crecimiento,
      tiempoCosechaDias: reference.cosecha,
      umbralHumedad: thresholds?.umbral_humedad,
      umbralPh: thresholds?.umbral_ph,
      umbralEc: thresholds?.umbral_ec,
      umbralTds: thresholds?.umbral_tds,
      notas: "",
    },
  }
}

function getDaysSincePlanting(fechaSiembra: string) {
  if (!fechaSiembra) return null
  const plantedAt = new Date(`${fechaSiembra}T00:00:00`)
  if (Number.isNaN(plantedAt.getTime())) return null
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.floor((todayStart.getTime() - plantedAt.getTime()) / 86400000))
}

function formatFertilizerText(value?: string | string[] | null): string {
  if (Array.isArray(value)) return value.map((item) => formatFertilizerText(String(item))).filter(Boolean).join(", ")
  const text = String(value || "").trim()
  if (!text) return ""

  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text)
      const rows = Array.isArray(parsed) ? parsed : [parsed]
      return rows
        .map((row) => {
          if (!row || typeof row !== "object") return String(row || "").trim()
          const record = row as Record<string, unknown>
          const name = String(record.nombre || record.name || "").trim()
          const dose = record.dosis != null && record.dosis !== "" ? `${record.dosis} ${record.unidad || "g/1000 L"}` : ""
          return [name, dose].filter(Boolean).join(" - ")
        })
        .filter(Boolean)
        .join(", ")
    } catch {
      return text
    }
  }

  return text.replace(/\n+/g, ", ")
}

function getCropWaterText(crop?: Cultivo) {
  return crop?.aguaLitrosPorMataDia != null ? `${crop.aguaLitrosPorMataDia} L por mata/dia` : null
}

function getCropYieldText(crop?: Cultivo) {
  return crop?.rendimientoPorMata != null
    ? `${crop.rendimientoPorMata} ${crop.unidadRendimiento || "unidad"} por mata`
    : null
}

function getStageFromDays(reference: CultivoReferencia, diasDesdeSiembra: number): EtapaCultivo {
  if (diasDesdeSiembra <= reference.germinacion) return "germinacion"
  if (diasDesdeSiembra <= reference.germinacion + reference.crecimiento) return "crecimiento"
  return "cosecha"
}

function getCropStageInfo(cropName: string, fechaSiembra: string) {
  const reference = findCropReference(cropName)
  const diasDesdeSiembra = getDaysSincePlanting(fechaSiembra)
  if (!reference || diasDesdeSiembra == null) return null

  const etapa = getStageFromDays(reference, diasDesdeSiembra)
  return {
    etapa,
    diasDesdeSiembra,
    thresholds: reference.etapas[etapa],
  }
}

function formatStageName(etapa: EtapaCultivo) {
  if (etapa === "germinacion") return "Germinación"
  if (etapa === "crecimiento") return "Crecimiento"
  return "Cosecha"
}

function getStageRecommendation(etapa: EtapaCultivo) {
  if (etapa === "germinacion") return "Mantener humedad estable y evitar saturación."
  if (etapa === "crecimiento") return "Priorizar nutrición balanceada y revisar vigor vegetativo."
  return "Controlar madurez, calidad y exceso de humedad antes del corte."
}

function formatCropDetail(crop?: Cultivo) {
  if (!crop) return null
  const reference = findCropReference(crop.nombre)
  if (!reference) return null

  return [
    `Germinación: ${reference.germinacion} días`,
    `Crecimiento: ${reference.crecimiento} días`,
    `Cosecha: ${reference.cosecha} días`,
  ].join(" · ")
}

function getCropThresholds(crop?: Cultivo, fallback?: Partial<ZoneData>, fechaSiembra?: string) {
  const stageInfo = getCropStageInfo(crop?.nombre || fallback?.cultivoActual || "", fechaSiembra || fallback?.fechaSiembra || "")

  return {
    umbralHumedad: stageInfo?.thresholds.umbral_humedad ?? crop?.umbralHumedad ?? crop?.detalle?.umbralHumedad ?? fallback?.umbralHumedad ?? 40,
    umbral_ph: stageInfo?.thresholds.umbral_ph ?? crop?.umbralPh ?? crop?.detalle?.umbralPh ?? fallback?.umbral_ph ?? 6,
    umbral_ec: stageInfo?.thresholds.umbral_ec ?? crop?.umbralEc ?? crop?.detalle?.umbralEc ?? fallback?.umbral_ec ?? 1.5,
    umbral_tds: stageInfo?.thresholds.umbral_tds ?? crop?.umbralTds ?? crop?.detalle?.umbralTds ?? fallback?.umbral_tds ?? 800,
  }
}

function formatCropThresholds(crop?: Cultivo, fallback?: Partial<ZoneData>, fechaSiembra?: string) {
  const thresholds = getCropThresholds(crop, fallback, fechaSiembra)
  return `Umbrales del cultivo: humedad ${thresholds.umbralHumedad}% · pH ${thresholds.umbral_ph} · EC ${thresholds.umbral_ec} · TDS ${thresholds.umbral_tds}`
}

function getEtapaText(value?: EtapaApiValue) {
  if (!value) return null
  if (typeof value === "string") return value
  return value.recomendacion || value.labores || null
}

function getAgronomicSummary(cropName: string, etapa?: EtapaCultivo, apiProfile?: PerfilAgronomicoApi) {
  const localProfile = getPerfilAgronomico(cropName)
  const profile = apiProfile || localProfile
  if (!profile) return null

  const sanidad =
    apiProfile?.sanidad?.length
      ? apiProfile.sanidad.slice(0, 4).join(", ")
      : apiProfile?.plagas?.length
        ? apiProfile.plagas.map((plaga) => plaga.nombre).filter(Boolean).slice(0, 4).join(", ")
        : localProfile?.sanidad.slice(0, 4).join(", ") || ""

  return {
    densidad: profile.densidadPlantasM2 || "No definido",
    sustrato: profile.sustratoSuelo || "No definido",
    agua: profile.aguaAproximada || "No definido",
    fertilizantes: profile.fertilizantes?.length ? formatFertilizerText(profile.fertilizantes) : "No definido",
    abonos: profile.abonos?.length ? profile.abonos.join(", ") : "No definido",
    rendimientoPorMata: profile.rendimientoPorMata || "No definido",
    mesesRecomendados: profile.mesesRecomendados?.length ? profile.mesesRecomendados.join(", ") : "No definido",
    fertilizacion: etapa ? getEtapaText(profile.fertilizacion?.[etapa]) : null,
    manejo: etapa ? getEtapaText(profile.manejo?.[etapa]) : null,
    sanidad,
  }
}

function parseRendimientoPorMata(value?: string | null) {
  const text = String(value || "").trim()
  if (!text || text === "No definido") return null

  const numbers = text
    .match(/\d+(?:[.,]\d+)?/g)
    ?.map((item) => Number(item.replace(",", ".")))
    .filter((item) => Number.isFinite(item) && item > 0)

  if (!numbers?.length) return null

  const rendimiento = numbers.length >= 2 ? (numbers[0] + numbers[1]) / 2 : numbers[0]
  const unidad = text
    .replace(/\d+(?:[.,]\d+)?/g, "")
    .replace(/\b(a|por|cada|mata|planta|aprox|aproximado|aproximada)\b/gi, "")
    .replace(/[./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "unidades"

  return { rendimiento, unidad }
}

function getProduccionEstimada(cantidadMatas: number, rendimientoPorMata?: string | null) {
  const parsed = parseRendimientoPorMata(rendimientoPorMata)
  const cantidad = Number(cantidadMatas || 0)
  if (!parsed || cantidad <= 0) return null

  return {
    total: cantidad * parsed.rendimiento,
    rendimiento: parsed.rendimiento,
    unidad: parsed.unidad,
  }
}

function parseAguaPorMata(value?: string | null) {
  const numbers = String(value || "")
    .match(/\d+(?:[.,]\d+)?/g)
    ?.map((item) => Number(item.replace(",", ".")))
    .filter((item) => Number.isFinite(item) && item > 0)

  if (!numbers?.length) return null
  return numbers.length >= 2 ? (numbers[0] + numbers[1]) / 2 : numbers[0]
}

function getAguaEstimada(cantidadMatas: number, aguaAproximada?: string | null) {
  const aguaPorMata = parseAguaPorMata(aguaAproximada)
  const cantidad = Number(cantidadMatas || 0)
  if (!aguaPorMata || cantidad <= 0) return null
  return aguaPorMata * cantidad
}

function formatEstimateNumber(value: number) {
  return value.toLocaleString("es-DO", {
    maximumFractionDigits: value >= 10 ? 1 : 2,
  })
}

function getFinancialEstimate(cantidadMatas: number, produccionEstimada: number | null | undefined, costoPorMata: number, precioMercado: number) {
  const cantidad = Number(cantidadMatas || 0)
  const produccion = Number(produccionEstimada || 0)
  const costoUnitario = Number(costoPorMata || 0)
  const precio = Number(precioMercado || 0)

  const costoTotal = cantidad * costoUnitario
  const ingreso = produccion * precio
  const margen = ingreso - costoTotal

  return {
    costoTotal,
    ingreso,
    margen,
    margenPorcentaje: ingreso > 0 ? (margen / ingreso) * 100 : 0,
  }
}

function formatMoney(value: number) {
  return `RD$ ${Number(value || 0).toLocaleString("es-DO", {
    maximumFractionDigits: 2,
  })}`
}

function getCropCycle(cropName: string, fechaSiembra: string) {
  const crop = findCropReference(cropName)
  if (!crop) {
    return {
      tiempoGerminacionDias: 0,
      tiempoCrecimientoDias: 0,
      tiempoCosechaDias: 0,
      fechaCosechaEstimada: "",
      notasCultivo: "",
    }
  }

  let fechaCosechaEstimada = ""
  if (fechaSiembra && crop.duracion) {
    const date = new Date(`${fechaSiembra}T00:00:00`)
    date.setDate(date.getDate() + crop.duracion)
    fechaCosechaEstimada = date.toISOString().slice(0, 10)
  }

  return {
    tiempoGerminacionDias: crop.germinacion,
    tiempoCrecimientoDias: crop.crecimiento,
    tiempoCosechaDias: crop.cosecha,
    fechaCosechaEstimada,
    notasCultivo: `Duración total: ${crop.duracion} días`,
  }
}

// -- Sensor micro-card inside the zone card --
function SensorMiniCard({ tipo, reading }: { tipo: string; reading?: SensorReading }) {
  const config = SENSOR_CONFIG[tipo]
  if (!config) return null
  const Icon = config.icon

  if (!reading || reading.estado === "error") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-dashed p-2.5 opacity-50">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${config.bg}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-muted-foreground">{config.label}</p>
          <p className="text-xs text-muted-foreground">{reading?.estado === "error" ? "Error" : "Sin datos"}</p>
        </div>
      </div>
    )
  }

  const status = getStatus(reading.valor, reading.rangoMin, reading.rangoMax)
  const pct = reading.rangoMax > reading.rangoMin
    ? Math.min(100, Math.max(0, ((reading.valor - reading.rangoMin) / (reading.rangoMax - reading.rangoMin)) * 100))
    : 50

  return (
    <div className="flex items-center gap-2.5 rounded-lg border p-2.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${config.bg}`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[11px] font-medium text-muted-foreground">{config.label}</p>
          <span className={`text-sm font-bold tabular-nums ${
            status === "normal" ? "text-foreground" : status === "bajo" ? "text-amber-400" : "text-red-400"
          }`}>
            {config.formatValue(reading.valor, reading.unidad)}
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              status === "normal" ? config.barColor : status === "bajo" ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-0.5 text-[9px] text-muted-foreground">{config.description}</p>
      </div>
    </div>
  )
}

// -- Zone Card --
function ZoneCard({
  zona,
  greenhouses,
  crops,
  metodosRiego,
  onToggleIrrigation,
  onSaveConfig,
  onToggleAuto,
  userRole,
}: {
  zona: ZoneData
  greenhouses: Invernadero[]
  crops: Cultivo[]
  metodosRiego: Array<{ id: string; nombre: string }>
  onToggleIrrigation: (id: string) => void
  onSaveConfig: (id: string, data: Record<string, unknown>) => void
  onToggleAuto: (id: string) => void
  userRole: UserRole
}) {
  const [configNombre, setConfigNombre] = useState(zona.nombre)
  const [configCultivo, setConfigCultivo] = useState(zona.cultivoActual)
  const [configArea, setConfigArea] = useState(zona.area_m2)
  const [configCaudal, setConfigCaudal] = useState(zona.caudal_litros_min)
  const [configMetodo, setConfigMetodo] = useState(zona.modoRiego || "")
  const [configObservaciones, setConfigObservaciones] = useState(zona.observaciones)
  const [configFechaSiembra, setConfigFechaSiembra] = useState(zona.fechaSiembra)
  const [configFechaCosecha, setConfigFechaCosecha] = useState(zona.fechaCosechaEstimada)
  const [configGerminacion, setConfigGerminacion] = useState(zona.tiempoGerminacionDias)
  const [configCrecimiento, setConfigCrecimiento] = useState(zona.tiempoCrecimientoDias)
  const [configCosecha, setConfigCosecha] = useState(zona.tiempoCosechaDias)
  const [configCantidadCultivo, setConfigCantidadCultivo] = useState(zona.cantidadCultivo)
  const [configCostoPorMata, setConfigCostoPorMata] = useState(Number(zona.costoPorMata || 0))
  const [configPrecioMercado, setConfigPrecioMercado] = useState(Number(zona.precioMercado || 0))
  const [configNotasCultivo, setConfigNotasCultivo] = useState(zona.notasCultivo)
  const [saving, setSaving] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

  const isAdmin = userRole === "administrador"
  const canControl = userRole === "administrador" || userRole === "tecnico"
  const isIrrigating = zona.estadoRiego === "activo"

  const greenhouse = greenhouses.find((i) => i.id === zona.invernaderoId)
  const greenhouseArea = Number(greenhouse?.area || 0)
  const selectedConfigCrop = crops.find((crop) => crop.nombre === configCultivo)
  const selectedConfigCropDetail = formatCropDetail(selectedConfigCrop)
  const selectedConfigCropThresholds = formatCropThresholds(selectedConfigCrop, zona, configFechaSiembra)
  const currentStage = getCropStageInfo(zona.cultivoActual, zona.fechaSiembra)
  const { data: currentApiAgronomy } = useSWR<PerfilAgronomicoApi>(
    zona.cultivoActual ? `/api/cultivosRD?mode=perfil&nombre=${encodeURIComponent(zona.cultivoActual)}` : null,
    fetcher
  )
  const { data: selectedConfigApiAgronomy } = useSWR<PerfilAgronomicoApi>(
    configCultivo ? `/api/cultivosRD?mode=perfil&nombre=${encodeURIComponent(configCultivo)}` : null,
    fetcher
  )
  const currentAgronomy = getAgronomicSummary(zona.cultivoActual, currentStage?.etapa, currentApiAgronomy)
  const selectedConfigAgronomy = getAgronomicSummary(
    configCultivo,
    getCropStageInfo(configCultivo, configFechaSiembra)?.etapa,
    selectedConfigApiAgronomy
  )
  const selectedConfigProductionEstimate = getProduccionEstimada(
    configCantidadCultivo,
    selectedConfigAgronomy?.rendimientoPorMata
  )
  const selectedConfigWaterEstimate = getAguaEstimada(configCantidadCultivo, selectedConfigAgronomy?.agua)
  const selectedConfigFinancialEstimate = getFinancialEstimate(
    configCantidadCultivo,
    selectedConfigProductionEstimate?.total,
    configCostoPorMata,
    configPrecioMercado
  )

  function applyCropToConfig(cropName: string) {
    setConfigCultivo(cropName)

    const cycle = getCropCycle(cropName, configFechaSiembra)
    if (cycle.tiempoGerminacionDias) setConfigGerminacion(cycle.tiempoGerminacionDias)
    if (cycle.tiempoCrecimientoDias) setConfigCrecimiento(cycle.tiempoCrecimientoDias)
    if (cycle.tiempoCosechaDias) setConfigCosecha(cycle.tiempoCosechaDias)
    if (cycle.fechaCosechaEstimada) setConfigFechaCosecha(cycle.fechaCosechaEstimada)
    if (cycle.notasCultivo) setConfigNotasCultivo(cycle.notasCultivo)
  }

  function updateConfigFechaSiembra(value: string) {
    setConfigFechaSiembra(value)
    const cycle = getCropCycle(configCultivo, value)
    if (cycle.fechaCosechaEstimada) setConfigFechaCosecha(cycle.fechaCosechaEstimada)
  }

  function handleSaveConfig() {
    if (greenhouseArea > 0 && configArea > greenhouseArea) {
      toast.error("Área de zona inválida", {
        description: `La zona no puede superar el tamaño del invernadero (${formatArea(greenhouseArea)})`,
      })
      return
    }

    setSaving(true)
    onSaveConfig(zona.id, {
      nombre: configNombre,
      cultivoActual: configCultivo,
      ...getCropThresholds(selectedConfigCrop, zona, configFechaSiembra),
      area_m2: configArea,
      caudal_litros_min: configCaudal,
      modoRiego: configMetodo,
      fechaSiembra: configFechaSiembra || null,
      fechaCosechaEstimada: configFechaCosecha || null,
      tiempoGerminacionDias: configGerminacion || null,
      tiempoCrecimientoDias: configCrecimiento || null,
      tiempoCosechaDias: configCosecha || null,
      cantidadCultivo: configCantidadCultivo,
      rendimientoPorMata: selectedConfigProductionEstimate?.rendimiento ?? null,
      unidadRendimiento: selectedConfigProductionEstimate?.unidad || "",
      produccionEstimada: selectedConfigProductionEstimate?.total ?? null,
      aguaEstimadaLitrosDia: selectedConfigWaterEstimate,
      humedadSiembra: zona.sensores?.humedad_suelo?.valor ?? zona.umbralHumedad,
      temperaturaSiembra: zona.sensores?.temperatura?.valor ?? null,
      phSiembra: zona.sensores?.ph?.valor ?? zona.umbral_ph,
      ecSiembra: zona.umbral_ec,
      tdsSiembra: zona.sensores?.tds?.valor ?? zona.umbral_tds,
      fertilizanteEstimado: selectedConfigAgronomy?.fertilizantes || "",
      abonoEstimado: selectedConfigAgronomy?.abonos || "",
      recomendacionSiembra: selectedConfigAgronomy?.mesesRecomendados || "",
      costoPorMata: configCostoPorMata || null,
      precioMercado: configPrecioMercado || null,
      costoTotalMatas: selectedConfigFinancialEstimate.costoTotal,
      ingresoEstimado: selectedConfigFinancialEstimate.ingreso,
      margenEstimado: selectedConfigFinancialEstimate.margen,
      margenPorcentaje: selectedConfigFinancialEstimate.margenPorcentaje,
      notasCultivo: configNotasCultivo,
      observaciones: configObservaciones,
    })
    setTimeout(() => {
      setSaving(false)
      setConfigOpen(false)
    }, 800)
  }

  function handleOpenConfig() {
    setConfigNombre(zona.nombre)
    setConfigCultivo(zona.cultivoActual)
    setConfigArea(zona.area_m2)
    setConfigCaudal(zona.caudal_litros_min)
    setConfigMetodo(zona.modoRiego || metodosRiego[0]?.nombre || "")
    setConfigFechaSiembra(zona.fechaSiembra)
    setConfigFechaCosecha(zona.fechaCosechaEstimada)
    setConfigGerminacion(zona.tiempoGerminacionDias)
    setConfigCrecimiento(zona.tiempoCrecimientoDias)
    setConfigCosecha(zona.tiempoCosechaDias)
    setConfigCantidadCultivo(zona.cantidadCultivo)
    setConfigCostoPorMata(Number(zona.costoPorMata || 0))
    setConfigPrecioMercado(Number(zona.precioMercado || 0))
    setConfigNotasCultivo(zona.notasCultivo)
    setConfigObservaciones(zona.observaciones)
    setConfigOpen(true)
  }

  return (
    <Card className="relative overflow-hidden">
      {isIrrigating && <div className="absolute inset-x-0 top-0 h-1 bg-blue-500 animate-pulse" />}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">{zona.nombre}</CardTitle>
            <p className="text-xs text-muted-foreground">{greenhouse?.nombre} &middot; {zona.cultivoActual}</p>
            {currentStage && (
              <p className="mt-1 text-xs text-muted-foreground">
                Día {currentStage.diasDesdeSiembra} &middot; Etapa: {formatStageName(currentStage.etapa)}
              </p>
            )}
            {currentStage && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {getStageRecommendation(currentStage.etapa)}
              </p>
            )}
            {currentAgronomy?.fertilizacion && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Fertirriego: {currentAgronomy.fertilizacion}
              </p>
            )}
          </div>
          <Badge className={isIrrigating ? "bg-blue-500/20 text-blue-400 border-0" : "bg-emerald-500/20 text-emerald-400 border-0"}>
            {isIrrigating ? "Regando" : "Normal"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* -- 4 Sensor Readings Grid -- */}
        <div className="grid grid-cols-2 gap-2">
          {SENSOR_ORDER.map((tipo) => (
            <SensorMiniCard
              key={tipo}
              tipo={tipo}
              reading={zona.sensores?.[tipo]}
            />
          ))}
        </div>

        {/* -- Humidity threshold bar (main decision metric) -- */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Umbral de Riego</span>
            <span className="text-xs tabular-nums text-foreground">{zona.humedadActual}% / {zona.umbralHumedad}%</span>
          </div>
          <div className="relative">
            <Progress value={Math.min(100, Math.max(0, zona.humedadActual))} className="h-2" />
            <div
              className="absolute top-0 h-2 w-0.5 bg-foreground/50"
              style={{ left: `${zona.umbralHumedad}%` }}
            />
          </div>
          <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground">
            <span>Seco</span>
            <span className={zona.humedadActual < zona.umbralHumedad ? "font-semibold text-amber-400" : ""}>
              {zona.humedadActual < zona.umbralHumedad ? "Necesita riego" : "Humedad OK"}
            </span>
            <span>Saturado</span>
          </div>
        </div>

        {/* -- Last irrigation info -- */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Ultimo riego: {formatTime(zona.ultimoRiego)}</span>
          </div>
          {zona.duracionUltimoRiego > 0 && (
            <span>{zona.duracionUltimoRiego} min &middot; {zona.volumenUltimoRiego}L</span>
          )}
        </div>

        {/* -- Controls -- */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={zona.modoRiego === "automatico"}
              onCheckedChange={() => {
                if (!canControl) {
                  toast.error("Acceso denegado", { description: "Solo tecnicos y administradores pueden cambiar el modo de riego" })
                  return
                }
                onToggleAuto(zona.id)
              }}
              disabled={!canControl}
              aria-label="Modo automatico"
            />
            <span className="text-xs text-muted-foreground">{zona.modoRiego === "automatico" ? "Auto" : "Manual"}</span>
            {!canControl && <Lock className="h-3 w-3 text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={handleOpenConfig}>
                    <Settings className="mr-1 h-3.5 w-3.5" />Config
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Configurar Zona</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex flex-col gap-2">
                      <Label>Nombre de la Zona</Label>
                      <Input value={configNombre} onChange={(e) => setConfigNombre(e.target.value)} placeholder="Ej: Zona 1 - Tomates" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Cultivo Actual</Label>
                      <Select value={configCultivo} onValueChange={applyCropToConfig}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cultivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {crops.map((crop) => (
                            <SelectItem key={crop.id} value={crop.nombre}>
                              {crop.nombre} {crop.variedad ? `(${crop.variedad})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedConfigCrop && (
                        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                          {selectedConfigCropDetail && <p>{selectedConfigCropDetail}</p>}
                          <p className={selectedConfigCropDetail ? "mt-1" : ""}>{selectedConfigCropThresholds}</p>
                          {selectedConfigAgronomy && (
                            <div className="mt-2 space-y-1">
                          <p>Densidad: {selectedConfigAgronomy.densidad}</p>
                          <p>Sustrato/suelo: {selectedConfigAgronomy.sustrato}</p>
                          <p>Agua aprox.: {selectedConfigAgronomy.agua}</p>
                          <p>Rendimiento por mata: {selectedConfigAgronomy.rendimientoPorMata}</p>
                          <p>Fertilizantes: {selectedConfigAgronomy.fertilizantes}</p>
                          <p>Abonos: {selectedConfigAgronomy.abonos}</p>
                          <p>Meses recomendados: {selectedConfigAgronomy.mesesRecomendados}</p>
                          {selectedConfigAgronomy.fertilizacion && <p>Fertirriego: {selectedConfigAgronomy.fertilizacion}</p>}
                          {selectedConfigAgronomy.manejo && <p>Manejo: {selectedConfigAgronomy.manejo}</p>}
                          <p>Vigilar: {selectedConfigAgronomy.sanidad}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-4">
                      <h3 className="mb-3 text-sm font-medium">Detalles de siembra</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Fecha de Siembra</Label>
                          <Input type="date" value={configFechaSiembra} onChange={(e) => updateConfigFechaSiembra(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Fecha Cosecha Estimada</Label>
                          <Input type="date" value={configFechaCosecha} onChange={(e) => setConfigFechaCosecha(e.target.value)} />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Germinación (días)</Label>
                          <Input type="number" min={0} value={configGerminacion} onChange={(e) => setConfigGerminacion(Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Crecimiento (días)</Label>
                          <Input type="number" min={0} value={configCrecimiento} onChange={(e) => setConfigCrecimiento(Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Cosecha (días)</Label>
                          <Input type="number" min={0} value={configCosecha} onChange={(e) => setConfigCosecha(Number(e.target.value))} />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        <Label>Cantidad a sembrar</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={configCantidadCultivo}
                          onChange={(e) => setConfigCantidadCultivo(Number(e.target.value))}
                          placeholder="Ej: 120 plantas"
                        />
                    {selectedConfigProductionEstimate && (
                      <p className="text-xs text-muted-foreground">
                        Produccion estimada:{" "}
                            <span className="font-medium text-foreground">
                              {formatEstimateNumber(selectedConfigProductionEstimate.total)} {selectedConfigProductionEstimate.unidad}
                            </span>{" "}
                            ({formatEstimateNumber(selectedConfigProductionEstimate.rendimiento)} por mata)
                          </p>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Costo por mata</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={configCostoPorMata}
                            onChange={(e) => setConfigCostoPorMata(Number(e.target.value))}
                            placeholder="Ej: 15"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Precio mercado por {selectedConfigProductionEstimate?.unidad || "unidad"}</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={configPrecioMercado}
                            onChange={(e) => setConfigPrecioMercado(Number(e.target.value))}
                            placeholder="Ej: 45"
                          />
                        </div>
                      </div>
                      {(configCostoPorMata > 0 || configPrecioMercado > 0) && (
                        <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                          <div className="grid grid-cols-2 gap-2">
                            <p>Costo matas: <span className="font-medium text-foreground">{formatMoney(selectedConfigFinancialEstimate.costoTotal)}</span></p>
                            <p>Ingreso estimado: <span className="font-medium text-foreground">{formatMoney(selectedConfigFinancialEstimate.ingreso)}</span></p>
                            <p>Margen: <span className={selectedConfigFinancialEstimate.margen >= 0 ? "font-medium text-emerald-500" : "font-medium text-red-500"}>{formatMoney(selectedConfigFinancialEstimate.margen)}</span></p>
                            <p>Margen %: <span className="font-medium text-foreground">{formatEstimateNumber(selectedConfigFinancialEstimate.margenPorcentaje)}%</span></p>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 flex flex-col gap-2">
                        <Label>Notas del cultivo en esta zona</Label>
                        <Textarea value={configNotasCultivo} onChange={(e) => setConfigNotasCultivo(e.target.value)} placeholder="Notas de siembra, etapa o manejo..." />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Area (m²)</Label>
                        <Input
                          type="number"
                          value={configArea}
                          onChange={(e) => setConfigArea(Number(e.target.value))}
                          min={1}
                          max={greenhouseArea || undefined}
                        />
                        {greenhouseArea > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Tamaño del invernadero: {formatArea(greenhouseArea)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Caudal (L/min)</Label>
                        <Input type="number" value={configCaudal} onChange={(e) => setConfigCaudal(Number(e.target.value))} min={1} step={0.5} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Metodo de Riego</Label>
                      <Select value={configMetodo} onValueChange={setConfigMetodo}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar metodo" /></SelectTrigger>
                        <SelectContent>
                          {metodosRiego.map((met) => (
                            <SelectItem key={met.id} value={met.nombre}>{met.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Observaciones</Label>
                      <Textarea value={configObservaciones} onChange={(e) => setConfigObservaciones(e.target.value)} placeholder="Notas adicionales..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSaveConfig} disabled={saving}>
                      {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cambios"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {canControl ? (
              <Button
                size="sm"
                className="h-8"
                variant={isIrrigating ? "destructive" : "default"}
                onClick={() => onToggleIrrigation(zona.id)}
              >
                {isIrrigating ? <><Square className="mr-1 h-3.5 w-3.5" />Detener</> : <><Play className="mr-1 h-3.5 w-3.5" />Regar</>}
              </Button>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
                <Lock className="h-3 w-3" />Solo lectura
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// -- Main View --
interface ZonesViewProps {
  selectedGreenhouse: string
  userRole: UserRole
}

export function ZonesView({ selectedGreenhouse, userRole }: ZonesViewProps) {
  const { data: zones, isLoading, mutate } = useSWR<ZoneData[]>(
    `/api/zones?greenhouse=${selectedGreenhouse}`,
    fetcher,
    { refreshInterval: 3000 }
  )
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)
  const { data: selectedGreenhouseCrops } = useSWR<Cultivo[]>(
    selectedGreenhouse ? `/api/crops?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )

  const [newZoneOpen, setNewZoneOpen] = useState(false)
  const [newZoneName, setNewZoneName] = useState("")
  const [newZoneCultivo, setNewZoneCultivo] = useState("")
  const [newZoneGreenhouse, setNewZoneGreenhouse] = useState(selectedGreenhouse)
  const [newZoneArea, setNewZoneArea] = useState(100)
  const [newZoneCaudal, setNewZoneCaudal] = useState(10)
  const [newZoneMetodo, setNewZoneMetodo] = useState("goteo")
  const [newZoneFechaSiembra, setNewZoneFechaSiembra] = useState("")
  const [newZoneFechaCosecha, setNewZoneFechaCosecha] = useState("")
  const [newZoneGerminacion, setNewZoneGerminacion] = useState(0)
  const [newZoneCrecimiento, setNewZoneCrecimiento] = useState(0)
  const [newZoneCosecha, setNewZoneCosecha] = useState(0)
  const [newZoneCantidadCultivo, setNewZoneCantidadCultivo] = useState(0)
  const [newZoneCostoPorMata, setNewZoneCostoPorMata] = useState(0)
  const [newZonePrecioMercado, setNewZonePrecioMercado] = useState(0)
  const [newZoneNotasCultivo, setNewZoneNotasCultivo] = useState("")
  const [newZoneObservaciones, setNewZoneObservaciones] = useState("")
  const [creatingZone, setCreatingZone] = useState(false)
  const [newMethodDialogOpen, setNewMethodDialogOpen] = useState(false)
  const [newMethodName, setNewMethodName] = useState("")
  const [newMethodDesc, setNewMethodDesc] = useState("")
  const [newMethodEficiencia, setNewMethodEficiencia] = useState(80)
  const [creatingMethod, setCreatingMethod] = useState(false)

  const { data: newZoneCrops } = useSWR<Cultivo[]>(
    newZoneGreenhouse ? `/api/crops?greenhouse=${newZoneGreenhouse}` : null,
    fetcher
  )
  const { data: selectedNewZoneApiAgronomy } = useSWR<PerfilAgronomicoApi>(
    newZoneCultivo ? `/api/cultivosRD?mode=perfil&nombre=${encodeURIComponent(newZoneCultivo)}` : null,
    fetcher
  )
  const { data: metodosRiego } = useSWR<Array<{ id: string; nombre: string }>>("/api/metodos-riego", fetcher)

  useEffect(() => {
    setNewZoneCultivo("")
  }, [newZoneGreenhouse])

  const isAdmin = userRole === "administrador"
  const ghList = greenhouses || []
  const zoneList = zones || []
  const selectedNewZoneGreenhouse = ghList.find((inv) => inv.id === newZoneGreenhouse)
  const selectedNewZoneGreenhouseArea = Number(selectedNewZoneGreenhouse?.area || 0)
  const newZoneCropOptions = useMemo(() => {
    const byName = new Map<string, Cultivo>()

    for (const crop of newZoneCrops || []) {
      const key = crop.nombre.trim().toLowerCase()
      if (key) byName.set(key, crop)
    }

    for (const reference of getAllCultivos()) {
      const key = reference.nombre.trim().toLowerCase()
      if (key && !byName.has(key)) {
        byName.set(key, getReferenceAsCrop(reference))
      }
    }

    return Array.from(byName.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [newZoneCrops])
  const selectedNewZoneCrop = newZoneCropOptions.find((crop) => crop.nombre === newZoneCultivo)
  const selectedNewZoneCropDetail = formatCropDetail(selectedNewZoneCrop)
  const selectedNewZoneCropThresholds = formatCropThresholds(selectedNewZoneCrop, undefined, newZoneFechaSiembra)
  const selectedNewZoneAgronomy = getAgronomicSummary(
    newZoneCultivo,
    getCropStageInfo(newZoneCultivo, newZoneFechaSiembra)?.etapa,
    selectedNewZoneApiAgronomy
  )
  const selectedNewZoneProductionEstimate = getProduccionEstimada(
    newZoneCantidadCultivo,
    selectedNewZoneAgronomy?.rendimientoPorMata || getCropYieldText(selectedNewZoneCrop)
  )
  const selectedNewZoneWaterEstimate = getAguaEstimada(
    newZoneCantidadCultivo,
    selectedNewZoneAgronomy?.agua || getCropWaterText(selectedNewZoneCrop)
  )
  const selectedNewZoneFinancialEstimate = getFinancialEstimate(
    newZoneCantidadCultivo,
    selectedNewZoneProductionEstimate?.total,
    newZoneCostoPorMata,
    newZonePrecioMercado
  )
  const selectedNewZoneFertilizersText =
    selectedNewZoneAgronomy?.fertilizantes !== "No definido"
      ? selectedNewZoneAgronomy?.fertilizantes || ""
      : formatFertilizerText(selectedNewZoneCrop?.fertilizantes)
  const selectedNewZoneAbonosText =
    selectedNewZoneAgronomy?.abonos !== "No definido"
      ? selectedNewZoneAgronomy?.abonos || ""
      : String(selectedNewZoneCrop?.abonos || "").replace(/\n+/g, ", ")
  const selectedNewZoneRecommendationText =
    selectedNewZoneAgronomy?.mesesRecomendados !== "No definido"
      ? selectedNewZoneAgronomy?.mesesRecomendados || ""
      : selectedNewZoneCrop?.mejoresMeses || selectedNewZoneCrop?.recomendacionSiembra || ""

  function applyCropToNewZone(cropName: string) {
    setNewZoneCultivo(cropName)

    const cycle = getCropCycle(cropName, newZoneFechaSiembra)
    if (cycle.tiempoGerminacionDias) setNewZoneGerminacion(cycle.tiempoGerminacionDias)
    if (cycle.tiempoCrecimientoDias) setNewZoneCrecimiento(cycle.tiempoCrecimientoDias)
    if (cycle.tiempoCosechaDias) setNewZoneCosecha(cycle.tiempoCosechaDias)
    if (cycle.fechaCosechaEstimada) setNewZoneFechaCosecha(cycle.fechaCosechaEstimada)
    if (cycle.notasCultivo) setNewZoneNotasCultivo(cycle.notasCultivo)
  }

  function updateNewZoneFechaSiembra(value: string) {
    setNewZoneFechaSiembra(value)
    const cycle = getCropCycle(newZoneCultivo, value)
    if (cycle.fechaCosechaEstimada) setNewZoneFechaCosecha(cycle.fechaCosechaEstimada)
  }

  const handleToggleIrrigation = useCallback(async (id: string) => {
    const zone = zoneList.find((z) => z.id === id)
    if (!zone) return
    const newState = zone.estadoRiego === "activo" ? "inactivo" : "activo"
    try {
      await api.updateZone(id, { estadoRiego: newState })
      mutate()
      toast.info(newState === "activo" ? "Riego iniciado" : "Riego detenido", { description: zone.nombre })
    } catch (err) {
      toast.error("Error al cambiar riego", { description: err instanceof Error ? err.message : "Error" })
    }
  }, [zoneList, mutate])

  const handleToggleAuto = useCallback(async (id: string) => {
    const zone = zoneList.find((z) => z.id === id)
    if (!zone) return
    const newMode = zone.modoRiego === "automatico" ? "manual" : "automatico"
    try {
      await api.updateZone(id, { modoRiego: newMode })
      mutate()
      toast.info(newMode === "automatico" ? "Modo automatico activado" : "Modo manual activado", { description: zone.nombre })
    } catch (err) {
      toast.error("Error al cambiar modo", { description: err instanceof Error ? err.message : "Error" })
    }
  }, [zoneList, mutate])

  const handleSaveConfig = useCallback(async (id: string, data: Record<string, unknown>) => {
    try {
      await api.updateZone(id, data)
      mutate()
      toast.success("Configuracion guardada", { description: `Zona: ${data.nombre}` })
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    }
  }, [mutate])

  async function handleCreateZone() {
    if (!newZoneName || !newZoneGreenhouse) {
      toast.error("Complete todos los campos", { description: "Nombre e invernadero son requeridos" })
      return
    }
    if (selectedNewZoneGreenhouseArea > 0 && newZoneArea > selectedNewZoneGreenhouseArea) {
      toast.error("Área de zona inválida", {
        description: `La zona no puede superar el tamaño del invernadero (${formatArea(selectedNewZoneGreenhouseArea)})`,
      })
      return
    }

    setCreatingZone(true)
    try {
      const selectedMetodo = metodosRiego?.find((m) => m.nombre === newZoneMetodo)
      await api.createZone({
        nombre: newZoneName,
        invernaderoId: newZoneGreenhouse,
        cultivoActual: "",
        umbralHumedad: 40,
        umbral_ph: 6,
        umbral_ec: 1.5,
        umbral_tds: 800,
        area_m2: newZoneArea,
        caudal_litros_min: newZoneCaudal,
        id_metodo_riego: selectedMetodo?.id || "1",
        fechaSiembra: null,
        fechaCosechaEstimada: null,
        tiempoGerminacionDias: null,
        tiempoCrecimientoDias: null,
        tiempoCosechaDias: null,
        cantidadCultivo: 0,
        rendimientoPorMata: null,
        unidadRendimiento: "",
        produccionEstimada: null,
        aguaEstimadaLitrosDia: null,
        humedadSiembra: null,
        temperaturaSiembra: null,
        phSiembra: null,
        ecSiembra: null,
        tdsSiembra: null,
        fertilizanteEstimado: "",
        abonoEstimado: "",
        recomendacionSiembra: "",
        costoPorMata: null,
        precioMercado: null,
        costoTotalMatas: null,
        ingresoEstimado: null,
        margenEstimado: null,
        margenPorcentaje: null,
        notasCultivo: "",
        observaciones: newZoneObservaciones,
      })
      mutate()
      setNewZoneOpen(false)
      setNewZoneName("")
      setNewZoneCultivo("")
      setNewZoneArea(100)
      setNewZoneCaudal(10)
      setNewZoneMetodo("goteo")
      setNewZoneFechaSiembra("")
      setNewZoneFechaCosecha("")
      setNewZoneGerminacion(0)
      setNewZoneCrecimiento(0)
      setNewZoneCosecha(0)
      setNewZoneCantidadCultivo(0)
      setNewZoneCostoPorMata(0)
      setNewZonePrecioMercado(0)
      setNewZoneNotasCultivo("")
      setNewZoneObservaciones("")
      toast.success("Zona creada exitosamente", { description: `${newZoneName} agregada al sistema` })
    } catch (err) {
      toast.error("Error al crear zona", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setCreatingZone(false)
    }
  }

  if (isLoading && !zones) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Zonas de Riego</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Gestione y controle" : "Visualice"} las zonas de riego ({zoneList.length} zonas)
          </p>
        </div>
{isAdmin && (
          <>
          <Dialog open={newZoneOpen} onOpenChange={setNewZoneOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />Nueva Zona
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">Crear Nueva Zona de Riego</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="rounded-lg border p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Datos de la zona</h3>
                    <p className="text-xs text-muted-foreground">Identificacion inicial de la zona de riego.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Nombre de la Zona</Label>
                      <Input placeholder="Ej: Zona 5 - Pepinos" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Invernadero</Label>
                      <Select value={newZoneGreenhouse} onValueChange={setNewZoneGreenhouse}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar invernadero" /></SelectTrigger>
                        <SelectContent>
                          {ghList.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>{inv.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Configuracion de riego</h3>
                    <p className="text-xs text-muted-foreground">Area, caudal, metodo y observaciones operativas.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Area (m²)</Label>
                    <Input
                      type="number"
                      value={newZoneArea}
                      onChange={(e) => setNewZoneArea(Number(e.target.value))}
                      min={1}
                      max={selectedNewZoneGreenhouseArea || undefined}
                    />
                    {selectedNewZoneGreenhouseArea > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Tamaño del invernadero: {formatArea(selectedNewZoneGreenhouseArea)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Caudal (L/min)</Label>
                    <Input type="number" value={newZoneCaudal} onChange={(e) => setNewZoneCaudal(Number(e.target.value))} min={1} step={0.5} />
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Label>Metodo de Riego</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select value={newZoneMetodo} onValueChange={setNewZoneMetodo}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar metodo" /></SelectTrigger>
                        <SelectContent>
                          {(metodosRiego || []).map((met) => (
                            <SelectItem key={met.id} value={met.nombre}>{met.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => setNewMethodDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                  <div className="flex flex-col gap-2">
                  <Label>Observaciones</Label>
                  <Textarea placeholder="Notas adicionales..." value={newZoneObservaciones} onChange={(e) => setNewZoneObservaciones(e.target.value)} />
                </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateZone} disabled={creatingZone}>
                  {creatingZone ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : "Crear Zona"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={newMethodDialogOpen} onOpenChange={setNewMethodDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Metodo de Riego</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                  <div className="mt-4 flex flex-col gap-2">
                  <Label>Nombre del Metodo</Label>
                  <Input
                    placeholder="Ej: Riego por goteo subterraneo"
                    value={newMethodName}
                    onChange={(e) => setNewMethodName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Descripcion</Label>
                  <Textarea
                    placeholder="Descripcion del metodo de riego..."
                    value={newMethodDesc}
                    onChange={(e) => setNewMethodDesc(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Eficiencia: {newMethodEficiencia}%</Label>
                  <Slider
                    value={[newMethodEficiencia]}
                    onValueChange={(v) => setNewMethodEficiencia(v[0])}
                    min={10}
                    max={100}
                    step={5}
                  />
                  </div>
                </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewMethodName("")
                    setNewMethodDesc("")
                    setNewMethodEficiencia(80)
                    setNewMethodDialogOpen(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!newMethodName.trim()) return
                    setCreatingMethod(true)
                    try {
                      const res = await api.createMetodoRiego({
                        nombre: newMethodName.trim(),
                        descripcion: newMethodDesc.trim(),
                        eficiencia: newMethodEficiencia / 100,
                      }) as { id: string; nombre: string }
                      setNewZoneMetodo(res.nombre)
                      setNewMethodName("")
                      setNewMethodDesc("")
                      setNewMethodEficiencia(80)
                      setNewMethodDialogOpen(false)
                      toast.success("Metodo creado", { description: res.nombre })
                    } catch (err) {
                      toast.error("Error", { description: err instanceof Error ? err.message : "Error" })
                    } finally {
                      setCreatingMethod(false)
                    }
                  }}
                  disabled={!newMethodName.trim() || creatingMethod}
                >
                  {creatingMethod ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : "Crear Metodo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        )}
      </div>

      {/* Sensor Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
        {SENSOR_ORDER.map((tipo) => {
          const c = SENSOR_CONFIG[tipo]
          const Icon = c.icon
          return (
            <div key={tipo} className="flex items-center gap-1.5">
              <div className={`flex h-6 w-6 items-center justify-center rounded ${c.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${c.color}`} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-foreground leading-tight">{c.label}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{c.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {zoneList.length > 0 ? (
          zoneList.map((zona) => (
            <ZoneCard
              key={zona.id}
              zona={zona}
              greenhouses={ghList}
              crops={selectedGreenhouseCrops || []}
              metodosRiego={metodosRiego || []}
              onToggleIrrigation={handleToggleIrrigation}
              onSaveConfig={handleSaveConfig}
              onToggleAuto={handleToggleAuto}
              userRole={userRole}
            />
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <Sprout className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Sin zonas en este invernadero</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Cree una nueva zona para empezar" : "Contacte a un administrador para agregar zonas"}
              </p>
              {isAdmin && (
                <Button size="sm" onClick={() => setNewZoneOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />Crear Zona
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
