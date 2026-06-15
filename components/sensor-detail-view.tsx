"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import useSWR from "swr"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Thermometer,
  Droplets,
  FlaskConical,
  Activity,
  AlertTriangle,
  Clock,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Gauge,
  Wifi,
  WifiOff,
  Loader2,
  Pencil,
} from "lucide-react"
import { api, fetcher } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts"
import { toast } from "sonner"
import type { UserRole } from "@/lib/greensense-data"
import type { Invernadero } from "@/lib/greensense-data"

interface CalibrationHistory {
  id: number
  descripcion: string
  severidad: string
  fecha: string
  modulo: string | null
  entidad: string | null
  entidadId: string | null
  accion: string | null
  valorAnterior: string | null
  valorNuevo: string | null
  origen: string | null
  usuarioId: number | null
  usuarioNombre: string | null
}

interface SensorData {
  id: string
  tipo: string
  nombre: string
  invernaderoId: string
  idDispositivo?: number
  estado: string
  modelo?: string
  marca?: string
  rangoMin?: number
  rangoMax?: number
  unidadMedida?: string
  precision?: number
  fechaInstalacion?: string
  ubicacionFisica?: string
  ultimoCalibrado?: string
  observaciones?: string
  ultimaLectura?: number
  unidad?: string
  umbralMin?: number
  umbralMax?: number
  ultimoReporte?: string
}

interface LecturaHistorial {
  timestamp: string
  valor: number
}

interface Alerta {
  id: string
  tipo_alerta: string
  tipo: string
  mensaje: string
  sensorId: string
  valor_detectado: number
  fecha_hora: string
  estado: string
  nivel: string
  umbral_min?: number
  umbral_max?: number
}

interface SensorProgramacion {
  sensorId: number
  intervaloSegundos: number
  modo: "automatico" | "manual"
  enviarAlertas: boolean
  activo: boolean
  actualizadoEn?: string
  estadoComando?: string
  fechaEnvio?: string
}

const SENSOR_ICONS: Record<string, React.ElementType> = {
  humedad_suelo: Droplets,
  temperatura: Thermometer,
  humedad_ambiental: Droplets,
  tds: FlaskConical,
  ph: FlaskConical,
  conductividad: Activity,
}

const SENSOR_TYPE_LABELS: Record<string, string> = {
  humedad_suelo: "Humedad del Suelo",
  temperatura: "Temperatura",
  humedad_ambiental: "Humedad Ambiental",
  tds: "TDS",
  ph: "pH",
  conductividad: "Conductividad",
}

const ALERT_COLORS: Record<string, string> = {
  critico: "bg-red-500/20 text-red-400 border-red-500/50",
  advertencia: "bg-amber-500/20 text-amber-400 border-amber-500/50",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/50",
}

const CHART_COLORS: Record<string, string> = {
  primary: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
}

interface SensorDetailViewProps {
  sensor: SensorData
  onBack: () => void
  userRole: UserRole
  historialPreload?: LecturaHistorial[]
}

