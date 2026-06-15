"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { api, fetcher } from "@/lib/api-client"
import { Loader2, Plus, Pencil, Trash2, Cpu, Wifi, Search } from "lucide-react"
import type { Invernadero } from "@/lib/greensense-data"

interface DispositivoData {
  id: string
  nombre: string
  tipo: string
  codigoDispositivo: string
  estado: string
  invernaderoId: string
  nombreInvernadero?: string
  firmwareVersion?: string
  ipLocal?: string
  ultimoReporte?: string
}

interface DiscoveredDevice {
  ip: string
  port: number
  url: string
  deviceName: string | null
  deviceCode: string | null
  firmwareVersion: string | null
  chipModel: string | null
  confidence: "high" | "medium"
  subnet?: string
}

const DEVICE_TYPES = [
  { value: "gateway", label: "Gateway" },
  { value: "controlador", label: "Controlador" },
  { value: "modulo", label: "Modulo" },
  { value: "repetidor", label: "Repetidor" },
]

const DEVICE_STATUS = [
  { value: "Activo", label: "Activo" },
  { value: "Inactivo", label: "Inactivo" },
  { value: "Mantenimiento", label: "Mantenimiento" },
]

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/
const FIRMWARE_REGEX = /^\d+(\.\d+)*$/

function formatIpAddress(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  const formatted = parts.map((part) => part.replace(/\D/g, "").slice(0, 3)).join(".")
  const lastDotIndex = formatted.lastIndexOf(".")
  if (formatted.length > 15 && lastDotIndex !== -1) {
    return formatted.slice(0, 15)
  }
  return formatted.slice(0, 15)
}

function validateIp(value: string): string | null {
  if (!value) return null
  if (!IP_REGEX.test(value)) return "Formato IP invalido (ej: 192.168.1.100)"
  const parts = value.split(".")
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (num < 0 || num > 255) return "Cada octeto debe ser 0-255"
  }
  return null
}

function validateFirmware(value: string): string | null {
  if (!value) return null
  if (!FIRMWARE_REGEX.test(value)) return "Formato invalido (ej: 1.2.3)"
  return null
}

