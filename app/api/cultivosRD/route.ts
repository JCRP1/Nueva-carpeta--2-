import { NextResponse } from "next/server"
import { cultivosRDData, getAllCultivos } from "@/lib/cultivos-rd-data"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const categoria = searchParams.get("categoria")
  const nombre = searchParams.get("nombre")

  if (nombre) {
    const cultivo = getAllCultivos().find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
    if (!cultivo) return NextResponse.json({ error: "Cultivo no encontrado" }, { status: 404 })
    return NextResponse.json(cultivo)
  }

  if (categoria) {
    const filtered = cultivosRDData.find(c => c.categoria.toLowerCase() === categoria.toLowerCase())
    if (!filtered) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 })
    return NextResponse.json(filtered)
  }

  return NextResponse.json(cultivosRDData)
}
