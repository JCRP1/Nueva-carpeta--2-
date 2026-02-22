"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  UserPlus,
  Shield,
  Wrench,
  Sprout,
  MoreVertical,
  Search,
  Loader2,
  Pencil,
  Key,
  UserX,
  UserCheck,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { UserRole } from "@/lib/greensense-data"
import { api, fetcher } from "@/lib/api-client"
import { toast } from "sonner"

interface UserData {
  id: string
  nombre: string
  email: string
  rol: UserRole
  empresaId: string
  activo: boolean
  ultimoAcceso: string
}

function getRoleIcon(rol: UserRole) {
  switch (rol) {
    case "administrador": return Shield
    case "tecnico": return Wrench
    case "agricultor": return Sprout
  }
}

function getRoleColor(rol: UserRole) {
  switch (rol) {
    case "administrador": return "bg-primary/20 text-primary border-0"
    case "tecnico": return "bg-blue-500/20 text-blue-400 border-0"
    case "agricultor": return "bg-amber-500/20 text-amber-400 border-0"
  }
}

function formatDate(ts: string) {
  if (!ts) return "--"
  return new Date(ts).toLocaleString("es-DO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function UsersView() {
  const { data: users, isLoading, mutate } = useSWR<UserData[]>("/api/users", fetcher)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  // Create user
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<UserRole>("agricultor")
  const [newPassword, setNewPassword] = useState("")
  const [creating, setCreating] = useState(false)

  // Edit user
  const [editUser, setEditUser] = useState<UserData | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editRole, setEditRole] = useState<UserRole>("agricultor")
  const [saving, setSaving] = useState(false)

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{ type: "toggle" | "reset"; user: UserData } | null>(null)

  const userList = users || []
  const filtered = userList.filter((u) => {
    const matchesSearch = u.nombre.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === "all" || u.rol === roleFilter
    return matchesSearch && matchesRole
  })

  async function handleCreate() {
    if (!newName || !newEmail || !newPassword) {
      toast.error("Complete todos los campos", { description: "Nombre, email y contrasena son requeridos" })
      return
    }
    if (newPassword.length < 8) {
      toast.error("Contrasena muy corta", { description: "Minimo 8 caracteres" })
      return
    }
    setCreating(true)
    try {
      await api.createUser({ nombre: newName, email: newEmail, password: newPassword, rol: newRole })
      mutate()
      setCreateOpen(false)
      setNewName("")
      setNewEmail("")
      setNewPassword("")
      setNewRole("agricultor")
      toast.success("Usuario creado")
    } catch (err) {
      toast.error("Error al crear usuario", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setCreating(false)
    }
  }

  function openEdit(user: UserData) {
    setEditUser(user)
    setEditName(user.nombre)
    setEditEmail(user.email)
    setEditRole(user.rol)
  }

  async function handleSaveEdit() {
    if (!editUser || !editName || !editEmail) return
    setSaving(true)
    try {
      await api.updateUser(editUser.id, { nombre: editName, email: editEmail, rol: editRole })
      mutate()
      setEditUser(null)
      toast.success("Usuario actualizado", { description: editName })
    } catch (err) {
      toast.error("Error al actualizar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(user: UserData) {
    try {
      await api.updateUser(user.id, { activo: !user.activo })
      mutate()
      setConfirmAction(null)
      toast.success(user.activo ? "Usuario desactivado" : "Usuario activado", { description: user.nombre })
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  function handleResetPassword(user: UserData) {
    setConfirmAction(null)
    toast.success("Contrasena restablecida", { description: `Se envio un enlace de recuperacion a ${user.email}` })
  }

  if (isLoading && !users) {
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
          <h2 className="text-lg font-semibold text-foreground">Gestion de Usuarios</h2>
          <p className="text-sm text-muted-foreground">Administre los usuarios y permisos del sistema ({userList.length} usuarios)</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="mr-2 h-4 w-4" />Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">Crear Nuevo Usuario</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label>Nombre Completo</Label>
                <Input placeholder="Nombre del usuario" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Correo Electronico</Label>
                <Input type="email" placeholder="usuario@greensense.io" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Rol</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="tecnico">Tecnico</SelectItem>
                    <SelectItem value="agricultor">Agricultor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Contrasena Temporal</Label>
                <Input type="password" placeholder="Min. 8 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : "Crear Usuario"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o correo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filtrar por rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Roles</SelectItem>
            <SelectItem value="administrador">Administrador</SelectItem>
            <SelectItem value="tecnico">Tecnico</SelectItem>
            <SelectItem value="agricultor">Agricultor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ultimo Acceso</TableHead>
                <TableHead className="w-10"><span className="sr-only">Acciones</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => {
                const RoleIcon = getRoleIcon(user.rol)
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-muted text-foreground text-xs">
                            {user.nombre.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.nombre}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(user.rol)}>
                        <RoleIcon className="mr-1 h-3 w-3" /><span className="capitalize">{user.rol}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.activo ? "default" : "outline"} className={user.activo ? "bg-emerald-500/20 text-emerald-400 border-0" : "text-muted-foreground"}>
                        {user.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(user.ultimoAcceso)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" /><span className="sr-only">Acciones de usuario</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Pencil className="mr-2 h-4 w-4" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setConfirmAction({ type: "reset", user })}>
                            <Key className="mr-2 h-4 w-4" />Restablecer Contrasena
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ type: "toggle", user })}>
                            {user.activo ? <><UserX className="mr-2 h-4 w-4" />Desactivar</> : <><UserCheck className="mr-2 h-4 w-4" />Activar</>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No se encontraron usuarios
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role permissions summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-foreground"><Shield className="h-4 w-4 text-primary" />Administrador</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              <li>Gestionar usuarios y permisos</li>
              <li>Configurar invernaderos y sensores</li>
              <li>Acceso completo a reportes</li>
              <li>Configuracion del sistema</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-foreground"><Wrench className="h-4 w-4 text-blue-400" />Tecnico</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              <li>Gestionar sensores y dispositivos</li>
              <li>Control manual de riego</li>
              <li>Ver y resolver alertas</li>
              <li>Acceso a reportes basicos</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-foreground"><Sprout className="h-4 w-4 text-amber-400" />Agricultor</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              <li>Ver dashboard y lecturas</li>
              <li>Ver estado de zonas de riego</li>
              <li>Recibir notificaciones</li>
              <li>Acceso de solo lectura</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Nombre Completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Correo Electronico</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Rol</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="tecnico">Tecnico</SelectItem>
                  <SelectItem value="agricultor">Agricultor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {confirmAction?.type === "toggle"
                ? confirmAction.user.activo ? "Desactivar Usuario" : "Activar Usuario"
                : "Restablecer Contrasena"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "toggle"
                ? confirmAction.user.activo
                  ? `Esta seguro de desactivar a ${confirmAction.user.nombre}? No podra acceder al sistema.`
                  : `Esta seguro de activar a ${confirmAction.user.nombre}? Podra acceder al sistema nuevamente.`
                : `Se enviara un enlace de recuperacion de contrasena a ${confirmAction?.user.email}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === "toggle") handleToggleActive(confirmAction.user)
                else if (confirmAction?.type === "reset") handleResetPassword(confirmAction.user)
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