export function SensorDetailView({ sensor, onBack, userRole, historialPreload }: SensorDetailViewProps) {
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false)
  const [thresholdForm, setThresholdForm] = useState({
    umbralMin: sensor.umbralMin?.toString() || "",
    umbralMax: sensor.umbralMax?.toString() || "",
  })
  const [saving, setSaving] = useState(false)
  const [programSaving, setProgramSaving] = useState(false)

  const isAdmin = userRole === "administrador" || userRole === "tecnico"
  const Icon = SENSOR_ICONS[sensor.tipo] || Activity
  const isActive = sensor.estado === "activo"
  const unidad = sensor.unidadMedida || sensor.unidad || ""

  const [historialData, setHistorialData] = useState<LecturaHistorial[]>(historialPreload || [])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [programLoading, setProgramLoading] = useState(false)
  const [programInfo, setProgramInfo] = useState<SensorProgramacion | null>(null)
  const [programForm, setProgramForm] = useState({
    intervaloSegundos: "300",
    modo: "automatico" as "automatico" | "manual",
    enviarAlertas: true,
    activo: true,
  })
  const [calibrationHistory, setCalibrationHistory] = useState<CalibrationHistory[]>([])
  const [calibrationLoading, setCalibrationLoading] = useState(false)
  const [newCalibrationOpen, setNewCalibrationOpen] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    if (historialPreload && historialPreload.length > 0) {
      setHistorialData(historialPreload)
    } else {
      setHistorialData([])
    }

    fetch(`/api/sensors/${sensor.id}/history`)
      .then(res => res.json())
      .then(data => {
        setHistorialData(Array.isArray(data) ? data : [])
      })
      .catch(err => console.error("Error historial:", err))
      .finally(() => setIsLoading(false))

    fetch(`/api/alerts?sensor=${sensor.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAlertas(data)
        }
      })
      .catch(err => console.error("Error alertas:", err))

    setProgramLoading(true)
    api.getSensorProgramming(sensor.id)
      .then((res) => {
        const p = res.programacion as SensorProgramacion | null
        if (!p) {
          setProgramInfo(null)
          setProgramForm({
            intervaloSegundos: "300",
            modo: "automatico",
            enviarAlertas: true,
            activo: true,
          })
          return
        }

        setProgramInfo(p)
        setProgramForm({
          intervaloSegundos: String(p.intervaloSegundos || 300),
          modo: p.modo || "automatico",
          enviarAlertas: p.enviarAlertas !== false,
          activo: p.activo !== false,
        })
      })
      .catch((err) => {
        console.error("Error programacion:", err)
      })
      .finally(() => setProgramLoading(false))

    setCalibrationLoading(true)
    fetch(`/api/sensors/${sensor.id}/calibration-history`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCalibrationHistory(data)
        }
      })
      .catch((err) => console.error("Error historial calibración:", err))
      .finally(() => setCalibrationLoading(false))
  }, [sensor.id, historialPreload])

  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)

  const greenhouseNombre = useMemo(() => {
    if (!greenhouses) return sensor.invernaderoId
    const gh = greenhouses.find((g) => g.id === sensor.invernaderoId)
    return gh?.nombre || sensor.invernaderoId
  }, [greenhouses, sensor.invernaderoId])

  const chartData = useMemo(() => {
    if (historialData && historialData.length > 0) {
      return historialData.map((h) => ({
        ...h,
        time: new Date(h.timestamp).toLocaleTimeString("es-DO", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: new Date(h.timestamp).toLocaleDateString("es-DO", {
          month: "short",
          day: "numeric",
        }),
      }))
    }
    return []
  }, [historialData])

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null
    const values = chartData.map((h) => h.valor)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const current = values[values.length - 1]
    const previous = values[values.length - 2] || current
    const trend = current - previous
    return { min, max, avg, current, trend }
  }, [chartData])

  const alertasActivas = alertas?.filter((a) => a.estado !== "resuelta") || []

  const handleSaveThresholds = useCallback(async () => {
    setSaving(true)
    try {
      await api.updateSensor(sensor.id, {
        umbralMin: thresholdForm.umbralMin ? Number(thresholdForm.umbralMin) : undefined,
        umbralMax: thresholdForm.umbralMax ? Number(thresholdForm.umbralMax) : undefined,
      })
      toast.success("Umbrales actualizados")
      setThresholdDialogOpen(false)
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSaving(false)
    }
  }, [sensor.id, thresholdForm])

  const handleSaveProgramming = useCallback(async () => {
    const intervalo = Number(programForm.intervaloSegundos)
    if (!Number.isFinite(intervalo) || intervalo < 10 || intervalo > 86400) {
      toast.error("Intervalo invalido", { description: "Use un valor entre 10 y 86400 segundos" })
      return
    }

    setProgramSaving(true)
    try {
      const response = await api.programSensor(sensor.id, {
        intervaloSegundos: intervalo,
        modo: programForm.modo,
        enviarAlertas: programForm.enviarAlertas,
        activo: programForm.activo,
      })

      const p = (response as { programacion?: SensorProgramacion }).programacion
      if (p) {
        setProgramInfo(p)
      }
      toast.success("Programacion enviada al dispositivo")
    } catch (err) {
      toast.error("No se pudo programar el sensor", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setProgramSaving(false)
    }
  }, [programForm, sensor.id])

  const handleSaveCalibration = useCallback(async () => {
    const calibrationDate = new Date().toISOString().split("T")[0]
    setSaving(true)
    try {
      await api.updateSensor(sensor.id, {
        ultimoCalibrado: calibrationDate,
      })
      toast.success("Calibración registrada", { description: `Fecha: ${calibrationDate}` })
      setNewCalibrationOpen(false)
      fetch(`/api/sensors/${sensor.id}/calibration-history`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCalibrationHistory(data)
          }
        })
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSaving(false)
    }
  }, [sensor.id])

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString("es-DO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleString("es-DO", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {sensor.nombre || SENSOR_TYPE_LABELS[sensor.tipo] || sensor.tipo}
            </h2>
            <p className="text-sm text-muted-foreground">
              {SENSOR_TYPE_LABELS[sensor.tipo] || sensor.tipo} • {greenhouseNombre}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className={isActive ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-amber-500/20 text-amber-400 border-amber-500/50"}>
            {isActive ? (
              <><Wifi className="mr-1 h-3 w-3" />Activo</>
            ) : (
              <><WifiOff className="mr-1 h-3 w-3" />{sensor.estado}</>
            )}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Historial de Lecturas</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Ultimas 48 horas
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Sin lecturas guardadas para este sensor
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    {sensor.umbralMin !== undefined && (
                      <ReferenceLine
                        y={sensor.umbralMin}
                        stroke={CHART_COLORS.danger}
                        strokeDasharray="5 5"
                        label={{ value: "Min", position: "insideTopRight", fill: CHART_COLORS.danger, fontSize: 10 }}
                      />
                    )}
                    {sensor.umbralMax !== undefined && (
                      <ReferenceLine
                        y={sensor.umbralMax}
                        stroke={CHART_COLORS.danger}
                        strokeDasharray="5 5"
                        label={{ value: "Max", position: "insideBottomRight", fill: CHART_COLORS.danger, fontSize: 10 }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke={CHART_COLORS.primary}
                      fillOpacity={1}
                      fill="url(#colorValor)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>Lectura</span>
              </div>
              {sensor.umbralMin !== undefined && (
                <div className="flex items-center gap-1">
                  <div className="h-0 w-3 border-t-2 border-dashed border-red-500" />
                  <span>Umbrales</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Lectura Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-bold text-foreground">
                    {stats?.current?.toFixed(1) || sensor.ultimaLectura?.toFixed(1) || "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">{unidad}</div>
                </div>
                {stats && (
                  <div className={`flex items-center gap-1 text-sm ${stats.trend > 0 ? "text-green-500" : stats.trend < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {stats.trend > 0 ? <TrendingUp className="h-4 w-4" /> : stats.trend < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    <span>{Math.abs(stats.trend).toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Ultima actualizacion: {sensor.ultimoReporte ? formatDateTime(sensor.ultimoReporte) : "Sin lecturas"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Estadisticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Minimo</span>
                <span className="font-medium">{stats?.min?.toFixed(1) || "—"} {unidad}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Maximo</span>
                <span className="font-medium">{stats?.max?.toFixed(1) || "—"} {unidad}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Promedio</span>
                <span className="font-medium">{stats?.avg?.toFixed(1) || "—"} {unidad}</span>
              </div>
            </CardContent>
          </Card>

          {alertasActivas.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas ({alertasActivas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alertasActivas.slice(0, 3).map((alerta) => (
                  <div key={alerta.id} className="rounded-md bg-amber-500/10 p-2 text-xs">
                    <div className="font-medium">{alerta.tipo_alerta || alerta.tipo}</div>
                    <div className="text-muted-foreground">{formatDateTime(alerta.fecha_hora)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Informacion</TabsTrigger>
          <TabsTrigger value="programming">Programacion</TabsTrigger>
          <TabsTrigger value="calibration">Calibracion</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">ID Sensor</div>
                  <div className="font-mono text-sm">{sensor.id}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Marca</div>
                  <div className="font-medium">{sensor.marca || "No especificada"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Modelo</div>
                  <div className="font-medium">{sensor.modelo || "No especificado"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Ubicacion</div>
                  <div className="font-medium">{sensor.ubicacionFisica || "No especificada"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Rango</div>
                  <div className="font-medium">
                    {sensor.rangoMin !== undefined && sensor.rangoMax !== undefined
                      ? `${sensor.rangoMin} - ${sensor.rangoMax} ${unidad}`
                      : "No definido"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Precision</div>
                  <div className="font-medium">
                    {sensor.precision !== undefined ? `±${sensor.precision} ${unidad}` : "No especificada"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fecha Instalacion</div>
                  <div className="flex items-center gap-1 font-medium">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {formatDate(sensor.fechaInstalacion)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dispositivo IoT</div>
                  <div className="font-medium">
                    {sensor.idDispositivo ? `#${sensor.idDispositivo}` : "No asignado"}
                  </div>
                </div>
              </div>

              {sensor.observaciones && (
                <div className="mt-6 border-t pt-4">
                  <div className="text-xs text-muted-foreground">Observaciones</div>
                  <div className="mt-1 text-sm">{sensor.observaciones}</div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                {isAdmin && (
                  <Button variant="outline" onClick={() => setThresholdDialogOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurar Umbrales
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programming" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Intervalo de lectura (segundos)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={86400}
                    placeholder="300"
                    value={programForm.intervaloSegundos}
                    onChange={(e) =>
                      setProgramForm((prev) => ({ ...prev, intervaloSegundos: e.target.value }))
                    }
                    disabled={!isAdmin}
                  />
                  <p className="text-xs text-muted-foreground">
                    Define cada cuantos segundos el dispositivo reporta una lectura.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Modo de operacion</Label>
                  <Select
                    value={programForm.modo}
                    onValueChange={(v) =>
                      setProgramForm((prev) => ({ ...prev, modo: v as "automatico" | "manual" }))
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatico">Automatico</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Alertas automaticas</Label>
                  <Select
                    value={programForm.enviarAlertas ? "si" : "no"}
                    onValueChange={(v) =>
                      setProgramForm((prev) => ({ ...prev, enviarAlertas: v === "si" }))
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="si">Habilitadas</SelectItem>
                      <SelectItem value="no">Deshabilitadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Estado de sensor programado</Label>
                  <Select
                    value={programForm.activo ? "activo" : "inactivo"}
                    onValueChange={(v) =>
                      setProgramForm((prev) => ({ ...prev, activo: v === "activo" }))
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-5 rounded-lg border p-4 text-sm">
                <p className="font-medium text-foreground">Ultima programacion enviada</p>
                {programLoading ? (
                  <p className="mt-2 text-muted-foreground">Cargando...</p>
                ) : programInfo ? (
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>Intervalo: {programInfo.intervaloSegundos}s</p>
                    <p>Modo: {programInfo.modo}</p>
                    <p>Alertas: {programInfo.enviarAlertas ? "si" : "no"}</p>
                    <p>Activo: {programInfo.activo ? "si" : "no"}</p>
                    {programInfo.fechaEnvio && <p>Enviado: {formatDateTime(programInfo.fechaEnvio)}</p>}
                    {programInfo.estadoComando && <p>Estado comando: {programInfo.estadoComando}</p>}
                  </div>
                ) : (
                  <p className="mt-2 text-muted-foreground">Sin programacion registrada para este sensor.</p>
                )}
              </div>

              {isAdmin && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSaveProgramming} disabled={programSaving}>
                    {programSaving ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Programando...</>
                    ) : (
                      "Aplicar Programacion"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calibration" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Gauge className="h-4 w-4" />
                    Ultimo Calibrado
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {formatDate(sensor.ultimoCalibrado)}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Fecha Instalacion
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {formatDate(sensor.fechaInstalacion)}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    Dias en Servicio
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {sensor.fechaInstalacion
                      ? Math.floor(
                          (Date.now() - new Date(sensor.fechaInstalacion).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : "N/A"}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setNewCalibrationOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Registrar Calibracion
                  </Button>
                </div>
              )}

              <div className="mt-6 border-t pt-6">
                <h3 className="mb-4 text-sm font-medium">Historial de Calibraciones</h3>
                {calibrationLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : calibrationHistory && calibrationHistory.length > 0 ? (
                  <div className="space-y-3">
                    {calibrationHistory.map((cal) => (
                      <div key={cal.id} className="flex items-start justify-between rounded-lg border p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
                            <Gauge className="h-4 w-4 text-blue-500" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              Calibración: {cal.valorNuevo || "N/A"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Anterior: {cal.valorAnterior || "Sin registro"} • Por: {cal.usuarioNombre || "Sistema"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {formatDateTime(cal.fecha)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                    <Gauge className="h-8 w-8" />
                    <p className="text-sm">Sin historial de calibraciones</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {alertas && alertas.length > 0 ? (
                <div className="space-y-3">
                  {alertas.map((alerta) => (
                    <div
                      key={alerta.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${ALERT_COLORS[alerta.nivel] || ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        <div>
                          <div className="font-medium">{alerta.tipo_alerta || alerta.tipo}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(alerta.fecha_hora)} • Valor: {alerta.valor_detectado} {unidad}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{alerta.estado}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Activity className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Sin alertas para este sensor</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={thresholdDialogOpen} onOpenChange={setThresholdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Umbrales</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Umbral Minimo ({unidad})</Label>
              <Input
                type="number"
                placeholder="Valor minimo"
                value={thresholdForm.umbralMin}
                onChange={(e) =>
                  setThresholdForm({ ...thresholdForm, umbralMin: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Se generara alerta cuando el valor caiga por debajo
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Umbral Maximo ({unidad})</Label>
              <Input
                type="number"
                placeholder="Valor maximo"
                value={thresholdForm.umbralMax}
                onChange={(e) =>
                  setThresholdForm({ ...thresholdForm, umbralMax: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Se generara alerta cuando el valor supere este limite
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveThresholds} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newCalibrationOpen} onOpenChange={setNewCalibrationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Calibracion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Se registrara la calibración del sensor con la fecha de hoy: <span className="font-medium text-foreground">{new Date().toLocaleDateString("es-DO")}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Esta accion creara un registro en el historial de calibraciones.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveCalibration} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : "Confirmar Calibracion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

