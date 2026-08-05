"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import {
  LayoutDashboard,
  Droplets,
  Bell,
  BarChart3,
  Settings,
  Leaf,
  Users,
  LogOut,
  ChevronDown,
  User,
  Warehouse,
  Activity,
  HardHat,
  Cpu,
  Shield,
  Building2,
  Sun,
  Moon,
  Wheat,
  Banknote,
  CalendarDays,
  ClipboardList,
  Package,
  ReceiptText,
  Sprout,
  TrendingUp,
  FlaskConical,
  Shovel,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { empresa } from "@/lib/greensense-data"
import type { User as UserType } from "@/lib/greensense-data"
import { fetcher } from "@/lib/api-client"
import { toast } from "sonner"
import { useTheme } from "next-themes"

interface AlertNotification {
  id: string
  timestamp: string
  resuelta: boolean
}

interface AppSidebarProps {
  activeView: string
  onViewChange: (view: string) => void
  onLogout: () => void
  currentUser: UserType
  empresaNombre?: string
  empresaRNC?: string
  allowedViews: string[]
}

const allNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "zonas", label: "Zonas de Riego", icon: Droplets },
  { id: "cultivos", label: "Cultivos", icon: Leaf },
  { id: "siembra", label: "Siembra", icon: Shovel },
  { id: "preparacion-fertilizante", label: "Preparacion", icon: FlaskConical },
  { id: "cosechas", label: "Cosechas", icon: Wheat },
  { id: "costos", label: "Costos", icon: ReceiptText },
  { id: "rentabilidad", label: "Rentabilidad", icon: TrendingUp },
  { id: "plan-agronomico", label: "Plan Agronomico", icon: Sprout },
  { id: "aplicaciones", label: "Aplicaciones", icon: ClipboardList },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
  { id: "inventario", label: "Inventario", icon: Package },
  { id: "sensores", label: "Sensores", icon: Activity },
  { id: "alertas", label: "Alertas", icon: Bell, badge: true },
  { id: "invernaderos", label: "Invernaderos", icon: Warehouse },
  { id: "reportes", label: "Reportes", icon: BarChart3 },
]

const adminItems = [
  { id: "ventas", label: "Ventas", icon: Banknote },
  { id: "personal", label: "Personal", icon: HardHat },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "dispositivos", label: "Dispositivos", icon: Cpu },
  { id: "configuracion", label: "Configuracion", icon: Settings },
]

function formatRNC(value: string): string {
  if (!value) return ""
  const clean = value.replace(/[^0-9]/g, "")
  if (clean.length > 8) return clean.slice(0,3) + "-" + clean.slice(3,8) + "-" + clean.slice(8)
  if (clean.length > 3) return clean.slice(0,3) + "-" + clean.slice(3)
  return clean
}

