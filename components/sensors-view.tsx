"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Thermometer,
  Droplets,
  FlaskConical,
  Activity,
  Plus,
  Loader2,
  Pencil,
  Eye,
  Sparkles,
} from "lucide-react"
import type { UserRole } from "@/lib/greensense-data"
import { api, fetcher } from "@/lib/api-client"
import { SensorDetailView } from "./sensor-detail-view"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { Invernadero } from "@/lib/greensense-data"

interface Dispositivo {
  id: string
  nombre: string
  codigoDispositivo?: string
  tipo: string
  estado: string
}

interface Marca {
  id: string
  nombre: string
  descripcion?: string
  paisOrigen?: string
  sitioWeb?: string
}

interface Modelo {
  id: string
  nombre: string
  marcaId?: string
  nombreMarca?: string
  especificaciones?: string
  rangoMin?: number
  rangoMax?: number
  precision?: number
  unidadMedida?: string
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
  idMarca?: string
  idModelo?: string
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
  history?: { timestamp: string; valor: number }[]
}

interface TipoSensor {
  id: number
  nombre: string
  unidad?: string
  rangoMin?: number
  rangoMax?: number
  descripcion?: string
}

const SENSOR_STATUS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "error", label: "Error" },
]

const SENSOR_ICONS: Record<string, React.ElementType> = {
  humedad_suelo: Droplets,
  temperatura: Thermometer,
  humedad_ambiental: Droplets,
  tds: FlaskConical,
  ph: FlaskConical,
  conductividad: Activity,
}

interface SensorsViewProps {
  selectedGreenhouse: string
  userRole: UserRole
}

