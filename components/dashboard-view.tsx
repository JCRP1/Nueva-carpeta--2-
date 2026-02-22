"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Droplets,
  Thermometer,
  Wind,
  FlaskConical,
  TestTubes,
  Activity,
  TrendingDown,
  TrendingUp,
  Minus,
  Wifi,
  WifiOff,
  Bell,
  RefreshCw,
  Loader2,
} from "lucide-react"
import type { UserRole } from "@/lib/greensense-data"
import { fetcher } from "@/lib/api-client"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { toast } from "sonner"

interface SensorData {
  id: string
  tipo: string
  nombre: string
  invernaderoId: string
  zonaRiegoId: string
  estado: string
  ultimaLectura: number
  unidad: string
  umbralMin: number
  umbralMax: number
  ultimaActualizacion: string
  history?: { timestamp: string; valor: number }[]
}

interface DashboardData {
  sensors: SensorData[]
  zones: Array<{ id: string; estadoRiego: string }>
  activeAlerts: number
  activeIrrigation: number
  recentEvents: Array<{
    id: string
    zonaRiegoId: string
    zonaNombre: string
    tipo: string
    inicio: string
    fin: string
    duracion: number
    volumen: number
    estado: string
  }>
  consumoAgua: Array<{ dia: string; litros: number }>
  greenhouse: { id: string; nombre: string; estado: string } | null
}

function getSensorIcon(tipo: string) {
  switch (tipo) {
    case "humedad_suelo": return Droplets
    case "temperatura": return Thermometer
    case "humedad_ambiental": return Wind
    case "tds": return TestTubes
    case "ph": return FlaskConical
    default: return Activity
  }
}

function getSensorColor(tipo: string) {
  switch (tipo) {
    case "humedad_suelo": return "text-blue-400"
    case "temperatura": return "text-orange-400"
    case "humedad_ambiental": return "text-cyan-400"
    case "tds": return "text-emerald-400"
    case "ph": return "text-violet-400"
    default: return "text-muted-foreground"
  }
}

function getSensorBg(tipo: string) {
  switch (tipo) {
    case "humedad_suelo": return "bg-blue-400/10"
    case "temperatura": return "bg-orange-400/10"
    case "humedad_ambiental": return "bg-cyan-400/10"
    case "tds": return "bg-emerald-400/10"
    case "ph": return "bg-violet-400/10"
    default: return "bg-muted"
  }
}

function getStatusValue(actual: number, min: number, max: number) {
  if (actual < min) return "bajo"
  if (actual > max) return "alto"
  return "normal"
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })
}

