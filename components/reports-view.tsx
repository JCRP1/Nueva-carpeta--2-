"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  Droplets,
  Thermometer,
  Leaf,
  Calendar,
  Loader2,
  FileSpreadsheet,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import type { UserRole } from "@/lib/greensense-data"
import { fetcher } from "@/lib/api-client"
import { toast } from "sonner"

interface SensorWithHistory {
  id: string
  tipo: string
  nombre: string
  history?: { timestamp: string; valor: number }[]
}

interface DashboardData {
  consumoAgua: Array<{ dia: string; litros: number }>
  recentEvents: Array<{
    id: string
    tipo: string
    duracion: number
    volumen: number
    estado: string
  }>
}

const defaultWeeklyWater = [
  { dia: "Lun", litros: 850 },
  { dia: "Mar", litros: 920 },
  { dia: "Mie", litros: 780 },
  { dia: "Jue", litros: 1100 },
  { dia: "Vie", litros: 950 },
  { dia: "Sab", litros: 620 },
  { dia: "Dom", litros: 480 },
]

const monthlyWater = [
  { dia: "Sem 1", litros: 4200 },
  { dia: "Sem 2", litros: 4800 },
  { dia: "Sem 3", litros: 3900 },
  { dia: "Sem 4", litros: 4500 },
]

const weeklyRiegoData = [
  { semana: "Sem 1", riegoAuto: 28, riegoManual: 5, aguaTotal: 4200, alertas: 8 },
  { semana: "Sem 2", riegoAuto: 32, riegoManual: 3, aguaTotal: 4800, alertas: 5 },
  { semana: "Sem 3", riegoAuto: 25, riegoManual: 7, aguaTotal: 3900, alertas: 12 },
  { semana: "Sem 4", riegoAuto: 30, riegoManual: 4, aguaTotal: 4500, alertas: 6 },
]

const monthlyEfficiency = [
  { mes: "Sep", eficiencia: 78 },
  { mes: "Oct", eficiencia: 82 },
  { mes: "Nov", eficiencia: 85 },
  { mes: "Dic", eficiencia: 80 },
  { mes: "Ene", eficiencia: 88 },
  { mes: "Feb", eficiencia: 91 },
]

const nutrientUsage = [
  { dia: "Lun", nitrogeno: 45, fosforo: 28, potasio: 35 },
  { dia: "Mar", nitrogeno: 52, fosforo: 32, potasio: 40 },
  { dia: "Mie", nitrogeno: 38, fosforo: 25, potasio: 30 },
  { dia: "Jue", nitrogeno: 60, fosforo: 35, potasio: 45 },
  { dia: "Vie", nitrogeno: 48, fosforo: 30, potasio: 38 },
  { dia: "Sab", nitrogeno: 30, fosforo: 20, potasio: 25 },
  { dia: "Dom", nitrogeno: 22, fosforo: 15, potasio: 18 },
]

const tooltipStyle = {
  background: "hsl(150, 14%, 9%)",
  border: "1px solid hsl(150, 10%, 16%)",
  borderRadius: "8px",
  fontSize: 12,
  color: "hsl(150, 8%, 93%)",
}
const axisTickStyle = { fontSize: 10, fill: "hsl(150, 5%, 55%)" }
const gridStroke = "hsl(150, 10%, 16%)"

