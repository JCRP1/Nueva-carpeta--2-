"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { getAllCultivos, getPerfilAgronomico } from "@/lib/cultivos-rd-data"

interface CropsViewProps {
  userRole: UserRole
  selectedGreenhouse: string
}

interface CultivoDetalle {
  id?: string
  umbral_humedad?: string
  umbral_temperatura?: string
  umbral_ph?: string
  umbral_ec?: string
  umbral_tds?: string
}

interface PerfilAgronomicoForm {
  aguaAproximada: string
  fertilizantes: string
  abonos: string
  rendimientoPorMata: string
  plagas: string
  mesesRecomendados: string
}

type CultivoRD = ReturnType<typeof getAllCultivos>[number]

type CultivoConPerfil = Cultivo & {
  perfilAgronomico?: Partial<Record<keyof PerfilAgronomicoForm, unknown>>
}

function emptyPerfilAgronomico(): PerfilAgronomicoForm {
  return {
    aguaAproximada: "",
    fertilizantes: "",
    abonos: "",
    rendimientoPorMata: "",
    plagas: "",
    mesesRecomendados: "",
  }
}

function valueToText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join("\n")
  return String(value || "")
}

function getPerfilAgronomicoForm(nombre: string, fallback?: Partial<Record<keyof PerfilAgronomicoForm, unknown>>): PerfilAgronomicoForm {
  const perfil = getPerfilAgronomico(nombre)
  const base = emptyPerfilAgronomico()

  return {
    aguaAproximada: valueToText(fallback?.aguaAproximada ?? perfil?.aguaAproximada ?? base.aguaAproximada),
    fertilizantes: valueToText(fallback?.fertilizantes ?? perfil?.fertilizantes ?? base.fertilizantes),
    abonos: valueToText(fallback?.abonos ?? perfil?.abonos ?? base.abonos),
    rendimientoPorMata: valueToText(fallback?.rendimientoPorMata ?? perfil?.rendimientoPorMata ?? base.rendimientoPorMata),
    plagas: valueToText(fallback?.plagas ?? perfil?.plagas ?? base.plagas),
    mesesRecomendados: valueToText(fallback?.mesesRecomendados ?? perfil?.mesesRecomendados ?? base.mesesRecomendados),
  }
}

function getCultivoRDThresholds(cultivo?: CultivoRD): CultivoDetalle {
  const thresholds = cultivo?.etapas.crecimiento || cultivo?.etapas.germinacion || cultivo?.etapas.cosecha

  return {
    umbral_humedad: thresholds?.umbral_humedad?.toString() || "40",
    umbral_temperatura: "28",
    umbral_ph: thresholds?.umbral_ph?.toString() || "6",
    umbral_ec: thresholds?.umbral_ec?.toString() || "1.5",
    umbral_tds: thresholds?.umbral_tds?.toString() || "800",
  }
}

function findCultivoRD(nombre: string, variedad?: string) {
  const normalizedName = nombre.trim().toLowerCase()
  const normalizedVariety = variedad?.trim().toLowerCase()
  const allCultivos = getAllCultivos()

  return allCultivos.find((cultivo) =>
    cultivo.nombre.toLowerCase() === normalizedName &&
    (!normalizedVariety || cultivo.variedad.toLowerCase() === normalizedVariety)
  ) || allCultivos.find((cultivo) => cultivo.nombre.toLowerCase() === normalizedName)
}

