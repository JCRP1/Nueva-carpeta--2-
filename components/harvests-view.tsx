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
  DialogClose,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { api, fetcher } from "@/lib/api-client"
import type { UserRole } from "@/lib/greensense-data"
import { Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, Wheat } from "lucide-react"
import { toast } from "sonner"

interface HarvestData {
  id: string
  idDetalle: string
  idZona: string
  fechaCosecha: string
  cantidadCosechadaKg: number
  cantidadUnidades: number
  unidadCosecha: string
  calidad: string
  rendimientoM2: number
  perdidaKg: number
  observaciones: string
  fechaRegistro: string
  cultivoNombre: string
  variedad: string
  invernaderoNombre: string
  zonaNombre: string
}

interface ZoneOption {
  id: string
  nombre: string
  cultivoActual: string
  invernaderoNombre: string
  areaM2: number
  rendimientoIdealM2: number
  cosechaEsperadaKg: number
  fechaSiembra: string
  fechaCosechaEstimada: string
}

interface HarvestForm {
  idZona: string
  fechaCosecha: string
  cantidadCosechadaKg: string
  cantidadUnidades: string
  unidadCosecha: string
  calidad: string
  perdidaKg: string
  observaciones: string
}

const emptyForm: HarvestForm = {
  idZona: "",
  fechaCosecha: "",
  cantidadCosechadaKg: "",
  cantidadUnidades: "",
  unidadCosecha: "lb",
  calidad: "Buena",
  perdidaKg: "0",
  observaciones: "",
}

function formatDate(value: string) {
  if (!value) return "-"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" })
}

function formatNumber(value: number, suffix = "") {
  return `${Number(value || 0).toLocaleString("es-DO", { maximumFractionDigits: 2 })}${suffix}`
}

function toInputNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ""
  return String(Number(value.toFixed(2)))
}

function zoneLabel(zone: ZoneOption) {
  const crop = zone.cultivoActual ? ` - ${zone.cultivoActual}` : ""
  const greenhouse = zone.invernaderoNombre ? ` (${zone.invernaderoNombre})` : ""
  return `${zone.nombre}${crop}${greenhouse}`
}

