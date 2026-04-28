import { query } from "@/lib/db"

export interface SensorAlertSettings {
  onlyCritical: boolean
  sensorAlertsEnabled: boolean
}

function parseBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "si", "sí", "yes", "on"].includes(normalized)) return true
    if (["false", "0", "no", "off"].includes(normalized)) return false
  }
  return fallback
}

export async function getSensorAlertSettings(sensorId: number, empresaId: number | null) {
  const settings: SensorAlertSettings = {
    onlyCritical: false,
    sensorAlertsEnabled: true,
  }

  if (empresaId != null) {
    const rows = await query<Array<{ parametro: string; valor: string }>>(
      `SELECT parametro, valor
       FROM ConfiguracionesSistema
       WHERE id_empresa = @empresaId
         AND parametro IN ('alertaCritica', 'notifEmail', 'notifSms')`,
      { empresaId }
    )

    const byKey = new Map(rows.map((row) => [row.parametro, row.valor]))
    settings.onlyCritical = parseBool(byKey.get("alertaCritica"), false)
  }

  const commandRows = await query<Array<{ parametros: string; fechaEnvio: string }>>(
    `SELECT TOP 20 parametros, fecha_envio AS fechaEnvio
     FROM ComandosIoT
     WHERE comando = 'CONFIG_SENSOR'
     ORDER BY fecha_envio DESC`
  )

  for (const row of commandRows) {
    if (!row.parametros) continue

    try {
      const parsed = JSON.parse(row.parametros) as { sensorId?: number; enviarAlertas?: boolean }
      if (Number(parsed.sensorId) !== sensorId) continue
      settings.sensorAlertsEnabled = parsed.enviarAlertas !== false
      break
    } catch {
      continue
    }
  }

  return settings
}
