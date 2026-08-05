"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import { fetcher } from "@/lib/api-client"
import type { UserRole } from "@/lib/greensense-data"
import { Banknote, CalendarDays, ClipboardList, Loader2, Package, Pencil, Plus, ReceiptText, Sprout, Trash2, TrendingUp } from "lucide-react"
import { toast } from "sonner"

type ViewProps = {
  selectedGreenhouse: string
  userRole: UserRole
}

type SaleRow = {
  id: string
  idCosecha: string
  fechaVenta: string
  cultivoNombre: string
  invernaderoNombre: string
  cantidadKg: number
  precioKg: number
  ingresoTotal: number
  comprador: string
  observaciones?: string
}

type HarvestOption = {
  id: string
  fechaCosecha: string
  cantidadKg: number
  kgVendidos: number
  kgDisponible: number
  cultivoNombre: string
  invernaderoNombre: string
}

type CostRow = {
  id: string
  idZona: string
  idCultivo: string
  fecha: string
  concepto: string
  monto: number
  zonaNombre: string
  cultivoNombre: string
  invernaderoNombre: string
  descripcion?: string
}

type ZoneOption = {
  id: string
  nombre: string
  cultivoActual: string
  idCultivo?: string
  invernaderoNombre: string
}

type CropOption = {
  id: string
  nombre: string
  variedad?: string
}

type ProfitabilityRow = {
  idZona: string
  idCultivo: string
  zonaNombre: string
  cultivoNombre: string
  invernaderoNombre: string
  produccionEstimada: number
  unidadRendimiento: string
  kgCosechados: number
  kgVendidos: number
  kgDisponible: number
  cumplimientoProduccion: number
  diferenciaProduccion: number
  ingresos: number
  ingresoEstimado: number
  diferenciaIngresos: number
  cumplimientoIngresos: number
  costos: number
  ganancia: number
  costoPorKg: number
}

type PlanRow = {
  idPerfil: string
  idCultivo: string
  cultivoNombre: string
  variedad: string
  invernaderoNombre: string
  densidadPlantasM2: string
  sustratoSuelo: string
  fertilizacion: string
  manejo: string
  sanidad: string
  observaciones?: string
}

type ApplicationRow = {
  id: string
  tipo: string
  idDetalle: string
  tipoPlaga: string
  fecha: string
  cultivoNombre: string
  invernaderoNombre: string
  idProducto: string
  producto: string
  dosis: string
  cantidad: string
  notas?: string
}

type DetailOption = {
  id: string
  cultivoNombre: string
  variedad: string
  invernaderoNombre: string
}

type CalendarRow = {
  id: string
  titulo: string
  descripcion: string
  tipo: string
  fecha: string
  estado: string
  responsable: string
  zonaNombre: string
  cultivoNombre: string
}

type InventoryRow = {
  id: string
  nombre: string
  tipo: string
  categoria: string
  composicion: string
  fabricante: string
  ph: number | null
  nitrogeno: number | null
  fosforo: number | null
  potasio: number | null
  formaAplicacion: string
  micronutrientes?: string
  riesgos?: string
  cantidadDisponible?: number | null
  unidadMedida?: string
  ubicacion?: string
  notas?: string
}

type UserOption = {
  id: string
  nombre: string
}

function scoped(path: string, selectedGreenhouse: string) {
  if (!selectedGreenhouse) return path
  return `${path}${path.includes("?") ? "&" : "?"}greenhouse=${selectedGreenhouse}`
}

async function writeApi(path: string, method: "POST" | "PUT" | "DELETE", data: Record<string, unknown>) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Error de red" }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(value: number) {
  return `RD$ ${Number(value || 0).toLocaleString("es-DO", { maximumFractionDigits: 2 })}`
}

function number(value: number, suffix = "") {
  return `${Number(value || 0).toLocaleString("es-DO", { maximumFractionDigits: 2 })}${suffix}`
}

function date(value: string) {
  if (!value) return "-"
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("es-DO", { month: "short", day: "numeric", year: "numeric" })
}

function EmptyRows({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  )
}

