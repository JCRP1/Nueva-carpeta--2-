"use client"

import { useState, useCallback, useEffect } from "react"
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
  rendimientoEstimado: number
  unidadRendimiento: string
  aguaEstimadaLitrosDia: number
  humedadSiembra: number | null
  temperaturaSiembra: number | null
  phSiembra: number | null
  ecSiembra: number | null
  tdsSiembra: number | null
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

function formatMeasure(value?: number | null, suffix = "") {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return "--"
  return `${numeric.toLocaleString("es-DO", { maximumFractionDigits: 2 })}${suffix}`
}

function optionalNumber(value: number | "") {
  return value === "" ? null : Number(value)
}

function getDaysSincePlanting(fechaSiembra: string) {
  if (!fechaSiembra) return null
  const plantedAt = new Date(`${fechaSiembra}T00:00:00`)
  if (Number.isNaN(plantedAt.getTime())) return null
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.floor((todayStart.getTime() - plantedAt.getTime()) / 86400000))
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
    fertilizacion: etapa ? getEtapaText(profile.fertilizacion?.[etapa]) : null,
    manejo: etapa ? getEtapaText(profile.manejo?.[etapa]) : null,
    sanidad,
  }
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
  const [configRendimientoEstimado, setConfigRendimientoEstimado] = useState(zona.rendimientoEstimado)
  const [configUnidadRendimiento, setConfigUnidadRendimiento] = useState(zona.unidadRendimiento || "lb")
  const [configAguaEstimada, setConfigAguaEstimada] = useState(zona.aguaEstimadaLitrosDia)
  const [configHumedadSiembra, setConfigHumedadSiembra] = useState<number | "">(zona.humedadSiembra ?? "")
  const [configTemperaturaSiembra, setConfigTemperaturaSiembra] = useState<number | "">(zona.temperaturaSiembra ?? "")
  const [configPhSiembra, setConfigPhSiembra] = useState<number | "">(zona.phSiembra ?? "")
  const [configEcSiembra, setConfigEcSiembra] = useState<number | "">(zona.ecSiembra ?? "")
  const [configTdsSiembra, setConfigTdsSiembra] = useState<number | "">(zona.tdsSiembra ?? "")
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
  const configAutoYield = Number(configCantidadCultivo || 0) * Number(selectedConfigCrop?.rendimientoPorMata || 0)
  const configAutoWater = Number(configCantidadCultivo || 0) * Number(selectedConfigCrop?.aguaLitrosPorMataDia || 0)

  function applyCropToConfig(cropName: string) {
    setConfigCultivo(cropName)

    const cycle = getCropCycle(cropName, configFechaSiembra)
    if (cycle.tiempoGerminacionDias) setConfigGerminacion(cycle.tiempoGerminacionDias)
    if (cycle.tiempoCrecimientoDias) setConfigCrecimiento(cycle.tiempoCrecimientoDias)
    if (cycle.tiempoCosechaDias) setConfigCosecha(cycle.tiempoCosechaDias)
    if (cycle.fechaCosechaEstimada) setConfigFechaCosecha(cycle.fechaCosechaEstimada)
    if (cycle.notasCultivo) setConfigNotasCultivo(cycle.notasCultivo)
    const crop = crops.find((item) => item.nombre === cropName)
    if (crop) {
      const cantidad = Number(configCantidadCultivo || 0)
      setConfigRendimientoEstimado(cantidad * Number(crop.rendimientoPorMata || 0))
      setConfigUnidadRendimiento(crop.unidadRendimiento || "lb")
      setConfigAguaEstimada(cantidad * Number(crop.aguaLitrosPorMataDia || 0))
    }
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
      rendimientoEstimado: configRendimientoEstimado || configAutoYield,
      unidadRendimiento: configUnidadRendimiento || selectedConfigCrop?.unidadRendimiento || "lb",
      aguaEstimadaLitrosDia: configAguaEstimada || configAutoWater,
      humedadSiembra: optionalNumber(configHumedadSiembra),
      temperaturaSiembra: optionalNumber(configTemperaturaSiembra),
      phSiembra: optionalNumber(configPhSiembra),
      ecSiembra: optionalNumber(configEcSiembra),
      tdsSiembra: optionalNumber(configTdsSiembra),
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
    setConfigRendimientoEstimado(zona.rendimientoEstimado)
    setConfigUnidadRendimiento(zona.unidadRendimiento || "lb")
    setConfigAguaEstimada(zona.aguaEstimadaLitrosDia)
    setConfigHumedadSiembra(zona.humedadSiembra ?? "")
    setConfigTemperaturaSiembra(zona.temperaturaSiembra ?? "")
    setConfigPhSiembra(zona.phSiembra ?? "")
    setConfigEcSiembra(zona.ecSiembra ?? "")
    setConfigTdsSiembra(zona.tdsSiembra ?? "")
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
            <p className="mt-1 text-[11px] text-muted-foreground">
              Matas: {formatMeasure(zona.cantidadCultivo)} &middot; Produccion estimada:{" "}
              {formatMeasure(zona.rendimientoEstimado, ` ${zona.unidadRendimiento || "lb"}`)} &middot; Agua/dia:{" "}
              {formatMeasure(zona.aguaEstimadaLitrosDia, " L")}
            </p>
            {(zona.humedadSiembra || zona.temperaturaSiembra || zona.phSiembra) && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Siembra: humedad {formatMeasure(zona.humedadSiembra, "%")}, temp{" "}
                {formatMeasure(zona.temperaturaSiembra, "°C")}, pH {formatMeasure(zona.phSiembra)}
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
                          onChange={(e) => {
                            const cantidad = Number(e.target.value)
                            setConfigCantidadCultivo(cantidad)
                            if (selectedConfigCrop) {
                              setConfigRendimientoEstimado(cantidad * Number(selectedConfigCrop.rendimientoPorMata || 0))
                              setConfigAguaEstimada(cantidad * Number(selectedConfigCrop.aguaLitrosPorMataDia || 0))
                              setConfigUnidadRendimiento(selectedConfigCrop.unidadRendimiento || configUnidadRendimiento || "lb")
                            }
                          }}
                          placeholder="Ej: 120 plantas"
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Produccion esperada</Label>
                          <Input type="number" min={0} value={configRendimientoEstimado || configAutoYield} onChange={(e) => setConfigRendimientoEstimado(Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Unidad</Label>
                          <Input value={configUnidadRendimiento} onChange={(e) => setConfigUnidadRendimiento(e.target.value)} placeholder="lb, unidad, kg" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Agua/dia (L)</Label>
                          <Input type="number" min={0} value={configAguaEstimada || configAutoWater} onChange={(e) => setConfigAguaEstimada(Number(e.target.value))} />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-5 gap-3">
                        <div className="flex flex-col gap-2">
                          <Label>Hum. siembra</Label>
                          <Input type="number" value={configHumedadSiembra} onChange={(e) => setConfigHumedadSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Temp.</Label>
                          <Input type="number" value={configTemperaturaSiembra} onChange={(e) => setConfigTemperaturaSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>pH</Label>
                          <Input type="number" step={0.1} value={configPhSiembra} onChange={(e) => setConfigPhSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>EC</Label>
                          <Input type="number" step={0.1} value={configEcSiembra} onChange={(e) => setConfigEcSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>TDS</Label>
                          <Input type="number" value={configTdsSiembra} onChange={(e) => setConfigTdsSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                        </div>
                      </div>
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
  const [newZoneHumedadSiembra, setNewZoneHumedadSiembra] = useState<number | "">("")
  const [newZoneTemperaturaSiembra, setNewZoneTemperaturaSiembra] = useState<number | "">("")
  const [newZonePhSiembra, setNewZonePhSiembra] = useState<number | "">("")
  const [newZoneEcSiembra, setNewZoneEcSiembra] = useState<number | "">("")
  const [newZoneTdsSiembra, setNewZoneTdsSiembra] = useState<number | "">("")
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
  const selectedNewZoneCrop = (newZoneCrops || []).find((crop) => crop.nombre === newZoneCultivo)
  const selectedNewZoneCropDetail = formatCropDetail(selectedNewZoneCrop)
  const selectedNewZoneCropThresholds = formatCropThresholds(selectedNewZoneCrop, undefined, newZoneFechaSiembra)
  const newZoneEstimatedYield = Number(newZoneCantidadCultivo || 0) * Number(selectedNewZoneCrop?.rendimientoPorMata || 0)
  const newZoneEstimatedWater = Number(newZoneCantidadCultivo || 0) * Number(selectedNewZoneCrop?.aguaLitrosPorMataDia || 0)
  const newZoneYieldUnit = selectedNewZoneCrop?.unidadRendimiento || "lb"
  const selectedNewZoneAgronomy = getAgronomicSummary(
    newZoneCultivo,
    getCropStageInfo(newZoneCultivo, newZoneFechaSiembra)?.etapa,
    selectedNewZoneApiAgronomy
  )

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
    if (!newZoneName || !newZoneCultivo) {
      toast.error("Complete todos los campos", { description: "Nombre y cultivo son requeridos" })
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
        cultivoActual: newZoneCultivo,
        ...getCropThresholds(selectedNewZoneCrop, undefined, newZoneFechaSiembra),
        area_m2: newZoneArea,
        caudal_litros_min: newZoneCaudal,
        id_metodo_riego: selectedMetodo?.id || "1",
        fechaSiembra: newZoneFechaSiembra || null,
        fechaCosechaEstimada: newZoneFechaCosecha || null,
        tiempoGerminacionDias: newZoneGerminacion || null,
        tiempoCrecimientoDias: newZoneCrecimiento || null,
        tiempoCosechaDias: newZoneCosecha || null,
        cantidadCultivo: newZoneCantidadCultivo,
        rendimientoEstimado: newZoneEstimatedYield,
        unidadRendimiento: newZoneYieldUnit,
        aguaEstimadaLitrosDia: newZoneEstimatedWater,
        humedadSiembra: optionalNumber(newZoneHumedadSiembra),
        temperaturaSiembra: optionalNumber(newZoneTemperaturaSiembra),
        phSiembra: optionalNumber(newZonePhSiembra),
        ecSiembra: optionalNumber(newZoneEcSiembra),
        tdsSiembra: optionalNumber(newZoneTdsSiembra),
        notasCultivo: newZoneNotasCultivo,
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
      setNewZoneHumedadSiembra("")
      setNewZoneTemperaturaSiembra("")
      setNewZonePhSiembra("")
      setNewZoneEcSiembra("")
      setNewZoneTdsSiembra("")
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
              <div className="flex flex-col gap-4 py-4">
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
                <div className="flex flex-col gap-2">
                  <Label>Cultivo</Label>
                  <Select value={newZoneCultivo} onValueChange={applyCropToNewZone} disabled={!newZoneGreenhouse}>
                    <SelectTrigger>
                      <SelectValue placeholder={newZoneGreenhouse ? "Seleccionar cultivo" : "Primero seleccione un invernadero"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(newZoneCrops || []).map((crop: Cultivo) => (
                        <SelectItem key={crop.id} value={crop.nombre}>
                          {crop.nombre} {crop.variedad ? `(${crop.variedad})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedNewZoneCrop && (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                      {selectedNewZoneCropDetail && <p>{selectedNewZoneCropDetail}</p>}
                      <p className={selectedNewZoneCropDetail ? "mt-1" : ""}>{selectedNewZoneCropThresholds}</p>
                      <p className="mt-1">
                        Produccion/mata: {formatMeasure(selectedNewZoneCrop.rendimientoPorMata, ` ${selectedNewZoneCrop.unidadRendimiento || "lb"}`)} &middot;
                        Agua/mata/dia: {formatMeasure(selectedNewZoneCrop.aguaLitrosPorMataDia, " L")}
                      </p>
                      {selectedNewZoneCrop.mejoresMeses && <p className="mt-1">Mejores meses: {selectedNewZoneCrop.mejoresMeses}</p>}
                      {selectedNewZoneCrop.recomendacionSiembra && <p className="mt-1">{selectedNewZoneCrop.recomendacionSiembra}</p>}
                      {selectedNewZoneAgronomy && (
                        <div className="mt-2 space-y-1">
                          <p>Densidad: {selectedNewZoneAgronomy.densidad}</p>
                          <p>Sustrato/suelo: {selectedNewZoneAgronomy.sustrato}</p>
                          {selectedNewZoneAgronomy.fertilizacion && <p>Fertirriego: {selectedNewZoneAgronomy.fertilizacion}</p>}
                          {selectedNewZoneAgronomy.manejo && <p>Manejo: {selectedNewZoneAgronomy.manejo}</p>}
                          <p>Vigilar: {selectedNewZoneAgronomy.sanidad}</p>
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
                      <Input type="date" value={newZoneFechaSiembra} onChange={(e) => updateNewZoneFechaSiembra(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Fecha Cosecha Estimada</Label>
                      <Input type="date" value={newZoneFechaCosecha} onChange={(e) => setNewZoneFechaCosecha(e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Germinación (días)</Label>
                      <Input type="number" min={0} value={newZoneGerminacion} onChange={(e) => setNewZoneGerminacion(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Crecimiento (días)</Label>
                      <Input type="number" min={0} value={newZoneCrecimiento} onChange={(e) => setNewZoneCrecimiento(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Cosecha (días)</Label>
                      <Input type="number" min={0} value={newZoneCosecha} onChange={(e) => setNewZoneCosecha(Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Label>Cantidad a sembrar</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={newZoneCantidadCultivo}
                      onChange={(e) => setNewZoneCantidadCultivo(Number(e.target.value))}
                      placeholder="Ej: 120 plantas"
                    />
                  </div>
                  <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Produccion estimada: {formatMeasure(newZoneEstimatedYield, ` ${newZoneYieldUnit}`)} &middot; Agua estimada/dia:{" "}
                    {formatMeasure(newZoneEstimatedWater, " L")}
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label>Hum. siembra</Label>
                      <Input type="number" value={newZoneHumedadSiembra} onChange={(e) => setNewZoneHumedadSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Temp.</Label>
                      <Input type="number" value={newZoneTemperaturaSiembra} onChange={(e) => setNewZoneTemperaturaSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>pH</Label>
                      <Input type="number" step={0.1} value={newZonePhSiembra} onChange={(e) => setNewZonePhSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>EC</Label>
                      <Input type="number" step={0.1} value={newZoneEcSiembra} onChange={(e) => setNewZoneEcSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>TDS</Label>
                      <Input type="number" value={newZoneTdsSiembra} onChange={(e) => setNewZoneTdsSiembra(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Label>Notas del cultivo en esta zona</Label>
                    <Textarea value={newZoneNotasCultivo} onChange={(e) => setNewZoneNotasCultivo(e.target.value)} placeholder="Notas de siembra, etapa o manejo..." />
                  </div>
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
                <div className="flex flex-col gap-2">
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
                <div className="flex flex-col gap-2">
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
