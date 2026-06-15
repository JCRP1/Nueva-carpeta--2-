"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Save,
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

interface ReportsData {
  consumoAgua: Array<{ dia: string; litros: number }>
  resumenRiego: Array<{ semana: string; riegoAuto: number; riegoManual: number; aguaTotal: number }>
  eficiencia: Array<{ mes: string; eficiencia: number }>
  nutrientes: Array<{ dia: string; aplicaciones: number; cantidad: number }>
  sensorHistory: Array<{ tipo: string; timestamp: string; valor: number }>
  sensores: Array<{ tipo: string; promedio: number; minimo: number; maximo: number }>
  productividad: {
    cultivosActivos: number
    cosechasEstimadas: number
    rendimientoRegistrado: number
  }
}

interface ZoneOption {
  id: string
  nombre: string
}

interface CropOption {
  id: string
  nombre: string
  variedad?: string
}

const tooltipStyle = {
  background: "hsl(150, 14%, 9%)",
  border: "1px solid hsl(150, 10%, 16%)",
  borderRadius: "8px",
  fontSize: 12,
  color: "hsl(150, 8%, 93%)",
}
const axisTickStyle = { fontSize: 10, fill: "hsl(150, 5%, 55%)" }
const gridStroke = "hsl(150, 10%, 16%)"

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
  selectedGreenhouse: string
}

