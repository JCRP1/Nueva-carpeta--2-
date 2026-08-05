"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetcher } from "@/lib/api-client"
import type { Cultivo, UserRole } from "@/lib/greensense-data"
import { getPerfilAgronomico } from "@/lib/cultivos-rd-data"
import { Droplets, FlaskConical, Gauge, Loader2, Scale, TestTubes } from "lucide-react"

type FertilizerPreparationViewProps = {
  selectedGreenhouse: string
  userRole: UserRole
}

type SensorReading = {
  valor: number
  unidad: string
  estado: string
  rangoMin: number
  rangoMax: number
  ultimaActualizacion: string
}

type ZoneData = {
  id: string
  nombre: string
  cultivoActual: string
  umbral_tds: number
  fertilizanteEstimado?: string
  abonoEstimado?: string
  recomendacionSiembra?: string
  sensores?: Record<string, SensorReading>
}

type SensorData = {
  id: string
  tipo: string
  nombre: string
  zonaRiegoId?: string
  ultimaLectura?: number
  unidad?: string
  estado?: string
  ultimoReporte?: string
}

type FertilizerDose = {
  nombre: string
  dosis: number | null
  unidad: string
}

type CropWithProfile = Cultivo & {
  perfilAgronomico?: Record<string, unknown>
}