function formatChartTime(ts: string) {
  return new Date(ts).toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = "\uFEFF"
  const csvContent = bom + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

interface ReportsViewProps {
  userRole: UserRole
}

export function ReportsView({ userRole }: ReportsViewProps) {
  const isAdmin = userRole === "administrador"
  const [period, setPeriod] = useState("semana")
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState("consumo")

  // Fetch real data from API
  const { data: dashData } = useSWR<DashboardData>("/api/dashboard?greenhouse=inv1", fetcher)
  const { data: sensorsData } = useSWR<SensorWithHistory[]>("/api/sensors", fetcher)

  const weeklyWater = dashData?.consumoAgua || defaultWeeklyWater
  const dailyWater = weeklyWater.slice(0, 1).map((d) => ({ ...d, dia: "Hoy" }))
  const events = dashData?.recentEvents || []
  const humedadSueloHistory = (sensorsData || []).find((s) => s.tipo === "humedad_suelo")?.history || []
  const tdsHistory = (sensorsData || []).find((s) => s.tipo === "tds")?.history || []

  const completedEvents = useMemo(
    () => events.filter((e) => e.estado === "completado"),
    [events]
  )
  const totalWater = useMemo(
    () => completedEvents.reduce((acc, e) => acc + e.volumen, 0),
    [completedEvents]
  )
  const totalDuration = useMemo(
    () => completedEvents.reduce((acc, e) => acc + e.duracion, 0),
    [completedEvents]
  )
  const autoEvents = useMemo(
    () => completedEvents.filter((e) => e.tipo === "automatico"),
    [completedEvents]
  )

  const waterData = useMemo(() => {
    switch (period) {
      case "dia": return dailyWater
      case "mes": return monthlyWater
      default: return weeklyWater
    }
  }, [period, weeklyWater, dailyWater])

  const periodLabel = useMemo(() => {
    switch (period) {
      case "dia": return "hoy"
      case "mes": return "este mes"
      default: return "esta semana"
    }
  }, [period])

  const handleExport = useCallback(() => {
    setExporting(true)
    setTimeout(() => {
      switch (activeTab) {
        case "consumo": {
          downloadCSV(
            `greensense-consumo-${period}.csv`,
            ["Periodo", "Litros"],
            waterData.map((d) => [d.dia, String(d.litros)])
          )
          break
        }
        case "sensores": {
          downloadCSV(
            `greensense-sensores-${period}.csv`,
            ["Timestamp", "Humedad Suelo (%)"],
            humedadSueloHistory.map((d) => [d.timestamp, String(d.valor)])
          )
          break
        }
        case "nutrientes": {
          downloadCSV(
            `greensense-nutrientes-${period}.csv`,
            ["Dia", "Nitrogeno (g)", "Fosforo (g)", "Potasio (g)"],
            nutrientUsage.map((d) => [d.dia, String(d.nitrogeno), String(d.fosforo), String(d.potasio)])
          )
          break
        }
        case "eficiencia": {
          downloadCSV(
            `greensense-eficiencia.csv`,
            ["Mes", "Eficiencia (%)"],
            monthlyEfficiency.map((d) => [d.mes, String(d.eficiencia)])
          )
          break
        }
      }
      setExporting(false)
      toast.success("Reporte exportado", {
        description: `Archivo CSV generado para ${activeTab} (${periodLabel})`,
      })
    }, 600)
  }, [activeTab, period, waterData, periodLabel])

  function handlePeriodChange(value: string) {
    setPeriod(value)
    const labels: Record<string, string> = { dia: "Hoy", semana: "Esta Semana", mes: "Este Mes" }
    toast.info("Periodo actualizado", { description: `Mostrando datos de: ${labels[value]}` })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Reportes y Estadisticas
          </h2>
          <p className="text-sm text-muted-foreground">
            Analisis de rendimiento, consumo y eficiencia del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-36">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Hoy</SelectItem>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mes</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Droplets className="h-4 w-4 text-blue-400" />
              <span className="text-xs">Agua Consumida</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalWater}L</p>
            <p className="text-xs text-emerald-400 mt-1">
              <TrendingDown className="mr-1 inline h-3 w-3" />
              -12% vs {periodLabel === "hoy" ? "ayer" : "anterior"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-xs">Eventos de Riego</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {completedEvents.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {autoEvents.length} automaticos, {completedEvents.length - autoEvents.length} manuales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Thermometer className="h-4 w-4 text-orange-400" />
              <span className="text-xs">Temp. Promedio</span>
            </div>
            <p className="text-2xl font-bold text-foreground">27.8C</p>
            <p className="text-xs text-muted-foreground mt-1">
              Min: 22.1C / Max: 33.4C
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Leaf className="h-4 w-4 text-emerald-400" />
              <span className="text-xs">Eficiencia</span>
            </div>
            <p className="text-2xl font-bold text-foreground">91%</p>
            <p className="text-xs text-emerald-400 mt-1">
              <TrendingUp className="mr-1 inline h-3 w-3" />
              +3% vs mes anterior
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="consumo" className="gap-1.5">
            <Droplets className="h-3.5 w-3.5" />
            Consumo de Agua
          </TabsTrigger>
          <TabsTrigger value="sensores" className="gap-1.5">
            <Thermometer className="h-3.5 w-3.5" />
            Sensores
          </TabsTrigger>
          <TabsTrigger value="nutrientes" className="gap-1.5">
            <Leaf className="h-3.5 w-3.5" />
            Nutrientes
          </TabsTrigger>
          <TabsTrigger value="eficiencia" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Eficiencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consumo" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground">
                    Consumo de Agua - {period === "dia" ? "Hoy" : period === "semana" ? "Semanal" : "Mensual"}
                  </CardTitle>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        downloadCSV(
                          `consumo-agua-${period}.csv`,
                          ["Periodo", "Litros"],
                          waterData.map((d) => [d.dia, String(d.litros)])
                        )
                        toast.success("CSV descargado", { description: "consumo-agua.csv" })
                      }}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={waterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="dia" tick={axisTickStyle} stroke={gridStroke} />
                    <YAxis tick={axisTickStyle} stroke={gridStroke} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}L`, "Consumo"]} />
                    <Bar dataKey="litros" fill="hsl(200, 65%, 46%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground">
                    Resumen Semanal de Riegos
                  </CardTitle>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        downloadCSV(
                          "resumen-riego-semanal.csv",
                          ["Semana", "Automatico", "Manual", "Agua Total (L)", "Alertas"],
                          weeklyRiegoData.map((d) => [d.semana, String(d.riegoAuto), String(d.riegoManual), String(d.aguaTotal), String(d.alertas)])
                        )
                        toast.success("CSV descargado", { description: "resumen-riego-semanal.csv" })
                      }}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={weeklyRiegoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="semana" tick={axisTickStyle} stroke={gridStroke} />
                    <YAxis tick={axisTickStyle} stroke={gridStroke} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "hsl(150, 5%, 55%)" }} />
                    <Bar dataKey="riegoAuto" name="Automatico" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="riegoManual" name="Manual" fill="hsl(43, 74%, 56%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sensores" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  Humedad del Suelo (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={humedadSueloHistory}>
                    <defs>
                      <linearGradient id="repHumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(200, 65%, 46%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(200, 65%, 46%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="timestamp" tickFormatter={formatChartTime} tick={axisTickStyle} stroke={gridStroke} />
                    <YAxis tick={axisTickStyle} stroke={gridStroke} domain={[20, 70]} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={formatChartTime} formatter={(v: number) => [`${v}%`, "Humedad"]} />
                    <Area type="monotone" dataKey="valor" stroke="hsl(200, 65%, 46%)" fill="url(#repHumGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  TDS Nutrientes (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={tdsHistory}>
                    <defs>
                      <linearGradient id="repTdsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="timestamp" tickFormatter={formatChartTime} tick={axisTickStyle} stroke={gridStroke} />
                    <YAxis tick={axisTickStyle} stroke={gridStroke} domain={[500, 1200]} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={formatChartTime} formatter={(v: number) => [`${v} ppm`, "TDS"]} />
                    <Area type="monotone" dataKey="valor" stroke="hsl(152, 60%, 42%)" fill="url(#repTdsGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nutrientes" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-foreground">
                  Uso de Nutrientes por Dia (g/zona)
                </CardTitle>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      downloadCSV(
                        "nutrientes-semanal.csv",
                        ["Dia", "Nitrogeno (g)", "Fosforo (g)", "Potasio (g)"],
                        nutrientUsage.map((d) => [d.dia, String(d.nitrogeno), String(d.fosforo), String(d.potasio)])
                      )
                      toast.success("CSV descargado", { description: "nutrientes-semanal.csv" })
                    }}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={nutrientUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="dia" tick={axisTickStyle} stroke={gridStroke} />
                  <YAxis tick={axisTickStyle} stroke={gridStroke} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "hsl(150, 5%, 55%)" }} />
                  <Bar dataKey="nitrogeno" name="Nitrogeno (N)" fill="hsl(152, 60%, 42%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="fosforo" name="Fosforo (P)" fill="hsl(200, 65%, 46%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="potasio" name="Potasio (K)" fill="hsl(43, 74%, 56%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eficiencia" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-foreground">
                  Eficiencia del Sistema (6 meses)
                </CardTitle>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      downloadCSV(
                        "eficiencia-6-meses.csv",
                        ["Mes", "Eficiencia (%)"],
                        monthlyEfficiency.map((d) => [d.mes, String(d.eficiencia)])
                      )
                      toast.success("CSV descargado", { description: "eficiencia-6-meses.csv" })
                    }}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyEfficiency}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="mes" tick={axisTickStyle} stroke={gridStroke} />
                  <YAxis tick={axisTickStyle} stroke={gridStroke} domain={[70, 100]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Eficiencia"]} />
                  <Line type="monotone" dataKey="eficiencia" stroke="hsl(152, 60%, 42%)" strokeWidth={2.5} dot={{ fill: "hsl(152, 60%, 42%)", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