export function AppSidebar({ activeView, onViewChange, onLogout, currentUser, empresaNombre, empresaRNC, allowedViews }: AppSidebarProps) {
  const { theme, setTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState(currentUser.nombre)
  const [profileEmail, setProfileEmail] = useState(currentUser.email)
  const [savingProfile, setSavingProfile] = useState(false)
  const [lastSeenAlertsAt, setLastSeenAlertsAt] = useState<string | null>(null)
  const { data: alerts } = useSWR<AlertNotification[]>("/api/alerts", fetcher, {
    refreshInterval: 3000,
  })

  const isAdmin = allowedViews.includes("usuarios") || allowedViews.includes("roles") || allowedViews.includes("configuracion")
  const allowedAdminItems = adminItems.filter((item) => allowedViews.includes(item.id))
  const alertsStorageKey = `greensense:alerts:last-seen:${currentUser.id}`

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(alertsStorageKey)
    setLastSeenAlertsAt(stored)
  }, [alertsStorageKey])

  const latestAlertTimestamp = useMemo(() => {
    const alertList = alerts || []
    if (alertList.length === 0) return null

    return alertList.reduce<string | null>((latest, alert) => {
      if (!alert.timestamp) return latest
      if (!latest) return alert.timestamp
      return new Date(alert.timestamp).getTime() > new Date(latest).getTime() ? alert.timestamp : latest
    }, null)
  }, [alerts])

  useEffect(() => {
    if (activeView !== "alertas") return
    if (!latestAlertTimestamp) return
    if (typeof window === "undefined") return

    window.localStorage.setItem(alertsStorageKey, latestAlertTimestamp)
    setLastSeenAlertsAt(latestAlertTimestamp)
  }, [activeView, latestAlertTimestamp, alertsStorageKey])

  const newUnresolvedAlerts = useMemo(() => {
    const alertList = alerts || []
    const lastSeenTs = lastSeenAlertsAt ? new Date(lastSeenAlertsAt).getTime() : 0

    return alertList.filter((alert) => {
      if (alert.resuelta) return false
      const alertTs = new Date(alert.timestamp).getTime()
      if (Number.isNaN(alertTs)) return false
      return alertTs > lastSeenTs
    }).length
  }, [alerts, lastSeenAlertsAt])

  function handleSaveProfile() {
    if (!isAdmin) {
      toast.error("Acceso denegado", { description: "Solo los administradores pueden editar perfiles" })
      return
    }
    setSavingProfile(true)
    setTimeout(() => {
      setSavingProfile(false)
      setProfileOpen(false)
      toast.success("Perfil actualizado", { description: `Nombre: ${profileName}` })
    }, 800)
  }

  return (
    <>
       <Sidebar>
         <SidebarHeader className="h-12 flex flex-row items-center pl-1 pr-4 border-b border-border p-0">
           <div className="flex items-center gap-2">
             <div className="flex h-8 w-8 ml-3 items-center justify-center rounded-lg bg-sidebar-primary">
               <Leaf className="h-4 w-4 text-sidebar-primary-foreground" />
             </div>
             <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">{empresaNombre || "GreenSense"}</span>
              <span className="text-xs text-sidebar-foreground/60">{empresaRNC ? formatRNC(empresaRNC) : "IoT Fertirriego"}</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Monitoreo</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {allNavItems
                  .filter((item) => allowedViews.includes(item.id))
                  .map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeView === item.id}
                        onClick={() => onViewChange(item.id)}
                        tooltip={item.label}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {item.badge && newUnresolvedAlerts > 0 ? (
                          <Badge className="ml-auto h-5 min-w-5 justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] px-1.5">
                            {newUnresolvedAlerts}
                          </Badge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {allowedAdminItems.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Administracion</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {allowedAdminItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeView === item.id}
                        onClick={() => onViewChange(item.id)}
                        tooltip={item.label}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

         <SidebarSeparator className="mx-0" />

        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-sidebar-accent transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {currentUser.nombre.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col">
                  <span className="text-xs font-medium text-sidebar-foreground">{profileName}</span>
                  <span className="text-[10px] text-sidebar-foreground/60 capitalize">{currentUser.rol}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-sidebar-foreground/40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                Mi Perfil
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {theme === "dark" ? (
                    <Moon className="mr-2 h-4 w-4" />
                  ) : theme === "semi" ? (
                    <div className="mr-2 h-4 w-4 flex overflow-hidden rounded-sm">
                      <div className="w-1/2 bg-sidebar-primary" />
                      <div className="w-1/2 bg-background border border-border" />
                    </div>
                  ) : (
                    <Sun className="mr-2 h-4 w-4" />
                  )}
                  Tema
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setTheme("light")}>
                    <Sun className="mr-2 h-4 w-4" />
                    Modo Claro
                    {theme === "light" && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>
                    <Moon className="mr-2 h-4 w-4" />
                    Modo Oscuro
                    {theme === "dark" && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("semi")}>
                    <div className="mr-2 h-4 w-4 flex overflow-hidden rounded-sm">
                      <div className="w-1/2 bg-sidebar-primary" />
                      <div className="w-1/2 bg-background border border-border" />
                    </div>
                    Modo Semi
                    {theme === "semi" && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {isAdmin && (
                <DropdownMenuItem onClick={() => onViewChange("configuracion")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configuracion
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Mi Perfil</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {profileName.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">{profileName}</p>
                <p className="text-sm text-muted-foreground capitalize">{currentUser.rol}</p>
                <p className="text-xs text-muted-foreground">{empresa.nombre}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Nombre Completo</Label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Correo Electronico</Label>
              <Input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Rol</Label>
              <Input value={currentUser.rol} disabled className="capitalize" />
            </div>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">
                Contacte a un administrador para modificar su perfil.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setProfileOpen(false)}>
                {isAdmin ? "Cancelar" : "Cerrar"}
              </Button>
              {isAdmin && (
                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Guardando..." : "Guardar Cambios"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
