import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const roles = await query(`
      SELECT RolID, Nombre 
      FROM Roles 
      WHERE Activo = 1
    `)

    return NextResponse.json(roles)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Error al obtener roles" }, { status: 500 })
  }
}