function parseJsonValue(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function splitTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  return String(value || "")
    .split(/[\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseDoseFromText(value: string): FertilizerDose {
  const match = value.match(/^(.*?)\s*(?:-|:)?\s*(\d+(?:[.,]\d+)?)?\s*([a-zA-Z]+\/1000\s*L|[a-zA-Z]+\/1000L|ml\/1000\s*L|g\/1000\s*L)?/i)
  const name = (match?.[1] || value).trim()
  const dose = match?.[2] ? Number(match[2].replace(",", ".")) : null
  const unit = (match?.[3] || "g/1000 L").replace("1000L", "1000 L")

  return {
    nombre: name || value,
    dosis: Number.isFinite(dose) ? dose : null,
    unidad: unit,
  }
}

function parseFertilizers(value: unknown): FertilizerDose[] {
  const source = typeof value === "string" ? parseJsonValue(value) : value
  const rows = Array.isArray(source) ? source : splitTextList(source)

  return rows
    .map((item) => {
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>
        const dose = row.dosis != null ? Number(row.dosis) : null
        return {
          nombre: String(row.nombre || row.name || "").trim(),
          dosis: Number.isFinite(dose) ? dose : null,
          unidad: String(row.unidad || row.unit || "g/1000 L").trim() || "g/1000 L",
        }
      }

      return parseDoseFromText(String(item || ""))
    })
    .filter((item) => item.nombre)
}

function formatDate(value?: string) {
  if (!value) return "Sin lectura"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin lectura"
  return date.toLocaleString("es-DO", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getTdsStatus(current: number | null, target: number) {
  if (current == null || target <= 0) {
    return {
      label: "Sin lectura",
      badge: "secondary" as const,
      message: "No hay lectura TDS disponible para esta zona.",
      difference: 0,
    }
  }

  const difference = Math.round(target - current)
  const tolerance = Math.max(40, Math.round(target * 0.05))

  if (Math.abs(difference) <= tolerance) {
    return {
      label: "En rango",
      badge: "default" as const,
      message: "La solucion esta dentro del rango objetivo para el cultivo.",
      difference,
    }
  }

  if (difference > 0) {
    return {
      label: "Bajo",
      badge: "secondary" as const,
      message: `Falta concentracion. Agregue nutrientes poco a poco hasta subir cerca de ${difference} ppm.`,
      difference,
    }
  }

  return {
    label: "Alto",
    badge: "destructive" as const,
    message: `La solucion esta concentrada. Diluya con agua limpia para bajar cerca de ${Math.abs(difference)} ppm.`,
    difference,
  }
}

export function FertilizerPreparationView({ selectedGreenhouse }: FertilizerPreparationViewProps) {
  const [selectedZoneId, setSelectedZoneId] = useState("")
  const [tankLiters, setTankLiters] = useState("1000")

  const { data: zones, isLoading: loadingZones } = useSWR<ZoneData[]>(
    selectedGreenhouse ? `/api/zones?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )
  const { data: crops } = useSWR<CropWithProfile[]>(
    selectedGreenhouse ? `/api/crops?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )
  const { data: sensors } = useSWR<SensorData[]>(
    selectedGreenhouse ? `/api/sensors?greenhouse=${selectedGreenhouse}` : null,
    fetcher,
    { refreshInterval: 5000 }
  )

  const zoneList = zones || []
  const selectedZone = zoneList.find((zone) => zone.id === selectedZoneId) || zoneList[0]
  const selectedCrop = (crops || []).find((crop) => {
    if (!selectedZone?.cultivoActual) return false
    return crop.nombre.trim().toLowerCase() === selectedZone.cultivoActual.trim().toLowerCase()
  })
  const localProfile = selectedZone?.cultivoActual ? getPerfilAgronomico(selectedZone.cultivoActual) : null

  const tdsSensor = useMemo(() => {
    if (!selectedZone) return null
    const zoneSensor = (sensors || []).find((sensor) => {
      return sensor.tipo?.toLowerCase() === "tds" && sensor.zonaRiegoId === selectedZone.id
    })
    if (zoneSensor) return zoneSensor

    return (sensors || []).find((sensor) => sensor.tipo?.toLowerCase() === "tds") || null
  }, [selectedZone, sensors])

  const currentTds = selectedZone?.sensores?.tds?.valor ?? tdsSensor?.ultimaLectura ?? null
  const currentTdsUnit = selectedZone?.sensores?.tds?.unidad || tdsSensor?.unidad || "ppm"
  const targetTds = selectedZone?.umbral_tds || selectedCrop?.umbralTds || selectedCrop?.detalle?.umbralTds || 800
  const status = getTdsStatus(currentTds, targetTds)
  const tankVolume = Math.max(0, Number(tankLiters) || 0)

  const fertilizers = useMemo(() => {
    const sources = [
      selectedZone?.fertilizanteEstimado,
      selectedCrop?.fertilizantes,
      selectedCrop?.perfilAgronomico?.fertilizantes,
      localProfile?.fertilizantes,
    ]

    for (const source of sources) {
      const parsed = parseFertilizers(source)
      if (parsed.length > 0) return parsed
    }

    return []
  }, [selectedZone, selectedCrop, localProfile])

  const progressValue = currentTds == null ? 0 : Math.min(100, Math.max(0, (currentTds / Math.max(targetTds * 1.4, 1)) * 100))
  const targetProgress = Math.min(100, Math.max(0, (targetTds / Math.max(targetTds * 1.4, 1)) * 100))
  const recommendation = selectedZone?.recomendacionSiembra || selectedCrop?.recomendacionSiembra || ""

  if (loadingZones && !zones) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-foreground">Preparacion de Fertilizante</h2>
        <p className="text-sm text-muted-foreground">
          Seleccione una zona para preparar la solucion segun el cultivo y controlar el valor con el sensor TDS.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-5 w-5 text-primary" />
              Solucion por cultivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Zona y cultivo</Label>
                <Select value={selectedZone?.id || ""} onValueChange={setSelectedZoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {zoneList.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        No hay zonas registradas
                      </SelectItem>
                    ) : (
                      zoneList.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.nombre} - {zone.cultivoActual || "Sin cultivo"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Volumen del tanque</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={tankLiters}
                    onChange={(event) => setTankLiters(event.target.value)}
                  />
                  <span className="w-16 text-sm text-muted-foreground">litros</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TestTubes className="h-4 w-4" />
                  TDS actual
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {currentTds == null ? "--" : Math.round(currentTds)} <span className="text-sm font-normal text-muted-foreground">{currentTdsUnit}</span>
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Gauge className="h-4 w-4" />
                  TDS objetivo
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {Math.round(targetTds)} <span className="text-sm font-normal text-muted-foreground">ppm</span>
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge variant={status.badge}>{status.label}</Badge>
                </div>
                <p className="mt-2 text-sm text-foreground">{status.message}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Lectura TDS</span>
                <span>Objetivo: {Math.round(targetTds)} ppm</span>
              </div>
              <div className="relative">
                <Progress value={progressValue} className="h-3" />
                <div
                  className="absolute top-[-3px] h-5 w-0.5 bg-foreground"
                  style={{ left: `${targetProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sensor: {tdsSensor?.nombre || "No asignado"} · Ultima lectura: {formatDate(tdsSensor?.ultimoReporte || selectedZone?.sensores?.tds?.ultimaActualizacion)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="h-5 w-5 text-primary" />
              Ajuste rapido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Cultivo</p>
              <p className="text-lg font-semibold">{selectedZone?.cultivoActual || "Sin cultivo seleccionado"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Diferencia TDS</p>
              <p className="text-lg font-semibold">
                {currentTds == null ? "--" : `${status.difference > 0 ? "+" : ""}${status.difference} ppm`}
              </p>
            </div>
            {recommendation ? (
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Recomendacion</p>
                <p className="mt-1 text-sm">{recommendation}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-primary" />
            Receta calculada
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fertilizers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Este cultivo no tiene fertilizantes con dosis registrada. Agregue la dosis en Cultivos para que aparezca aqui.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fertilizante</TableHead>
                  <TableHead>Dosis base</TableHead>
                  <TableHead>Volumen</TableHead>
                  <TableHead>Cantidad para preparar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fertilizers.map((fertilizer, index) => {
                  const amount = fertilizer.dosis != null ? fertilizer.dosis * (tankVolume / 1000) : null

                  return (
                    <TableRow key={`${fertilizer.nombre}-${index}`}>
                      <TableCell className="font-medium">{fertilizer.nombre}</TableCell>
                      <TableCell>
                        {fertilizer.dosis != null ? `${fertilizer.dosis} ${fertilizer.unidad}` : "Dosis no definida"}
                      </TableCell>
                      <TableCell>{tankVolume.toLocaleString("es-DO")} L</TableCell>
                      <TableCell className="font-semibold">
                        {amount != null ? `${Number(amount.toFixed(2)).toLocaleString("es-DO")} ${fertilizer.unidad.replace("/1000 L", "")}` : "Definir dosis"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