export function SensorsView({ selectedGreenhouse, userRole }: SensorsViewProps) {
  const [formData, setFormData] = useState({
    tipo: "",
    idModelo: "",
    estado: "activo",
    idMarca: "",
    rangoMin: "",
    rangoMax: "",
    unidadMedida: "",
    precision: "",
    fechaInstalacion: "",
    ubicacionFisica: "",
    ultimoCalibrado: "",
    observaciones: "",
    idInvernadero: selectedGreenhouse,
    idDispositivo: "",
  })

  const { data: sensors, isLoading, mutate } = useSWR<SensorData[]>(
    selectedGreenhouse ? `/api/sensors?greenhouse=${selectedGreenhouse}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)
  const { data: devices, isLoading: devicesLoading } = useSWR<Dispositivo[]>("/api/devices", fetcher)
  const { data: marcas, mutate: mutateMarcas } = useSWR<Marca[]>("/api/marcas", fetcher)
  const { data: tiposSensor, mutate: mutateTiposSensor } = useSWR<TipoSensor[]>("/api/tipos-sensor", fetcher)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingSensor, setEditingSensor] = useState<SensorData | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedSensor, setSelectedSensor] = useState<SensorData | null>(null)
  const [idMarca, setIdMarca] = useState("")
  const [idModelo, setIdModelo] = useState("")
  const [marcaDialogOpen, setMarcaDialogOpen] = useState(false)
  const [modeloDialogOpen, setModeloDialogOpen] = useState(false)
  const [tipoSensorDialogOpen, setTipoSensorDialogOpen] = useState(false)
  const [newMarca, setNewMarca] = useState({ nombre: "", descripcion: "", paisOrigen: "", sitioWeb: "" })
  const [newModelo, setNewModelo] = useState({ nombre: "", especificaciones: "", rangoMin: "", rangoMax: "", precision: "", unidadMedida: "" })
  const [newTipoSensor, setNewTipoSensor] = useState({ nombre: "", unidad: "", rangoMin: "", rangoMax: "", descripcion: "" })
  const [savingMarca, setSavingMarca] = useState(false)
  const [savingModelo, setSavingModelo] = useState(false)
  const [savingTipoSensor, setSavingTipoSensor] = useState(false)

  const { data: allModelos, mutate: mutateModelos } = useSWR<Modelo[]>("/api/modelos", fetcher, { refreshInterval: 0 })
  
  const modelos = idMarca && allModelos ? allModelos.filter(m => Number(m.marcaId) === Number(idMarca)) : allModelos || []

  const isAdmin = userRole === "administrador" || userRole === "tecnico"
  const ghList = greenhouses || []
  const sensorList = sensors || []
  const deviceList = devices || []

  useEffect(() => {
    if (ghList.length > 0 && !formData.idInvernadero) {
      setFormData(prev => ({ ...prev, idInvernadero: ghList[0].id }))
    } else if (ghList.length > 0 && formData.idInvernadero && !ghList.find(g => g.id === formData.idInvernadero)) {
      setFormData(prev => ({ ...prev, idInvernadero: ghList[0].id }))
    }
  }, [ghList, formData.idInvernadero])

  useEffect(() => {
    if (!idMarca) {
      setIdModelo("")
    }
  }, [idMarca])

  const resetForm = useCallback(() => {
    setFormData({
      tipo: "",
      idModelo: "",
      estado: "activo",
      idMarca: "",
      rangoMin: "",
      rangoMax: "",
      unidadMedida: "",
      precision: "",
      fechaInstalacion: "",
      ubicacionFisica: "",
      ultimoCalibrado: "",
      observaciones: "",
      idInvernadero: selectedGreenhouse,
      idDispositivo: "",
    })
    setIdMarca("")
    setIdModelo("")
    setEditingSensor(null)
    setEditMode(false)
  }, [selectedGreenhouse])

  const openCreateDialog = useCallback(() => {
    const defaultGh = selectedGreenhouse || (ghList.length > 0 ? ghList[0].id : "")
    setFormData({
      tipo: "",
      idModelo: "",
      estado: "activo",
      idMarca: "",
      rangoMin: "",
      rangoMax: "",
      unidadMedida: "",
      precision: "",
      fechaInstalacion: "",
      ubicacionFisica: "",
      ultimoCalibrado: "",
      observaciones: "",
      idInvernadero: defaultGh,
      idDispositivo: "",
    })
    setIdMarca("")
    setIdModelo("")
    setEditingSensor(null)
    setEditMode(false)
    setDialogOpen(true)
  }, [selectedGreenhouse, ghList])

  const openEditDialog = useCallback((sensor: SensorData) => {
    setFormData({
      tipo: sensor.tipo || "",
      idModelo: sensor.idModelo || "",
      estado: sensor.estado || "activo",
      idMarca: sensor.idMarca || "",
      rangoMin: sensor.rangoMin?.toString() || "",
      rangoMax: sensor.rangoMax?.toString() || "",
      unidadMedida: sensor.unidadMedida || sensor.unidad || "",
      precision: sensor.precision?.toString() || "",
      fechaInstalacion: sensor.fechaInstalacion?.split("T")[0] || "",
      ubicacionFisica: sensor.ubicacionFisica || "",
      ultimoCalibrado: sensor.ultimoCalibrado?.split("T")[0] || "",
      observaciones: sensor.observaciones || "",
      idInvernadero: sensor.invernaderoId,
      idDispositivo: sensor.idDispositivo?.toString() || "",
    })
    setIdMarca(sensor.idMarca || "")
    setIdModelo(sensor.idModelo || "")
    setEditingSensor(sensor)
    setEditMode(true)
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(async () => {
    const requiredFields = [
      { field: formData.tipo, name: "Tipo" },
      { field: formData.idInvernadero, name: "Invernadero" },
      { field: formData.estado, name: "Estado" },
      { field: idMarca, name: "Marca" },
      { field: idModelo, name: "Modelo" },
      { field: formData.ubicacionFisica, name: "Ubicación Física" },
      { field: formData.unidadMedida, name: "Unidad de Medida" },
      { field: formData.precision, name: "Precisión" },
      { field: formData.rangoMin, name: "Rango Mín" },
      { field: formData.rangoMax, name: "Rango Máx" },
      { field: formData.fechaInstalacion, name: "Fecha Instalación" },
      { field: formData.ultimoCalibrado, name: "Último Calibrado" },
    ]

    const missingFields = requiredFields.filter(f => !f.field)
    if (missingFields.length > 0) {
      toast.error("Complete todos los campos requeridos", { description: `Faltan: ${missingFields.map(f => f.name).join(", ")}` })
      return
    }

    setSaving(true)
    try {
      const payload = {
        tipo: formData.tipo,
        idMarca: idMarca ? Number(idMarca) : undefined,
        idModelo: idModelo ? Number(idModelo) : undefined,
        estado: formData.estado,
        rangoMin: formData.rangoMin ? Number(formData.rangoMin) : undefined,
        rangoMax: formData.rangoMax ? Number(formData.rangoMax) : undefined,
        unidadMedida: formData.unidadMedida || undefined,
        precision: formData.precision ? Number(formData.precision) : undefined,
        fechaInstalacion: formData.fechaInstalacion || undefined,
        ubicacionFisica: formData.ubicacionFisica || undefined,
        ultimoCalibrado: formData.ultimoCalibrado || undefined,
        observaciones: formData.observaciones || undefined,
        idInvernadero: formData.idInvernadero,
        idDispositivo: formData.idDispositivo ? Number(formData.idDispositivo) : undefined,
      }

      if (editMode && editingSensor) {
        await api.updateSensor(editingSensor.id, payload)
        toast.success("Sensor actualizado", { description: formData.tipo })
      } else {
        await api.createSensor(payload)
        toast.success("Sensor creado", { description: formData.tipo })
      }
      mutate()
      setDialogOpen(false)
      resetForm()
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSaving(false)
    }
  }, [formData, idMarca, idModelo, editMode, editingSensor, mutate, resetForm])

  if (isLoading && !sensors && !selectedSensor) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (selectedSensor) {
    return (
      <SensorDetailView
        sensor={selectedSensor}
        historialPreload={selectedSensor.history}
        onBack={() => setSelectedSensor(null)}
        userRole={userRole}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Registro de Sensores</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Gestione los sensores IoT" : "Visualice los sensores"} ({sensorList.length} sensores)
          </p>
        </div>
        {isAdmin && (
          <>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />Nuevo Sensor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editMode ? "Editar Sensor" : "Nuevo Sensor"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid max-h-[65vh] grid-cols-3 gap-4 overflow-y-auto py-4">
                <div className="flex flex-col gap-2">
                  <Label>Tipo *</Label>
                  <div className="flex gap-2">
                    <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                      <SelectContent>
                        {(tiposSensor || []).map((t) => (
                          <SelectItem key={String(t.id)} value={t.nombre}>{t.nombre} ({t.unidad})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setTipoSensorDialogOpen(true)} title="Agregar tipo de sensor">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Invernadero *</Label>
                  <Select value={formData.idInvernadero} onValueChange={(v) => setFormData({ ...formData, idInvernadero: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar invernadero" /></SelectTrigger>
                    <SelectContent>
                      {ghList.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>{inv.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Estado *</Label>
                  <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SENSOR_STATUS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Marca *</Label>
                  <div className="flex gap-2">
                    <Select value={idMarca} onValueChange={(v) => { setIdMarca(v); setIdModelo(""); }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar marca" /></SelectTrigger>
                      <SelectContent>
                        {(marcas || []).map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setMarcaDialogOpen(true)} title="Agregar marca">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Modelo *</Label>
                  <div className="flex gap-2">
                    <Select value={idModelo} onValueChange={setIdModelo}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={idMarca ? "Seleccionar modelo" : "Seleccione marca primero"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {(modelos || []).length > 0 ? (
                          modelos!.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
                          ))
                        ) : idMarca ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">Sin modelos para esta marca</div>
                        ) : null}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => { if (idMarca) setModeloDialogOpen(true); else toast.warning("Seleccione una marca primero"); }} title="Agregar modelo" disabled={!idMarca}>
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Dispositivo</Label>
                  <Select value={formData.idDispositivo || "none"} onValueChange={(v) => setFormData({ ...formData, idDispositivo: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Sin dispositivo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin dispositivo</SelectItem>
                      {deviceList.map((d) => (
                        <SelectItem key={String(d.id)} value={String(d.id)}>
                          {d.codigoDispositivo ? `${d.nombre} (${d.codigoDispositivo})` : d.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Ubicación Física *</Label>
                  <Input placeholder="Ej: Zona A - Esquina NW" value={formData.ubicacionFisica} onChange={(e) => setFormData({ ...formData, ubicacionFisica: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Unidad de Medida *</Label>
                  <Input placeholder="Ej: %, °C, ppm" value={formData.unidadMedida} onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Precisión *</Label>
                  <Input type="number" step="0.01" placeholder="0.1" value={formData.precision} onChange={(e) => setFormData({ ...formData, precision: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Rango Mín *</Label>
                  <Input type="number" placeholder="0" value={formData.rangoMin} onChange={(e) => setFormData({ ...formData, rangoMin: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Rango Máx *</Label>
                  <Input type="number" placeholder="100" value={formData.rangoMax} onChange={(e) => setFormData({ ...formData, rangoMax: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Fecha Instalación *</Label>
                  <Input type="date" value={formData.fechaInstalacion} onChange={(e) => setFormData({ ...formData, fechaInstalacion: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Último Calibrado *</Label>
                  <Input type="date" value={formData.ultimoCalibrado} onChange={(e) => setFormData({ ...formData, ultimoCalibrado: e.target.value })} />
                </div>
                <div className="col-span-2 flex flex-col gap-2">
                  <Label>Observaciones</Label>
                  <Textarea placeholder="Notas adicionales sobre el sensor..." value={formData.observaciones} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} className="min-h-[80px]" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : editMode ? "Actualizar" : "Crear Sensor"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={marcaDialogOpen} onOpenChange={setMarcaDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Marca</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Nombre *</Label>
                  <Input placeholder="Ej: DHT" value={newMarca.nombre} onChange={(e) => setNewMarca({ ...newMarca, nombre: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Descripción</Label>
                  <Input placeholder="Descripción de la marca" value={newMarca.descripcion} onChange={(e) => setNewMarca({ ...newMarca, descripcion: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>País de Origen</Label>
                  <Input placeholder="Ej: China" value={newMarca.paisOrigen} onChange={(e) => setNewMarca({ ...newMarca, paisOrigen: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Sitio Web</Label>
                  <Input placeholder="https://..." value={newMarca.sitioWeb} onChange={(e) => setNewMarca({ ...newMarca, sitioWeb: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button onClick={async () => {
                  if (!newMarca.nombre) { toast.error("El nombre es requerido"); return; }
                  setSavingMarca(true)
                  try {
                    const res = await fetch("/api/marcas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newMarca) })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    setIdMarca(String(data.id))
                    await mutateMarcas()
                    setMarcaDialogOpen(false)
                    setNewMarca({ nombre: "", descripcion: "", paisOrigen: "", sitioWeb: "" })
                    toast.success("Marca creada")
                  } catch (err) { toast.error(err instanceof Error ? err.message : "Error al crear marca") }
                  finally { setSavingMarca(false) }
                }} disabled={savingMarca}>
                  {savingMarca ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Crear Marca
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={modeloDialogOpen} onOpenChange={setModeloDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Modelo</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Marca</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    {marcas?.find(m => String(m.id) === idMarca)?.nombre || "Sin marca seleccionada"}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Nombre *</Label>
                  <Input placeholder="Ej: DHT22-AM2302" value={newModelo.nombre} onChange={(e) => setNewModelo({ ...newModelo, nombre: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Especificaciones</Label>
                  <Input placeholder="Especificaciones técnicas" value={newModelo.especificaciones} onChange={(e) => setNewModelo({ ...newModelo, especificaciones: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Rango Mín</Label>
                    <Input type="number" placeholder="0" value={newModelo.rangoMin} onChange={(e) => setNewModelo({ ...newModelo, rangoMin: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Rango Máx</Label>
                    <Input type="number" placeholder="100" value={newModelo.rangoMax} onChange={(e) => setNewModelo({ ...newModelo, rangoMax: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Precisión</Label>
                  <Input type="number" step="0.01" placeholder="0.1" value={newModelo.precision} onChange={(e) => setNewModelo({ ...newModelo, precision: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Unidad de Medida</Label>
                  <Input placeholder="Ej: %, °C, ppm" value={newModelo.unidadMedida} onChange={(e) => setNewModelo({ ...newModelo, unidadMedida: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button onClick={async () => {
                  if (!newModelo.nombre) { toast.error("El nombre es requerido"); return; }
                  setSavingModelo(true)
                  try {
                    const res = await fetch("/api/modelos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newModelo, idMarca }) })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    setIdModelo(String(data.id))
                    await mutateModelos()
                    setModeloDialogOpen(false)
                    setNewModelo({ nombre: "", especificaciones: "", rangoMin: "", rangoMax: "", precision: "", unidadMedida: "" })
                    toast.success("Modelo creado")
                  } catch (err) { toast.error(err instanceof Error ? err.message : "Error al crear modelo") }
                  finally { setSavingModelo(false) }
                }} disabled={savingModelo}>
                  {savingModelo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Crear Modelo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={tipoSensorDialogOpen} onOpenChange={setTipoSensorDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Tipo de Sensor</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Nombre *</Label>
                  <Input placeholder="Ej: humedad_suelo" value={newTipoSensor.nombre} onChange={(e) => setNewTipoSensor({ ...newTipoSensor, nombre: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Unidad</Label>
                  <Input placeholder="Ej: %, °C, ppm" value={newTipoSensor.unidad} onChange={(e) => setNewTipoSensor({ ...newTipoSensor, unidad: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Rango Mín</Label>
                    <Input type="number" placeholder="0" value={newTipoSensor.rangoMin} onChange={(e) => setNewTipoSensor({ ...newTipoSensor, rangoMin: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Rango Máx</Label>
                    <Input type="number" placeholder="100" value={newTipoSensor.rangoMax} onChange={(e) => setNewTipoSensor({ ...newTipoSensor, rangoMax: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Descripción</Label>
                  <Input placeholder="Descripción del tipo de sensor" value={newTipoSensor.descripcion} onChange={(e) => setNewTipoSensor({ ...newTipoSensor, descripcion: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button onClick={async () => {
                  if (!newTipoSensor.nombre) { toast.error("El nombre es requerido"); return; }
                  setSavingTipoSensor(true)
                  try {
                    const res = await fetch("/api/tipos-sensor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newTipoSensor) })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    await mutateTiposSensor()
                    setTipoSensorDialogOpen(false)
                    setNewTipoSensor({ nombre: "", unidad: "", rangoMin: "", rangoMax: "", descripcion: "" })
                    toast.success("Tipo de sensor creado")
                  } catch (err) { toast.error(err instanceof Error ? err.message : "Error al crear tipo") }
                  finally { setSavingTipoSensor(false) }
                }} disabled={savingTipoSensor}>
                  {savingTipoSensor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Crear Tipo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sensorList.length > 0 ? (
          sensorList.map((sensor) => {
            const Icon = SENSOR_ICONS[sensor.tipo] || Activity
            const isActive = sensor.estado === "activo"
            return (
              <Card key={sensor.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{sensor.nombre || sensor.tipo}</CardTitle>
                        <p className="text-xs text-muted-foreground">{tiposSensor?.find(t => t.nombre === sensor.tipo)?.nombre || sensor.tipo}</p>
                      </div>
                    </div>
                    <Badge className={isActive ? "bg-green-500/20 text-green-400 border-0" : "bg-amber-500/20 text-amber-400 border-0"}>
                      {sensor.estado}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-xs">
                  {sensor.marca && <div className="flex justify-between"><span className="text-muted-foreground">Marca:</span><span>{sensor.marca}</span></div>}
                  {sensor.modelo && <div className="flex justify-between"><span className="text-muted-foreground">Modelo:</span><span>{sensor.modelo}</span></div>}
                  {sensor.ubicacionFisica && <div className="flex justify-between"><span className="text-muted-foreground">Ubicación:</span><span>{sensor.ubicacionFisica}</span></div>}
                  {sensor.unidadMedida && <div className="flex justify-between"><span className="text-muted-foreground">Unidad:</span><span>{sensor.unidadMedida}</span></div>}
                  {sensor.rangoMin !== undefined && sensor.rangoMax !== undefined && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Rango:</span><span>{sensor.rangoMin} - {sensor.rangoMax}</span></div>
                  )}
                  <div className="mt-2 flex justify-end gap-2 border-t pt-2">
                    <Button variant="outline" size="sm" className="h-7" onClick={() => setSelectedSensor(sensor)}>
                      <Eye className="mr-1 h-3 w-3" />Ver
                    </Button>
                    {isAdmin && (
                      <Button variant="outline" size="sm" className="h-7" onClick={() => openEditDialog(sensor)}>
                        <Pencil className="mr-1 h-3 w-3" />Editar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <Activity className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Sin sensores en este invernadero</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Agregue un nuevo sensor para comenzar" : "Contacte a un administrador para agregar sensores"}
              </p>
              {isAdmin && (
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />Agregar Sensor
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
