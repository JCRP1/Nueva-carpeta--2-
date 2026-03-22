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
  Warehouse,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  MapPin,
  Square,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api, fetcher } from "@/lib/api-client"
import type { Invernadero, UserRole } from "@/lib/greensense-data"
import { toast } from "sonner"

interface GreenhousesViewProps {
  userRole: UserRole
}


export function GreenhousesView({ userRole }: GreenhousesViewProps) {
  const isReadOnly = userRole === "agricultor"
  const { data: greenhouses, mutate, isLoading } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGreenhouse, setEditingGreenhouse] = useState<Invernadero | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    ubicacion: "",
    area: "",
    estado: "activo" as "activo" | "inactivo" | "mantenimiento",
  })

  const filteredGreenhouses = (greenhouses || []).filter((inv) =>
    inv.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.ubicacion.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function openNewDialog() {
    setEditingGreenhouse(null)
    setFormData({ nombre: "", ubicacion: "", area: "", estado: "activo" })
    setDialogOpen(true)
  }

  function openEditDialog(inv: Invernadero) {
    setEditingGreenhouse(inv)
    setFormData({
      nombre: inv.nombre,
      ubicacion: inv.ubicacion,
      area: inv.area.toString(),
      estado: inv.estado,
    })
    setDialogOpen(true)
  }
  

  async function handleSave() {
    if (!formData.nombre || !formData.ubicacion || !formData.area) {
      toast.error("Error", { description: "Por favor complete todos los campos" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        nombre: formData.nombre,
        ubicacion: formData.ubicacion,
        area: parseFloat(formData.area),
        estado: formData.estado,
      }

      if (editingGreenhouse) {
        await api.updateGreenhouses(editingGreenhouse.id, payload)
        toast.success("Invernadero actualizado", { description: `${formData.nombre} ha sido actualizado` })
      } else {
        await api.createGreenhouses(payload)
        toast.success("Invernadero creado", { description: `${formData.nombre} ha sido creado` })
      }

      mutate()
      setDialogOpen(false)
    } catch {
      toast.error("Error", { description: "No se pudo guardar el invernadero" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteGreenhouses(id)
      mutate()
      toast.success("Invernadero eliminado", { description: "El invernadero ha sido eliminado" })
    } catch {
      toast.error("Error", { description: "No se pudo eliminar el invernadero" })
    }
  }

  const getEstadoBadge = (estado: Invernadero["estado"]) => {
    switch (estado) {
      case "activo":
        return <Badge className="bg-emerald-500">Activo</Badge>
      case "inactivo":
        return <Badge variant="secondary">Inactivo</Badge>
      case "mantenimiento":
        return <Badge className="bg-amber-500">Mantenimiento</Badge>
    }
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
          <h1 className="text-2xl font-bold text-foreground">Invernaderos</h1>
          <p className="text-sm text-muted-foreground">Gestione sus invernaderos</p>
        </div>
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Invernadero
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGreenhouse ? "Editar Invernadero" : "Nuevo Invernadero"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Invernadero 1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <Input
                    id="ubicacion"
                    value={formData.ubicacion}
                    onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                    placeholder="Santiago, República Dominicana"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="area">Área (m²)</Label>
                  <Input
                    id="area"
                    type="number"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    placeholder="1000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="estado">Estado</Label>
                  <select
                    id="estado"
                    aria-label="Estado del invernadero"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value as any })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
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
            placeholder="Buscar invernaderos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista de Invernaderos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Estado</TableHead>
                {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGreenhouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No se encontraron invernaderos
                  </TableCell>
                </TableRow>
              ) : (
                filteredGreenhouses.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                        {inv.nombre}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {inv.ubicacion}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Square className="h-4 w-4 text-muted-foreground" />
                        {inv.area} m²
                      </div>
                    </TableCell>
                    <TableCell>{getEstadoBadge(inv.estado)}</TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(inv)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(inv.id)}
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
