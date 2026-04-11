"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
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
import {
  HardHat,
  Search,
  Loader2,
  Pencil,
  MoreVertical,
  Phone,
  CreditCard,
  Briefcase,
  ArrowUpRight,
  Trash2,
  Shield,
  Wrench,
  Sprout,
  Users,
} from "lucide-react"
import type { UserRole } from "@/lib/greensense-data"
import { api, fetcher } from "@/lib/api-client"
import { toast } from "sonner"
import { useEffect } from "react"

type Rol = {
  RolID: number
  Nombre: string
}


interface PersonalData {
  id: string
  nombre: string
  email: string
  rol: "personal"
  activo: boolean
  puesto: string | null
  telefono: string | null
  cedula: string | null
  registrado: string
}

function formatDate(ts: string) {
  if (!ts) return "--"
  return new Date(ts).toLocaleString("es-DO", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const PUESTOS = [
  "Operador de Riego",
  "Tecnico Agronomo",
  "Auxiliar de Campo",
  "Supervisor de Invernadero",
  "Analista de Sensores",
  "Otro",
]

export function PersonalView() {
    // 🔹 Roles dinámicos
const { data: roles = [] } = useSWR<Rol[]>("/api/rols", fetcher)

// ⚠️ CAMBIA este estado (reemplaza el existente)
const [promoteRole, setPromoteRole] = useState<string>("")
  const { data: personal, isLoading, mutate } = useSWR<PersonalData[]>(
    "/api/people",
    fetcher
  )

  const [search, setSearch] = useState("")

  // ── Form state ──────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PersonalData | null>(null)
  const [formNombre, setFormNombre] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formCargo, setFormPuesto] = useState("")
  const [formCargoCustom, setFormPuestoCustom] = useState("")
  const [formTelefono, setFormTelefono] = useState("")
  const [formCedula, setFormCedula] = useState("")
  const [saving, setSaving] = useState(false)

  // ── Promote state ────────────────────────────────────────────────────────────
  const [promoteTarget, setPromoteTarget] = useState<PersonalData | null>(null)
  const [promotePassword, setPromotePassword] = useState("")
  const [showPromotePassword, setShowPromotePassword] = useState(false)
  const [promoting, setPromoting] = useState(false)

  // ── Delete state ─────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<PersonalData | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const list = (personal || []).filter((p) => {
    const q = search.toLowerCase()
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.puesto || "").toLowerCase().includes(q) ||
      (p.cedula || "").includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    )
  })

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null)
    setFormNombre("")
    setFormEmail("")
    setFormPuesto("")
    setFormPuestoCustom("")
    setFormTelefono("")
    setFormCedula("")
    setDialogOpen(true)
  }

  function openEdit(p: PersonalData) {
    setEditTarget(p)
    setFormNombre(p.nombre)
    setFormEmail(p.email)
    const isPreset = PUESTOS.includes(p.puesto || "")
    setFormPuesto(isPreset ? (p.puesto || "") : "Otro")
    setFormPuestoCustom(!isPreset ? (p.puesto || "") : "")
    setFormTelefono(p.telefono || "")
    setFormCedula(p.cedula || "")
    setDialogOpen(true)
  }

  function resolvedCargo() {
    return formCargo === "Otro" ? formCargoCustom : formCargo
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!formNombre.trim() || !formEmail.trim()) {
      toast.error("Nombre y correo son requeridos")
      return
    }
    setSaving(true)
    try {
      if (editTarget) {
        await api.updatePerson(editTarget.id, {
          nombre: formNombre.trim(),
          email: formEmail.trim(),
          cargo: resolvedCargo() || null,
          telefono: formTelefono.trim() || null,
          cedula: formCedula.trim() || null,
        })
        toast.success("Personal actualizado", { description: formNombre })
      } else {
        await api.createPerson({
          nombre: formNombre.trim(),
          email: formEmail.trim(),
          rol: "personal",
          cargo: resolvedCargo() || null,
          telefono: formTelefono.trim() || null,
          cedula: formCedula.trim() || null,
        })
        toast.success("Personal agregado", { description: formNombre })
      }
      mutate()
      setDialogOpen(false)
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Error inesperado" })
    } finally {
      setSaving(false)
    }
  }

  async function handlePromote() {
    if (!promoteTarget) return
    if (!promotePassword || promotePassword.length < 8) {
      toast.error("La contrasena debe tener al menos 8 caracteres")
      return
    }
    setPromoting(true)
    try {
      await api.updateUser(promoteTarget.id, {
        rol: promoteRole,
        password: promotePassword,
      })
      mutate()
      setPromoteTarget(null)
      setPromotePassword("")
      toast.success("Personal promovido a usuario del sistema", {
        description: `${promoteTarget.nombre} ahora tiene acceso como ${promoteRole}`,
      })
    } catch (err) {
      toast.error("Error al promover", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setPromoting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deletePerson(deleteTarget.id)
      mutate()
      setDeleteTarget(null)
      toast.success("Personal eliminado", { description: deleteTarget.nombre })
    } catch (err) {
      toast.error("Error al eliminar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setDeleting(false)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const total = (personal || []).length
  const cargoCounts = (personal || []).reduce<Record<string, number>>((acc, p) => {
    const c = p.puesto || "Sin cargo"
    acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})
  const topCargo = Object.entries(cargoCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Gestion de Personal</h2>
        <p className="text-sm text-muted-foreground">
          Registre y administre los empleados del invernadero. El personal registrado puede ser promovido a usuario del sistema.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground">Total Personal</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <HardHat className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {Object.keys(cargoCounts).filter((c) => c !== "Sin cargo").length}
              </p>
              <p className="text-xs text-muted-foreground">Cargos distintos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Briefcase className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{topCargo?.[0] ?? "--"}</p>
              <p className="text-xs text-muted-foreground">
                Cargo mas comun {topCargo ? `(${topCargo[1]} persona${topCargo[1] > 1 ? "s" : ""})` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, cargo o cedula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={openAdd}>
          <HardHat className="mr-2 h-4 w-4" />
          Agregar Personal
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Cedula</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !personal ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <HardHat className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        {search ? "No se encontraron resultados" : "No hay personal registrado"}
                      </p>
                      {!search && (
                        <Button size="sm" variant="outline" onClick={openAdd} className="mt-1">
                          Agregar primer empleado
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-muted text-foreground text-xs font-medium">
                            {p.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.puesto ? (
                        <Badge variant="outline" className="gap-1.5 border-border text-foreground font-normal">
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          {p.puesto}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.telefono ? (
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {p.telefono}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.cedula ? (
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          {p.cedula}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(p.registrado)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Acciones</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setPromoteTarget(p)
                              setPromoteRole("agricultor")
                              setPromotePassword("")
                              setShowPromotePassword(false)
                            }}
                          >
                            <ArrowUpRight className="mr-2 h-4 w-4" />
                            Convertir en Usuario
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editTarget ? "Editar Empleado" : "Agregar Empleado"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Avatar preview */}
            {formNombre && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                    {formNombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{formNombre || "Nombre Completo"}</p>
                  <p className="text-xs text-muted-foreground">{formEmail || "correo@empresa.com"}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>
                  Nombre Completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Ej. Pedro Castillo"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                />
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>
                  Correo Electronico <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="empleado@invernadero.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Cargo</Label>
                <Select value={formCargo} onValueChange={setFormPuesto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cargo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PUESTOS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formCargo === "Otro" && (
                  <Input
                    placeholder="Especifique el cargo..."
                    value={formCargoCustom}
                    onChange={(e) => setFormPuestoCustom(e.target.value)}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Telefono</Label>
                <Input
                  placeholder="809-000-0000"
                  value={formTelefono}
                  onChange={(e) => setFormTelefono(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Cedula</Label>
                <Input
                  placeholder="000-0000000-0"
                  value={formCedula}
                  onChange={(e) => setFormCedula(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : editTarget ? (
                "Guardar Cambios"
              ) : (
                "Agregar Empleado"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Promote to User Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!promoteTarget}
        onOpenChange={(o) => {
          if (!o) setPromoteTarget(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Dar Acceso al Sistema</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Rol en el Sistema</Label>

            <Select value={promoteRole} onValueChange={setPromoteRole}>
                <SelectTrigger>
                <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>

                <SelectContent>
                {roles.map((rol) => (
                    <SelectItem key={rol.RolID} value={rol.RolID.toString()}>
                    <div className="flex items-center gap-2">
                        {rol.Nombre.toLowerCase() === "administrador" && (
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        )}
                        {rol.Nombre.toLowerCase() === "tecnico" && (
                        <Wrench className="h-3.5 w-3.5 text-blue-400" />
                        )}
                        {rol.Nombre.toLowerCase() === "agricultor" && (
                        <Sprout className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        {rol.Nombre}
                    </div>
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
            </div>
          <div className="flex flex-col gap-4 py-2">
            {promoteTarget && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                    {promoteTarget.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{promoteTarget.nombre}</p>
                  <p className="text-xs text-muted-foreground">{promoteTarget.email}</p>
                  {promoteTarget.puesto && (
                    <p className="text-xs text-muted-foreground">{promoteTarget.puesto}</p>
                  )}
                </div>
              </div>
            )}

            

            <div className="flex flex-col gap-1.5">
              <Label>
                Contrasena Inicial <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showPromotePassword ? "text" : "password"}
                  placeholder="Min. 8 caracteres"
                  value={promotePassword}
                  onChange={(e) => setPromotePassword(e.target.value)}
                  className="pr-20"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPromotePassword((v) => !v)}
                >
                  {showPromotePassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                El usuario podra cambiar su contrasena despues de iniciar sesion.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteTarget(null)} disabled={promoting}>
              Cancelar
            </Button>
            <Button onClick={handlePromote} disabled={promoting}>
              {promoting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
              ) : (
                <>
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Dar Acceso
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Eliminar Empleado</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente a{" "}
              <strong className="text-foreground">{deleteTarget?.nombre}</strong> del registro.
              Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Eliminando...</>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
