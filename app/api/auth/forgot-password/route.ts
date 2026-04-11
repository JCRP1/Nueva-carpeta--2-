import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { registrarBitacora } from "@/lib/bitacora"
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/password-reset"

function getRequestOrigin(req: Request) {
  const requestUrl = new URL(req.url)
  const forwardedProto = req.headers.get("x-forwarded-proto")
  const forwardedHost = req.headers.get("x-forwarded-host")

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return requestUrl.origin
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Correo requerido" }, { status: 400 })
    }

    const session = await getSession()
    const resetData = await createPasswordResetToken(String(email).trim())

    if (resetData) {
      await sendPasswordResetEmail({
        email: resetData.user.correo,
        token: resetData.rawToken,
        userName: resetData.user.nombre,
        origin: getRequestOrigin(req),
      })

      await registrarBitacora({
        session,
        req,
        descripcion: `Se solicito restablecimiento de contrasena para ${resetData.user.correo}`,
        modulo: "usuarios",
        entidad: "Usuarios",
        entidadId: resetData.user.id_usuario,
        accion: "PASSWORD_RESET_REQUEST",
        origen: session ? "web" : "api",
        valorNuevo: { correo: resetData.user.correo },
      })
    }

    return NextResponse.json({
      ok: true,
      message: "Si el correo existe, se envio un enlace de recuperacion.",
    })
  } catch (error: any) {
    console.error("[Forgot Password]", error)

    if (error?.message === "SMTP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "El envio de correos no esta configurado en el servidor" },
        { status: 500 }
      )
    }

    if (error?.code === "EAUTH" || error?.responseCode === 535) {
      return NextResponse.json(
        {
          error: "No se pudo autenticar con el servidor de correo. Verifique SMTP_USER y SMTP_PASSWORD.",
        },
        { status: 500 }
      )
    }

    if (error?.code === "ECONNECTION" || error?.code === "ESOCKET") {
      return NextResponse.json(
        {
          error: "No se pudo conectar al servidor de correo. Verifique SMTP_HOST, SMTP_PORT y la red.",
        },
        { status: 500 }
      )
    }

    if (error?.number === 208) {
      return NextResponse.json(
        { error: "Falta la tabla PasswordResetTokens. Ejecute la migracion correspondiente." },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "No se pudo procesar la solicitud" }, { status: 500 })
  }
}
