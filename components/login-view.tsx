"use client"

import React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Building2, Leaf, Eye, EyeOff, Loader2, Shield, Wrench, Sprout } from "lucide-react"
import type { User } from "@/lib/greensense-data"
import { api } from "@/lib/api-client"

const quickAccess = [
  { empresaCodigo: "EMP-0001", email: "carlos@greensense.io", password: "admin123", nombre: "Carlos Martinez", rol: "administrador" as const },
  { empresaCodigo: "EMP-0001", email: "maria@greensense.io", password: "tecnico123", nombre: "Maria Lopez", rol: "tecnico" as const },
  { empresaCodigo: "EMP-0001", email: "juan@greensense.io", password: "agri123", nombre: "Juan Perez", rol: "agricultor" as const },
]

interface LoginViewProps {
  onLogin: (user: User, message?: string) => void
  initialView?: "login" | "super"
}

interface SuperEmpresa {
  id_empresa: number
  codigo_empresa?: string
  nombre: string
  rnc?: string
  correo?: string
  estado?: string
}

export function LoginView({ onLogin, initialView = "login" }: LoginViewProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [empresaCodigo, setEmpresaCodigo] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [view, setView] = useState<"login" | "forgot" | "super" | "company">(initialView)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotSent, setForgotSent] = useState(false)
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [companyCreated, setCompanyCreated] = useState("")
  const [superCompanies, setSuperCompanies] = useState<SuperEmpresa[]>([])
  const [updatingCompanyId, setUpdatingCompanyId] = useState<number | null>(null)
  const [superForm, setSuperForm] = useState({
    adminEmail: "",
    adminPassword: "",
  })
  const [companyForm, setCompanyForm] = useState({
    adminEmail: "",
    adminPassword: "",
    nombre: "",
    rnc: "",
    correo: "",
    telefono: "",
    userName: "",
    userEmail: "",
    userPassword: "",
  })

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!empresaCodigo || !email || !password) {
      setError("Complete todos los campos")
      return
    }
    setLoading(true)
    try {
      const res = await api.login(email, password, empresaCodigo)
      const msg = res.message || ""
      onLogin(res.user as unknown as User, msg)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesion")
      setLoading(false)
    }
  }

  async function handleQuickLogin(cred: typeof quickAccess[number]) {
    setEmpresaCodigo(cred.empresaCodigo)
    setEmail(cred.email)
    setPassword(cred.password)
    setLoading(true)
    setError("")
    try {
      const res = await api.login(cred.email, cred.password, cred.empresaCodigo)
      onLogin(res.user as unknown as User, "")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesion. Ejecute npm run db:seed primero.")
      setLoading(false)
    }
  }

  function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    api.forgotPassword(forgotEmail)
      .then(() => {
        setForgotSent(true)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo enviar el correo")
      })
      .finally(() => setLoading(false))
  }

  function updateCompanyField(field: keyof typeof companyForm, value: string) {
    setCompanyForm((current) => ({ ...current, [field]: value }))
  }

  function updateSuperField(field: keyof typeof superForm, value: string) {
    setSuperForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSuperLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setCompanyCreated("")

    if (!superForm.adminEmail || !superForm.adminPassword) {
      setError("Complete las credenciales del super usuario")
      return
    }

    setLoading(true)
    try {
      const res = await api.listPublicCompanies(superForm.adminEmail, superForm.adminPassword)
      setSuperCompanies(res.empresas as unknown as SuperEmpresa[])
      setCompanyForm((current) => ({
        ...current,
        adminEmail: superForm.adminEmail,
        adminPassword: superForm.adminPassword,
      }))
      setView("company")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Credenciales de super usuario invalidas")
    } finally {
      setLoading(false)
    }
  }

  async function refreshSuperCompanies() {
    const res = await api.listPublicCompanies(companyForm.adminEmail, companyForm.adminPassword)
    setSuperCompanies(res.empresas as unknown as SuperEmpresa[])
  }

  async function handleCompanyStatusChange(empresa: SuperEmpresa, estado: string) {
    setError("")
    setUpdatingCompanyId(empresa.id_empresa)
    try {
      await api.updatePublicCompanyStatus({
        adminEmail: companyForm.adminEmail,
        adminPassword: companyForm.adminPassword,
        id_empresa: empresa.id_empresa,
        estado,
      })
      setSuperCompanies((current) =>
        current.map((item) => (item.id_empresa === empresa.id_empresa ? { ...item, estado } : item))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado")
    } finally {
      setUpdatingCompanyId(null)
    }
  }

  async function handleAccessCompany(empresa: SuperEmpresa) {
    setError("")
    setUpdatingCompanyId(empresa.id_empresa)
    try {
      const res = await api.accessPublicCompany({
        adminEmail: companyForm.adminEmail,
        adminPassword: companyForm.adminPassword,
        id_empresa: empresa.id_empresa,
      })
      onLogin(res.user as unknown as User, `Accediendo a ${empresa.nombre}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo acceder a la empresa")
    } finally {
      setUpdatingCompanyId(null)
    }
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setCompanyCreated("")

    if (
      !companyForm.adminEmail ||
      !companyForm.adminPassword ||
      !companyForm.nombre ||
      !companyForm.userName ||
      !companyForm.userEmail ||
      !companyForm.userPassword
    ) {
      setError("Complete credenciales autorizadas, empresa y usuario administrador")
      return
    }

    if (companyForm.userPassword.length < 8) {
      setError("La contrasena del usuario administrador debe tener al menos 8 caracteres")
      return
    }

    setLoading(true)
    try {
      const res = await api.createPublicCompany(companyForm)
      const code = String(res.empresa?.codigo_empresa || res.empresa?.codigo || "")
      setCompanyCreated(code)
      await refreshSuperCompanies()
      setEmpresaCodigo(code)
      setEmail(companyForm.userEmail)
      setPassword("")
      setCompanyForm({
        adminEmail: superForm.adminEmail,
        adminPassword: superForm.adminPassword,
        nombre: "",
        rnc: "",
        correo: "",
        telefono: "",
        userName: "",
        userEmail: "",
        userPassword: "",
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo crear la empresa")
    } finally {
      setLoading(false)
    }
  }

  const roleIcons = {
    administrador: Shield,
    tecnico: Wrench,
    agricultor: Sprout,
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className={view === "company" ? "w-full max-w-4xl" : "w-full max-w-sm"}>
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Leaf className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">GreenSense</h1>
            <p className="text-sm text-muted-foreground">Sistema de Fertirriego Inteligente</p>
          </div>
        </div>

        {view === "login" ? (
          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Acceso de Usuarios</h2>
              <p className="text-sm text-muted-foreground">
                Ingrese el codigo de empresa y sus credenciales
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="empresaCodigo">Codigo de Empresa</Label>
                  <div className="relative">
                    <Input
                      id="empresaCodigo"
                      type="text"
                      placeholder="EMP-0001"
                      value={empresaCodigo}
                      onChange={(e) => setEmpresaCodigo(e.target.value.toUpperCase())}
                      autoComplete="organization"
                      className="pl-10"
                    />
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Correo Electronico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@greensense.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contrasena</Label>
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Olvido su contrasena?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingrese su contrasena"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {welcomeMessage && (
                  <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
                    {welcomeMessage}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ingresando...
                    </>
                  ) : (
                    "Ingresar"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setError("")
                    setWelcomeMessage("")
                    setView("super")
                  }}
                >
                  Acceso Super Usuario
                </Button>
              </form>


            </CardContent>
          </Card>
        ) : view === "super" ? (
          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Acceso Super Usuario</h2>
              <p className="text-sm text-muted-foreground">
                Solo este acceso puede crear empresas
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSuperLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="superEmail">Correo Super Usuario</Label>
                  <Input
                    id="superEmail"
                    type="email"
                    value={superForm.adminEmail}
                    onChange={(e) => updateSuperField("adminEmail", e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="superPassword">Contrasena Super Usuario</Label>
                  <div className="relative">
                    <Input
                      id="superPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingrese la contrasena"
                      value={superForm.adminPassword}
                      onChange={(e) => updateSuperField("adminPassword", e.target.value)}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    "Entrar como Super Usuario"
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setView("login")} type="button">
                  Volver al Login de Usuarios
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : view === "company" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
            <Card>
              <CardHeader className="pb-4">
                <h2 className="text-lg font-semibold text-card-foreground">Empresas</h2>
                <p className="text-sm text-muted-foreground">
                  Ver empresas y cambiar su estado
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <div className="grid grid-cols-[1fr_110px_140px_90px] gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                    <span>Empresa</span>
                    <span>Codigo</span>
                    <span>Estado</span>
                    <span>Acceso</span>
                  </div>
                  <div className="max-h-[520px] overflow-auto">
                    {superCompanies.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No hay empresas registradas
                      </div>
                    ) : (
                      superCompanies.map((empresa) => {
                        const estado = empresa.estado || "Activa"
                        const isUpdating = updatingCompanyId === empresa.id_empresa

                        return (
                          <div
                            key={empresa.id_empresa}
                            className="grid grid-cols-[1fr_110px_140px_90px] items-center gap-3 border-b px-3 py-3 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{empresa.nombre}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {empresa.correo || empresa.rnc || `ID ${empresa.id_empresa}`}
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {empresa.codigo_empresa || "-"}
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={estado}
                                disabled={isUpdating}
                                onValueChange={(value) => handleCompanyStatusChange(empresa, value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Activa">Activa</SelectItem>
                                  <SelectItem value="Inactiva">Inactiva</SelectItem>
                                </SelectContent>
                              </Select>
                              {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() => handleAccessCompany(empresa)}
                            >
                              Entrar
                            </Button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
                {error && (
                  <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <h2 className="text-lg font-semibold text-card-foreground">Crear Empresa</h2>
                <p className="text-sm text-muted-foreground">
                  Panel exclusivo del super usuario
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateCompany} className="flex flex-col gap-4">
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    Super usuario: {companyForm.adminEmail}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="companyName">Nombre de Empresa</Label>
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Nombre de la empresa"
                      value={companyForm.nombre}
                      onChange={(e) => updateCompanyField("nombre", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="companyRnc">RNC</Label>
                      <Input
                        id="companyRnc"
                        type="text"
                        placeholder="Opcional"
                        value={companyForm.rnc}
                        onChange={(e) => updateCompanyField("rnc", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="companyPhone">Telefono</Label>
                      <Input
                        id="companyPhone"
                        type="text"
                        placeholder="Opcional"
                        value={companyForm.telefono}
                        onChange={(e) => updateCompanyField("telefono", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="companyEmail">Correo de Empresa</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      placeholder="correo@empresa.com"
                      value={companyForm.correo}
                      onChange={(e) => updateCompanyField("correo", e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2 border-t pt-4">
                    <Label htmlFor="adminUserName">Nombre del Administrador</Label>
                    <Input
                      id="adminUserName"
                      type="text"
                      placeholder="Nombre del usuario administrador"
                      value={companyForm.userName}
                      onChange={(e) => updateCompanyField("userName", e.target.value)}
                      autoComplete="name"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="adminUserEmail">Correo del Administrador</Label>
                    <Input
                      id="adminUserEmail"
                      type="email"
                      placeholder="admin@empresa.com"
                      value={companyForm.userEmail}
                      onChange={(e) => updateCompanyField("userEmail", e.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="adminUserPassword">Contrasena del Administrador</Label>
                    <Input
                      id="adminUserPassword"
                      type="password"
                      placeholder="Minimo 8 caracteres"
                      value={companyForm.userPassword}
                      onChange={(e) => updateCompanyField("userPassword", e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>

                  {companyCreated && (
                    <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
                      Codigo creado: {companyCreated}
                    </div>
                  )}

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Empresa"
                    )}
                  </Button>
                  <Button variant="ghost" onClick={() => setView("login")} type="button">
                    Volver al Login de Usuarios
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Recuperar Contrasena</h2>
              <p className="text-sm text-muted-foreground">
                Ingrese su correo para recibir un enlace de recuperacion
              </p>
            </CardHeader>
            <CardContent>
              {forgotSent ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Leaf className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-center text-sm text-foreground">
                    Se ha enviado un enlace de recuperacion a <strong>{forgotEmail}</strong>
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setView("login")
                      setForgotSent(false)
                      setForgotEmail("")
                    }}
                  >
                    Volver al Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="forgot-email">Correo Electronico</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="usuario@greensense.io"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <Button type="submit" disabled={loading || !forgotEmail} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar Enlace"
                    )}
                  </Button>
                  <Button variant="ghost" onClick={() => setView("login")} type="button">
                    Volver al Login
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Invernadero Pedro Castillo - San Jose de Ocoa
        </p>
      </div>
    </div>
  )
}
