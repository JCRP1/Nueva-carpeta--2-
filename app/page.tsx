"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { LoginView } from "@/components/login-view"
import { DashboardView } from "@/components/dashboard-view"
import { ZonesView } from "@/components/zones-view"
import { AlertsView } from "@/components/alerts-view"
import { ReportsView } from "@/components/reports-view"
import { GreenhousesView } from "@/components/greenhouses-view"
import { UsersView } from "@/components/users-view"
import { SettingsView } from "@/components/settings-view"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import type { User, UserRole, Invernadero } from "@/lib/greensense-data"
import { api, fetcher } from "@/lib/api-client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Wifi, Clock, ShieldAlert, Loader2 } from "lucide-react"
import { toast } from "sonner"

const viewLabels: Record<string, string> = {
  dashboard: "Dashboard",
  zonas: "Zonas de Riego",
  alertas: "Alertas",
  invernaderos: "Invernaderos",
  reportes: "Reportes",
  usuarios: "Usuarios",
  configuracion: "Configuracion",
}

const roleAccess: Record<UserRole, string[]> = {
  administrador: ["dashboard", "zonas", "alertas", "invernaderos", "reportes", "usuarios", "configuracion"],
  tecnico: ["dashboard", "zonas", "alertas", "invernaderos", "reportes"],
  agricultor: ["dashboard", "zonas", "alertas", "invernaderos", "reportes"],
}

export default function Page() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeView, setActiveView] = useState("dashboard")
  const [selectedGreenhouse, setSelectedGreenhouse] = useState("inv1")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [mqttConnected, setMqttConnected] = useState(true)
  const [checkingSession, setCheckingSession] = useState(true)

  // Fetch greenhouses from API (only when logged in)
  const { data: greenhouses } = useSWR<Invernadero[]>(
    currentUser ? "/api/greenhouses" : null,
    fetcher
  )

  // Check existing session on mount
  useEffect(() => {
    api.me()
      .then((res) => {
        if (res.user) {
          setCurrentUser(res.user as unknown as User)
        }
      })
      .catch(() => {
        // No session
      })
      .finally(() => setCheckingSession(false))
  }, [])

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Simulate MQTT connection status
  useEffect(() => {
    const interval = setInterval(() => {
      const willDisconnect = Math.random() < 0.05
      if (willDisconnect && mqttConnected) {
        setMqttConnected(false)
        toast.warning("Conexion MQTT perdida", { description: "Intentando reconectar..." })
        setTimeout(() => {
          setMqttConnected(true)
          toast.success("MQTT reconectado", { description: "Conexion restablecida" })
        }, 3000)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [mqttConnected])

  function handleLogin(user: User) {
    setCurrentUser(user)
    setActiveView("dashboard")
    toast.success(`Bienvenido, ${user.nombre}`, {
      description: `Sesion iniciada como ${user.rol}`,
    })
  }

  async function handleLogout() {
    try {
      await api.logout()
    } catch {
      // Logout even if API fails
    }
    setCurrentUser(null)
    setActiveView("dashboard")
    toast.info("Sesion cerrada", { description: "Ha cerrado sesion exitosamente" })
  }

  function handleViewChange(view: string) {
    if (!currentUser) return
    const allowed = roleAccess[currentUser.rol]
    if (!allowed.includes(view)) {
      toast.error("Acceso denegado", {
        description: "No tiene permisos para acceder a esta seccion",
      })
      return
    }
    setActiveView(view)
  }

  function handleGreenhouseChange(value: string) {
    setSelectedGreenhouse(value)
    const inv = (greenhouses || []).find((i) => i.id === value)
    toast.info("Invernadero cambiado", { description: `Ahora viendo: ${inv?.nombre}` })
  }

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando sesion...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />
  }

  const isAdmin = currentUser.rol === "administrador"
  const isReadOnly = currentUser.rol === "agricultor"
  const ghList = greenhouses || []

  function renderView() {
    switch (activeView) {
      case "dashboard":
        return <DashboardView selectedGreenhouse={selectedGreenhouse} userRole={currentUser!.rol} />
      case "zonas":
        return <ZonesView selectedGreenhouse={selectedGreenhouse} userRole={currentUser!.rol} />
      case "alertas":
        return <AlertsView userRole={currentUser!.rol} />
      case "invernaderos":
        return <GreenhousesView userRole={currentUser!.rol} />
      case "reportes":
        return <ReportsView userRole={currentUser!.rol} />
      case "usuarios":
        if (!isAdmin) {
          return (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <ShieldAlert className="h-12 w-12 text-destructive" />
              <h2 className="text-lg font-semibold text-foreground">Acceso Restringido</h2>
              <p className="text-sm text-muted-foreground">Solo los administradores pueden gestionar usuarios</p>
            </div>
          )
        }
        return <UsersView />
      case "configuracion":
        if (!isAdmin) {
          return (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <ShieldAlert className="h-12 w-12 text-destructive" />
              <h2 className="text-lg font-semibold text-foreground">Acceso Restringido</h2>
              <p className="text-sm text-muted-foreground">Solo los administradores pueden modificar la configuracion</p>
            </div>
          )
        }
        return <SettingsView />
      default:
        return <DashboardView selectedGreenhouse={selectedGreenhouse} userRole={currentUser!.rol} />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground font-medium">
                  {viewLabels[activeView] || "Dashboard"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {isReadOnly && (
            <Badge variant="outline" className="ml-2 text-amber-400 border-amber-400/30 text-[10px]">
              Solo Lectura
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-3">
            <Select value={selectedGreenhouse} onValueChange={handleGreenhouseChange}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ghList.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          inv.estado === "activo"
                            ? "bg-emerald-500"
                            : inv.estado === "mantenimiento"
                              ? "bg-amber-500"
                              : "bg-muted-foreground"
                        }`}
                      />
                      <span>{inv.nombre}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge
              variant="outline"
              className={`hidden gap-1.5 md:flex ${
                mqttConnected
                  ? "text-emerald-400 border-emerald-400/30"
                  : "text-red-400 border-red-400/30 animate-pulse"
              }`}
            >
              <Wifi className="h-3 w-3" />
              <span className="text-[10px]">{mqttConnected ? "MQTT Conectado" : "Reconectando..."}</span>
            </Badge>

            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {currentTime.toLocaleString("es-DO", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {renderView()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
