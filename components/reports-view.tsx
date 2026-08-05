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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  Warehouse,
  Package,
  ReceiptText,
  Users,
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
  comparativoInvernaderos?: Array<{
    id: string
    nombre: string
    kgCosechados: number
    unidadesCosechadas: number
    ingresos: number
    costos: number
    ganancia: number
  }>
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

interface GreenhouseReportRow {
  id: string
  nombre: string
  ubicacion?: string
  area?: number
  estado?: string
}

interface InventoryReportRow {
  id: string
  nombre: string
  tipo: string
  categoria?: string
  cantidadDisponible: number
  unidadMedida?: string
  ubicacion?: string
}

interface SaleReportRow {
  id: string
  fechaVenta: string
  cultivoNombre: string
  invernaderoNombre: string
  cantidadKg: number
  precioKg: number
  ingresoTotal: number
  comprador: string
}

interface CostReportRow {
  id: string
  fecha: string
  concepto: string
  monto: number
  zonaNombre?: string
  cultivoNombre?: string
  invernaderoNombre?: string
}

interface PersonalReportRow {
  id: string
  nombre: string
  email?: string
  puesto?: string
  telefono?: string
  cedula?: string
  registrado?: string
  fechaContrato?: string
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

function escapeExcelCell(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function downloadExcel(filename: string, title: string, headers: string[], rows: string[][]) {
  const safeFilename = filename.endsWith(".xls") ? filename : filename.replace(/\.[^.]+$/, "") + ".xls"
  const generatedAt = new Date().toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const colSpan = Math.max(headers.length, 1)
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #1f2933; }
          table { border-collapse: collapse; width: 100%; }
          .title { background: #13795b; color: #ffffff; font-size: 18px; font-weight: 700; }
          .subtitle { background: #e8f3ee; color: #4b5563; font-size: 11px; }
          th { background: #1f8f68; color: #ffffff; font-weight: 700; border: 1px solid #d9e2dd; padding: 8px; }
          td { border: 1px solid #d9e2dd; padding: 7px; }
          .row-even { background: #f7fbf9; }
          .row-odd { background: #ffffff; }
          .empty { color: #6b7280; font-style: italic; text-align: center; }
        </style>
      </head>
      <body>
        <table>
          <tr><td class="title" colspan="${colSpan}">GreenSense SRL - ${escapeExcelCell(title)}</td></tr>
          <tr><td class="subtitle" colspan="${colSpan}">Generado: ${escapeExcelCell(generatedAt)}</td></tr>
          <tr>${headers.map((header) => `<th>${escapeExcelCell(header)}</th>`).join("")}</tr>
          ${
            rows.length > 0
              ? rows
                  .map(
                    (row, index) =>
                      `<tr class="${index % 2 === 0 ? "row-even" : "row-odd"}">${row
                        .map((cell) => `<td>${escapeExcelCell(cell)}</td>`)
                        .join("")}</tr>`
                  )
                  .join("")
              : `<tr><td class="empty" colspan="${colSpan}">No hay datos disponibles</td></tr>`
          }
        </table>
      </body>
    </html>
  `
  const blob = new Blob(["\uFEFF", html], { type: "application/vnd.ms-excel;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = safeFilename
  link.click()
  URL.revokeObjectURL(url)
}

function formatMoney(value: number) {
  return `RD$ ${Number(value || 0).toLocaleString("es-DO", { maximumFractionDigits: 2 })}`
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("es-DO", { maximumFractionDigits: 2 })
}

function formatReportDate(value?: string) {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("es-DO", { year: "numeric", month: "2-digit", day: "2-digit" })
}

function ReportTable({
  title,
  icon: Icon,
  headers,
  rows,
  filename,
}: {
  title: string
  icon: React.ElementType
  headers: string[]
  rows: string[][]
  filename: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              downloadExcel(filename, title, headers, rows)
              toast.success("Excel descargado", { description: filename })
            }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-8 text-center text-sm text-muted-foreground">
                  No hay datos disponibles
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rowIndex) => (
                <TableRow key={`${title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${title}-${rowIndex}-${cellIndex}`}>
                      {cell || "--"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
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
  const { data: greenhouses = [] } = useSWR<GreenhouseReportRow[]>("/api/greenhouses", fetcher)
  const { data: inventory = [] } = useSWR<InventoryReportRow[]>("/api/inventory", fetcher)
  const { data: sales = [] } = useSWR<SaleReportRow[]>(
    selectedGreenhouse ? `/api/sales?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )
  const { data: costs = [] } = useSWR<CostReportRow[]>(
    selectedGreenhouse ? `/api/costs?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )
  const { data: personal = [] } = useSWR<PersonalReportRow[]>(
    isAdmin ? "/api/people" : null,
    fetcher
  )

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const weeklyWater = reportData?.consumoAgua || []
  const dailyWater = weeklyWater.slice(0, 1).map((d) => ({ ...d, dia: "Hoy" }))
  const monthlyWater = reportData?.resumenRiego?.map((d) => ({ dia: d.semana, litros: d.aguaTotal })) || []
  const weeklyRiegoData = reportData?.resumenRiego || []
  const monthlyEfficiency = reportData?.eficiencia || []
  const nutrientUsage = reportData?.nutrientes || []
  const greenhouseComparison = reportData?.comparativoInvernaderos || []
  const temperaturaStats = reportData?.sensores?.find((s) => s.tipo === "temperatura")
  const currentEfficiency = reportData?.eficiencia?.[reportData.eficiencia.length - 1]?.eficiencia || 0
  const bestGreenhouse = greenhouseComparison[0]
  const greenhouseRows = useMemo(
    () => greenhouses.map((row) => [
      row.nombre,
      row.ubicacion || "--",
      `${formatNumber(Number(row.area || 0))} m2`,
      row.estado || "--",
    ]),
    [greenhouses]
  )
  const inventoryRows = useMemo(
    () => inventory.map((row) => [
      row.nombre,
      row.tipo,
      row.categoria || "--",
      formatNumber(row.cantidadDisponible),
      row.unidadMedida || "--",
      row.ubicacion || "--",
    ]),
    [inventory]
  )
  const salesRows = useMemo(
    () => sales.map((row) => [
      formatReportDate(row.fechaVenta),
      row.cultivoNombre,
      row.invernaderoNombre,
      `${formatNumber(row.cantidadKg)} kg`,
      formatMoney(row.precioKg),
      formatMoney(row.ingresoTotal),
      row.comprador || "--",
    ]),
    [sales]
  )
  const costsRows = useMemo(
    () => costs.map((row) => [
      formatReportDate(row.fecha),
      row.concepto,
      row.invernaderoNombre || "--",
      row.zonaNombre || row.cultivoNombre || "--",
      formatMoney(row.monto),
    ]),
    [costs]
  )
  const personalRows = useMemo(
    () => personal.map((row) => [
      row.nombre,
      row.puesto || "--",
      row.telefono || "--",
      row.email || "--",
      row.cedula || "--",
      formatReportDate(row.fechaContrato || row.registrado),
    ]),
    [personal]
  )

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
          downloadExcel(
            `greensense-consumo-${period}.xls`,
            `Consumo de Agua - ${periodLabel}`,
            ["Periodo", "Litros"],
            waterData.map((d) => [d.dia, String(d.litros)])
          )
          break
        }
        case "nutrientes": {
          downloadExcel(
            `greensense-nutrientes-${period}.xls`,
            `Uso de Nutrientes - ${periodLabel}`,
            ["Dia", "Aplicaciones", "Cantidad registrada"],
            nutrientUsage.map((d) => [d.dia, String(d.aplicaciones), String(d.cantidad)])
          )
          break
        }
        case "eficiencia": {
          downloadExcel(
            "greensense-eficiencia.xls",
            "Eficiencia del Sistema",
            ["Mes", "Eficiencia (%)"],
            monthlyEfficiency.map((d) => [d.mes, String(d.eficiencia)])
          )
          break
        }
        case "invernaderos": {
          downloadExcel("greensense-invernaderos.xls", "Reporte de Invernaderos", ["Nombre", "Ubicacion", "Area", "Estado"], greenhouseRows)
          break
        }
        case "inventario": {
          downloadExcel("greensense-inventario.xls", "Reporte de Inventario", ["Producto", "Tipo", "Categoria", "Cantidad", "Unidad", "Ubicacion"], inventoryRows)
          break
        }
        case "ventas": {
          downloadExcel("greensense-ventas.xls", "Reporte de Ventas", ["Fecha", "Cultivo", "Invernadero", "Cantidad", "Precio", "Ingreso", "Comprador"], salesRows)
          break
        }
        case "costos": {
          downloadExcel("greensense-costos.xls", "Reporte de Costos", ["Fecha", "Concepto", "Invernadero", "Zona/Cultivo", "Monto"], costsRows)
          break
        }
        case "personal": {
          downloadExcel("greensense-personal.xls", "Reporte de Personal", ["Nombre", "Puesto", "Telefono", "Email", "Cedula", "Fecha de contrato"], personalRows)
          break
        }
      }
      setExporting(false)
      toast.success("Reporte exportado", {
        description: `Archivo Excel generado para ${activeTab} (${periodLabel})`,
      })
    }, 600)
  }, [activeTab, period, waterData, nutrientUsage, monthlyEfficiency, periodLabel, greenhouseRows, inventoryRows, salesRows, costsRows, personalRows])

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
                  Exportar Excel
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
              {autoEvents} activaciones automaticas, {totalEvents - autoEvents} manuales
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
              Calculada por activaciones automaticas
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            Comparativo por Invernadero
          </CardTitle>
        </CardHeader>
        <CardContent>
          {greenhouseComparison.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cosechas, ventas o costos suficientes para comparar.</p>
          ) : (
            <div className="space-y-3">
              {bestGreenhouse && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <span className="text-muted-foreground">Mas rentable: </span>
                  <span className="font-medium text-foreground">{bestGreenhouse.nombre}</span>
                  <span className={bestGreenhouse.ganancia >= 0 ? "ml-2 font-medium text-emerald-500" : "ml-2 font-medium text-red-500"}>
                    RD$ {bestGreenhouse.ganancia.toLocaleString("es-DO", { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <div className="min-w-[620px] rounded-md border">
                  <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                    <span>Invernadero</span>
                    <span>Produccion</span>
                    <span>Ingresos</span>
                    <span>Costos</span>
                    <span>Ganancia</span>
                  </div>
                  {greenhouseComparison.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3 border-b px-3 py-2 text-xs last:border-b-0">
                      <span className="font-medium text-foreground">{item.nombre}</span>
                      <span>{item.kgCosechados.toLocaleString("es-DO", { maximumFractionDigits: 2 })} kg</span>
                      <span>RD$ {item.ingresos.toLocaleString("es-DO", { maximumFractionDigits: 2 })}</span>
                      <span>RD$ {item.costos.toLocaleString("es-DO", { maximumFractionDigits: 2 })}</span>
                      <span className={item.ganancia >= 0 ? "font-medium text-emerald-500" : "font-medium text-red-500"}>
                        RD$ {item.ganancia.toLocaleString("es-DO", { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap justify-start">
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
          <TabsTrigger value="invernaderos" className="gap-1.5">
            <Warehouse className="h-3.5 w-3.5" />
            Invernaderos
          </TabsTrigger>
          <TabsTrigger value="inventario" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="ventas" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Ventas
          </TabsTrigger>
          <TabsTrigger value="costos" className="gap-1.5">
            <ReceiptText className="h-3.5 w-3.5" />
            Costos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="personal" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Personal
            </TabsTrigger>
          )}
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
                        downloadExcel(
                          `consumo-agua-${period}.xls`,
                          `Consumo de Agua - ${periodLabel}`,
                          ["Periodo", "Litros"],
                          waterData.map((d) => [d.dia, String(d.litros)])
                        )
                        toast.success("Excel descargado", { description: `consumo-agua-${period}.xls` })
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
                        downloadExcel(
                          "resumen-riego-semanal.xls",
                          "Resumen Semanal de Riegos",
                          ["Semana", "Activaciones automaticas", "Riegos manuales", "Agua Total (L)"],
                          weeklyRiegoData.map((d) => [d.semana, String(d.riegoAuto), String(d.riegoManual), String(d.aguaTotal)])
                        )
                        toast.success("Excel descargado", { description: "resumen-riego-semanal.xls" })
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
                    <Bar dataKey="riegoAuto" name="Activaciones automaticas" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="riegoManual" name="Riegos manuales" fill="hsl(43, 74%, 56%)" radius={[4, 4, 0, 0]} />
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
                      downloadExcel(
                        "nutrientes-semanal.xls",
                        "Uso de Nutrientes por Dia",
                        ["Dia", "Aplicaciones", "Cantidad registrada"],
                        nutrientUsage.map((d) => [d.dia, String(d.aplicaciones), String(d.cantidad)])
                      )
                      toast.success("Excel descargado", { description: "nutrientes-semanal.xls" })
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
                      downloadExcel(
                        "eficiencia-6-meses.xls",
                        "Eficiencia del Sistema",
                        ["Mes", "Eficiencia (%)"],
                        monthlyEfficiency.map((d) => [d.mes, String(d.eficiencia)])
                      )
                      toast.success("Excel descargado", { description: "eficiencia-6-meses.xls" })
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

        <TabsContent value="invernaderos" className="mt-4">
          <ReportTable
            title="Reporte de Invernaderos"
            icon={Warehouse}
            headers={["Nombre", "Ubicacion", "Area", "Estado"]}
            rows={greenhouseRows}
            filename="greensense-invernaderos.xls"
          />
        </TabsContent>

        <TabsContent value="inventario" className="mt-4">
          <ReportTable
            title="Reporte de Inventario"
            icon={Package}
            headers={["Producto", "Tipo", "Categoria", "Cantidad", "Unidad", "Ubicacion"]}
            rows={inventoryRows}
            filename="greensense-inventario.xls"
          />
        </TabsContent>

        <TabsContent value="ventas" className="mt-4">
          <ReportTable
            title="Reporte de Ventas"
            icon={TrendingUp}
            headers={["Fecha", "Cultivo", "Invernadero", "Cantidad", "Precio", "Ingreso", "Comprador"]}
            rows={salesRows}
            filename="greensense-ventas.xls"
          />
        </TabsContent>

        <TabsContent value="costos" className="mt-4">
          <ReportTable
            title="Reporte de Costos"
            icon={ReceiptText}
            headers={["Fecha", "Concepto", "Invernadero", "Zona/Cultivo", "Monto"]}
            rows={costsRows}
            filename="greensense-costos.xls"
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="personal" className="mt-4">
            <ReportTable
              title="Reporte de Personal"
              icon={Users}
              headers={["Nombre", "Puesto", "Telefono", "Email", "Cedula", "Fecha de contrato"]}
              rows={personalRows}
              filename="greensense-personal.xls"
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
