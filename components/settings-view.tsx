"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Building2,
  Wifi,
  Bell,
  Shield,
  Database,
  Server,
  Save,
  RotateCcw,
  Loader2,
  RefreshCw,
} from "lucide-react"
import type { Invernadero } from "@/lib/greensense-data"
import { api, fetcher } from "@/lib/api-client"
import { toast } from "sonner"

interface SettingsState {
  empresaNombre: string
  empresaUbicacion: string
  timezone: string
  autoIrrigation: boolean
  maxDuration: number
  maxVolume: number
  mqttEnabled: boolean
  brokerUrl: string
  topicBase: string
  clientId: string
  sensorInterval: number
  connectionTimeout: number
  retries: number
  emailAlerts: boolean
  smsAlerts: boolean
  criticalOnly: boolean
  alertEmail: string
  alertPhone: string
  jwtDuration: number
  refreshDuration: number
  maxLoginAttempts: number
  lockoutMinutes: number
  dataRetention: number
  allowedOrigins: string
  rateLimit: number
}

const defaultSettings: SettingsState = {
  empresaNombre: "Invernadero Pedro Castillo",
  empresaUbicacion: "San Jose de Ocoa, RD",
  timezone: "america_santo_domingo",
  autoIrrigation: true,
  maxDuration: 30,
  maxVolume: 200,
  mqttEnabled: true,
  brokerUrl: "mqtts://broker.greensense.io:8883",
  topicBase: "greensense/inv-pedro-castillo/",
  clientId: "gs-server-prod-001",
  sensorInterval: 15,
  connectionTimeout: 30,
  retries: 3,
  emailAlerts: true,
  smsAlerts: false,
  criticalOnly: false,
  alertEmail: "alertas@greensense.io",
  alertPhone: "+1 809 555 1234",
  jwtDuration: 24,
  refreshDuration: 30,
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  dataRetention: 365,
  allowedOrigins: "https://app.greensense.io",
  rateLimit: 100,
}

interface DeviceState {
  id: string
  nombre: string
  online: boolean
  ip: string
  pinging: boolean
}