function isPlantApplicationProduct(product: InventoryRow) {
  const text = [
    product.tipo,
    product.categoria,
    product.formaAplicacion,
    product.composicion,
    product.nombre,
  ].join(" ").toLowerCase()
  const excluded = [
    "herramienta",
    "equipo",
    "sensor",
    "riego",
    "material",
    "accesorio",
    "envase",
    "guante",
    "cinta",
    "filtro",
    "esp32",
    "sustrato",
  ]
  const included = [
    "fertilizante",
    "abono",
    "nutriente",
    "micronutriente",
    "insecticida",
    "fungicida",
    "acaricida",
    "herbicida",
    "plaguicida",
    "pesticida",
    "nematicida",
    "bactericida",
    "bioestimulante",
    "enraizante",
    "enmienda",
    "acondicionador",
    "compost",
    "humus",
    "materia organica",
    "materia orgánica",
    "desinfectante de suelo",
    "tratamiento de suelo",
    "suelo",
    "regulador",
    "foliar",
    "micorriza",
  ]

  return included.some((word) => text.includes(word)) && !excluded.some((word) => text.includes(word))
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string
  icon: typeof Banknote
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  )
}

export function SalesView({ selectedGreenhouse }: ViewProps) {
  const { data, isLoading, mutate } = useSWR<SaleRow[]>(scoped("/api/sales", selectedGreenhouse), fetcher)
  const { data: harvests } = useSWR<HarvestOption[]>(scoped("/api/sales?mode=harvests", selectedGreenhouse), fetcher)
  const rows = data || []
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.ingresoTotal, 0), [rows])
  const kg = useMemo(() => rows.reduce((sum, row) => sum + row.cantidadKg, 0), [rows])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SaleRow | null>(null)
  const [form, setForm] = useState({
    idCosecha: "",
    fechaVenta: today(),
    cantidadKg: "",
    precioKg: "",
    comprador: "",
    observaciones: "",
  })
  const selectedHarvest = useMemo(
    () => (harvests || []).find((harvest) => harvest.id === form.idCosecha),
    [harvests, form.idCosecha]
  )
  const maxKgVenta = selectedHarvest
    ? selectedHarvest.kgDisponible + (editing?.idCosecha === selectedHarvest.id ? editing.cantidadKg : 0)
    : undefined

  function openCreate() {
    setEditing(null)
    setForm({ idCosecha: "", fechaVenta: today(), cantidadKg: "", precioKg: "", comprador: "", observaciones: "" })
    setOpen(true)
  }

  function openEdit(row: SaleRow) {
    setEditing(row)
    setForm({
      idCosecha: row.idCosecha,
      fechaVenta: row.fechaVenta,
      cantidadKg: String(row.cantidadKg || ""),
      precioKg: String(row.precioKg || ""),
      comprador: row.comprador || "",
      observaciones: row.observaciones || "",
    })
    setOpen(true)
  }

  async function save() {
    try {
      if (maxKgVenta != null && Number(form.cantidadKg) > maxKgVenta) {
        toast.error("Cantidad no disponible", { description: `Disponible: ${number(maxKgVenta, " kg")}` })
        return
      }
      await writeApi("/api/sales", editing ? "PUT" : "POST", {
        id: editing?.id,
        ...form,
        cantidadKg: Number(form.cantidadKg),
        precioKg: Number(form.precioKg),
      })
      toast.success(editing ? "Venta actualizada" : "Venta registrada")
      setOpen(false)
      mutate()
    } catch (err) {
      toast.error("Error en ventas", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  async function remove(id: string) {
    try {
      await writeApi("/api/sales", "DELETE", { id })
      toast.success("Venta eliminada")
      mutate()
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ventas de Cosecha</h2>
            <p className="text-sm text-muted-foreground">Ingresos registrados por cosecha vendida</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nueva venta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar venta" : "Registrar venta"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid gap-2">
                  <Label>Cosecha</Label>
                  <Select value={form.idCosecha} onValueChange={(value) => setForm({ ...form, idCosecha: value })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cosecha" /></SelectTrigger>
                    <SelectContent>
                      {(harvests || []).map((harvest) => (
                        <SelectItem key={harvest.id} value={harvest.id}>
                          {harvest.cultivoNombre} - {date(harvest.fechaCosecha)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedHarvest && (
                    <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Cantidad cosechada</span>
                        <span className="font-medium">{number(selectedHarvest.cantidadKg, " kg")}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Cantidad vendida</span>
                        <span className="font-medium">{number(selectedHarvest.kgVendidos, " kg")}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Cantidad disponible</span>
                        <span className="font-semibold text-primary">{number(maxKgVenta || 0, " kg")}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2"><Label>Fecha</Label><Input type="date" value={form.fechaVenta} onChange={(e) => setForm({ ...form, fechaVenta: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Kg</Label><Input type="number" min={0} max={maxKgVenta} value={form.cantidadKg} onChange={(e) => setForm({ ...form, cantidadKg: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Precio/kg</Label><Input type="number" min={0} value={form.precioKg} onChange={(e) => setForm({ ...form, precioKg: e.target.value })} /></div>
                </div>
                <div className="grid gap-2"><Label>Comprador</Label><Input value={form.comprador} onChange={(e) => setForm({ ...form, comprador: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Ingresos" value={money(total)} icon={Banknote} />
        <SummaryCard title="Kg vendidos" value={number(kg, " kg")} icon={Package} />
        <SummaryCard title="Ventas" value={String(rows.length)} icon={ReceiptText} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cultivo</TableHead>
                <TableHead>Invernadero</TableHead>
                <TableHead>Kg</TableHead>
                <TableHead>Precio/kg</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRows colSpan={8} label="No hay ventas registradas" /> : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{date(row.fechaVenta)}</TableCell>
                  <TableCell>{row.cultivoNombre}</TableCell>
                  <TableCell>{row.invernaderoNombre}</TableCell>
                  <TableCell>{number(row.cantidadKg, " kg")}</TableCell>
                  <TableCell>{money(row.precioKg)}</TableCell>
                  <TableCell>{money(row.ingresoTotal)}</TableCell>
                  <TableCell>{row.comprador || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function CostsView({ selectedGreenhouse }: ViewProps) {
  const { data, isLoading, mutate } = useSWR<CostRow[]>(scoped("/api/costs", selectedGreenhouse), fetcher)
  const { data: zones } = useSWR<ZoneOption[]>(scoped("/api/harvests?mode=zones", selectedGreenhouse), fetcher)
  const { data: crops } = useSWR<CropOption[]>(scoped("/api/crops", selectedGreenhouse), fetcher)
  const rows = data || []
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.monto, 0), [rows])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CostRow | null>(null)
  const [form, setForm] = useState({ idZona: "", idCultivo: "", concepto: "", monto: "", fecha: today(), descripcion: "" })
  const selectedCostZone = useMemo(
    () => (zones || []).find((zone) => zone.id === form.idZona),
    [zones, form.idZona]
  )

  function openCreate() {
    setEditing(null)
    setForm({ idZona: "", idCultivo: "", concepto: "", monto: "", fecha: today(), descripcion: "" })
    setOpen(true)
  }

  function selectCostZone(value: string) {
    if (value === "none") {
      setForm({ ...form, idZona: "", idCultivo: "" })
      return
    }
    const zone = (zones || []).find((item) => item.id === value)
    setForm({ ...form, idZona: value, idCultivo: zone?.idCultivo || "" })
  }

  function openEdit(row: CostRow) {
    setEditing(row)
    setForm({
      idZona: row.idZona || "",
      idCultivo: row.idCultivo || "",
      concepto: row.concepto,
      monto: String(row.monto || ""),
      fecha: row.fecha,
      descripcion: row.descripcion || "",
    })
    setOpen(true)
  }

  async function save() {
    try {
      await writeApi("/api/costs", editing ? "PUT" : "POST", {
        id: editing?.id,
        ...form,
        monto: Number(form.monto),
      })
      toast.success(editing ? "Costo actualizado" : "Costo registrado")
      setOpen(false)
      mutate()
    } catch (err) {
      toast.error("Error en costos", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  async function remove(id: string) {
    try {
      await writeApi("/api/costs", "DELETE", { id })
      toast.success("Costo eliminado")
      mutate()
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Costos de Cultivo</h2>
            <p className="text-sm text-muted-foreground">Gastos por zona, cultivo e invernadero</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nuevo costo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar costo" : "Registrar costo"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Zona</Label>
                    <Select value={form.idZona || "none"} onValueChange={selectCostZone}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin zona</SelectItem>
                        {(zones || []).map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.nombre} - {zone.cultivoActual}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Cultivo</Label>
                    <Select
                      value={form.idCultivo || "none"}
                      onValueChange={(value) => setForm({ ...form, idCultivo: value === "none" ? "" : value })}
                      disabled={Boolean(form.idZona)}
                    >
                      <SelectTrigger><SelectValue placeholder={selectedCostZone?.cultivoActual || "Opcional"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin cultivo</SelectItem>
                        {(crops || []).map((crop) => <SelectItem key={crop.id} value={crop.id}>{crop.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedCostZone && (
                      <p className="text-xs text-muted-foreground">
                        Cultivo tomado de la zona: {selectedCostZone.cultivoActual || "Sin cultivo asignado"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid gap-2"><Label>Concepto</Label><Input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>Monto</Label><Input type="number" min={0} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
                </div>
                <div className="grid gap-2"><Label>Descripcion</Label><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Costo total" value={money(total)} icon={ReceiptText} />
        <SummaryCard title="Registros" value={String(rows.length)} icon={ClipboardList} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Detalle</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Zona/Cultivo</TableHead>
                <TableHead>Invernadero</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRows colSpan={6} label="No hay costos registrados" /> : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{date(row.fecha)}</TableCell>
                  <TableCell>{row.concepto}</TableCell>
                  <TableCell>{row.zonaNombre || row.cultivoNombre || "-"}</TableCell>
                  <TableCell>{row.invernaderoNombre || "-"}</TableCell>
                  <TableCell>{money(row.monto)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function ProfitabilityView({ selectedGreenhouse }: ViewProps) {
  const { data, isLoading } = useSWR<ProfitabilityRow[]>(scoped("/api/profitability", selectedGreenhouse), fetcher)
  const rows = data || []
  const totals = useMemo(() => rows.reduce((acc, row) => ({
    estimado: acc.estimado + row.produccionEstimada,
    ingresos: acc.ingresos + row.ingresos,
    ingresoEstimado: acc.ingresoEstimado + row.ingresoEstimado,
    costos: acc.costos + row.costos,
    ganancia: acc.ganancia + row.ganancia,
    kg: acc.kg + row.kgCosechados,
    vendidos: acc.vendidos + row.kgVendidos,
  }), { estimado: 0, ingresos: 0, ingresoEstimado: 0, costos: 0, ganancia: 0, kg: 0, vendidos: 0 }), [rows])

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Rentabilidad</h2>
        <p className="text-sm text-muted-foreground">Compara lo estimado contra cosecha real, ventas reales y margen</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Ingresos" value={money(totals.ingresos)} icon={Banknote} />
        <SummaryCard title="Costos" value={money(totals.costos)} icon={ReceiptText} />
        <SummaryCard title="Ganancia" value={money(totals.ganancia)} icon={TrendingUp} />
        <SummaryCard title="Real / estimado" value={`${number(totals.kg, " kg")} / ${number(totals.estimado, " kg")}`} icon={Package} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Estimado vs real por unidad productiva</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zona</TableHead>
                <TableHead>Cultivo</TableHead>
                <TableHead>Estimado</TableHead>
                <TableHead>Cosechado</TableHead>
                <TableHead>Vendido</TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>Cumplimiento</TableHead>
                <TableHead>Costos</TableHead>
                <TableHead>Ganancia</TableHead>
                <TableHead>Ingreso real/est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRows colSpan={10} label="No hay datos suficientes para calcular rentabilidad" /> : rows.map((row) => (
                <TableRow key={`${row.idZona}-${row.idCultivo}`}>
                  <TableCell>{row.zonaNombre}</TableCell>
                  <TableCell>{row.cultivoNombre}</TableCell>
                  <TableCell>{number(row.produccionEstimada, ` ${row.unidadRendimiento || "kg"}`)}</TableCell>
                  <TableCell>
                    <div>
                      <p>{number(row.kgCosechados, " kg")}</p>
                      <p className={row.diferenciaProduccion >= 0 ? "text-xs text-emerald-500" : "text-xs text-red-500"}>
                        {row.diferenciaProduccion >= 0 ? "+" : ""}{number(row.diferenciaProduccion, " kg")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{number(row.kgVendidos, " kg")}</TableCell>
                  <TableCell>{number(row.kgDisponible, " kg")}</TableCell>
                  <TableCell>{row.cumplimientoProduccion ? number(row.cumplimientoProduccion, "%") : "-"}</TableCell>
                  <TableCell>{money(row.costos)}</TableCell>
                  <TableCell className={row.ganancia >= 0 ? "text-emerald-500" : "text-red-500"}>{money(row.ganancia)}</TableCell>
                  <TableCell>
                    <div>
                      <p>{money(row.ingresos)} / {money(row.ingresoEstimado)}</p>
                      <p className={row.diferenciaIngresos >= 0 ? "text-xs text-emerald-500" : "text-xs text-red-500"}>
                        {row.diferenciaIngresos >= 0 ? "+" : ""}{money(row.diferenciaIngresos)}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function AgronomicPlanView({ selectedGreenhouse }: ViewProps) {
  const { data, isLoading, mutate } = useSWR<PlanRow[]>(scoped("/api/agronomic-plan", selectedGreenhouse), fetcher)
  const rows = data || []
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PlanRow | null>(null)
  const [form, setForm] = useState({ idCultivo: "", densidadPlantasM2: "", sustratoSuelo: "", observaciones: "" })

  function openEdit(row: PlanRow) {
    setEditing(row)
    setForm({
      idCultivo: row.idCultivo,
      densidadPlantasM2: row.densidadPlantasM2 || "",
      sustratoSuelo: row.sustratoSuelo || "",
      observaciones: row.observaciones || "",
    })
    setOpen(true)
  }

  async function save() {
    try {
      await writeApi("/api/agronomic-plan", editing?.idPerfil ? "PUT" : "POST", form)
      toast.success("Perfil agronomico guardado")
      setOpen(false)
      mutate()
    } catch (err) {
      toast.error("Error en plan agronomico", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  async function remove(idPerfil: string) {
    try {
      await writeApi("/api/agronomic-plan", "DELETE", { idPerfil })
      toast.success("Perfil eliminado")
      mutate()
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Plan Agronomico</h2>
        <p className="text-sm text-muted-foreground">Densidad, sustrato, fertirriego, manejo y sanidad por cultivo</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar perfil agronomico</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="grid gap-2"><Label>Cultivo</Label><Input value={editing?.cultivoNombre || ""} disabled /></div>
              <div className="grid gap-2"><Label>Densidad plantas/m2</Label><Input value={form.densidadPlantasM2} onChange={(e) => setForm({ ...form, densidadPlantasM2: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Sustrato/suelo</Label><Textarea value={form.sustratoSuelo} onChange={(e) => setForm({ ...form, sustratoSuelo: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No hay perfiles agronomicos cargados</CardContent></Card>
        ) : rows.map((row) => (
          <Card key={row.idCultivo}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>{row.cultivoNombre}</span>
                <Badge variant={row.idPerfil ? "default" : "outline"}>{row.idPerfil ? "Perfil" : "Sin perfil"}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{row.variedad || "-"} · {row.invernaderoNombre}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Densidad:</span> {row.densidadPlantasM2 || "No definida"}</p>
              <p><span className="text-muted-foreground">Sustrato/suelo:</span> {row.sustratoSuelo || "No definido"}</p>
              <p className="whitespace-pre-line"><span className="text-muted-foreground">Fertirriego:</span> {row.fertilizacion || "No definido"}</p>
              <p className="whitespace-pre-line"><span className="text-muted-foreground">Manejo:</span> {row.manejo || "No definido"}</p>
              <p><span className="text-muted-foreground">Sanidad:</span> {row.sanidad || "No definida"}</p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                {row.idPerfil && <Button variant="outline" size="sm" onClick={() => remove(row.idPerfil)}><Trash2 className="mr-2 h-4 w-4 text-destructive" />Eliminar perfil</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function ApplicationsView({ selectedGreenhouse }: ViewProps) {
  const { data, isLoading, mutate } = useSWR<ApplicationRow[]>(scoped("/api/applications", selectedGreenhouse), fetcher)
  const { data: details } = useSWR<DetailOption[]>(scoped("/api/harvests?mode=details", selectedGreenhouse), fetcher)
  const { data: zones } = useSWR<ZoneOption[]>(scoped("/api/harvests?mode=zones", selectedGreenhouse), fetcher)
  const { data: inventory, mutate: mutateInventory } = useSWR<InventoryRow[]>("/api/inventory", fetcher)
  const rows = data || []
  const applicationProducts = useMemo(
    () => (inventory || []).filter(isPlantApplicationProduct),
    [inventory]
  )
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ApplicationRow | null>(null)
  const [form, setForm] = useState({
    idZona: "",
    idDetalle: "",
    tipoPlaga: "",
    idProducto: "",
    producto: "",
    dosis: "",
    cantidad: "",
    fecha: today(),
    notas: "",
  })
  const selectedProduct = useMemo(
    () => (inventory || []).find((product) => product.id === form.idProducto),
    [inventory, form.idProducto]
  )
  const selectedZone = useMemo(
    () => (zones || []).find((zone) => zone.id === form.idZona),
    [zones, form.idZona]
  )
  const selectedZoneDetail = useMemo(
    () => selectedZone
      ? (details || []).find((detail) =>
          detail.cultivoNombre === selectedZone.cultivoActual &&
          detail.invernaderoNombre === selectedZone.invernaderoNombre
        )
      : null,
    [details, selectedZone]
  )
  const availableProductQuantity = selectedProduct
    ? Number(selectedProduct.cantidadDisponible || 0) + (editing?.idProducto === selectedProduct.id ? Number(editing.cantidad || 0) : 0)
    : 0

  function openCreate() {
    setEditing(null)
    setForm({ idZona: "", idDetalle: "", tipoPlaga: "", idProducto: "", producto: "", dosis: "", cantidad: "", fecha: today(), notas: "" })
    setOpen(true)
  }

  function openEdit(row: ApplicationRow) {
    if (!row.id.startsWith("plaga-")) {
      toast.info("Las aplicaciones de fertilizante se editan desde el plan de fertilizacion")
      return
    }
    setEditing(row)
    setForm({
      idZona: "",
      idDetalle: row.idDetalle,
      tipoPlaga: row.tipoPlaga || "",
      idProducto: row.idProducto || "",
      producto: row.producto || "",
      dosis: row.dosis || "",
      cantidad: row.cantidad || "",
      fecha: row.fecha,
      notas: row.notas || "",
    })
    setOpen(true)
  }

  function selectZone(value: string) {
    const zone = (zones || []).find((item) => item.id === value)
    const detail = zone
      ? (details || []).find((item) =>
          item.cultivoNombre === zone.cultivoActual &&
          item.invernaderoNombre === zone.invernaderoNombre
        )
      : null
    setForm({ ...form, idZona: value, idDetalle: detail?.id || "" })
  }

  async function save() {
    try {
      if (!form.idProducto) {
        toast.error("Producto requerido", { description: "Selecciona un producto del inventario" })
        return
      }
      if (Number(form.cantidad) <= 0) {
        toast.error("Cantidad requerida", { description: "La cantidad aplicada debe ser mayor que 0" })
        return
      }
      if (selectedProduct && Number(form.cantidad) > availableProductQuantity) {
        toast.error("Inventario insuficiente", {
          description: `Disponible: ${number(availableProductQuantity, selectedProduct.unidadMedida ? ` ${selectedProduct.unidadMedida}` : "")}`,
        })
        return
      }
      await writeApi("/api/applications", editing ? "PUT" : "POST", { id: editing?.id, ...form })
      toast.success(editing ? "Aplicacion actualizada" : "Aplicacion registrada")
      setOpen(false)
      mutate()
      mutateInventory()
    } catch (err) {
      toast.error("Error en aplicaciones", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  async function remove(id: string) {
    try {
      await writeApi("/api/applications", "DELETE", { id })
      toast.success("Aplicacion eliminada")
      mutate()
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Aplicaciones</h2>
            <p className="text-sm text-muted-foreground">Fertilizacion y control de plagas aplicados en campo</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nueva aplicacion</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar aplicacion" : "Registrar aplicacion"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid gap-2">
                  <Label>Zona de riego</Label>
                  <Select value={form.idZona} onValueChange={selectZone}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar zona" /></SelectTrigger>
                    <SelectContent>
                      {(zones || []).map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.nombre} - {zone.cultivoActual || "Sin cultivo"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedZone && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Cultivo de la zona</span>
                        <span className="font-medium">{selectedZone.cultivoActual || "Sin cultivo"}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Invernadero</span>
                        <span>{selectedZone.invernaderoNombre || "-"}</span>
                      </div>
                      {!selectedZoneDetail && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Al guardar se creara el detalle del cultivo si aun no existe.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>Tipo plaga/enfermedad</Label><Input value={form.tipoPlaga} onChange={(e) => setForm({ ...form, tipoPlaga: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Producto</Label>
                    <Select
                      value={form.idProducto}
                      onValueChange={(value) => {
                        const product = applicationProducts.find((item) => item.id === value)
                        setForm({ ...form, idProducto: value, producto: product?.nombre || "" })
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                      <SelectContent>
                        {applicationProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Dosis</Label><Input value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} /></div>
                </div>
                {selectedProduct && (
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Disponible en inventario</span>
                      <span className="font-medium">{number(availableProductQuantity, selectedProduct.unidadMedida ? ` ${selectedProduct.unidadMedida}` : "")}</span>
                    </div>
                    <div className="grid gap-2">
                      <Label>Cantidad aplicada</Label>
                      <Input
                        type="number"
                        min={0}
                        max={availableProductQuantity}
                        value={form.cantidad}
                        onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="grid gap-2"><Label>Notas</Label><Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cultivo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Dosis</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRows colSpan={7} label="No hay aplicaciones registradas" /> : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{date(row.fecha)}</TableCell>
                  <TableCell><Badge variant="outline">{row.tipo}</Badge></TableCell>
                  <TableCell>{row.cultivoNombre}</TableCell>
                  <TableCell>{row.producto || "-"}</TableCell>
                  <TableCell>{row.dosis || "-"}</TableCell>
                  <TableCell>{row.cantidad || "-"}</TableCell>
                  <TableCell>
                    {row.id.startsWith("plaga-") ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function FarmCalendarView({ selectedGreenhouse }: ViewProps) {
  const { data, isLoading, mutate } = useSWR<CalendarRow[]>(scoped("/api/farm-calendar", selectedGreenhouse), fetcher)
  const { data: users } = useSWR<UserOption[]>("/api/users", fetcher)
  const rows = data || []
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarRow | null>(null)
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    frecuencia: "unica",
    proximaEjecucion: today(),
    responsable: "",
    estado: "Activa",
  })

  function openCreate() {
    setEditing(null)
    setForm({ titulo: "", descripcion: "", frecuencia: "unica", proximaEjecucion: today(), responsable: users?.[0]?.id || "", estado: "Activa" })
    setOpen(true)
  }

  function openEdit(row: CalendarRow) {
    if (!row.id.startsWith("tarea-")) {
      toast.info("Las cosechas estimadas se editan desde Zonas de Riego")
      return
    }
    setEditing(row)
    setForm({
      titulo: row.titulo,
      descripcion: row.descripcion || "",
      frecuencia: row.tipo || "unica",
      proximaEjecucion: row.fecha,
      responsable: row.responsable || users?.[0]?.id || "",
      estado: row.estado || "Activa",
    })
    setOpen(true)
  }

  async function save() {
    try {
      await writeApi("/api/farm-calendar", editing ? "PUT" : "POST", { id: editing?.id, ...form })
      toast.success(editing ? "Tarea actualizada" : "Tarea creada")
      setOpen(false)
      mutate()
    } catch (err) {
      toast.error("Error en calendario", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  async function remove(id: string) {
    try {
      await writeApi("/api/farm-calendar", "DELETE", { id })
      toast.success("Tarea eliminada")
      mutate()
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Calendario Agricola</h2>
            <p className="text-sm text-muted-foreground">Tareas programadas y cosechas estimadas</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nueva tarea</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar tarea" : "Crear tarea"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid gap-2"><Label>Titulo</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2"><Label>Frecuencia</Label><Input value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Fecha</Label><Input type="date" value={form.proximaEjecucion} onChange={(e) => setForm({ ...form, proximaEjecucion: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} /></div>
                </div>
                <div className="grid gap-2">
                  <Label>Responsable</Label>
                  <Select value={form.responsable} onValueChange={(value) => setForm({ ...form, responsable: value })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar responsable" /></SelectTrigger>
                    <SelectContent>
                      {(users || []).map((user) => <SelectItem key={user.id} value={user.id}>{user.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Descripcion</Label><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid gap-3">
        {rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No hay eventos programados</CardContent></Card>
        ) : rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex items-start gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.titulo}</p>
                  <Badge variant="outline">{row.tipo}</Badge>
                  {row.estado && <Badge variant="secondary">{row.estado}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{date(row.fecha)} · {row.zonaNombre || row.cultivoNombre || "General"}</p>
                {row.descripcion && <p className="mt-2 text-sm">{row.descripcion}</p>}
                {row.id.startsWith("tarea-") && (
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                    <Button variant="outline" size="sm" onClick={() => remove(row.id)}><Trash2 className="mr-2 h-4 w-4 text-destructive" />Eliminar</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function InventoryView({}: ViewProps) {
  const { data, isLoading, mutate } = useSWR<InventoryRow[]>("/api/inventory", fetcher)
  const rows = data || []
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryRow | null>(null)
  const [form, setForm] = useState({
    nombre: "",
    tipo: "",
    categoria: "",
    composicion: "",
    fabricante: "",
    ph: "",
    nitrogeno: "",
    fosforo: "",
    potasio: "",
    micronutrientes: "",
    formaAplicacion: "",
    riesgos: "",
    cantidadDisponible: "",
    unidadMedida: "",
    ubicacion: "",
    notas: "",
  })

  function openCreate() {
    setEditing(null)
    setForm({ nombre: "", tipo: "", categoria: "", composicion: "", fabricante: "", ph: "", nitrogeno: "", fosforo: "", potasio: "", micronutrientes: "", formaAplicacion: "", riesgos: "", cantidadDisponible: "", unidadMedida: "", ubicacion: "", notas: "" })
    setOpen(true)
  }

  function openEdit(row: InventoryRow) {
    setEditing(row)
    setForm({
      nombre: row.nombre,
      tipo: row.tipo,
      categoria: row.categoria || "",
      composicion: row.composicion || "",
      fabricante: row.fabricante || "",
      ph: row.ph != null ? String(row.ph) : "",
      nitrogeno: row.nitrogeno != null ? String(row.nitrogeno) : "",
      fosforo: row.fosforo != null ? String(row.fosforo) : "",
      potasio: row.potasio != null ? String(row.potasio) : "",
      micronutrientes: row.micronutrientes || "",
      formaAplicacion: row.formaAplicacion || "",
      riesgos: row.riesgos || "",
      cantidadDisponible: row.cantidadDisponible != null ? String(row.cantidadDisponible) : "",
      unidadMedida: row.unidadMedida || "",
      ubicacion: row.ubicacion || "",
      notas: row.notas || "",
    })
    setOpen(true)
  }

  async function save() {
    try {
      await writeApi("/api/inventory", editing ? "PUT" : "POST", { id: editing?.id, ...form })
      toast.success(editing ? "Producto actualizado" : "Producto registrado")
      setOpen(false)
      mutate()
    } catch (err) {
      toast.error("Error en inventario", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  async function remove(id: string) {
    try {
      await writeApi("/api/inventory", "DELETE", { id })
      toast.success("Producto eliminado")
      mutate()
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Inventario Agricola</h2>
            <p className="text-sm text-muted-foreground">Control general de productos, insumos y materiales disponibles</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nuevo producto</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar producto" : "Registrar producto"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Tipo</Label><Input value={form.tipo} placeholder="Semilla, herramienta, fertilizante..." onChange={(e) => setForm({ ...form, tipo: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>Categoria</Label><Input value={form.categoria} placeholder="Insumo, material, equipo..." onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Fabricante / marca</Label><Input value={form.fabricante} onChange={(e) => setForm({ ...form, fabricante: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>Descripcion / composicion</Label><Input value={form.composicion} onChange={(e) => setForm({ ...form, composicion: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Ubicacion</Label><Input value={form.ubicacion} placeholder="Almacen, zona, estante..." onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="grid gap-2"><Label>pH</Label><Input type="number" step="0.1" value={form.ph} onChange={(e) => setForm({ ...form, ph: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>N</Label><Input type="number" step="0.1" value={form.nitrogeno} onChange={(e) => setForm({ ...form, nitrogeno: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>P</Label><Input type="number" step="0.1" value={form.fosforo} onChange={(e) => setForm({ ...form, fosforo: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>K</Label><Input type="number" step="0.1" value={form.potasio} onChange={(e) => setForm({ ...form, potasio: e.target.value })} /></div>
                </div>
                <div className="grid gap-2"><Label>Micronutrientes</Label><Input value={form.micronutrientes} onChange={(e) => setForm({ ...form, micronutrientes: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Forma de aplicacion</Label><Input value={form.formaAplicacion} onChange={(e) => setForm({ ...form, formaAplicacion: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>Cantidad disponible</Label><Input type="number" min={0} value={form.cantidadDisponible} onChange={(e) => setForm({ ...form, cantidadDisponible: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Unidad</Label><Input value={form.unidadMedida} placeholder="kg, L, unidad..." onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })} /></div>
                </div>
                <div className="grid gap-2"><Label>Riesgos</Label><Textarea value={form.riesgos} onChange={(e) => setForm({ ...form, riesgos: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Notas</Label><Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>Ubicacion</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <EmptyRows colSpan={7} label="No hay productos registrados" /> : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.nombre}</p>
                      <p className="text-xs text-muted-foreground">{row.fabricante || "-"}</p>
                    </div>
                  </TableCell>
                  <TableCell>{row.tipo}</TableCell>
                  <TableCell>{row.categoria || "-"}</TableCell>
                  <TableCell>{row.composicion || "-"}</TableCell>
                  <TableCell>{row.cantidadDisponible != null ? number(row.cantidadDisponible, row.unidadMedida ? ` ${row.unidadMedida}` : "") : "-"}</TableCell>
                  <TableCell>{row.ubicacion || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