export function HarvestsView({
  selectedGreenhouse,
  userRole,
}: {
  selectedGreenhouse: string
  userRole: UserRole
}) {
  const isReadOnly = userRole === "agricultor"
  const { data: harvests, isLoading, mutate } = useSWR<HarvestData[]>(
    `/api/harvests${selectedGreenhouse ? `?greenhouse=${selectedGreenhouse}` : ""}`,
    fetcher
  )
  const { data: zones } = useSWR<ZoneOption[]>(
    `/api/harvests?mode=zones${selectedGreenhouse ? `&greenhouse=${selectedGreenhouse}` : ""}`,
    fetcher
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHarvest, setEditingHarvest] = useState<HarvestData | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<HarvestForm>(emptyForm)

  const filteredHarvests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const list = harvests || []
    if (!query) return list

    return list.filter((harvest) =>
      harvest.cultivoNombre.toLowerCase().includes(query) ||
      harvest.variedad.toLowerCase().includes(query) ||
      harvest.zonaNombre.toLowerCase().includes(query) ||
      harvest.invernaderoNombre.toLowerCase().includes(query) ||
      harvest.calidad.toLowerCase().includes(query)
    )
  }, [harvests, searchQuery])

  const totalKg = useMemo(
    () => (harvests || []).reduce((sum, harvest) => sum + Number(harvest.cantidadCosechadaKg || 0), 0),
    [harvests]
  )
  const totalLoss = useMemo(
    () => (harvests || []).reduce((sum, harvest) => sum + Number(harvest.perdidaKg || 0), 0),
    [harvests]
  )
  const selectedZone = (zones || []).find((zone) => zone.id === formData.idZona)
  const harvestedKg = Number(formData.cantidadCosechadaKg || 0)
  const lossKg = Number(formData.perdidaKg || 0)
  const selectedZoneAreaM2 = Number(selectedZone?.areaM2 || 0)
  const idealYieldM2 = Number(selectedZone?.rendimientoIdealM2 || 0)
  const expectedHarvestKg = Number(selectedZone?.cosechaEsperadaKg || 0)
  const calculatedYield = useMemo(() => {
    if (selectedZoneAreaM2 <= 0) return 0
    return Math.max(0, (harvestedKg - lossKg) / selectedZoneAreaM2)
  }, [harvestedKg, lossKg, selectedZoneAreaM2])

  function handleZoneChange(value: string) {
    const zone = (zones || []).find((item) => item.id === value)
    const expectedKg = Number(zone?.cosechaEsperadaKg || 0)

    setFormData({
      ...formData,
      idZona: value,
      cantidadCosechadaKg: expectedKg > 0 ? toInputNumber(expectedKg) : formData.cantidadCosechadaKg,
    })
  }

  function openNewDialog() {
    setEditingHarvest(null)
    setFormData({
      ...emptyForm,
      fechaCosecha: new Date().toISOString().slice(0, 10),
    })
    setDialogOpen(true)
  }

  function openEditDialog(harvest: HarvestData) {
    setEditingHarvest(harvest)
    setFormData({
      idZona: harvest.idZona,
      fechaCosecha: harvest.fechaCosecha,
      cantidadCosechadaKg: String(harvest.cantidadCosechadaKg || ""),
      cantidadUnidades: String(harvest.cantidadUnidades || ""),
      unidadCosecha: harvest.unidadCosecha || "lb",
      calidad: harvest.calidad || "Buena",
      perdidaKg: String(harvest.perdidaKg || 0),
      observaciones: harvest.observaciones || "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.idZona || !formData.fechaCosecha) {
      toast.error("Complete los campos requeridos", { description: "Seleccione zona de riego y fecha de cosecha" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        idZona: formData.idZona,
        fechaCosecha: formData.fechaCosecha,
        cantidadCosechadaKg: formData.cantidadCosechadaKg ? Number(formData.cantidadCosechadaKg) : 0,
        cantidadUnidades: formData.cantidadUnidades ? Number(formData.cantidadUnidades) : 0,
        unidadCosecha: formData.unidadCosecha,
        calidad: formData.calidad,
        perdidaKg: formData.perdidaKg ? Number(formData.perdidaKg) : 0,
        observaciones: formData.observaciones,
      }

      if (editingHarvest) {
        await api.updateHarvest(editingHarvest.id, payload)
        toast.success("Cosecha actualizada")
      } else {
        await api.createHarvest(payload)
        toast.success("Cosecha registrada")
      }

      mutate()
      setDialogOpen(false)
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteHarvest(id)
      mutate()
      toast.success("Cosecha eliminada")
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  if (isLoading && !harvests) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cosechas</h1>
          <p className="text-sm text-muted-foreground">Registro y rendimiento de cosechas por cultivo</p>
        </div>
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Cosecha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingHarvest ? "Editar Cosecha" : "Registrar Cosecha"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Zona de riego *</Label>
                  <Select
                    value={formData.idZona}
                    onValueChange={handleZoneChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar zona de riego" />
                    </SelectTrigger>
                    <SelectContent>
                      {(zones || []).map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zoneLabel(zone)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Area zona</p>
                    <p className="text-sm font-medium">{formatNumber(selectedZoneAreaM2, " m2")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rendimiento ideal</p>
                    <p className="text-sm font-medium">{formatNumber(idealYieldM2, " kg/m2")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cosecha esperada</p>
                    <p className="text-sm font-medium">{formatNumber(expectedHarvestKg, " kg")}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Fecha de cosecha *</Label>
                    <Input
                      type="date"
                      value={formData.fechaCosecha}
                      onChange={(e) => setFormData({ ...formData, fechaCosecha: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Calidad</Label>
                    <Select
                      value={formData.calidad}
                      onValueChange={(value) => setFormData({ ...formData, calidad: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Calidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Excelente">Excelente</SelectItem>
                        <SelectItem value="Buena">Buena</SelectItem>
                        <SelectItem value="Regular">Regular</SelectItem>
                        <SelectItem value="Baja">Baja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Cosechado (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.cantidadCosechadaKg}
                      onChange={(e) => setFormData({ ...formData, cantidadCosechadaKg: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ideal: {formatNumber(idealYieldM2, " kg/m2")} * {formatNumber(selectedZoneAreaM2, " m2")}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Perdida (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.perdidaKg}
                      onChange={(e) => setFormData({ ...formData, perdidaKg: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Rendimiento calculado kg/m2</Label>
                    <Input
                      value={selectedZoneAreaM2 > 0 ? formatNumber(calculatedYield) : ""}
                      readOnly
                      placeholder="Seleccione una zona"
                      className="bg-muted font-medium"
                    />
                    <p className="text-xs text-muted-foreground">
                      ({formatNumber(harvestedKg)} - {formatNumber(lossKg)}) / {formatNumber(selectedZoneAreaM2, " m2")}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Cantidad cosechada</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.cantidadUnidades}
                      onChange={(e) => setFormData({ ...formData, cantidadUnidades: e.target.value })}
                      placeholder="Ej: 350"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidad</Label>
                    <Input
                      value={formData.unidadCosecha}
                      onChange={(e) => setFormData({ ...formData, unidadCosecha: e.target.value })}
                      placeholder="lb, unidades, cajas"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Observaciones</Label>
                  <Textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Notas sobre calidad, lote, empaque o incidencias..."
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cosechas</p>
            <p className="text-2xl font-semibold">{harvests?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total cosechado</p>
            <p className="text-2xl font-semibold">{formatNumber(totalKg, " kg")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Perdida registrada</p>
            <p className="text-2xl font-semibold">{formatNumber(totalLoss, " kg")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar cosechas..."
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista de Cosechas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cultivo</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Calidad</TableHead>
                <TableHead>Rendimiento</TableHead>
                <TableHead>Perdida</TableHead>
                {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHarvests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isReadOnly ? 7 : 8} className="py-8 text-center text-muted-foreground">
                    No se encontraron cosechas
                  </TableCell>
                </TableRow>
              ) : (
                filteredHarvests.map((harvest) => (
                  <TableRow key={harvest.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Wheat className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{harvest.cultivoNombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {harvest.variedad || "-"} - {harvest.invernaderoNombre}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{harvest.zonaNombre || "Sin zona"}</TableCell>
                    <TableCell>{formatDate(harvest.fechaCosecha)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{formatNumber(harvest.cantidadCosechadaKg, " kg")}</div>
                      {harvest.cantidadUnidades > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(harvest.cantidadUnidades, ` ${harvest.unidadCosecha || "unid."}`)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{harvest.calidad || "Sin clasificar"}</Badge>
                    </TableCell>
                    <TableCell>{formatNumber(harvest.rendimientoM2, " kg/m2")}</TableCell>
                    <TableCell>{formatNumber(harvest.perdidaKg, " kg")}</TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(harvest)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(harvest.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
