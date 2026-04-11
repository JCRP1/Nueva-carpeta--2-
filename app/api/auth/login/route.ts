import { NextResponse } from "next/server"
import { compareSync } from "bcryptjs"
import { getUserByEmail, createSession, sanitizeUser } from "@/lib/auth"
import { registrarBitacora } from "@/lib/bitacora"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email y contrasena requeridos" }, { status: 400 })
    }

    const user = await getUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 })
    }

    if (!compareSync(password, user.passwordHash)) {
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 })
    }

    await createSession(user)
    await registrarBitacora({
      req,
      descripcion: `Inicio de sesion de ${user.correo}`,
      modulo: "autenticacion",
      entidad: "Usuarios",
      entidadId: user.id_usuario,
      accion: "LOGIN",
      severidad: "info",
      origen: "web",
      valorNuevo: { correo: user.correo, rol: user.rol },
    })
    return NextResponse.json({ user: sanitizeUser(user) })
  } catch (err) {
    console.error("[GreenSense] Login error:", err)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
