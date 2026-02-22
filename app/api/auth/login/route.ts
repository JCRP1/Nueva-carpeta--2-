import { NextResponse } from "next/server"
import { compareSync } from "bcryptjs"
import { getUserByEmail, createSession, sanitizeUser } from "@/lib/auth"

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

    // Compare with bcrypt hash stored in contraseña column
    if (!compareSync(password, user.contraseña)) {
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 })
    }

    await createSession(user)
    return NextResponse.json({ user: sanitizeUser(user) })
  } catch (err) {
    console.error("[GreenSense] Login error:", err)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
