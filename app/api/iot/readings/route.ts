import { NextResponse } from "next/server"
import { isValidIotKey } from "@/lib/iot-auth"
import { getIotReadingErrorResponse, processIotReading } from "@/lib/iot-readings"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const baseUrl = url.origin

  return NextResponse.json({
    endpoint: `${baseUrl}/api/iot/readings`,
    method: "POST",
    authHeaders: ["x-iot-key", "x-api-key", "authorization"],
    acceptedIdentifiers: {
      sensorId: "Identificador interno del sensor",
      "codigoDispositivo + tipo": "Alternativa recomendada para firmware cuando se envia desde un equipo fisico",
      "deviceId + tipo": "Compatibilidad temporal con integraciones antiguas",
    },
    requiredFields: ["valor"],
    optionalFields: ["sensorId", "codigoDispositivo", "deviceId", "tipo", "unidad"],
    timestamp: "El servidor asigna la fecha y hora actual al registrar la lectura",
    example: {
      codigoDispositivo: "ESP32-INV-A-01",
      tipo: "temperatura",
      valor: 27.4,
      unidad: "C",
    },
  })
}

export async function POST(req: Request) {
  try {
    if (!isValidIotKey(req)) {
      return NextResponse.json({ error: "No autorizado para IoT" }, { status: 401 })
    }
    const body = await req.json()
    const result = await processIotReading(body, "http")
    return NextResponse.json(result)
  } catch (err) {
    console.error("[IoT Readings POST]", err)
    const response = getIotReadingErrorResponse(err)
    return NextResponse.json(response.body, { status: response.status })
  }
}