export function DispositivosView() {
  const { data: devices, isLoading, mutate } = useSWR<DispositivoData[]>("/api/devices", fetcher)
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingDevice, setEditingDevice] = useState<DispositivoData | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDevice, setDeletingDevice] = useState<DispositivoData | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([])
  const [scannedNetworks, setScannedNetworks] = useState<string[]>([])
  const [scannedTargets, setScannedTargets] = useState(0)
  const [targetIps, setTargetIps] = useState("")

  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "gateway",
    codigoDispositivo: "",
    estado: "Activo",
    idInvernadero: "",
    firmwareVersion: "",
    ipLocal: "",
  })
  const [ipError, setIpError] = useState<string | null>(null)
  const [firmwareError, setFirmwareError] = useState<string | null>(null)

  const ghList = greenhouses || []
  const deviceList = devices || []

  const resetForm = useCallback(() => {
    setFormData({
      nombre: "",
      tipo: "gateway",
      codigoDispositivo: "",
      estado: "Activo",
      idInvernadero: "",
      firmwareVersion: "",
      ipLocal: "",
    })
    setIpError(null)
    setFirmwareError(null)
    setEditingDevice(null)
    setEditMode(false)
  }, [])

  const openCreateDialog = useCallback(() => {
    resetForm()
    setDialogOpen(true)
  }, [resetForm])

  const openEditDialog = useCallback((device: DispositivoData) => {
    setFormData({
      nombre: device.nombre || "",
      tipo: device.tipo || "gateway",
      codigoDispositivo: device.codigoDispositivo || "",
      estado: device.estado || "Activo",
      idInvernadero: String(device.invernaderoId),
      firmwareVersion: device.firmwareVersion || "",
      ipLocal: device.ipLocal || "",
    })
    setEditingDevice(device)
    setEditMode(true)
    setDialogOpen(true)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formData.nombre || !formData.idInvernadero || !formData.codigoDispositivo.trim()) {
      toast.error("Complete los campos requeridos", { description: "Nombre, invernadero y codigo son requeridos" })
      return
    }

    if (!formData.ipLocal.trim()) {
      setIpError("IP Local es requerida")
      toast.error("IP Local es requerida")
      return
    }
    if (!formData.firmwareVersion.trim()) {
      setFirmwareError("Version Firmware es requerida")
      toast.error("Version Firmware es requerida")
      return
    }

    const ipValidation = validateIp(formData.ipLocal)
    const firmwareValidation = validateFirmware(formData.firmwareVersion)
    if (ipValidation) {
      setIpError(ipValidation)
      toast.error("IP Local invalida", { description: ipValidation })
      return
    }
    if (firmwareValidation) {
      setFirmwareError(firmwareValidation)
      toast.error("Version Firmware invalida", { description: firmwareValidation })
      return
    }

    setSaving(true)
    try {
      const payload = {
        nombre: formData.nombre,
        tipo: formData.tipo,
        codigoDispositivo: formData.codigoDispositivo.trim().toUpperCase(),
        estado: formData.estado,
        idInvernadero: Number(formData.idInvernadero),
        firmwareVersion: formData.firmwareVersion || undefined,
        ipLocal: formData.ipLocal || undefined,
      }

      if (editMode && editingDevice) {
        await api.updateDevice(editingDevice.id, payload)
        toast.success("Dispositivo actualizado", { description: formData.nombre })
      } else {
        await api.createDevice(payload)
        toast.success("Dispositivo creado", { description: formData.nombre })
      }
      mutate()
      setDialogOpen(false)
      resetForm()
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSaving(false)
    }
  }, [formData, editMode, editingDevice, mutate, resetForm])

  const handleDelete = useCallback(async () => {
    if (!deletingDevice) return

    setDeleting(true)
    try {
      await api.deleteDevice(deletingDevice.id)
      toast.success("Dispositivo eliminado", { description: deletingDevice.nombre })
      mutate()
      setDeleteDialogOpen(false)
      setDeletingDevice(null)
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setDeleting(false)
    }
  }, [deletingDevice, mutate])

  const openDeleteDialog = useCallback((device: DispositivoData) => {
    setDeletingDevice(device)
    setDeleteDialogOpen(true)
  }, [])

  const handleDiscover = useCallback(async () => {
    setDiscovering(true)
    setDiscoverDialogOpen(true)
    try {
      const result = await api.discoverDevices({ ips: targetIps }) as {
        networks?: string[]
        scannedTargets?: number
        manualScan?: boolean
        targetIps?: string[]
        discovered?: DiscoveredDevice[]
      }

      const discovered = result.discovered || []
      setScannedNetworks(result.networks || [])
      setScannedTargets(result.scannedTargets || 0)
      setDiscoveredDevices(discovered)

      if (discovered.length === 0) {
        toast.info("Escaneo completado", { description: "No se detectaron ESP32 accesibles en la red local." })
        return
      }

      toast.success("ESP32 detectados", { description: `${discovered.length} dispositivo(s) encontrado(s).` })
    } catch (err) {
      toast.error("Error al buscar ESP32", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setDiscovering(false)
    }
  }, [targetIps])

  const handleUseDiscoveredDevice = useCallback((device: DiscoveredDevice) => {
    setFormData((current) => ({
      ...current,
      nombre: current.nombre || device.deviceName || `ESP32 ${device.ip}`,
      tipo: "modulo",
      codigoDispositivo: device.deviceCode || current.codigoDispositivo,
      firmwareVersion: device.firmwareVersion || current.firmwareVersion,
      ipLocal: device.ip,
      estado: "Activo",
    }))
    setIpError(null)
    setFirmwareError(null)
    setDiscoverDialogOpen(false)
    setDialogOpen(true)
  }, [])

  if (isLoading && !devices) {
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
          <h2 className="text-lg font-semibold text-foreground">Dispositivos IoT</h2>
          <p className="text-sm text-muted-foreground">
            Gestion de dispositivos conectados ({deviceList.length} dispositivos)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDiscover} disabled={discovering}>
            {discovering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Buscar ESP32
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />Nuevo Dispositivo
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Invernadero</TableHead>
                <TableHead>IP Local</TableHead>
                <TableHead>Firmware</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deviceList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay dispositivos registrados
                  </TableCell>
                </TableRow>
              ) : (
                deviceList.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        {device.nombre}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{device.codigoDispositivo}</TableCell>
                    <TableCell className="capitalize">{device.tipo}</TableCell>
                    <TableCell>{device.nombreInvernadero || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {device.ipLocal || "-"}
                    </TableCell>
                    <TableCell className="text-xs">{device.firmwareVersion || "-"}</TableCell>
                    <TableCell>
                      <Badge className={
                        device.estado === "Activo" ? "bg-green-500/20 text-green-400 border-0" :
                        device.estado === "Inactivo" ? "bg-red-500/20 text-red-400 border-0" :
                        "bg-amber-500/20 text-amber-400 border-0"
                      }>
                        {device.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(device)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(device)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editMode ? "Editar Dispositivo" : "Nuevo Dispositivo"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Nombre *</Label>
                <Input placeholder="Ej: Gateway Principal" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Codigo Dispositivo *</Label>
                <Input
                  placeholder="Ej: ESP32-INV-A-01"
                  value={formData.codigoDispositivo}
                  onChange={(e) => setFormData({ ...formData, codigoDispositivo: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Tipo</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Invernadero *</Label>
                <Select value={formData.idInvernadero || "placeholder"} onValueChange={(v) => setFormData({ ...formData, idInvernadero: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {ghList.map((gh) => (
                      <SelectItem key={gh.id} value={String(gh.id)}>{gh.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Estado</Label>
              <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEVICE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>IP Local *</Label>
                <Input 
                  placeholder="192.168.1.100" 
                  value={formData.ipLocal} 
                  onChange={(e) => {
                    const formatted = formatIpAddress(e.target.value)
                    setFormData({ ...formData, ipLocal: formatted })
                    setIpError(formatted ? validateIp(formatted) : "IP Local es requerida")
                  }}
                  className={ipError ? "border-destructive" : ""}
                />
                {ipError && <p className="text-xs text-destructive">{ipError}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Version Firmware *</Label>
                <Input 
                  placeholder="1.2.3" 
                  value={formData.firmwareVersion} 
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.]/g, "")
                    setFormData({ ...formData, firmwareVersion: value })
                    setFirmwareError(value ? validateFirmware(value) : "Version Firmware es requerida")
                  }}
                  className={firmwareError ? "border-destructive" : ""}
                />
                {firmwareError && <p className="text-xs text-destructive">{firmwareError}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : editMode ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeletingDevice(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Eliminar Dispositivo</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Esta seguro de eliminar el dispositivo <strong>{deletingDevice?.nombre}</strong>? 
              Esta accion no se puede deshacer.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting || !deletingDevice}>
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Eliminando...</> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discoverDialogOpen} onOpenChange={setDiscoverDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Buscar ESP32 por Wi-Fi</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid gap-2">
              <Label>IPs reales del ESP32</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="font-mono text-xs"
                  placeholder="Ej: 192.168.1.45, 192.168.1.46"
                  value={targetIps}
                  onChange={(event) => setTargetIps(event.target.value)}
                />
                <Button onClick={handleDiscover} disabled={discovering}>
                  {discovering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Buscar IPs
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Si deja este campo vacio, se escanea la red automaticamente. Si escribe IPs, se prueban solo esas direcciones.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              {discovering
                ? targetIps.trim()
                  ? "Probando las IPs indicadas en busca de ESP32 accesibles por HTTP..."
                  : "Escaneando la red local en busca de modulos ESP32 accesibles por HTTP..."
                : scannedNetworks.length > 0
                  ? `Subredes revisadas: ${scannedNetworks.join(", ")}${scannedTargets ? ` - objetivos: ${scannedTargets}` : ""}`
                  : "Ejecute una busqueda para detectar modulos ESP32 dentro de la misma red."}
            </div>

            {discovering ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : discoveredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <Wifi className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No se detectaron ESP32 accesibles en la red actual.</p>
                <p className="max-w-md text-xs text-muted-foreground">
                  Verifique que el ESP32 este encendido, conectado al mismo Wi-Fi y responda por HTTP con texto que incluya ESP32, Espressif o GreenSense.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP</TableHead>
                      <TableHead>Puerto</TableHead>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Firmware</TableHead>
                      <TableHead>Confianza</TableHead>
                      <TableHead className="text-right">Usar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discoveredDevices.map((device) => (
                      <TableRow key={`${device.ip}:${device.port}`}>
                        <TableCell className="font-mono text-xs">{device.ip}</TableCell>
                        <TableCell>{device.port}</TableCell>
                        <TableCell className="font-mono text-xs">{device.deviceCode || "-"}</TableCell>
                        <TableCell>{device.deviceName || device.chipModel || "ESP32 detectado"}</TableCell>
                        <TableCell>{device.firmwareVersion || "-"}</TableCell>
                        <TableCell>
                          <Badge className={device.confidence === "high" ? "bg-emerald-500/20 text-emerald-400 border-0" : "bg-amber-500/20 text-amber-400 border-0"}>
                            {device.confidence === "high" ? "Alta" : "Media"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleUseDiscoveredDevice(device)}>
                            Usar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscoverDialogOpen(false)}>Cerrar</Button>
            <Button onClick={handleDiscover} disabled={discovering}>
              {discovering ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando...</> : "Buscar de nuevo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
