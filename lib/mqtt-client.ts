import { query } from "@/lib/db"

type MqttClientModule = typeof import("mqtt")
type MqttClientInstance = import("mqtt").MqttClient

interface MqttRuntimeState {
  started: boolean
  enabled: boolean
  connected: boolean
  connecting: boolean
  brokerUrl: string | null
  topic: string | null
  clientId: string | null
  lastError: string | null
  lastMessageAt: string | null
}

const globalForMqtt = globalThis as typeof globalThis & {
  __greensenseMqttState?: MqttRuntimeState
  __greensenseMqttClient?: MqttClientInstance | null
  __greensenseMqttStartPromise?: Promise<MqttRuntimeState> | null
}

function getState(): MqttRuntimeState {
  if (!globalForMqtt.__greensenseMqttState) {
    globalForMqtt.__greensenseMqttState = {
      started: false,
      enabled: false,
      connected: false,
      connecting: false,
      brokerUrl: null,
      topic: null,
      clientId: null,
      lastError: null,
      lastMessageAt: null,
    }
  }
  return globalForMqtt.__greensenseMqttState
}

async function loadMqttSettings() {
  const rows = (await query(
    `SELECT parametro, valor
     FROM ConfiguracionesSistema
     WHERE parametro IN ('mqttBroker', 'mqttTopic', 'mqttClientId', 'mqttUsername', 'mqttPassword', 'mqttEnabled')`
  )) as Array<{ parametro: string; valor: string }>

  const mapped = Object.fromEntries(rows.map((row) => [row.parametro, row.valor]))
  const brokerUrl = mapped.mqttBroker?.trim() || process.env.MQTT_BROKER_URL?.trim() || ""
  const topicBase = mapped.mqttTopic?.trim() || process.env.MQTT_TOPIC_BASE?.trim() || "greensense/#"
  const clientId = mapped.mqttClientId?.trim() || process.env.MQTT_CLIENT_ID?.trim() || `greensense-server-${process.pid}`
  const username = mapped.mqttUsername?.trim() || process.env.MQTT_USERNAME?.trim() || ""
  const password = mapped.mqttPassword?.trim() || process.env.MQTT_PASSWORD?.trim() || ""
  const enabledRaw = mapped.mqttEnabled?.trim() || process.env.MQTT_ENABLED?.trim() || ""
  const enabled = enabledRaw ? enabledRaw !== "false" : Boolean(brokerUrl)

  return {
    enabled,
    brokerUrl,
    topic: topicBase.endsWith("#") ? topicBase : `${topicBase.replace(/\/?$/, "/")}#`,
    clientId,
    username,
    password,
  }
}

async function importMqttModule(): Promise<MqttClientModule> {
  return import("mqtt")
}

async function importIotReadingsModule() {
  return import("@/lib/iot-readings")
}

function attachClientHandlers(client: MqttClientInstance, state: MqttRuntimeState) {
  client.on("connect", () => {
    state.connected = true
    state.connecting = false
    state.lastError = null
    if (state.topic) {
      client.subscribe(state.topic, (error) => {
        if (error) {
          state.lastError = error.message
        }
      })
    }
  })

  client.on("reconnect", () => {
    state.connecting = true
    state.connected = false
  })

  client.on("close", () => {
    state.connected = false
  })

  client.on("offline", () => {
    state.connected = false
  })

  client.on("error", (error) => {
    state.lastError = error.message
    state.connected = false
  })

  client.on("message", async (_topic, payload) => {
    try {
      const { normalizeIotReadingsPayload, processIotReading } = await importIotReadingsModule()
      const parsed = JSON.parse(payload.toString("utf8")) as unknown
      const readings = normalizeIotReadingsPayload(parsed)

      for (const reading of readings) {
        await processIotReading(reading, "mqtt")
      }

      state.lastMessageAt = new Date().toISOString()
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : "MQTT_MESSAGE_ERROR"
      console.error("[MQTT Message]", error)
    }
  })
}

function reattachClientHandlers(client: MqttClientInstance, state: MqttRuntimeState) {
  client.removeAllListeners("connect")
  client.removeAllListeners("reconnect")
  client.removeAllListeners("close")
  client.removeAllListeners("offline")
  client.removeAllListeners("error")
  client.removeAllListeners("message")
  attachClientHandlers(client, state)

  if (client.connected) {
    state.connected = true
    state.connecting = false
    state.lastError = null
    if (state.topic) {
      client.subscribe(state.topic, (error) => {
        if (error) {
          state.lastError = error.message
        }
      })
    }
  }
}

export async function ensureMqttClientStarted() {
  const state = getState()
  if (globalForMqtt.__greensenseMqttStartPromise) {
    return globalForMqtt.__greensenseMqttStartPromise
  }

  globalForMqtt.__greensenseMqttStartPromise = (async () => {
    const settings = await loadMqttSettings()

    state.enabled = settings.enabled
    state.brokerUrl = settings.brokerUrl || null
    state.topic = settings.topic || null
    state.clientId = settings.clientId || null

    if (!settings.enabled || !settings.brokerUrl) {
      state.started = true
      state.connecting = false
      state.connected = false
      return state
    }

    if (globalForMqtt.__greensenseMqttClient) {
      reattachClientHandlers(globalForMqtt.__greensenseMqttClient, state)
      state.started = true
      return state
    }

    state.connecting = true
    const mqtt = await importMqttModule()
    const client = mqtt.connect(settings.brokerUrl, {
      clientId: settings.clientId,
      username: settings.username || undefined,
      password: settings.password || undefined,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    })

    globalForMqtt.__greensenseMqttClient = client
    attachClientHandlers(client, state)
    state.started = true
    return state
  })()

  try {
    return await globalForMqtt.__greensenseMqttStartPromise
  } finally {
    globalForMqtt.__greensenseMqttStartPromise = null
  }
}

export async function getMqttStatus() {
  const state = await ensureMqttClientStarted()
  return { ...state }
}
