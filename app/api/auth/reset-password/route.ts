import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { registrarBitacora } from "@/lib/bitacora"
import { consumePasswordResetToken, findValidPasswordResetToken } from "@/lib/password-reset"

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    const resetToken = await findValidPasswordResetToken(token)

    if (!resetToken) {
      return NextResponse.json({ valid: false })
    }

    return NextResponse.json({
      valid: true,
      email: resetToken.correo,
      nombre: resetToken.nombre,
    })
  } catch (error: any) {
    console.error("[Reset Password GET]", error)

    if (error?.number === 208) {
      return NextResponse.json(
        { error: "Falta la tabla PasswordResetTokens. Ejecute la migracion correspondiente." },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "No se pudo validar el enlace" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token y contrasena requeridos" }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres" },
        { status: 400 }
      )
    }

    const consumed = await consumePasswordResetToken(String(token), hashSync(String(password), 10))

    if (!consumed) {
      return NextResponse.json({ error: "El enlace no es valido o ya expiro" }, { status: 400 })
    }

    await registrarBitacora({
      req,
      descripcion: `El usuario ${consumed.correo} restablecio su contrasena`,
      modulo: "usuarios",
      entidad: "Usuarios",
      entidadId: consumed.id_usuario,
      accion: "PASSWORD_RESET_COMPLETE",
      origen: "web",
      valorNuevo: { correo: consumed.correo, password: "[PROTEGIDA]" },
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[Reset Password POST]", error)

    if (error?.number === 208) {
      return NextResponse.json(
        { error: "Falta la tabla PasswordResetTokens. Ejecute la migracion correspondiente." },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "No se pudo actualizar la contrasena" }, { status: 500 })
  }
}
