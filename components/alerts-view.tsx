"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Bell,
  BellOff,
  Filter,
  Trash2,
  Loader2,
  Lock,
} from "lucide-react"
import type { UserRole, Invernadero } from "@/lib/greensense-data"
import { api, fetcher } from "@/lib/api-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface AlertData {
  id: string
  tipo: string
  mensaje: string
  sensorId: string
  invernaderoId: string
  timestamp: string
  resuelta: boolean
}

function getAlertIcon(tipo: string) {
  switch (tipo) {
    case "critica": return AlertTriangle
    case "advertencia": return AlertCircle
    default: return Info
  }
}

function getAlertColor(tipo: string) {
  switch (tipo) {
    case "critica": return { text: "text-red-400", bg: "bg-red-500/10", badge: "bg-red-500/20 text-red-400 border-0" }
    case "advertencia": return { text: "text-amber-400", bg: "bg-amber-500/10", badge: "bg-amber-500/20 text-amber-400 border-0" }
    default: return { text: "text-blue-400", bg: "bg-blue-500/10", badge: "bg-blue-500/20 text-blue-400 border-0" }
  }
}

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString("es-DO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function AlertCard({ alerta, onResolve, canResolve }: { alerta: AlertData; onResolve: (id: string) => void; canResolve: boolean }) {
  const [resolving, setResolving] = useState(false)
  const Icon = getAlertIcon(alerta.tipo)
  const colors = getAlertColor(alerta.tipo)

  async function handleResolve() {
    setResolving(true)
    await onResolve(alerta.id)
    setResolving(false)
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${alerta.resuelta ? "opacity-60" : ""}`}>
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}>
        <Icon className={`h-4 w-4 ${colors.text}`} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{alerta.mensaje}</p>
          <Badge className={colors.badge}>
            {alerta.tipo === "critica" ? "Critica" : alerta.tipo === "advertencia" ? "Advertencia" : "Info"}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatTimestamp(alerta.timestamp)}</span>
        </div>
      </div>
      {!alerta.resuelta && canResolve && (
        <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={handleResolve} disabled={resolving}>
          {resolving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
          Resolver
        </Button>
      )}
      {!alerta.resuelta && !canResolve && (
        <Badge variant="outline" className="shrink-0 text-muted-foreground text-[10px] gap-1">
          <Lock className="h-3 w-3" />Solo lectura
        </Badge>
      )}
      {alerta.resuelta && (
        <Badge variant="outline" className="shrink-0 text-emerald-400 border-emerald-400/30 text-[10px]">Resuelta</Badge>
      )}
    </div>
  )
}

interface AlertsViewProps {
  userRole: UserRole
}

export function AlertsView({ userRole }: AlertsViewProps) {
  const { data: alerts, isLoading, mutate } = useSWR<AlertData[]>("/api/alerts", fetcher)
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)

  const [filterTypes, setFilterTypes] = useState<Record<string, boolean>>({ critica: true, advertencia: true, info: true })
  const [filterGreenhouses, setFilterGreenhouses] = useState<Record<string, boolean>>({})
  const [silencingAll, setSilencingAll] = useState(false)

  const isAdmin = userRole === "administrador"
  const canResolve = userRole === "administrador" || userRole === "tecnico"
  const ghList = greenhouses || []
  const alertList = alerts || []

  // Initialize greenhouse filters once we have data
  const ghFilter = useMemo(() => {
    const base: Record<string, boolean> = {}
    ghList.forEach((g) => { base[g.id] = filterGreenhouses[g.id] ?? true })
    return base
  }, [ghList, filterGreenhouses])

  const unresolved = useMemo(() =>
    alertList.filter((a) => !a.resuelta && filterTypes[a.tipo] && ghFilter[a.invernaderoId] !== false),
    [alertList, filterTypes, ghFilter]
  )
  const resolved = useMemo(() =>
    alertList.filter((a) => a.resuelta && filterTypes[a.tipo] && ghFilter[a.invernaderoId] !== false),
    [alertList, filterTypes, ghFilter]
  )
  const allFiltered = useMemo(() =>
    alertList.filter((a) => filterTypes[a.tipo] && ghFilter[a.invernaderoId] !== false),
    [alertList, filterTypes, ghFilter]
  )

  const criticas = alertList.filter((a) => !a.resuelta && a.tipo === "critica")
  const advertencias = alertList.filter((a) => !a.resuelta && a.tipo === "advertencia")
  const resolvedCount = alertList.filter((a) => a.resuelta)

  async function handleResolve(id: string) {
    try {
      await api.resolveAlert(id)
      mutate()
      toast.success("Alerta resuelta", { description: "La alerta ha sido marcada como resuelta" })
    } catch (err) {
      toast.error("Error al resolver alerta", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  async function handleSilenceAll() {
    setSilencingAll(true)
    try {
      await api.resolveAllAlerts()
      mutate()
      toast.success("Todas las alertas resueltas")
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSilencingAll(false)
    }
  }

  async function handleClearResolved() {
    try {
      await api.clearResolvedAlerts()
      mutate()
      toast.info("Historial de alertas resueltas limpiado")
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Error" })
    }
  }

  if (isLoading && !alerts) {
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
          <h2 className="text-lg font-semibold text-foreground">Centro de Alertas</h2>
          <p className="text-sm text-muted-foreground">
            {canResolve ? "Monitoree y gestione" : "Visualice"} las alertas del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />Filtrar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Tipo de Alerta</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filterTypes.critica} onCheckedChange={(v) => setFilterTypes((p) => ({ ...p, critica: !!v }))}>
                Criticas
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filterTypes.advertencia} onCheckedChange={(v) => setFilterTypes((p) => ({ ...p, advertencia: !!v }))}>
                Advertencias
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filterTypes.info} onCheckedChange={(v) => setFilterTypes((p) => ({ ...p, info: !!v }))}>
                Informativas
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Invernadero</DropdownMenuLabel>
              {ghList.map((inv) => (
                <DropdownMenuCheckboxItem
                  key={inv.id}
                  checked={ghFilter[inv.id] !== false}
                  onCheckedChange={(v) => setFilterGreenhouses((p) => ({ ...p, [inv.id]: !!v }))}
                >
                  {inv.nombre}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleSilenceAll} disabled={silencingAll}>
              {silencingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}
              Silenciar Todas
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Criticas</p>
              <p className="text-xl font-bold text-foreground">{criticas.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertCircle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Advertencias</p>
              <p className="text-xl font-bold text-foreground">{advertencias.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resueltas</p>
              <p className="text-xl font-bold text-foreground">{resolvedCount.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Activas ({unresolved.length})</TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Resueltas ({resolved.length})</TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">Todas ({allFiltered.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="flex flex-col gap-3">
            {unresolved.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-8">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <p className="text-sm font-medium text-foreground">Sin alertas activas</p>
                  <p className="text-xs text-muted-foreground">Todos los sistemas funcionan con normalidad</p>
                </CardContent>
              </Card>
            ) : (
              unresolved
                .sort((a, b) => {
                  const order: Record<string, number> = { critica: 0, advertencia: 1, info: 2 }
                  return (order[a.tipo] ?? 3) - (order[b.tipo] ?? 3)
                })
                .map((a) => <AlertCard key={a.id} alerta={a} onResolve={handleResolve} canResolve={canResolve} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          {isAdmin && resolved.length > 0 && (
            <div className="mb-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClearResolved}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />Limpiar Historial ({resolved.length})
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {resolved.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-8">
                  <Bell className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Sin alertas resueltas</p>
                </CardContent>
              </Card>
            ) : (
              resolved.map((a) => <AlertCard key={a.id} alerta={a} onResolve={handleResolve} canResolve={canResolve} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <div className="flex flex-col gap-3">
            {allFiltered
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((a) => <AlertCard key={a.id} alerta={a} onResolve={handleResolve} canResolve={canResolve} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
