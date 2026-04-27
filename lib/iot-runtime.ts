import { ensureMqttClientStarted } from "@/lib/mqtt-client"

const globalForIotRuntime = globalThis as typeof globalThis & {
  __greensenseIotRuntimeStarted?: boolean
}

export async function ensureIotRuntimeStarted() {
  if (globalForIotRuntime.__greensenseIotRuntimeStarted) return

  globalForIotRuntime.__greensenseIotRuntimeStarted = true

  try {
    await ensureMqttClientStarted()
  } catch (error) {
    console.error("[IoT Runtime]", error)
  }
}