export function ReportsView({ userRole, selectedGreenhouse }: ReportsViewProps) {
  const isAdmin = userRole === "administrador"
  const [period, setPeriod] = useState("semana")
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState("consumo")
  const [waterZoneId, setWaterZoneId] = useState("")
  const [waterLiters, setWaterLiters] = useState("")
  const [waterDate, setWaterDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [savingWater, setSavingWater] = useState(false)
  const [nutrientCropId, setNutrientCropId] = useState("")
  const [nutrientAmount, setNutrientAmount] = useState("")
  const [nutrientDate, setNutrientDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [nutrientNotes, setNutrientNotes] = useState("")
  const [savingNutrients, setSavingNutrients] = useState(false)

  const { data: reportData, mutate: mutateReports } = useSWR<ReportsData>(
    selectedGreenhouse ? `/api/reports?greenhouse=${selectedGreenhouse}` : null,
    fetcher,
    { refreshInterval: 10000 }
  )
  const { data: zones = [] } = useSWR<ZoneOption[]>(
    selectedGreenhouse ? `/api/zones?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )
  const { data: crops = [] } = useSWR<CropOption[]>(
    selectedGreenhouse ? `/api/crops?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const weeklyWater = reportData?.consumoAgua || []
  const dailyWater = weeklyWater.slice(0, 1).map((d) => ({ ...d, dia: "Hoy" }))
  const monthlyWater = reportData?.resumenRiego?.map((d) => ({ dia: d.semana, litros: d.aguaTotal })) || []
  const weeklyRiegoData = reportData?.resumenRiego || []
  const monthlyEfficiency = reportData?.eficiencia || []
  const nutrientUsage = reportData?.nutrientes || []
  const temperaturaStats = reportData?.sensores?.find((s) => s.tipo === "temperatura")
  const currentEfficiency = reportData?.eficiencia?.[reportData.eficiencia.length - 1]?.eficiencia || 0

  const totalWater = useMemo(
    () => weeklyWater.reduce((acc, e) => acc + e.litros, 0),
    [weeklyWater]
  )
  const totalEvents = useMemo(
    () => weeklyRiegoData.reduce((acc, e) => acc + e.riegoAuto + e.riegoManual, 0),
    [weeklyRiegoData]
  )
  const autoEvents = useMemo(
    () => weeklyRiegoData.reduce((acc, e) => acc + e.riegoAuto, 0),
    [weeklyRiegoData]
  )

  const waterData = useMemo(() => {
    switch (period) {
      case "dia": return dailyWater
      case "mes": return monthlyWater
      default: return weeklyWater
    }
  }, [period, weeklyWater, dailyWater, monthlyWater])

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
        case "nutrientes": {
          downloadCSV(
            `greensense-nutrientes-${period}.csv`,
            ["Dia", "Aplicaciones", "Cantidad registrada"],
            nutrientUsage.map((d) => [d.dia, String(d.aplicaciones), String(d.cantidad)])
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
  }, [activeTab, period, waterData, nutrientUsage, monthlyEfficiency, periodLabel])

  function handlePeriodChange(value: string) {
    setPeriod(value)
    const labels: Record<string, string> = { dia: "Hoy", semana: "Esta Semana", mes: "Este Mes" }
    toast.info("Periodo actualizado", { description: `Mostrando datos de: ${labels[value]}` })
  }

  async function handleSaveWaterConsumption() {
    const liters = Number(waterLiters)
    const zoneId = waterZoneId || zones[0]?.id || ""

    if (!selectedGreenhouse || !zoneId) {
      toast.error("No hay zona disponible", {
        description: "Selecciona un invernadero con zonas de riego",
      })
      return
    }

    if (!Number.isFinite(liters) || liters <= 0) {
      toast.error("Consumo invalido", {
        description: "Ingresa una cantidad mayor que 0 litros",
      })
      return
    }

    setSavingWater(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          greenhouse: selectedGreenhouse,
          zoneId,
          liters,
          date: waterDate,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "No se pudo guardar el consumo" }))
        throw new Error(body.error || "No se pudo guardar el consumo")
      }

      setWaterLiters("")
      await mutateReports()
      toast.success("Consumo guardado", {
        description: "El registro ya se muestra en los reportes",
      })
    } catch (err) {
      toast.error("Error al guardar", {
        description: err instanceof Error ? err.message : "Intenta nuevamente",
      })
    } finally {
      setSavingWater(false)
    }
  }

  async function handleSaveNutrients() {
    const amount = Number(nutrientAmount)
    const cropId = nutrientCropId || crops[0]?.id || ""

    if (!selectedGreenhouse || !cropId) {
      toast.error("No hay cultivo disponible", {
        description: "Selecciona un invernadero con cultivos registrados",
      })
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Cantidad invalida", {
        description: "Ingresa una cantidad mayor que 0",
      })
      return
    }

    setSavingNutrients(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "nutrients",
          greenhouse: selectedGreenhouse,
          cropId,
          amount,
          date: nutrientDate,
          notes: nutrientNotes,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "No se pudo guardar el registro" }))
        throw new Error(body.error || "No se pudo guardar el registro")
      }

      setNutrientAmount("")
      setNutrientNotes("")
      await mutateReports()
      toast.success("Nutrientes guardados", {
        description: "El registro ya se muestra en los reportes",
      })
    } catch (err) {
      toast.error("Error al guardar", {
        description: err instanceof Error ? err.message : "Intenta nuevamente",
      })
    } finally {
      setSavingNutrients(false)
    }
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
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingDown className="mr-1 inline h-3 w-3" />
              Datos reales del periodo
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
              {totalEvents}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {autoEvents} automaticos, {totalEvents - autoEvents} manuales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Thermometer className="h-4 w-4 text-orange-400" />
              <span className="text-xs">Temp. Promedio</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{temperaturaStats ? `${temperaturaStats.promedio.toFixed(1)}C` : "0C"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Min: {temperaturaStats?.minimo.toFixed(1) || "0"}C / Max: {temperaturaStats?.maximo.toFixed(1) || "0"}C
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Leaf className="h-4 w-4 text-emerald-400" />
              <span className="text-xs">Eficiencia</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{currentEfficiency}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="mr-1 inline h-3 w-3" />
              Calculada por eventos automaticos
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
                <CardTitle className="text-sm font-medium text-foreground">
                  Registrar Consumo de Agua
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="water-zone">Zona de riego</Label>
                  <Select
                    value={waterZoneId || zones[0]?.id || ""}
                    onValueChange={setWaterZoneId}
                    disabled={savingWater || zones.length === 0}
                  >
                    <SelectTrigger id="water-zone">
                      <SelectValue placeholder="Selecciona una zona" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="water-liters">Litros consumidos</Label>
                  <Input
                    id="water-liters"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej: 120"
                    value={waterLiters}
                    onChange={(e) => setWaterLiters(e.target.value)}
                    disabled={savingWater}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="water-date">Fecha del consumo</Label>
                  <Input
                    id="water-date"
                    type="date"
                    value={waterDate}
                    max={today}
                    onChange={(e) => setWaterDate(e.target.value)}
                    disabled={savingWater}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSaveWaterConsumption}
                  disabled={savingWater || zones.length === 0}
                >
                  {savingWater ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar en reportes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

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
                          ["Semana", "Automatico", "Manual", "Agua Total (L)"],
                          weeklyRiegoData.map((d) => [d.semana, String(d.riegoAuto), String(d.riegoManual), String(d.aguaTotal)])
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

        <TabsContent value="nutrientes" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  Registrar Nutrientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="nutrient-crop">Cultivo</Label>
                  <Select
                    value={nutrientCropId || crops[0]?.id || ""}
                    onValueChange={setNutrientCropId}
                    disabled={savingNutrients || crops.length === 0}
                  >
                    <SelectTrigger id="nutrient-crop">
                      <SelectValue placeholder="Selecciona un cultivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {crops.map((crop) => (
                        <SelectItem key={crop.id} value={crop.id}>
                          {crop.variedad ? `${crop.nombre} - ${crop.variedad}` : crop.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nutrient-amount">Cantidad aplicada</Label>
                  <Input
                    id="nutrient-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej: 25"
                    value={nutrientAmount}
                    onChange={(e) => setNutrientAmount(e.target.value)}
                    disabled={savingNutrients}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nutrient-date">Fecha de aplicacion</Label>
                  <Input
                    id="nutrient-date"
                    type="date"
                    value={nutrientDate}
                    max={today}
                    onChange={(e) => setNutrientDate(e.target.value)}
                    disabled={savingNutrients}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nutrient-notes">Notas</Label>
                  <Textarea
                    id="nutrient-notes"
                    placeholder="Producto, dosis o comentario"
                    value={nutrientNotes}
                    onChange={(e) => setNutrientNotes(e.target.value)}
                    disabled={savingNutrients}
                    className="min-h-[80px]"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSaveNutrients}
                  disabled={savingNutrients || crops.length === 0}
                >
                  {savingNutrients ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar en reportes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-foreground">
                  Uso de Nutrientes por Dia
                </CardTitle>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      downloadCSV(
                        "nutrientes-semanal.csv",
                        ["Dia", "Aplicaciones", "Cantidad registrada"],
                        nutrientUsage.map((d) => [d.dia, String(d.aplicaciones), String(d.cantidad)])
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
                  <Bar dataKey="aplicaciones" name="Aplicaciones" fill="hsl(152, 60%, 42%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="cantidad" name="Cantidad registrada" fill="hsl(200, 65%, 46%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
            </Card>
          </div>
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
