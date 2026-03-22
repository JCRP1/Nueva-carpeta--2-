"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Leaf,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Calendar,
  Sprout,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api, fetcher } from "@/lib/api-client"
import type { Cultivo, Invernadero, UserRole } from "@/lib/greensense-data"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CropsViewProps {
  userRole: UserRole
  selectedGreenhouse: string
}

interface CultivoDetalle {
  id?: string
  fecha_cosecha_estimada?: string
  tiempo_germinacion_dias?: string
  tiempo_crecimiento_dias?: string
  tiempo_cosecha_dias?: string
  notas?: string
}

export function CropsView({ userRole, selectedGreenhouse }: CropsViewProps) {
  const isReadOnly = userRole === "agricultor"
  const { data: crops, mutate: mutateCrops, isLoading, error } = useSWR<Cultivo[]>(
    selectedGreenhouse ? `/api/crops?greenhouse=${selectedGreenhouse}` : null,
    fetcher
  )
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCrop, setEditingCrop] = useState<Cultivo | null>(null)
  const [saving, setSaving] = useState(false)

  console.log("[CropsView] selectedGreenhouse:", selectedGreenhouse)
  console.log("[CropsView] crops data:", crops)
  console.log("[CropsView] crops length:", crops?.length)
  console.log("[CropsView] first crop raw:", crops?.[0])
  console.log("[CropsView] greenhouses:", greenhouses)
  console.log("[CropsView] error:", error)
  console.log("[CropsView] isLoading:", isLoading)

  const [formData, setFormData] = useState({
    nombre: "",
    variedad: "",
    invernaderoId: "",
    fecha_siembra: "",
    detalle: {
      fecha_cosecha_estimada: "",
      tiempo_germinacion_dias: "",
      tiempo_crecimiento_dias: "",
      tiempo_cosecha_dias: "",
      notas: "",
    } as CultivoDetalle,
  })

  const filteredCrops = (crops || []).filter((crop) =>
    crop.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (crop.variedad || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  function openNewDialog() {
    setEditingCrop(null)
    setFormData({
      nombre: "",
      variedad: "",
      invernaderoId: selectedGreenhouse,
      fecha_siembra: "",
      detalle: {
        fecha_cosecha_estimada: "",
        tiempo_germinacion_dias: "",
        tiempo_crecimiento_dias: "",
        tiempo_cosecha_dias: "",
        notas: "",
      },
    })
    setDialogOpen(true)
  }

  function openEditDialog(crop: Cultivo) {
    setEditingCrop(crop)
    setFormData({
      nombre: crop.nombre,
      variedad: crop.variedad || "",
      invernaderoId: crop.invernaderoId,
      fecha_siembra: crop.fechaSiembra || "",
      detalle: {
        fecha_cosecha_estimada: crop.detalle?.fechaCosechaEstimada || "",
        tiempo_germinacion_dias: crop.detalle?.tiempoGerminacionDias?.toString() || "",
        tiempo_crecimiento_dias: crop.detalle?.tiempoCrecimientoDias?.toString() || "",
        tiempo_cosecha_dias: crop.detalle?.tiempoCosechaDias?.toString() || "",
        notas: crop.detalle?.notas || "",
      },
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.nombre || !formData.invernaderoId) {
      toast.error("Error", { description: "Por favor complete los campos requeridos" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        nombre: formData.nombre,
        variedad: formData.variedad,
        invernaderoId: formData.invernaderoId,
        fecha_siembra: formData.fecha_siembra || null,
        fecha_cosecha_estimada: formData.detalle.fecha_cosecha_estimada || null,
        tiempo_germinacion_dias: formData.detalle.tiempo_germinacion_dias ? parseInt(formData.detalle.tiempo_germinacion_dias) : null,
        tiempo_crecimiento_dias: formData.detalle.tiempo_crecimiento_dias ? parseInt(formData.detalle.tiempo_crecimiento_dias) : null,
        tiempo_cosecha_dias: formData.detalle.tiempo_cosecha_dias ? parseInt(formData.detalle.tiempo_cosecha_dias) : null,
        notas: formData.detalle.notas,
      }

      if (editingCrop) {
        await api.updateCrop(editingCrop.id, { ...payload, detalle: formData.detalle })
        toast.success("Cultivo actualizado", { description: `${formData.nombre} ha sido actualizado` })
      } else {
        await api.createCrop(payload)
        toast.success("Cultivo creado", { description: `${formData.nombre} ha sido creado` })
      }

      mutateCrops()
      setDialogOpen(false)
    } catch {
      toast.error("Error", { description: "No se pudo guardar el cultivo" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteCrop(id)
      mutateCrops()
      toast.success("Cultivo eliminado", { description: "El cultivo ha sido eliminado" })
    } catch {
      toast.error("Error", { description: "No se pudo eliminar el cultivo" })
    }
  }

  function getGreenhouseName(invId: string | number) {
    const id = String(invId)
    const inv = greenhouses?.find((i) => String(i.id) === id)
    return inv?.nombre || `Invernadero ${id}`
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "-"
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return "-"
      return date.toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" })
    } catch {
      return "-"
    }
  }

  if (!selectedGreenhouse) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Seleccione un invernadero para ver sus cultivos</p>
      </div>
    )
  }

  if (isLoading) {
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
          <h1 className="text-2xl font-bold text-foreground">Cultivos</h1>
          <p className="text-sm text-muted-foreground">Gestione los cultivos del invernadero</p>
        </div>
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Cultivo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCrop ? "Editar Cultivo" : "Nuevo Cultivo"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Tomate"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="variedad">Variedad</Label>
                    <Input
                      id="variedad"
                      value={formData.variedad}
                      onChange={(e) => setFormData({ ...formData, variedad: e.target.value })}
                      placeholder="Cherry, Roma, etc."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="invernadero">Invernadero *</Label>
                    <select
                      id="invernadero"
                      aria-label="Invernadero"
                      value={formData.invernaderoId}
                      onChange={(e) => setFormData({ ...formData, invernaderoId: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">Seleccionar invernadero</option>
                      {(greenhouses || []).map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fecha_siembra">Fecha de Siembra</Label>
                    <Input
                      id="fecha_siembra"
                      type="date"
                      value={formData.fecha_siembra}
                      onChange={(e) => setFormData({ ...formData, fecha_siembra: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="border-t pt-4 mt-2">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Sprout className="h-4 w-4" />
                    Detalles del Cultivo
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="fecha_cosecha">Fecha Cosecha Estimada</Label>
                      <Input
                        id="fecha_cosecha"
                        type="date"
                        value={formData.detalle.fecha_cosecha_estimada}
                        onChange={(e) => setFormData({
                          ...formData,
                          detalle: { ...formData.detalle, fecha_cosecha_estimada: e.target.value }
                        })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notas">Notas</Label>
                      <Input
                        id="notas"
                        value={formData.detalle.notas}
                        onChange={(e) => setFormData({
                          ...formData,
                          detalle: { ...formData.detalle, notas: e.target.value }
                        })}
                        placeholder="Notas adicionales..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="germinacion">Germinacion (dias)</Label>
                      <Input
                        id="germinacion"
                        type="number"
                        min="0"
                        value={formData.detalle.tiempo_germinacion_dias}
                        onChange={(e) => setFormData({
                          ...formData,
                          detalle: { ...formData.detalle, tiempo_germinacion_dias: e.target.value }
                        })}
                        placeholder="7"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="crecimiento">Crecimiento (dias)</Label>
                      <Input
                        id="crecimiento"
                        type="number"
                        min="0"
                        value={formData.detalle.tiempo_crecimiento_dias}
                        onChange={(e) => setFormData({
                          ...formData,
                          detalle: { ...formData.detalle, tiempo_crecimiento_dias: e.target.value }
                        })}
                        placeholder="60"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cosecha">Cosecha (dias)</Label>
                      <Input
                        id="cosecha"
                        type="number"
                        min="0"
                        value={formData.detalle.tiempo_cosecha_dias}
                        onChange={(e) => setFormData({
                          ...formData,
                          detalle: { ...formData.detalle, tiempo_cosecha_dias: e.target.value }
                        })}
                        placeholder="90"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cultivos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista de Cultivos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead>Invernadero</TableHead>
                <TableHead>Fecha Siembra</TableHead>
                <TableHead>Estado</TableHead>
                {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCrops.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron cultivos
                  </TableCell>
                </TableRow>
              ) : (
                filteredCrops.map((crop) => (
                  <TableRow key={crop.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-muted-foreground" />
                        {crop.nombre}
                      </div>
                    </TableCell>
                    <TableCell>{crop.variedad || "-"}</TableCell>
                    <TableCell>{getGreenhouseName(crop.invernaderoId)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(crop.fechaSiembra)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {crop.detalle ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-blue-500 cursor-help">
                                {crop.detalle.fechaCosechaEstimada ? "Con Detalle" : "Sin Cosecha"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="w-72 p-0">
                              <Card className="border-0 shadow-none">
                                <CardContent className="p-3 space-y-2">
                                  <p className="font-semibold text-sm">Detalles del Cultivo</p>
                                  {crop.detalle.fechaCosechaEstimada && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Fecha Cosecha:</span>
                                      <span>{formatDate(crop.detalle.fechaCosechaEstimada)}</span>
                                    </div>
                                  )}
                                  {crop.detalle.tiempoGerminacionDias && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Germinacion:</span>
                                      <span>{crop.detalle.tiempoGerminacionDias} dias</span>
                                    </div>
                                  )}
                                  {crop.detalle.tiempoCrecimientoDias && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Crecimiento:</span>
                                      <span>{crop.detalle.tiempoCrecimientoDias} dias</span>
                                    </div>
                                  )}
                                  {crop.detalle.tiempoCosechaDias && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Tiempo Cosecha:</span>
                                      <span>{crop.detalle.tiempoCosechaDias} dias</span>
                                    </div>
                                  )}
                                  {crop.detalle.notas && (
                                    <div className="pt-1 border-t">
                                      <p className="text-xs text-muted-foreground mb-1">Notas:</p>
                                      <p className="text-xs">{crop.detalle.notas}</p>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge variant="outline">Sin Detalle</Badge>
                      )}
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(crop)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(crop.id)}
                            >
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