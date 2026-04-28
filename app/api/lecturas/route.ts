import { NextResponse } from "next/server"
import { isValidIotKey } from "@/lib/iot-auth"
import {
  getIotReadingErrorResponse,
  normalizeIotReadingsPayload,
  processIotReading,
} from "@/lib/iot-readings"

export async function GET(req: Request) {
  const url = new URL(req.url)

  return NextResponse.json({
    endpoint: `${url.origin}/api/lecturas`,
    aliasOf: `${url.origin}/api/iot/readings`,
    method: "POST",
    authHeaders: ["x-iot-key", "x-api-key", "authorization"],
    acceptedIdentifiers: {
      sensorId: "Identificador interno del sensor",
      "codigoDispositivo + tipo": "Alternativa recomendada para firmware",
      "deviceId + tipo": "Compatibilidad temporal con integraciones antiguas",
    },
    requiredFields: ["valor"],
    optionalFields: ["sensorId", "codigoDispositivo", "deviceId", "tipo", "unidad", "timestamp"],
  })
}

export async function POST(req: Request) {
  try {
    if (!isValidIotKey(req)) {
      return NextResponse.json({ error: "No autorizado para IoT" }, { status: 401 })
    }

    const body = await req.json()
    const readings = normalizeIotReadingsPayload(body)

    if (readings.length === 0) {
      return NextResponse.json({ error: "Payload de lecturas vacio o invalido" }, { status: 400 })
    }

    const results = []
    for (const reading of readings) {
      results.push(await processIotReading(reading, "http"))
    }

    return NextResponse.json(readings.length === 1 ? results[0] : { ok: true, results })
  } catch (err) {
    console.error("[Lecturas POST]", err)
    const response = getIotReadingErrorResponse(err)
    return NextResponse.json(response.body, { status: response.status })
  }
}