export function CropsView({ userRole, selectedGreenhouse }: CropsViewProps) {
  const isReadOnly = userRole === "agricultor"
  const { data: crops, mutate: mutateCrops, isLoading, error } = useSWR<Cultivo[]>(
    "/api/crops",
    fetcher
  )
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCrop, setEditingCrop] = useState<Cultivo | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    variedad: "",
    invernaderoId: "",
    detalle: {
      umbral_humedad: "40",
      umbral_temperatura: "28",
      umbral_ph: "6",
      umbral_ec: "1.5",
      umbral_tds: "800",
    } as CultivoDetalle,
    perfilAgronomico: emptyPerfilAgronomico(),
  })
  const [searchCultivo, setSearchCultivo] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const cultivosSugeridos = useMemo(() => {
    const allCultivos = getAllCultivos()
    if (!searchCultivo || searchCultivo.trim().length < 1) return []
    const searchLower = searchCultivo.toLowerCase().trim()
    return allCultivos.filter(c =>
      c.nombre.toLowerCase().includes(searchLower) ||
      c.variedad.toLowerCase().includes(searchLower)
    )
  }, [searchCultivo])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const cropTableColumnCount = isReadOnly ? 4 : 5

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
      detalle: {
        umbral_humedad: "40",
        umbral_temperatura: "28",
        umbral_ph: "6",
        umbral_ec: "1.5",
        umbral_tds: "800",
      },
      perfilAgronomico: emptyPerfilAgronomico(),
    })
    setSearchCultivo("")
    setShowSuggestions(false)
    setDialogOpen(true)
  }

  function openEditDialog(crop: Cultivo) {
    const cultivoRDThresholds = getCultivoRDThresholds(findCultivoRD(crop.nombre, crop.variedad))
    const cropWithPerfil = crop as CultivoConPerfil

    setEditingCrop(crop)
    setFormData({
      nombre: crop.nombre,
      variedad: crop.variedad || "",
      invernaderoId: crop.invernaderoId,
      detalle: {
        umbral_humedad: crop.umbralHumedad?.toString() || crop.detalle?.umbralHumedad?.toString() || cultivoRDThresholds.umbral_humedad,
        umbral_temperatura: crop.umbralTemperatura?.toString() || cultivoRDThresholds.umbral_temperatura,
        umbral_ph: crop.umbralPh?.toString() || crop.detalle?.umbralPh?.toString() || cultivoRDThresholds.umbral_ph,
        umbral_ec: crop.umbralEc?.toString() || crop.detalle?.umbralEc?.toString() || cultivoRDThresholds.umbral_ec,
        umbral_tds: crop.umbralTds?.toString() || crop.detalle?.umbralTds?.toString() || cultivoRDThresholds.umbral_tds,
      },
      perfilAgronomico: getPerfilAgronomicoForm(crop.nombre, cropWithPerfil.perfilAgronomico),
    })
    setSearchCultivo(crop.nombre)
    setShowSuggestions(false)
    setDialogOpen(true)
  }

  function selectCultivo(cultivo: CultivoRD) {
    setFormData({
      nombre: cultivo.nombre,
      variedad: cultivo.variedad,
      invernaderoId: formData.invernaderoId,
      detalle: getCultivoRDThresholds(cultivo),
      perfilAgronomico: getPerfilAgronomicoForm(cultivo.nombre),
    })
    setSearchCultivo(cultivo.nombre)
    setShowSuggestions(false)
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
        umbral_humedad: formData.detalle.umbral_humedad ? Number(formData.detalle.umbral_humedad) : null,
        umbral_temperatura: formData.detalle.umbral_temperatura ? Number(formData.detalle.umbral_temperatura) : null,
        umbral_ph: formData.detalle.umbral_ph ? Number(formData.detalle.umbral_ph) : null,
        umbral_ec: formData.detalle.umbral_ec ? Number(formData.detalle.umbral_ec) : null,
        umbral_tds: formData.detalle.umbral_tds ? Number(formData.detalle.umbral_tds) : null,
        perfilAgronomico: formData.perfilAgronomico,
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
          <p className="text-sm text-muted-foreground">Gestione todos los cultivos registrados</p>
        </div>
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Cultivo
              </Button>
            </DialogTrigger>
             <DialogContent className="max-w-3xl">
               <DialogHeader>
                 <DialogTitle>
                   {editingCrop ? "Editar Cultivo" : "Nuevo Cultivo"}
                 </DialogTitle>
               </DialogHeader>
               <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="grid gap-2 relative" ref={searchRef}>
                     <Label htmlFor="nombre">Nombre *</Label>
                     <Input
                       id="nombre"
                       value={searchCultivo}
                       onChange={(e) => {
                         const nombre = e.target.value
                         const cultivoRD = findCultivoRD(nombre, formData.variedad)
                         setSearchCultivo(nombre)
                         setFormData({
                           ...formData,
                           nombre,
                           detalle: cultivoRD ? getCultivoRDThresholds(cultivoRD) : formData.detalle,
                           perfilAgronomico: cultivoRD ? getPerfilAgronomicoForm(cultivoRD.nombre) : formData.perfilAgronomico,
                         })
                         setShowSuggestions(nombre.length > 0)
                       }}
                       placeholder="Escriba para buscar un cultivo..."
                     />
                     {cultivosSugeridos.length > 0 && showSuggestions && (
                       <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto top-full">
                         {cultivosSugeridos.map((cultivo, index) => (
                           <div
                             key={`${cultivo.nombre}-${index}`}
                             className="px-3 py-2 cursor-pointer hover:bg-accent"
                             onMouseDown={(e) => {
                               e.preventDefault()
                               selectCultivo(cultivo)
                             }}
                           >
                             <div className="font-medium text-sm">{cultivo.nombre}</div>
                             <div className="text-xs text-muted-foreground">{cultivo.variedad}</div>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                   <div className="grid gap-2">
                     <Label htmlFor="variedad">Variedad</Label>
                     <Input
                       id="variedad"
                       value={formData.variedad}
                       onChange={(e) => {
                         const variedad = e.target.value
                         const cultivoRD = findCultivoRD(formData.nombre, variedad)
                         setFormData({
                           ...formData,
                           variedad,
                           detalle: cultivoRD ? getCultivoRDThresholds(cultivoRD) : formData.detalle,
                           perfilAgronomico: cultivoRD ? getPerfilAgronomicoForm(cultivoRD.nombre) : formData.perfilAgronomico,
                         })
                       }}
                       placeholder="Se completa automaticamente o escriba una variedad"
                     />
                   </div>
                 </div>
                <div className="grid grid-cols-1 gap-4">
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
                </div>
                <div className="border-t pt-4 mt-2">
                  <h3 className="mb-3 text-sm font-medium">Perfil agronomico</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="agua_aproximada">Agua aproximada</Label>
                      <Input
                        id="agua_aproximada"
                        value={formData.perfilAgronomico.aguaAproximada}
                        onChange={(e) => setFormData({
                          ...formData,
                          perfilAgronomico: { ...formData.perfilAgronomico, aguaAproximada: e.target.value },
                        })}
                        placeholder="Ej: 1.5 a 2.5 L por mata/dia"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rendimiento_por_mata">Rendimiento por mata</Label>
                      <Input
                        id="rendimiento_por_mata"
                        value={formData.perfilAgronomico.rendimientoPorMata}
                        onChange={(e) => setFormData({
                          ...formData,
                          perfilAgronomico: { ...formData.perfilAgronomico, rendimientoPorMata: e.target.value },
                        })}
                        placeholder="Ej: 8 a 12 lb por mata"
                      />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="fertilizantes">Fertilizantes</Label>
                      <Textarea
                        id="fertilizantes"
                        value={formData.perfilAgronomico.fertilizantes}
                        onChange={(e) => setFormData({
                          ...formData,
                          perfilAgronomico: { ...formData.perfilAgronomico, fertilizantes: e.target.value },
                        })}
                        placeholder="Uno por linea"
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="abonos">Abonos</Label>
                      <Textarea
                        id="abonos"
                        value={formData.perfilAgronomico.abonos}
                        onChange={(e) => setFormData({
                          ...formData,
                          perfilAgronomico: { ...formData.perfilAgronomico, abonos: e.target.value },
                        })}
                        placeholder="Uno por linea"
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="plagas">Plagas o insectos</Label>
                      <Textarea
                        id="plagas"
                        value={formData.perfilAgronomico.plagas}
                        onChange={(e) => setFormData({
                          ...formData,
                          perfilAgronomico: { ...formData.perfilAgronomico, plagas: e.target.value },
                        })}
                        placeholder="Uno por linea"
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="meses_recomendados">Meses recomendados</Label>
                      <Textarea
                        id="meses_recomendados"
                        value={formData.perfilAgronomico.mesesRecomendados}
                        onChange={(e) => setFormData({
                          ...formData,
                          perfilAgronomico: { ...formData.perfilAgronomico, mesesRecomendados: e.target.value },
                        })}
                        placeholder="Uno por linea o separados por coma"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4 mt-2">
                  <h3 className="mb-3 text-sm font-medium">Umbrales del Cultivo</h3>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="umbral_humedad">Humedad (%)</Label>
                        <Input
                          id="umbral_humedad"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={formData.detalle.umbral_humedad}
                          onChange={(e) => setFormData({
                            ...formData,
                            detalle: { ...formData.detalle, umbral_humedad: e.target.value }
                          })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="umbral_temperatura">Temp. (C)</Label>
                        <Input
                          id="umbral_temperatura"
                          type="number"
                          min="0"
                          step="0.1"
                          value={formData.detalle.umbral_temperatura}
                          onChange={(e) => setFormData({
                            ...formData,
                            detalle: { ...formData.detalle, umbral_temperatura: e.target.value }
                          })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="umbral_ph">pH</Label>
                        <Input
                          id="umbral_ph"
                          type="number"
                          min="0"
                          max="14"
                          step="0.1"
                          value={formData.detalle.umbral_ph}
                          onChange={(e) => setFormData({
                            ...formData,
                            detalle: { ...formData.detalle, umbral_ph: e.target.value }
                          })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="umbral_ec">EC</Label>
                        <Input
                          id="umbral_ec"
                          type="number"
                          min="0"
                          step="0.1"
                          value={formData.detalle.umbral_ec}
                          onChange={(e) => setFormData({
                            ...formData,
                            detalle: { ...formData.detalle, umbral_ec: e.target.value }
                          })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="umbral_tds">TDS</Label>
                        <Input
                          id="umbral_tds"
                          type="number"
                          min="0"
                          step="10"
                          value={formData.detalle.umbral_tds}
                          onChange={(e) => setFormData({
                            ...formData,
                            detalle: { ...formData.detalle, umbral_tds: e.target.value }
                          })}
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
                <TableHead>Umbrales</TableHead>
                {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCrops.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={cropTableColumnCount} className="text-center py-8 text-muted-foreground">
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
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="cursor-help bg-blue-500">Ver umbrales</Badge>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="w-60 p-0">
                            <Card className="border-0 shadow-none">
                              <CardContent className="space-y-2 p-3">
                                <p className="text-sm font-semibold">Umbrales del cultivo</p>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Humedad:</span>
                                  <span>{crop.umbralHumedad ?? crop.detalle?.umbralHumedad ?? 40}%</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Temperatura:</span>
                                  <span>{crop.umbralTemperatura ?? 28}C</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">pH:</span>
                                  <span>{crop.umbralPh ?? crop.detalle?.umbralPh ?? 6}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">EC:</span>
                                  <span>{crop.umbralEc ?? crop.detalle?.umbralEc ?? 1.5}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">TDS:</span>
                                  <span>{crop.umbralTds ?? crop.detalle?.umbralTds ?? 800}</span>
                                </div>
                              </CardContent>
                            </Card>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
