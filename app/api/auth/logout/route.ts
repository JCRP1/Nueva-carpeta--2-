import { NextResponse } from "next/server"
import { destroySession, getSession } from "@/lib/auth"
import { registrarBitacora } from "@/lib/bitacora"

export async function POST(req: Request) {
  const session = await getSession()
  if (session) {
    await registrarBitacora({
      session,
      req,
      descripcion: `Cierre de sesion de ${session.email}`,
      modulo: "autenticacion",
      entidad: "Usuarios",
      entidadId: session.userId,
      accion: "LOGOUT",
      severidad: "info",
      origen: "web",
    })
  }
  await destroySession()
  return NextResponse.json({ ok: true })
}
