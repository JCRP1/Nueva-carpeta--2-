import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getMqttStatus } from "@/lib/mqtt-client"

export async function GET() {
  try {
    await requireAuth()
    const status = await getMqttStatus()
    return NextResponse.json(status)
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    console.error("[MQTT Status]", error)
    return NextResponse.json({ error: "No se pudo obtener el estado MQTT" }, { status: 500 })
  }
}