export function SettingsView() {
  const { data: serverSettings, mutate: mutateSettings } = useSWR<Record<string, unknown>>("/api/settings", fetcher)
  const { data: greenhouses } = useSWR<Invernadero[]>("/api/greenhouses", fetcher)

  const [settings, setSettings] = useState<SettingsState>({ ...defaultSettings })
  const [saving, setSaving] = useState(false)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [devices, setDevices] = useState<DeviceState[]>([
    { id: "ESP32-001", nombre: "Controlador Inv. A", online: true, ip: "192.168.1.101", pinging: false },
    { id: "ESP32-002", nombre: "Controlador Inv. B", online: true, ip: "192.168.1.102", pinging: false },
    { id: "ESP32-003", nombre: "Controlador Inv. C", online: false, ip: "192.168.1.103", pinging: false },
  ])

  // Hydrate local form from server settings
  useEffect(() => {
    if (serverSettings) {
      setSettings((prev) => ({
        ...prev,
        mqttEnabled: serverSettings.mqttBroker ? true : prev.mqttEnabled,
        brokerUrl: (serverSettings.mqttBroker as string) || prev.brokerUrl,
        sensorInterval: (serverSettings.lecturaIntervalo as number) || prev.sensorInterval,
        emailAlerts: (serverSettings.notifEmail as boolean) ?? prev.emailAlerts,
        smsAlerts: (serverSettings.notifSms as boolean) ?? prev.smsAlerts,
      }))
    }
  }, [serverSettings])

  const ghList = greenhouses || []

  const update = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  async function handleSaveAll() {
    setSaving(true)
    try {
      await api.updateSettings({
        mqttBroker: settings.brokerUrl,
        mqttPort: 1883,
        mqttTopic: settings.topicBase,
        lecturaIntervalo: settings.sensorInterval,
        notifEmail: settings.emailAlerts,
        notifSms: settings.smsAlerts,
        alertaCritica: settings.criticalOnly,
        sesionTimeout: settings.jwtDuration * 60,
      })
      mutateSettings()
      toast.success("Configuracion guardada", {
        description: "Todos los parametros han sido actualizados correctamente",
      })
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSaving(false)
    }
  }

  function handleRestore() {
    setSettings({ ...defaultSettings })
    toast.info("Configuracion restaurada", {
      description: "Se han restaurado los valores predeterminados del sistema",
    })
  }

  async function handleSaveSection(section: string) {
    setSavingSection(section)
    try {
      await api.updateSettings({
        mqttBroker: settings.brokerUrl,
        mqttTopic: settings.topicBase,
        lecturaIntervalo: settings.sensorInterval,
        notifEmail: settings.emailAlerts,
        notifSms: settings.smsAlerts,
        alertaCritica: settings.criticalOnly,
        sesionTimeout: settings.jwtDuration * 60,
      })
      mutateSettings()
      toast.success(`Seccion "${section}" guardada`, {
        description: "Los cambios han sido aplicados",
      })
    } catch (err) {
      toast.error("Error al guardar", { description: err instanceof Error ? err.message : "Error" })
    } finally {
      setSavingSection(null)
    }
  }

  function handlePingDevice(deviceId: string) {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, pinging: true } : d))
    )
    setTimeout(() => {
      setDevices((prev) =>
        prev.map((d) => {
          if (d.id !== deviceId) return d
          const wasOffline = !d.online
          const nowOnline = wasOffline ? Math.random() > 0.3 : true
          if (wasOffline && nowOnline) {
            toast.success(`${d.nombre} reconectado`, { description: `${d.id} ahora esta en linea` })
          } else if (wasOffline && !nowOnline) {
            toast.error(`${d.nombre} no responde`, { description: `${d.id} sigue sin conexion` })
          } else {
            toast.success(`${d.nombre} responde`, { description: `Ping exitoso a ${d.ip}` })
          }
          return { ...d, pinging: false, online: nowOnline }
        })
      )
    }, 1500)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Configuracion del Sistema
          </h2>
          <p className="text-sm text-muted-foreground">
            Administre los parametros generales del sistema GreenSense
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRestore}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Todo
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="iot" className="gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            IoT / MQTT
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="seguridad" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">Datos de la Empresa</CardTitle>
                <CardDescription>Informacion general del invernadero</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Nombre de la Empresa</Label>
                  <Input value={settings.empresaNombre} onChange={(e) => update("empresaNombre", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Ubicacion</Label>
                  <Input value={settings.empresaUbicacion} onChange={(e) => update("empresaUbicacion", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Zona Horaria</Label>
                  <Select value={settings.timezone} onValueChange={(v) => update("timezone", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="america_santo_domingo">America/Santo Domingo (AST)</SelectItem>
                      <SelectItem value="america_new_york">America/New York (EST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="self-end"
                  onClick={() => handleSaveSection("Empresa")}
                  disabled={savingSection === "Empresa"}
                >
                  {savingSection === "Empresa" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">Invernaderos Registrados</CardTitle>
                <CardDescription>Listado de invernaderos en el sistema</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {ghList.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{inv.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.ubicacion} - {inv.area}m2
                      </p>
                    </div>
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        inv.estado === "activo"
                          ? "bg-emerald-500"
                          : inv.estado === "mantenimiento"
                            ? "bg-amber-500"
                            : "bg-muted-foreground"
                      }`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">Riego Automatico</CardTitle>
                <CardDescription>Parametros globales de riego</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Riego Automatico Global</p>
                    <p className="text-xs text-muted-foreground">
                      Activar riego automatico basado en umbrales
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoIrrigation}
                    onCheckedChange={(v) => {
                      update("autoIrrigation", v)
                      toast(v ? "Riego automatico activado" : "Riego automatico desactivado")
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Duracion Maxima de Riego (min)</Label>
                  <Input
                    type="number"
                    value={settings.maxDuration}
                    onChange={(e) => update("maxDuration", Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Volumen Maximo por Sesion (L)</Label>
                  <Input
                    type="number"
                    value={settings.maxVolume}
                    onChange={(e) => update("maxVolume", Number(e.target.value))}
                  />
                </div>
                <Button
                  className="self-end"
                  onClick={() => handleSaveSection("Riego")}
                  disabled={savingSection === "Riego"}
                >
                  {savingSection === "Riego" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* IOT TAB */}
        <TabsContent value="iot" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">Configuracion MQTT</CardTitle>
                <CardDescription>Parametros de comunicacion con dispositivos IoT</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Broker MQTT</p>
                    <p className="text-xs text-muted-foreground">Conexion al broker de mensajes</p>
                  </div>
                  <Switch
                    checked={settings.mqttEnabled}
                    onCheckedChange={(v) => {
                      update("mqttEnabled", v)
                      toast(v ? "Broker MQTT habilitado" : "Broker MQTT deshabilitado")
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>URL del Broker</Label>
                  <Input value={settings.brokerUrl} onChange={(e) => update("brokerUrl", e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Topic Base</Label>
                  <Input value={settings.topicBase} onChange={(e) => update("topicBase", e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Cliente ID</Label>
                  <Input value={settings.clientId} onChange={(e) => update("clientId", e.target.value)} className="font-mono text-xs" />
                </div>
                <Button
                  className="self-end"
                  onClick={() => handleSaveSection("MQTT")}
                  disabled={savingSection === "MQTT"}
                >
                  {savingSection === "MQTT" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">Intervalo de Lectura</CardTitle>
                <CardDescription>Frecuencia de adquisicion de datos</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>
                    Intervalo de Sensores: {settings.sensorInterval} segundos
                  </Label>
                  <Slider
                    value={[settings.sensorInterval]}
                    onValueChange={(v) => update("sensorInterval", v[0])}
                    min={5}
                    max={60}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Frecuencia con la que los ESP32 envian lecturas
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Timeout de Conexion (seg)</Label>
                  <Input
                    type="number"
                    value={settings.connectionTimeout}
                    onChange={(e) => update("connectionTimeout", Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Reintentos de Conexion</Label>
                  <Input
                    type="number"
                    value={settings.retries}
                    onChange={(e) => update("retries", Number(e.target.value))}
                  />
                </div>
                <Button
                  className="self-end"
                  onClick={() => handleSaveSection("Lecturas")}
                  disabled={savingSection === "Lecturas"}
                >
                  {savingSection === "Lecturas" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm text-foreground">Dispositivos ESP32</CardTitle>
                <CardDescription>Estado de dispositivos conectados</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${device.online ? "bg-emerald-500" : "bg-red-500"}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{device.nombre}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {device.id} - {device.ip}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {device.online ? "Conectado" : "Desconectado"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePingDevice(device.id)}
                        disabled={device.pinging}
                      >
                        {device.pinging ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5 text-xs">Ping</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ALERTAS TAB */}
        <TabsContent value="s" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-foreground">Configuracion de Notificaciones</CardTitle>
              <CardDescription>Gestione como y cuando recibe alertas</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Alertas por Email</p>
                  <p className="text-xs text-muted-foreground">
                    Recibir notificaciones por correo electronico
                  </p>
                </div>
                <Switch
                  checked={settings.emailAlerts}
                  onCheckedChange={(v) => {
                    update("emailAlerts", v)
                    toast(v ? "Alertas por email activadas" : "Alertas por email desactivadas")
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Alertas por SMS</p>
                  <p className="text-xs text-muted-foreground">
                    Recibir notificaciones por mensaje de texto
                  </p>
                </div>
                <Switch
                  checked={settings.smsAlerts}
                  onCheckedChange={(v) => {
                    update("smsAlerts", v)
                    toast(v ? "Alertas por SMS activadas" : "Alertas por SMS desactivadas")
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Solo Alertas Criticas</p>
                  <p className="text-xs text-muted-foreground">
                    Notificar solo cuando haya alertas criticas
                  </p>
                </div>
                <Switch
                  checked={settings.criticalOnly}
                  onCheckedChange={(v) => {
                    update("criticalOnly", v)
                    toast(v ? "Solo alertas criticas" : "Todas las alertas habilitadas")
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email de Notificaciones</Label>
                <Input type="email" value={settings.alertEmail} onChange={(e) => update("alertEmail", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Telefono SMS</Label>
                <Input type="tel" value={settings.alertPhone} onChange={(e) => update("alertPhone", e.target.value)} />
              </div>
              <Button
                className="self-end"
                onClick={() => handleSaveSection("Notificaciones")}
                disabled={savingSection === "Notificaciones"}
              >
                {savingSection === "Notificaciones" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Guardar Preferencias
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEGURIDAD TAB */}
        <TabsContent value="seguridad" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">Autenticacion</CardTitle>
                <CardDescription>Parametros de seguridad de acceso</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Duracion del Token JWT (horas)</Label>
                  <Input type="number" value={settings.jwtDuration} onChange={(e) => update("jwtDuration", Number(e.target.value))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Duracion Refresh Token (dias)</Label>
                  <Input type="number" value={settings.refreshDuration} onChange={(e) => update("refreshDuration", Number(e.target.value))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Intentos de Login antes de Bloqueo</Label>
                  <Input type="number" value={settings.maxLoginAttempts} onChange={(e) => update("maxLoginAttempts", Number(e.target.value))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Tiempo de Bloqueo (minutos)</Label>
                  <Input type="number" value={settings.lockoutMinutes} onChange={(e) => update("lockoutMinutes", Number(e.target.value))} />
                </div>
                <Button
                  className="self-end"
                  onClick={() => handleSaveSection("Seguridad")}
                  disabled={savingSection === "Seguridad"}
                >
                  {savingSection === "Seguridad" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">Base de Datos</CardTitle>
                <CardDescription>Conexion y mantenimiento</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">SQL Server</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        greensense-db.database.local
                      </p>
                    </div>
                  </div>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">API Server</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        api.greensense.io:3000
                      </p>
                    </div>
                  </div>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Retencion de Datos (dias)</Label>
                  <Input type="number" value={settings.dataRetention} onChange={(e) => update("dataRetention", Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">
                    Tiempo que se mantienen las lecturas de sensores en la base de datos
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">CORS y Seguridad API</CardTitle>
                <CardDescription>Configuracion de origenes permitidos</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Origenes Permitidos</Label>
                  <Input value={settings.allowedOrigins} onChange={(e) => update("allowedOrigins", e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Rate Limit (peticiones/min)</Label>
                  <Input type="number" value={settings.rateLimit} onChange={(e) => update("rateLimit", Number(e.target.value))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">HTTPS Obligatorio</p>
                    <p className="text-xs text-muted-foreground">
                      Forzar conexiones seguras
                    </p>
                  </div>
                  <Switch checked={true} disabled />
                </div>
                <Button
                  className="self-end"
                  onClick={() => handleSaveSection("API")}
                  disabled={savingSection === "API"}
                >
                  {savingSection === "API" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