function SensorCard({ sensor }: { sensor: SensorData }) {
  const Icon = getSensorIcon(sensor.tipo)
  const color = getSensorColor(sensor.tipo)
  const bg = getSensorBg(sensor.tipo)
  const status = sensor.estado === "error" ? "error" : getStatusValue(sensor.ultimaLectura, sensor.umbralMin, sensor.umbralMax)

  return (
    <Card className="relative overflow-hidden group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{sensor.nombre}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  {sensor.estado === "error" ? "--" : sensor.ultimaLectura}
                </span>
                <span className="text-xs text-muted-foreground">{sensor.unidad === "C" ? "\u00B0C" : sensor.unidad}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {sensor.estado === "error" ? (
              <Badge variant="destructive" className="text-[10px]">Error</Badge>
            ) : status === "bajo" ? (
              <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">
                <TrendingDown className="mr-1 h-3 w-3" />Bajo
              </Badge>
            ) : status === "alto" ? (
              <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px]">
                <TrendingUp className="mr-1 h-3 w-3" />Alto
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">
                <Minus className="mr-1 h-3 w-3" />Normal
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{formatTime(sensor.ultimaActualizacion)}</span>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{sensor.umbralMin}{sensor.unidad === "C" ? "\u00B0C" : sensor.unidad}</span>
            <span>{sensor.umbralMax}{sensor.unidad === "C" ? "\u00B0C" : sensor.unidad}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                status === "normal" ? "bg-emerald-500" : status === "bajo" ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{
                width: `${sensor.estado === "error" ? 0 : Math.min(100, Math.max(0, ((sensor.ultimaLectura - sensor.umbralMin) / (sensor.umbralMax - sensor.umbralMin)) * 100))}%`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatChartTime(ts: string) {
  return new Date(ts).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })
}

interface DashboardViewProps {
  selectedGreenhouse: string
  userRole: UserRole
}

export function DashboardView({ selectedGreenhouse, userRole }: DashboardViewProps) {
  // Fetch dashboard overview
  const { data: dashboard, isLoading: loadingDash, mutate: mutateDash } = useSWR<DashboardData>(
    `/api/dashboard?greenhouse=${selectedGreenhouse}`,
    fetcher,
    { refreshInterval: 15000 }
  )

  // Fetch sensors with history for charts
  const { data: sensorsWithHistory, isLoading: loadingSensors, mutate: mutateSensors } = useSWR<SensorData[]>(
    `/api/sensors?greenhouse=${selectedGreenhouse}`,
    fetcher,
    { refreshInterval: 15000 }
  )

  const [refreshing, setRefreshing] = useState(false)

  const sensors = dashboard?.sensors || []
  const activeSensors = sensors.filter((s) => s.estado === "activo").length
  const errorSensors = sensors.filter((s) => s.estado === "error").length
  const activeIrrigation = dashboard?.activeIrrigation || 0
  const unresolvedAlerts = dashboard?.activeAlerts || 0
  const consumoAgua = dashboard?.consumoAgua || []
  const recentEvents = dashboard?.recentEvents || []
  const ghName = dashboard?.greenhouse?.nombre || "Invernadero"

  // Build chart data from sensor history
  const humedadHistory = (sensorsWithHistory || []).find((s) => s.tipo === "humedad_suelo")?.history || []
  const tempHistory = (sensorsWithHistory || []).find((s) => s.tipo === "temperatura")?.history || []
  const humedadAmbHistory = (sensorsWithHistory || []).find((s) => s.tipo === "humedad_ambiental")?.history || []
  const phHistory = (sensorsWithHistory || []).find((s) => s.tipo === "ph")?.history || []
  const tdsHistory = (sensorsWithHistory || []).find((s) => s.tipo === "tds")?.history || []

  function handleRefreshAll() {
    setRefreshing(true)
    Promise.all([mutateDash(), mutateSensors()]).then(() => {
      setRefreshing(false)
      toast.success("Dashboard actualizado", { description: "Todos los datos han sido refrescados" })
    })
  }

  const isLoading = loadingDash && !dashboard

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status overview */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Resumen del Sistema</h3>
        <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualizando..." : "Actualizar Todo"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Wifi className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sensores Activos</p>
              <p className="text-xl font-bold text-foreground">{activeSensors}/{sensors.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-400/10">
              <Droplets className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Riegos Activos</p>
              <p className="text-xl font-bold text-foreground">{activeIrrigation}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/10">
              <Bell className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alertas Activas</p>
              <p className="text-xl font-bold text-foreground">{unresolvedAlerts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10">
              {errorSensors > 0 ? <WifiOff className="h-5 w-5 text-red-400" /> : <Activity className="h-5 w-5 text-emerald-400" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado General</p>
              <p className="text-xl font-bold text-foreground">{errorSensors > 0 ? `${errorSensors} errores` : "OK"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sensor readings */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Lecturas en Tiempo Real - {ghName}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sensors.length > 0 ? (
            sensors.map((sensor) => (
              <SensorCard key={sensor.id} sensor={sensor} />
            ))
          ) : (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center gap-2 py-8">
                <Activity className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-foreground">Sin sensores en este invernadero</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Humedad del Suelo (12h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={humedadHistory.slice(-24)}>
                <defs>
                  <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200, 65%, 46%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(200, 65%, 46%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 10%, 16%)" />
                <XAxis dataKey="timestamp" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" domain={[20, 70]} />
                <Tooltip contentStyle={{ background: "hsl(150, 14%, 9%)", border: "1px solid hsl(150, 10%, 16%)", borderRadius: "8px", fontSize: 12, color: "hsl(150, 8%, 93%)" }} labelFormatter={formatChartTime} formatter={(value: number) => [`${value}%`, "Humedad"]} />
                <Area type="monotone" dataKey="valor" stroke="hsl(200, 65%, 46%)" fill="url(#humGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Temperatura Ambiental (12h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tempHistory.slice(-24)}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(30, 80%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(30, 80%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 10%, 16%)" />
                <XAxis dataKey="timestamp" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" domain={[15, 40]} />
                <Tooltip contentStyle={{ background: "hsl(150, 14%, 9%)", border: "1px solid hsl(150, 10%, 16%)", borderRadius: "8px", fontSize: 12, color: "hsl(150, 8%, 93%)" }} labelFormatter={formatChartTime} formatter={(value: number) => [`${value}\u00B0C`, "Temperatura"]} />
                <Area type="monotone" dataKey="valor" stroke="hsl(30, 80%, 55%)" fill="url(#tempGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Humedad Ambiental (12h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={humedadAmbHistory.slice(-24)}>
                <defs>
                  <linearGradient id="hambGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(173, 58%, 39%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(173, 58%, 39%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 10%, 16%)" />
                <XAxis dataKey="timestamp" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" domain={[40, 90]} />
                <Tooltip contentStyle={{ background: "hsl(150, 14%, 9%)", border: "1px solid hsl(150, 10%, 16%)", borderRadius: "8px", fontSize: 12, color: "hsl(150, 8%, 93%)" }} labelFormatter={formatChartTime} formatter={(value: number) => [`${value}%`, "Humedad Amb."]} />
                <Area type="monotone" dataKey="valor" stroke="hsl(173, 58%, 39%)" fill="url(#hambGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">pH Agua / Sustrato (12h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={phHistory.slice(-24)}>
                <defs>
                  <linearGradient id="phGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(263, 70%, 58%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(263, 70%, 58%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 10%, 16%)" />
                <XAxis dataKey="timestamp" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" domain={[4, 9]} />
                <Tooltip contentStyle={{ background: "hsl(150, 14%, 9%)", border: "1px solid hsl(150, 10%, 16%)", borderRadius: "8px", fontSize: 12, color: "hsl(150, 8%, 93%)" }} labelFormatter={formatChartTime} formatter={(value: number) => [value.toFixed(1), "pH"]} />
                <Area type="monotone" dataKey="valor" stroke="hsl(263, 70%, 58%)" fill="url(#phGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">EC / TDS (12h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tdsHistory.slice(-24)}>
                <defs>
                  <linearGradient id="tdsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 10%, 16%)" />
                <XAxis dataKey="timestamp" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" domain={[300, 1500]} />
                <Tooltip contentStyle={{ background: "hsl(150, 14%, 9%)", border: "1px solid hsl(150, 10%, 16%)", borderRadius: "8px", fontSize: 12, color: "hsl(150, 8%, 93%)" }} labelFormatter={formatChartTime} formatter={(value: number) => [`${value} ppm`, "TDS"]} />
                <Area type="monotone" dataKey="valor" stroke="hsl(152, 60%, 42%)" fill="url(#tdsGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Consumo de Agua Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={consumoAgua}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 10%, 16%)" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(150, 5%, 55%)" }} stroke="hsl(150, 10%, 16%)" />
                <Tooltip contentStyle={{ background: "hsl(150, 14%, 9%)", border: "1px solid hsl(150, 10%, 16%)", borderRadius: "8px", fontSize: 12, color: "hsl(150, 8%, 93%)" }} formatter={(value: number) => [`${value}L`, "Consumo"]} />
                <Bar dataKey="litros" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent irrigation events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Eventos de Riego Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEvents.length > 0 ? recentEvents.map((evento) => (
              <div key={evento.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${evento.estado === "en_curso" ? "bg-blue-400/10" : "bg-muted"}`}>
                    <Droplets className={`h-4 w-4 ${evento.estado === "en_curso" ? "text-blue-400" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{evento.zonaNombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(evento.inicio)} {evento.fin && ` - ${formatTime(evento.fin)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{evento.estado === "en_curso" ? "En curso" : `${evento.duracion}min`}</p>
                    <p className="text-xs text-muted-foreground">{evento.volumen > 0 ? `${evento.volumen}L` : ""}</p>
                  </div>
                  <Badge className={evento.estado === "en_curso" ? "bg-blue-500/20 text-blue-400 border-0" : evento.tipo === "automatico" ? "bg-emerald-500/20 text-emerald-400 border-0" : "bg-amber-500/20 text-amber-400 border-0"}>
                    {evento.tipo === "automatico" ? "Auto" : "Manual"}
                  </Badge>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sin eventos recientes</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
