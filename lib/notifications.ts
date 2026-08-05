import nodemailer from "nodemailer"
import { query } from "@/lib/db"

type AlertNotification = {
  empresaId: number
  alertId?: number | null
  title: string
  message: string
  level: "critico" | "advertencia"
  url?: string
}

function parseBool(value: unknown, fallback = false) {
  if (value == null) return fallback
  return ["true", "1", "si", "sí", "yes", "on"].includes(String(value).trim().toLowerCase())
}

async function getNotificationSettings(empresaId: number) {
  const rows = await query<Array<{ parametro: string; valor: string }>>(
    `SELECT parametro, valor
     FROM ConfiguracionesSistema
     WHERE id_empresa = @empresaId
       AND parametro IN ('notifEmail', 'alertaCritica', 'alertEmail')`,
    { empresaId }
  )
  const settings = new Map(rows.map((row) => [row.parametro, row.valor]))
  return {
    email: parseBool(settings.get("notifEmail"), false),
    criticalOnly: parseBool(settings.get("alertaCritica"), false),
    alertEmail: settings.get("alertEmail")?.trim() || "",
  }
}

async function sendAlertEmail(notification: AlertNotification, recipient: string) {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASSWORD?.trim()
  if (!host || !user || !pass) throw new Error("SMTP_NOT_CONFIGURED")

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  const from = process.env.SMTP_FROM?.trim() || user
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
  const alertUrl = `${appUrl}${notification.url || "/"}`

  await transporter.sendMail({
    from,
    to: recipient,
    subject: `[${notification.level === "critico" ? "CRÍTICA" : "ALERTA"}] ${notification.title}`,
    text: `${notification.message}\n\nVer alertas: ${alertUrl}`,
    html: `<div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
      <h2 style="color:${notification.level === "critico" ? "#b91c1c" : "#b45309"}">${notification.title}</h2>
      <p>${notification.message}</p>
      <p><a href="${alertUrl}" style="display:inline-block;padding:10px 16px;background:#1a7a45;color:#fff;text-decoration:none;border-radius:8px">Ver alertas</a></p>
    </div>`,
  })
}

export async function dispatchAlertNotification(notification: AlertNotification) {
  try {
    const settings = await getNotificationSettings(notification.empresaId)
    if (settings.criticalOnly && notification.level !== "critico") return

    const jobs: Promise<unknown>[] = []
    if (settings.email && settings.alertEmail) {
      jobs.push(sendAlertEmail(notification, settings.alertEmail))
    }
    const results = await Promise.allSettled(jobs)
    results.forEach((result) => {
      if (result.status === "rejected") console.error("[GreenSense] Error de notificación:", result.reason)
    })
  } catch (error) {
    // Una falla del proveedor nunca debe impedir guardar la lectura IoT.
    console.error("[GreenSense] No se pudo despachar la notificación:", error)
  }
}
