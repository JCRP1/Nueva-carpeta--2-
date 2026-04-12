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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Building2,
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
} from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { toast } from "sonner"

interface Empresa {
  id_empresa: number
  nombre: string
  rnc?: string
  direccion?: string
  telefono?: string
  correo?: string
  estado?: string
  fecha_creacion?: string
}

export function EnterprisesView() {
  const { data: empresas, isLoading, mutate } = useSWR<Empresa[]>("/api/empresas", fetcher)
  const [search, setSearch] = useState("")
  
  // Create empresa
  const [createOpen, setCreateOpen] = useState(false)
  const [newNombre, setNewNombre] = useState("")
  const [newRnc, setNewRnc] = useState("")
  const [newDireccion, setNewDireccion] = useState("")
  const [newTelefono, setNewTelefono] = useState("")
  const [newCorreo, setNewCorreo] = useState("")
  const [newEstado, setNewEstado] = useState("Activa")
  const [creating, setCreating] = useState(false)

  // Edit empresa
  const [editOpen, setEditOpen] = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null)
  const [editNombre, setEditNombre] = useState("")
  const [editRnc, setEditRnc] = useState("")
  const [editDireccion, setEditDireccion] = useState("")
  const [editTelefono, setEditTelefono] = useState("")
  const [editCorreo, setEditCorreo] = useState("")
  const [editEstado, setEditEstado] = useState("Activa")
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingEmpresa, setDeletingEmpresa] = useState<Empresa | null>(null)
  const [deleting, setDeleting] = useState(false)

  const empresaList = empresas || []

  const filtered = empresaList.filter((e) =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.rnc?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate() {
    if (!newNombre.trim()) {
      toast.error("El nombre de la empresa es requerido")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nombre: newNombre.trim(), 
          rnc: newRnc.trim(),
          direccion: newDireccion.trim(),
          telefono: newTelefono.trim(),
          correo: newCorreo.trim(),
          estado: newEstado
        })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al crear empresa")
      } else {
        toast.success("Empresa creada exitosamente")
        mutate()
        setCreateOpen(false)
        resetCreateForm()
      }
    } catch (err) {
      toast.error("Error al crear empresa")
    } finally {
      setCreating(false)
    }
  }

  function resetCreateForm() {
    setNewNombre("")
    setNewRnc("")
    setNewDireccion("")
    setNewTelefono("")
    setNewCorreo("")
    setNewEstado("Activa")
  }

  function openEditDialog(empresa: Empresa) {
    setEditingEmpresa(empresa)
    setEditNombre(empresa.nombre)
    setEditRnc(empresa.rnc || "")
    setEditDireccion(empresa.direccion || "")
    setEditTelefono(empresa.telefono || "")
    setEditCorreo(empresa.correo || "")
    setEditEstado(empresa.estado || "Activa")
    setEditOpen(true)
  }

  async function handleUpdate() {
    if (!editNombre.trim() || !editingEmpresa) {
      toast.error("El nombre de la empresa es requerido")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/empresas/${editingEmpresa.id_empresa}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nombre: editNombre.trim(), 
          rnc: editRnc.trim(),
          direccion: editDireccion.trim(),
          telefono: editTelefono.trim(),
          correo: editCorreo.trim(),
          estado: editEstado
        })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al actualizar empresa")
      } else {
        toast.success("Empresa actualizada exitosamente")
        mutate()
        setEditOpen(false)
        setEditingEmpresa(null)
      }
    } catch (err) {
      toast.error("Error al actualizar empresa")
    } finally {
      setSaving(false)
    }
  }

  function openDeleteDialog(empresa: Empresa) {
    setDeletingEmpresa(empresa)
    setDeleteOpen(true)
  }

  async function handleDelete() {
    if (!deletingEmpresa) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/empresas/${deletingEmpresa.id_empresa}`, {
        method: "DELETE"
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al eliminar empresa")
      } else {
        toast.success("Empresa eliminada exitosamente")
        mutate()
        setDeleteOpen(false)
        setDeletingEmpresa(null)
      }
    } catch (err) {
      toast.error("Error al eliminar empresa")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gestion de Empresas</h2>
          <p className="text-sm text-muted-foreground">
            Administre las empresas del sistema ({empresaList.length} empresas)
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nueva Empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">Crear Nueva Empresa</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label>Nombre de la Empresa *</Label>
                <Input
                  placeholder="Nombre de la empresa"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>RNC</Label>
                <Input
                  placeholder="RNC"
                  value={newRnc}
                  onChange={(e) => setNewRnc(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Direccion</Label>
                <Input
                  placeholder="Direccion"
                  value={newDireccion}
                  onChange={(e) => setNewDireccion(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Telefono</Label>
                <Input
                  placeholder="Telefono"
                  value={newTelefono}
                  onChange={(e) => setNewTelefono(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Correo</Label>
                <Input
                  type="email"
                  placeholder="correo@empresa.com"
                  value={newCorreo}
                  onChange={(e) => setNewCorreo(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Estado</Label>
                <Select value={newEstado} onValueChange={setNewEstado}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activa">Activa</SelectItem>
                    <SelectItem value="Inactiva">Inactiva</SelectItem>
                  </SelectContent>
                </Select>
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
                  "Crear Empresa"
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
            placeholder="Buscar por nombre o RNC..."
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
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay empresas registradas</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>RNC</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((empresa) => (
                  <TableRow key={empresa.id_empresa}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="font-medium">{empresa.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {empresa.rnc || "--"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {empresa.telefono || "--"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {empresa.correo || "--"}
                    </TableCell>
                    <TableCell>
                      <Badge className={empresa.estado === "Activa" ? "bg-green-500/20 text-green-400 border-0" : "bg-muted text-muted-foreground"}>
                        {empresa.estado || "Activa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(empresa)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openDeleteDialog(empresa)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Empresa</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Nombre de la Empresa *</Label>
              <Input
                placeholder="Nombre de la empresa"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>RNC</Label>
              <Input
                placeholder="RNC"
                value={editRnc}
                onChange={(e) => setEditRnc(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Direccion</Label>
              <Input
                placeholder="Direccion"
                value={editDireccion}
                onChange={(e) => setEditDireccion(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Telefono</Label>
              <Input
                placeholder="Telefono"
                value={editTelefono}
                onChange={(e) => setEditTelefono(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Correo</Label>
              <Input
                type="email"
                placeholder="correo@empresa.com"
                value={editCorreo}
                onChange={(e) => setEditCorreo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Estado</Label>
              <Select value={editEstado} onValueChange={setEditEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activa">Activa</SelectItem>
                  <SelectItem value="Inactiva">Inactiva</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Eliminar Empresa</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Esta seguro que desea eliminar la empresa <strong>{deletingEmpresa?.nombre}</strong>? 
              Esta accion no se puede deshacer.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Eliminando...</>
              ) : (
                "Eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}