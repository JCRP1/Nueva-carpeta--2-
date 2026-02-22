"use client"

import { useState, useCallback } from "react"
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
  onToggleIrrigation,
  onSaveConfig,
  onToggleAuto,
  userRole,
}: {
  zona: ZoneData
  greenhouses: Invernadero[]
  onToggleIrrigation: (id: string) => void
  onSaveConfig: (id: string, cultivo: string, umbral: number) => void
  onToggleAuto: (id: string) => void
  userRole: UserRole
}) {
  const [configCultivo, setConfigCultivo] = useState(zona.cultivoActual)
  const [configUmbral, setConfigUmbral] = useState(zona.umbralHumedad)
  const [saving, setSaving] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)

  const isAdmin = userRole === "administrador"
  const canControl = userRole === "administrador" || userRole === "tecnico"
  const isIrrigating = zona.estadoRiego === "activo"

  const greenhouse = greenhouses.find((i) => i.id === zona.invernaderoId)

  function handleSaveConfig() {
    setSaving(true)
    onSaveConfig(zona.id, configCultivo, configUmbral)
    setTimeout(() => {
      setSaving(false)
      setConfigOpen(false)
    }, 800)
  }

  return (
    <Card className="relative overflow-hidden">
      {isIrrigating && <div className="absolute inset-x-0 top-0 h-1 bg-blue-500 animate-pulse" />}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">{zona.nombre}</CardTitle>
            <p className="text-xs text-muted-foreground">{greenhouse?.nombre} &middot; {zona.cultivoActual}</p>
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
                  <Button variant="outline" size="sm" className="h-8 bg-transparent">
                    <Settings className="mr-1 h-3.5 w-3.5" />Config
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Configurar {zona.nombre}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex flex-col gap-2">
                      <Label>Cultivo Actual</Label>
                      <Input value={configCultivo} onChange={(e) => setConfigCultivo(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Umbral de Humedad: {configUmbral}%</Label>
                      <Slider value={[configUmbral]} onValueChange={(v) => setConfigUmbral(v[0])} min={10} max={80} step={5} />
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
    { refreshInterval: 15000 }
  )
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)

  const [newZoneOpen, setNewZoneOpen] = useState(false)
  const [newZoneName, setNewZoneName] = useState("")
  const [newZoneCultivo, setNewZoneCultivo] = useState("")
  const [newZoneGreenhouse, setNewZoneGreenhouse] = useState(selectedGreenhouse)
  const [newZoneUmbral, setNewZoneUmbral] = useState(40)
  const [creatingZone, setCreatingZone] = useState(false)

  const isAdmin = userRole === "administrador"
  const ghList = greenhouses || []
  const zoneList = zones || []

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

  const handleSaveConfig = useCallback(async (id: string, cultivo: string, umbral: number) => {
    try {
      await api.updateZone(id, { cultivoActual: cultivo, umbralHumedad: umbral })
      mutate()
      toast.success("Configuracion guardada", { description: `Cultivo: ${cultivo}, Umbral: ${umbral}%` })
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    }
  }, [mutate])

  async function handleCreateZone() {
    if (!newZoneName || !newZoneCultivo) {
      toast.error("Complete todos los campos", { description: "Nombre y cultivo son requeridos" })
      return
    }
    setCreatingZone(true)
    try {
      await api.createZone({
        nombre: newZoneName,
        invernaderoId: newZoneGreenhouse,
        cultivoActual: newZoneCultivo,
        umbralHumedad: newZoneUmbral,
      })
      mutate()
      setNewZoneOpen(false)
      setNewZoneName("")
      setNewZoneCultivo("")
      setNewZoneUmbral(40)
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
          <Dialog open={newZoneOpen} onOpenChange={setNewZoneOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />Nueva Zona
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-foreground">Crear Nueva Zona de Riego</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Nombre de la Zona</Label>
                  <Input placeholder="Ej: Zona 5 - Pepinos" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Cultivo</Label>
                  <Input placeholder="Ej: Pepino" value={newZoneCultivo} onChange={(e) => setNewZoneCultivo(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Invernadero</Label>
                  <Select value={newZoneGreenhouse} onValueChange={setNewZoneGreenhouse}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ghList.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>{inv.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Umbral de Humedad: {newZoneUmbral}%</Label>
                  <Slider value={[newZoneUmbral]} onValueChange={(v) => setNewZoneUmbral(v[0])} min={10} max={80} step={5} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleCreateZone} disabled={creatingZone}>
                  {creatingZone ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : "Crear Zona"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
