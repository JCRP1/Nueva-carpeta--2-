"use client"

import { useState, useCallback } from "react"
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
} from "lucide-react"
import type { UserRole } from "@/lib/greensense-data"
import { api, fetcher } from "@/lib/api-client"
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
}

const SENSOR_TYPES = [
  { value: "humedad_suelo", label: "Humedad del Suelo" },
  { value: "temperatura", label: "Temperatura" },
  { value: "humedad_ambiental", label: "Humedad Ambiental" },
  { value: "tds", label: "TDS" },
  { value: "ph", label: "pH" },
  { value: "conductividad", label: "Conductividad" },
]

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
  const { data: sensors, isLoading, mutate } = useSWR<SensorData[]>(
    selectedGreenhouse ? `/api/sensors?greenhouse=${selectedGreenhouse}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingSensor, setEditingSensor] = useState<SensorData | null>(null)

  const [formData, setFormData] = useState({
    tipo: "",
    modelo: "",
    estado: "activo",
    marca: "",
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
  const [saving, setSaving] = useState(false)

  const isAdmin = userRole === "administrador" || userRole === "tecnico"
  const ghList = greenhouses || []
  const sensorList = sensors || []

  const resetForm = useCallback(() => {
    setFormData({
      tipo: "",
      modelo: "",
      estado: "activo",
      marca: "",
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
    setEditingSensor(null)
    setEditMode(false)
  }, [selectedGreenhouse])

  const openCreateDialog = useCallback(() => {
    resetForm()
    setDialogOpen(true)
  }, [resetForm])

  const openEditDialog = useCallback((sensor: SensorData) => {
    setFormData({
      tipo: sensor.tipo || "",
      modelo: sensor.modelo || "",
      estado: sensor.estado || "activo",
      marca: sensor.marca || "",
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
    setEditingSensor(sensor)
    setEditMode(true)
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formData.tipo || !formData.idInvernadero) {
      toast.error("Complete los campos requeridos", { description: "Tipo e invernadero son requeridos" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        tipo: formData.tipo,
        modelo: formData.modelo || undefined,
        estado: formData.estado,
        marca: formData.marca || undefined,
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
  }, [formData, editMode, editingSensor, mutate, resetForm])

  if (isLoading && !sensors) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
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
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    <SelectContent>
                      {SENSOR_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Label>Estado</Label>
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
                  <Label>Marca</Label>
                  <Input placeholder="Ej: DHT22" value={formData.marca} onChange={(e) => setFormData({ ...formData, marca: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Modelo</Label>
                  <Input placeholder="Ej: DHT22-AM2302" value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>ID Dispositivo</Label>
                  <Input type="number" placeholder="Opcional" value={formData.idDispositivo} onChange={(e) => setFormData({ ...formData, idDispositivo: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Ubicación Física</Label>
                  <Input placeholder="Ej: Zona A - Esquina NW" value={formData.ubicacionFisica} onChange={(e) => setFormData({ ...formData, ubicacionFisica: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Unidad de Medida</Label>
                  <Input placeholder="Ej: %, °C, ppm" value={formData.unidadMedida} onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Precisión</Label>
                  <Input type="number" step="0.01" placeholder="0.1" value={formData.precision} onChange={(e) => setFormData({ ...formData, precision: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Rango Mín</Label>
                  <Input type="number" placeholder="0" value={formData.rangoMin} onChange={(e) => setFormData({ ...formData, rangoMin: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Rango Máx</Label>
                  <Input type="number" placeholder="100" value={formData.rangoMax} onChange={(e) => setFormData({ ...formData, rangoMax: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Fecha Instalación</Label>
                  <Input type="date" value={formData.fechaInstalacion} onChange={(e) => setFormData({ ...formData, fechaInstalacion: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Último Calibrado</Label>
                  <Input type="date" value={formData.ultimoCalibrado} onChange={(e) => setFormData({ ...formData, ultimoCalibrado: e.target.value })} />
                </div>
                <div className="col-span-2 flex flex-col gap-2">
                  <Label>Observaciones</Label>
                  <Textarea placeholder="Notas adicionales sobre el sensor..." value={formData.observaciones} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} className="min-h-[80px]" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : editMode ? "Actualizar" : "Crear Sensor"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                        <p className="text-xs text-muted-foreground">{SENSOR_TYPES.find(t => t.value === sensor.tipo)?.label || sensor.tipo}</p>
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
                  {isAdmin && (
                    <div className="mt-2 flex justify-end border-t pt-2">
                      <Button variant="outline" size="sm" className="h-7" onClick={() => openEditDialog(sensor)}>
                        <Pencil className="mr-1 h-3 w-3" />Editar
                      </Button>
                    </div>
                  )}
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
