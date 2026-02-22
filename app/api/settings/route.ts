import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { query, execute } from "@/lib/db"

export async function GET() {
  try {
    const session = await requireAdmin()

    const rows = (await query(
      `SELECT parametro, valor FROM ConfiguracionesSistema
       WHERE id_empresa = @empresaId`,
      { empresaId: session.empresaId }
    )) as Record<string, unknown>[]

    // Convert key-value rows into a single object
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.parametro as string] = row.valor as string
    }

    return NextResponse.json(settings)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin()
    const updates = await req.json()

    // Upsert each key-value pair into ConfiguracionesSistema
    for (const [parametro, valor] of Object.entries(updates)) {
      const existing = (await query(
        `SELECT id_config FROM ConfiguracionesSistema
         WHERE id_empresa = @empresaId AND parametro = @parametro`,
        { empresaId: session.empresaId, parametro }
      )) as Record<string, unknown>[]

      if (existing.length > 0) {
        await execute(
          `UPDATE ConfiguracionesSistema
           SET valor = @valor, fecha_modificacion = GETDATE()
           WHERE id_empresa = @empresaId AND parametro = @parametro`,
          { empresaId: session.empresaId, parametro, valor: String(valor) }
        )
      } else {
        await execute(
          `INSERT INTO ConfiguracionesSistema (id_empresa, parametro, valor, creado_por, fecha_creacion)
           VALUES (@empresaId, @parametro, @valor, @userId, GETDATE())`,
          { empresaId: session.empresaId, parametro, valor: String(valor), userId: session.userId }
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
}
