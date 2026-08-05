"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Shield,
  Plus,
  Loader2,
  Search,
  Pencil,
} from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { toast } from "sonner"

interface Rol {
  RolID: number
  Nombre: string
  Descripcion?: string
  Permisos?: string
  Activo: number
}

const permissionOptions = [
  { id: "dashboard", label: "Dashboard" },
  { id: "zonas", label: "Zonas de Riego" },
  { id: "cultivos", label: "Cultivos" },
  { id: "siembra", label: "Siembra" },
  { id: "preparacion-fertilizante", label: "Preparacion de Fertilizante" },
  { id: "cosechas", label: "Cosechas" },
  { id: "ventas", label: "Ventas" },
  { id: "costos", label: "Costos" },
  { id: "rentabilidad", label: "Rentabilidad" },
  { id: "plan-agronomico", label: "Plan Agronomico" },
  { id: "aplicaciones", label: "Aplicaciones" },
  { id: "calendario", label: "Calendario" },
  { id: "inventario", label: "Inventario" },
  { id: "sensores", label: "Sensores" },
  { id: "alertas", label: "Alertas" },
  { id: "invernaderos", label: "Invernaderos" },
  { id: "reportes", label: "Reportes" },
  { id: "personal", label: "Personal" },
  { id: "usuarios", label: "Usuarios" },
  { id: "roles", label: "Roles" },
  { id: "empresas", label: "Empresas" },
  { id: "dispositivos", label: "Dispositivos" },
  { id: "configuracion", label: "Configuracion" },
]

const defaultPermissionsByRole: Record<string, string[]> = {
  administrador: permissionOptions.map((option) => option.id),
  tecnico: ["dashboard", "zonas", "cultivos", "siembra", "preparacion-fertilizante", "cosechas", "plan-agronomico", "aplicaciones", "calendario", "inventario", "alertas", "invernaderos", "reportes", "sensores", "dispositivos"],
  agricultor: ["dashboard", "zonas", "cultivos", "siembra", "preparacion-fertilizante", "cosechas", "costos", "rentabilidad", "plan-agronomico", "aplicaciones", "calendario", "inventario", "alertas", "invernaderos", "reportes"],
  visualizador: ["dashboard", "zonas", "cultivos", "siembra", "preparacion-fertilizante", "cosechas", "rentabilidad", "calendario", "inventario", "alertas", "invernaderos", "reportes"],
}

function normalizeRoleName(value: string) {
  return value.trim().toLowerCase()
}

function parsePermissions(value?: string, roleName = "") {
  try {
    const parsed = JSON.parse(value || "[]")
    if (Array.isArray(parsed) && parsed.length > 0) {
      const permissions = new Set(parsed.map(String))
      if ((permissions.has("cultivos") || permissions.has("zonas")) && !permissions.has("preparacion-fertilizante")) {
        permissions.add("preparacion-fertilizante")
      }
      if ((permissions.has("cultivos") || permissions.has("zonas")) && !permissions.has("siembra")) {
        permissions.add("siembra")
      }
      return Array.from(permissions)
    }
  } catch {
    // Fallback below.
  }
  return defaultPermissionsByRole[normalizeRoleName(roleName)] || ["dashboard"]
}

function togglePermission(list: string[], permission: string) {
  return list.includes(permission)
    ? list.filter((item) => item !== permission)
    : [...list, permission]
}

export function RolesView() {
  const { data: roles, isLoading, mutate } = useSWR<Rol[]>("/api/roles", fetcher)
  const [search, setSearch] = useState("")
  
  // Create role
  const [createOpen, setCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")
  const [newPermissions, setNewPermissions] = useState<string[]>(["dashboard"])
  const [creating, setCreating] = useState(false)

  // Edit role
  const [editOpen, setEditOpen] = useState(false)
  const [editingRol, setEditingRol] = useState<Rol | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editActivo, setEditActivo] = useState(1)
  const [editPermissions, setEditPermissions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const roleList = roles || []

  const filtered = roleList.filter((r) =>
    r.Nombre.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate() {
    if (!newRoleName.trim()) {
      toast.error("El nombre del rol es requerido")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newRoleName.trim(), descripcion: newRoleDescription.trim(), permisos: newPermissions })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al crear rol")
      } else {
        toast.success("Rol creado exitosamente")
        mutate()
        setCreateOpen(false)
        setNewRoleName("")
        setNewRoleDescription("")
        setNewPermissions(["dashboard"])
      }
    } catch (err) {
      toast.error("Error al crear rol")
    } finally {
      setCreating(false)
    }
  }

  function openEditDialog(rol: Rol) {
    setEditingRol(rol)
    setEditName(rol.Nombre)
    setEditDescription(rol.Descripcion || "")
    setEditActivo(rol.Activo)
    setEditPermissions(parsePermissions(rol.Permisos, rol.Nombre))
    setEditOpen(true)
  }

  async function handleUpdate() {
    if (!editName.trim() || !editingRol) {
      toast.error("El nombre del rol es requerido")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/roles/${editingRol.RolID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nombre: editName.trim(), 
          descripcion: editDescription.trim(),
          permisos: editPermissions,
          activo: editActivo
        })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al actualizar rol")
      } else {
        toast.success("Rol actualizado exitosamente")
        mutate()
        setEditOpen(false)
        setEditingRol(null)
      }
    } catch (err) {
      toast.error("Error al actualizar rol")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gestion de Roles</h2>
          <p className="text-sm text-muted-foreground">
            Administre los roles y permisos del sistema ({roleList.length} roles)
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nuevo Rol</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">Crear Nuevo Rol</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label>Nombre del Rol *</Label>
                <Input
                  placeholder="Ej: Gerente"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Descripcion</Label>
                <Input
                  placeholder="Descripcion del rol"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Permisos</Label>
                <div className="grid max-h-64 gap-3 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                  {permissionOptions.map((permission) => (
                    <label key={permission.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={newPermissions.includes(permission.id)}
                        onCheckedChange={() => setNewPermissions((current) => togglePermission(current, permission.id))}
                      />
                      <span>{permission.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</>
                ) : (
                  "Crear Rol"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Rol</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label>Nombre del Rol *</Label>
                <Input
                  placeholder="Nombre del rol"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Descripcion</Label>
                <Input
                  placeholder="Descripcion del rol"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Estado</Label>
                <Select value={String(editActivo)} onValueChange={(v) => setEditActivo(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Activo</SelectItem>
                    <SelectItem value="0">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Permisos</Label>
                <div className="grid max-h-64 gap-3 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                  {permissionOptions.map((permission) => (
                    <label key={permission.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editPermissions.includes(permission.id)}
                        onCheckedChange={() => setEditPermissions((current) => togglePermission(current, permission.id))}
                      />
                      <span>{permission.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleUpdate} disabled={saving}>
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <Shield className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay roles registrados</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rol) => (
                  <TableRow key={rol.RolID}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="font-medium">{rol.Nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rol.Descripcion || "--"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {parsePermissions(rol.Permisos, rol.Nombre).length} modulos
                    </TableCell>
                    <TableCell>
                      <Badge className={rol.Activo ? "bg-green-500/20 text-green-400 border-0" : "bg-muted text-muted-foreground"}>
                        {rol.Activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(rol)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
