"use client";

import { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
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
  PlugZap,
  Radio,
  Search,
  Cpu,
  Activity,
} from "lucide-react";
import type { Invernadero } from "@/lib/greensense-data";
import { api, fetcher } from "@/lib/api-client";
import { toast } from "sonner";

interface SettingsState {
  empresaNombre: string;
  empresaUbicacion: string;
  timezone: string;
  autoIrrigation: boolean;
  maxDuration: number;
  maxVolume: number;
  mqttEnabled: boolean;
  brokerUrl: string;
  topicBase: string;
  clientId: string;
  sensorInterval: number;
  connectionTimeout: number;
  retries: number;
  emailAlerts: boolean;
  criticalOnly: boolean;
  alertEmail: string;
  jwtDuration: number;
  refreshDuration: number;
  maxLoginAttempts: number;
  lockoutMinutes: number;
  dataRetention: number;
  allowedOrigins: string;
  rateLimit: number;
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
  criticalOnly: false,
  alertEmail: "alertas@greensense.io",
  jwtDuration: 24,
  refreshDuration: 30,
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  dataRetention: 365,
  allowedOrigins: "https://app.greensense.io",
  rateLimit: 100,
};

function parseSettingBool(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "si", "sí", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function parseSettingNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

interface DeviceState {
  id: string;
  nombre: string;
  tipo: string;
  codigoDispositivo?: string;
  estado: string;
  ipLocal?: string;
  firmwareVersion?: string;
  ultimoReporte?: string;
  invernaderoId?: string;
  nombreInvernadero?: string;
}

interface DiscoveredDevice {
  ip: string;
  port: number;
  url: string;
  deviceName: string | null;
  deviceCode: string | null;
  firmwareVersion: string | null;
  chipModel: string | null;
  confidence: "high" | "medium";
  subnet?: string;
}

interface SensorReadingState {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  ultimaLectura?: number;
  unidad?: string;
  umbralMin?: number;
  umbralMax?: number;
  ultimoReporte?: string;
  history?: Array<{ timestamp: string; valor: number }>;
}

export function SettingsView() {
  const { data: serverSettings, mutate: mutateSettings } = useSWR<
    Record<string, unknown>
  >("/api/settings", fetcher);
  const { data: greenhouses } = useSWR<Invernadero[]>(
    "/api/greenhouses",
    fetcher,
  );
  const { data: iotDevices, mutate: mutateDevices } = useSWR<DeviceState[]>(
    "/api/devices",
    fetcher,
  );

  const [settings, setSettings] = useState<SettingsState>({
    ...defaultSettings,
  });
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<
    DiscoveredDevice[]
  >([]);
  const [scannedNetworks, setScannedNetworks] = useState<string[]>([]);
  const [scannedTargets, setScannedTargets] = useState(0);
  const [selectedReadingsGreenhouse, setSelectedReadingsGreenhouse] =
    useState("");

  // Hydrate local form from server settings
  useEffect(() => {
    if (serverSettings) {
      setSettings((prev) => ({
        ...prev,
        mqttEnabled: serverSettings.mqttBroker ? true : prev.mqttEnabled,
        brokerUrl: (serverSettings.mqttBroker as string) || prev.brokerUrl,
        autoIrrigation:
          serverSettings.autoIrrigation != null
            ? String(serverSettings.autoIrrigation).toLowerCase() === "true"
            : prev.autoIrrigation,
        sensorInterval:
          parseSettingNumber(serverSettings.lecturaIntervalo, prev.sensorInterval),
        connectionTimeout:
          parseSettingNumber(serverSettings.connectionTimeout, prev.connectionTimeout),
        emailAlerts: parseSettingBool(serverSettings.notifEmail, prev.emailAlerts),
        criticalOnly: parseSettingBool(serverSettings.alertaCritica, prev.criticalOnly),
        alertEmail: (serverSettings.alertEmail as string) || prev.alertEmail,
        jwtDuration: parseSettingNumber(serverSettings.sesionTimeout, prev.jwtDuration * 60) / 60,
        refreshDuration: parseSettingNumber(serverSettings.refreshDuration, prev.refreshDuration),
        maxLoginAttempts: parseSettingNumber(serverSettings.maxLoginAttempts, prev.maxLoginAttempts),
        lockoutMinutes: parseSettingNumber(serverSettings.lockoutMinutes, prev.lockoutMinutes),
      }));
    }
  }, [serverSettings]);

  const ghList = greenhouses || [];
  const {
    data: sensorReadings,
    isLoading: loadingSensorReadings,
    mutate: mutateSensorReadings,
  } = useSWR<SensorReadingState[]>(
    selectedReadingsGreenhouse
      ? `/api/sensors?greenhouse=${selectedReadingsGreenhouse}`
      : null,
    fetcher,
    { refreshInterval: settings.sensorInterval * 1000 },
  );

  useEffect(() => {
    if (!selectedReadingsGreenhouse && greenhouses?.[0]?.id) {
      setSelectedReadingsGreenhouse(greenhouses[0].id);
    }
  }, [greenhouses, selectedReadingsGreenhouse]);

  const update = useCallback(
    <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  async function handleSaveAll() {
    setSaving(true);
    try {
      await api.updateSettings({
        mqttBroker: settings.brokerUrl,
        mqttPort: 1883,
        mqttTopic: settings.topicBase,
        lecturaIntervalo: settings.sensorInterval,
        connectionTimeout: settings.connectionTimeout,
        autoIrrigation: settings.autoIrrigation,
        notifEmail: settings.emailAlerts,
        alertaCritica: settings.criticalOnly,
        alertEmail: settings.alertEmail,
        sesionTimeout: settings.jwtDuration * 60,
        refreshDuration: settings.refreshDuration,
        maxLoginAttempts: settings.maxLoginAttempts,
        lockoutMinutes: settings.lockoutMinutes,
      });
      mutateSettings();
      toast.success("Configuracion guardada", {
        description: "Todos los parametros han sido actualizados correctamente",
      });
    } catch (err) {
      toast.error("Error al guardar", {
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleRestore() {
    setSettings({ ...defaultSettings });
    toast.info("Configuracion restaurada", {
      description: "Se han restaurado los valores predeterminados del sistema",
    });
  }

  async function handleSaveSection(section: string) {
    setSavingSection(section);
    try {
      await api.updateSettings({
        mqttBroker: settings.brokerUrl,
        mqttTopic: settings.topicBase,
        lecturaIntervalo: settings.sensorInterval,
        connectionTimeout: settings.connectionTimeout,
        autoIrrigation: settings.autoIrrigation,
        notifEmail: settings.emailAlerts,
        alertaCritica: settings.criticalOnly,
        alertEmail: settings.alertEmail,
        sesionTimeout: settings.jwtDuration * 60,
        refreshDuration: settings.refreshDuration,
        maxLoginAttempts: settings.maxLoginAttempts,
        lockoutMinutes: settings.lockoutMinutes,
      });
      mutateSettings();
      toast.success(`Seccion "${section}" guardada`, {
        description: "Los cambios han sido aplicados",
      });
    } catch (err) {
      toast.error("Error al guardar", {
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setSavingSection(null);
    }
  }

  function isDeviceOnline(device: DeviceState) {
    if (!device.ultimoReporte) return false;
    const lastReport = new Date(device.ultimoReporte);
    if (Number.isNaN(lastReport.getTime())) return false;
    return Date.now() - lastReport.getTime() <= settings.sensorInterval * 4000;
  }

  async function handlePingDevice(device: DeviceState) {
    await mutateDevices();

    if (isDeviceOnline(device)) {
      toast.success(`${device.nombre} reporta correctamente`, {
        description: device.ipLocal
          ? `Ultima IP registrada: ${device.ipLocal}`
          : "El dispositivo tiene reportes recientes",
      });
      return;
    }

    toast.error(`${device.nombre} sin reportes recientes`, {
      description: device.ultimoReporte
        ? `Ultimo reporte: ${new Date(device.ultimoReporte).toLocaleString()}`
        : "Aun no se ha recibido ninguna lectura de este dispositivo",
    });
  }

  async function handleDiscoverEsp32() {
    setDiscovering(true);
    try {
      const result = (await api.discoverDevices()) as {
        networks?: string[];
        scannedTargets?: number;
        discovered?: DiscoveredDevice[];
      };

      const discovered = result.discovered || [];
      setScannedNetworks(result.networks || []);
      setScannedTargets(result.scannedTargets || 0);
      setDiscoveredDevices(discovered);

      if (discovered.length === 0) {
        toast.info("Escaneo completado", {
          description: "No se detectaron ESP32 accesibles en la red local.",
        });
        return;
      }

      toast.success("ESP32 detectados", {
        description: `${discovered.length} dispositivo(s) encontrado(s).`,
      });
    } catch (err) {
      toast.error("Error al buscar ESP32", {
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setDiscovering(false);
    }
  }

  function getReadingStatus(sensor: SensorReadingState) {
    if (sensor.estado === "error") return "error";
    if (sensor.ultimaLectura == null || sensor.history?.length === 0) {
      return "sin_lectura";
    }
    if (sensor.umbralMin != null && sensor.ultimaLectura < sensor.umbralMin) {
      return "bajo";
    }
    if (sensor.umbralMax != null && sensor.ultimaLectura > sensor.umbralMax) {
      return "alto";
    }
    return "normal";
  }

  function getReadingStatusStyles(status: string) {
    switch (status) {
      case "normal":
        return {
          dot: "bg-emerald-500",
          label: "Normal",
          text: "text-emerald-500",
        };
      case "bajo":
        return { dot: "bg-amber-500", label: "Bajo", text: "text-amber-500" };
      case "alto":
        return { dot: "bg-red-500", label: "Alto", text: "text-red-500" };
      case "error":
        return { dot: "bg-red-500", label: "Error", text: "text-red-500" };
      default:
        return {
          dot: "bg-muted-foreground",
          label: "Sin lectura",
          text: "text-muted-foreground",
        };
    }
  }

  function formatReadingDate(timestamp?: string) {
    if (!timestamp) return "Sin reporte";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Fecha no valida";
    return date.toLocaleString();
  }

  const deviceList = iotDevices || [];
  const readingList = sensorReadings || [];
  const exampleBaseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://tu-dominio";
  const examplePayload = `{
  "codigoDispositivo": "ESP32-INV-A-01",
  "tipo": "temperatura",
  "valor": 27.4,
  "unidad": "C"
}`;
  const exampleCurl = `curl -X POST "${exampleBaseUrl}/api/iot/readings" \\
  -H "Content-Type: application/json" \\
  -H "x-iot-key: TU_IOT_API_KEY" \\
  -d '${examplePayload}'`;

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
                <CardTitle className="text-sm text-foreground">
                  Invernaderos Registrados
                </CardTitle>
                <CardDescription>
                  Listado de invernaderos en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {ghList.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {inv.nombre}
                      </p>
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
                <CardTitle className="text-sm text-foreground">
                  Riego Automatico
                </CardTitle>
                <CardDescription>Parametros globales de riego</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">
                      Riego Automatico Global
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Activar riego automatico basado en umbrales
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoIrrigation}
                    onCheckedChange={(v) => {
                      update("autoIrrigation", v);
                      toast(
                        v
                          ? "Riego automatico activado"
                          : "Riego automatico desactivado",
                      );
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Duracion Maxima de Riego (min)</Label>
                  <Input
                    type="number"
                    value={settings.maxDuration}
                    onChange={(e) =>
                      update("maxDuration", Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Volumen Maximo por Sesion (L)</Label>
                  <Input
                    type="number"
                    value={settings.maxVolume}
                    onChange={(e) =>
                      update("maxVolume", Number(e.target.value))
                    }
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
                <CardTitle className="text-sm text-foreground">
                  Configuracion MQTT
                </CardTitle>
                <CardDescription>
                  Parametros de comunicacion con dispositivos IoT
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Broker MQTT</p>
                    <p className="text-xs text-muted-foreground">
                      Conexion al broker de mensajes
                    </p>
                  </div>
                  <Switch
                    checked={settings.mqttEnabled}
                    onCheckedChange={(v) => {
                      update("mqttEnabled", v);
                      toast(
                        v
                          ? "Broker MQTT habilitado"
                          : "Broker MQTT deshabilitado",
                      );
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>URL del Broker</Label>
                  <Input
                    value={settings.brokerUrl}
                    onChange={(e) => update("brokerUrl", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Topic Base</Label>
                  <Input
                    value={settings.topicBase}
                    onChange={(e) => update("topicBase", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Cliente ID</Label>
                  <Input
                    value={settings.clientId}
                    onChange={(e) => update("clientId", e.target.value)}
                    className="font-mono text-xs"
                  />
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
                <CardTitle className="text-sm text-foreground">
                  Intervalo de Lectura
                </CardTitle>
                <CardDescription>
                  Frecuencia de adquisicion de datos
                </CardDescription>
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
                    onChange={(e) =>
                      update("connectionTimeout", Number(e.target.value))
                    }
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                      <Search className="h-4 w-4" />
                      Buscar ESP32 en la red
                    </CardTitle>
                    <CardDescription>
                      Escanea la red local del servidor y muestra modulos ESP32
                      accesibles por HTTP
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleDiscoverEsp32}
                    disabled={discovering}
                  >
                    {discovering ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Buscar ESP32
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  {discovering
                    ? "Escaneando IPs locales. Mantenga el ESP32 encendido y conectado al mismo Wi-Fi."
                    : scannedNetworks.length > 0
                      ? `Subredes revisadas: ${scannedNetworks.join(", ")}${
                          scannedTargets ? ` - objetivos: ${scannedTargets}` : ""
                        }`
                      : "Ejecute una busqueda para detectar ESP32 dentro de la red actual."}
                </div>

                {discoveredDevices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
                    <Cpu className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      Sin ESP32 detectados
                    </p>
                    <p className="max-w-xl text-xs text-muted-foreground">
                      Verifique que el ESP32 responda por HTTP, este en el
                      mismo Wi-Fi que el servidor y que su pagina devuelva
                      texto con "ESP32", "Espressif" o "GreenSense".
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {discoveredDevices.map((device) => (
                      <div
                        key={`${device.ip}:${device.port}`}
                        className="rounded-lg border p-3"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {device.deviceName ||
                                device.chipModel ||
                                "ESP32 detectado"}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {device.url}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              device.confidence === "high"
                                ? "bg-emerald-500/15 text-emerald-500"
                                : "bg-amber-500/15 text-amber-500"
                            }`}
                          >
                            {device.confidence === "high" ? "Alta" : "Media"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <span>
                            Codigo: {device.deviceCode || "no informado"}
                          </span>
                          <span>
                            Firmware: {device.firmwareVersion || "no informado"}
                          </span>
                          <span>IP: {device.ip}</span>
                          <span>Puerto: {device.port}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                      <Activity className="h-4 w-4" />
                      Lecturas de Sensores
                    </CardTitle>
                    <CardDescription>
                      Valores reales recibidos desde los sensores del
                      invernadero
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedReadingsGreenhouse}
                      onValueChange={setSelectedReadingsGreenhouse}
                    >
                      <SelectTrigger className="h-9 w-[220px]">
                        <SelectValue placeholder="Seleccione invernadero" />
                      </SelectTrigger>
                      <SelectContent>
                        {ghList.map((greenhouse) => (
                          <SelectItem key={greenhouse.id} value={greenhouse.id}>
                            {greenhouse.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => mutateSensorReadings()}
                      disabled={!selectedReadingsGreenhouse}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span className="ml-1.5 text-xs">Actualizar</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSensorReadings ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando lecturas de sensores...
                  </div>
                ) : readingList.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {readingList.map((sensor) => {
                      const status = getReadingStatus(sensor);
                      const statusStyles = getReadingStatusStyles(status);
                      const unit = sensor.unidad || "";
                      const hasReading = status !== "sin_lectura";
                      const hasRange =
                        sensor.umbralMin != null && sensor.umbralMax != null;

                      return (
                        <div key={sensor.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {sensor.nombre || sensor.tipo}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sensor.tipo}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${statusStyles.dot}`}
                              />
                              <span
                                className={`text-xs font-medium ${statusStyles.text}`}
                              >
                                {statusStyles.label}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4">
                            <p className="text-xs text-muted-foreground">
                              Lectura actual
                            </p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-semibold text-foreground">
                                {hasReading && sensor.ultimaLectura != null
                                  ? sensor.ultimaLectura.toFixed(1)
                                  : "--"}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {unit}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                            <span>
                              {hasRange
                                ? `Rango esperado: ${sensor.umbralMin} - ${sensor.umbralMax} ${unit}`
                                : "Sin rango configurado"}
                            </span>
                            <span>
                              Ultimo reporte:{" "}
                              {hasReading
                                ? formatReadingDate(sensor.ultimoReporte)
                                : "Sin reporte"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No hay lecturas registradas para este invernadero.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm text-foreground">
                  Dispositivos ESP32
                </CardTitle>
                <CardDescription>
                  Estado real de dispositivos registrados en la base de datos
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {deviceList.length > 0 ? (
                  deviceList.map((device) => {
                    const online = isDeviceOnline(device);

                    return (
                      <div
                        key={device.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`}
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {device.nombre}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {device.codigoDispositivo || `ID ${device.id}`} -{" "}
                              {device.tipo || "gateway"} -{" "}
                              {device.ipLocal || "sin IP"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {device.nombreInvernadero || "Sin invernadero"} -{" "}
                              {device.firmwareVersion || "sin firmware"} -{" "}
                              {device.ultimoReporte
                                ? `ultimo reporte ${new Date(device.ultimoReporte).toLocaleString()}`
                                : "sin lecturas reportadas"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {online ? "En linea" : "Sin reporte"}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePingDevice(device)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span className="ml-1.5 text-xs">Verificar</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No hay dispositivos IoT registrados. Cree un dispositivo y
                    luego asocie sensores a ese dispositivo.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                  <PlugZap className="h-4 w-4" />
                  Integracion de Sensores
                </CardTitle>
                <CardDescription>
                  Contrato tecnico para conectar ESP32, Arduino o gateways
                  externos
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-sm font-medium text-foreground">
                      1. Registrar hardware
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cree un dispositivo en el modulo de dispositivos y use su
                      codigo fisico unico.
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-sm font-medium text-foreground">
                      2. Asociar sensor
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cree el sensor y seleccione el dispositivo para que el
                      backend pueda enrutar la lectura.
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-sm font-medium text-foreground">
                      3. Enviar lecturas
                    </p>
                    <p className="text-xs text-muted-foreground">
                      El microcontrolador debe hacer `POST` a
                      `/api/iot/readings` con `x-iot-key`.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      Endpoint
                    </p>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {exampleBaseUrl}/api/iot/readings
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Headers aceptados: `x-iot-key`, `x-api-key` o
                    `Authorization: Bearer ...`
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Variables requeridas en servidor: `IOT_API_KEY` y una URL
                    publica accesible desde el dispositivo.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-medium text-foreground">
                      Payload ejemplo
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      <code>{examplePayload}</code>
                    </pre>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-medium text-foreground">
                      Prueba rapida
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      <code>{exampleCurl}</code>
                    </pre>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                  La forma recomendada es enviar `codigoDispositivo + tipo`. El
                  backend buscara el sensor asociado, guardara la lectura en
                  `LecturasSensores` y actualizara `ultimo_reporte` del
                  dispositivo. La fecha y hora se asignan automaticamente al
                  momento de recibir la lectura.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ALERTAS TAB */}
        <TabsContent value="alertas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-foreground">
                Configuracion de Notificaciones
              </CardTitle>
              <CardDescription>
                Gestione como y cuando recibe alertas
              </CardDescription>
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
                    update("emailAlerts", v);
                    toast(
                      v
                        ? "Alertas por email activadas"
                        : "Alertas por email desactivadas",
                    );
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">
                    Solo Alertas Criticas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Notificar solo cuando haya alertas criticas
                  </p>
                </div>
                <Switch
                  checked={settings.criticalOnly}
                  onCheckedChange={(v) => {
                    update("criticalOnly", v);
                    toast(
                      v
                        ? "Solo alertas criticas"
                        : "Todas las alertas habilitadas",
                    );
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email de Notificaciones</Label>
                <Input
                  type="email"
                  value={settings.alertEmail}
                  onChange={(e) => update("alertEmail", e.target.value)}
                />
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
                <CardTitle className="text-sm text-foreground">
                  Autenticacion
                </CardTitle>
                <CardDescription>
                  Parametros de seguridad de acceso
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Duracion del Token JWT (horas)</Label>
                  <Input
                    type="number"
                    value={settings.jwtDuration}
                    onChange={(e) =>
                      update("jwtDuration", Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Duracion Refresh Token (dias)</Label>
                  <Input
                    type="number"
                    value={settings.refreshDuration}
                    onChange={(e) =>
                      update("refreshDuration", Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Intentos de Login antes de Bloqueo</Label>
                  <Input
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) =>
                      update("maxLoginAttempts", Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Tiempo de Bloqueo (minutos)</Label>
                  <Input
                    type="number"
                    value={settings.lockoutMinutes}
                    onChange={(e) =>
                      update("lockoutMinutes", Number(e.target.value))
                    }
                  />
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
                <CardTitle className="text-sm text-foreground">
                  Base de Datos
                </CardTitle>
                <CardDescription>Conexion y mantenimiento</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        SQL Server
                      </p>
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
                      <p className="text-sm font-medium text-foreground">
                        API Server
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        api.greensense.io:3000
                      </p>
                    </div>
                  </div>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Retencion de Datos (dias)</Label>
                  <Input
                    type="number"
                    value={settings.dataRetention}
                    onChange={(e) =>
                      update("dataRetention", Number(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Tiempo que se mantienen las lecturas de sensores en la base
                    de datos
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-foreground">
                  CORS y Seguridad API
                </CardTitle>
                <CardDescription>
                  Configuracion de origenes permitidos
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Origenes Permitidos</Label>
                  <Input
                    value={settings.allowedOrigins}
                    onChange={(e) => update("allowedOrigins", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Rate Limit (peticiones/min)</Label>
                  <Input
                    type="number"
                    value={settings.rateLimit}
                    onChange={(e) =>
                      update("rateLimit", Number(e.target.value))
                    }
                  />
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
  );
}
