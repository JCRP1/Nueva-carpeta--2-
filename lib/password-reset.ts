import { createHash, randomBytes } from "crypto"
import nodemailer from "nodemailer"
import { execute, query } from "@/lib/db"

const RESET_EXPIRATION_MINUTES = 60

interface PasswordResetTokenRow {
  id_token_reset: number
  id_usuario: number
  token_hash: string
  expira_en: string
  usado_en: string | null
  fecha_creacion: string
}

interface UserResetRow {
  id_usuario: number
  nombre: string
  correo: string
  activo?: boolean | null
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function getAppUrl(origin?: string) {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    origin ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

function getMailTransport() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASSWORD?.trim()

  if (!host || !user || !pass) {
    throw new Error("SMTP_NOT_CONFIGURED")
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  })
}

async function getUserByEmail(email: string) {
  const rows = await query<UserResetRow[]>(
    `SELECT TOP 1
       id_usuario,
       nombre,
       correo,
       activo
     FROM Usuarios
     WHERE correo = @email`,
    { email: email.trim() }
  )

  return rows[0]
}

export async function createPasswordResetToken(email: string) {
  const user = await getUserByEmail(email)

  if (!user || user.activo === false) {
    return null
  }

  await execute(
    `UPDATE PasswordResetTokens
     SET usado_en = ISNULL(usado_en, GETDATE())
     WHERE id_usuario = @userId
       AND usado_en IS NULL`,
    { userId: user.id_usuario }
  )

  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = hashToken(rawToken)

  await execute(
    `INSERT INTO PasswordResetTokens
      (id_usuario, token_hash, expira_en, fecha_creacion)
     VALUES
      (@userId, @tokenHash, DATEADD(MINUTE, @expiresInMinutes, GETDATE()), GETDATE())`,
    {
      userId: user.id_usuario,
      tokenHash,
      expiresInMinutes: RESET_EXPIRATION_MINUTES,
    }
  )

  return {
    user,
    rawToken,
    expiresInMinutes: RESET_EXPIRATION_MINUTES,
  }
}

export async function sendPasswordResetEmail(input: {
  email: string
  token: string
  userName: string
  origin?: string
}) {
  const transporter = getMailTransport()
  const appUrl = getAppUrl(input.origin)
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(input.token)}`
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "no-reply@greensense.local"

  await transporter.sendMail({
    from,
    to: input.email,
    subject: "Restablecer contrasena de GreenSense",
    text: [
      `Hola ${input.userName},`,
      "",
      "Recibimos una solicitud para restablecer tu contrasena en GreenSense.",
      `Usa este enlace dentro de los proximos ${RESET_EXPIRATION_MINUTES} minutos:`,
      resetUrl,
      "",
      "Si no solicitaste este cambio, ignora este mensaje.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 16px;">Restablecer contrasena</h2>
        <p>Hola ${input.userName},</p>
        <p>Recibimos una solicitud para restablecer tu contrasena en GreenSense.</p>
        <p>
          <a
            href="${resetUrl}"
            style="display: inline-block; padding: 12px 18px; background: #1a7a45; color: #ffffff; text-decoration: none; border-radius: 8px;"
          >
            Cambiar contrasena
          </a>
        </p>
        <p>Este enlace vence en ${RESET_EXPIRATION_MINUTES} minutos.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
        <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
      </div>
    `,
  })

  return resetUrl
}

export async function findValidPasswordResetToken(token: string) {
  const tokenHash = hashToken(token)

  const rows = await query<Array<PasswordResetTokenRow & UserResetRow>>(
    `SELECT TOP 1
       prt.id_token_reset,
       prt.id_usuario,
       prt.token_hash,
       prt.expira_en,
       prt.usado_en,
       prt.fecha_creacion,
       u.nombre,
       u.correo,
       u.activo
     FROM PasswordResetTokens prt
     INNER JOIN Usuarios u ON u.id_usuario = prt.id_usuario
     WHERE prt.token_hash = @tokenHash
       AND prt.usado_en IS NULL
       AND prt.expira_en >= GETDATE()
       AND ISNULL(u.activo, 1) = 1
     ORDER BY prt.id_token_reset DESC`,
    { tokenHash }
  )

  return rows[0] || null
}

export async function consumePasswordResetToken(token: string, passwordHash: string) {
  const resetToken = await findValidPasswordResetToken(token)

  if (!resetToken) {
    return null
  }

  await execute(
    `DECLARE @passwordColumn SYSNAME;
     DECLARE @sql NVARCHAR(MAX);
     DECLARE @legacyTable SYSNAME;
     DECLARE @legacySchema SYSNAME;
     DECLARE @legacyPasswordColumn SYSNAME;
     DECLARE @legacyIdColumn SYSNAME;
     DECLARE @legacyEmailColumn SYSNAME;
     DECLARE @legacyObjectId INT;

     SELECT TOP 1 @passwordColumn = name
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Usuarios')
       AND name LIKE 'contrase%';

     IF @passwordColumn IS NULL
     BEGIN
       THROW 50001, 'No se encontro la columna de contrasena en Usuarios.', 1;
     END

     SET @sql = N'UPDATE Usuarios SET ' + QUOTENAME(@passwordColumn) + N' = @passwordHash WHERE id_usuario = @userId';

     EXEC sp_executesql
       @sql,
       N'@passwordHash NVARCHAR(255), @userId INT',
       @passwordHash = @passwordHash,
       @userId = @userId;

     SELECT TOP 1
       @legacyTable = t.name,
       @legacySchema = s.name,
       @legacyObjectId = t.object_id
     FROM sys.tables t
     INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
     WHERE LOWER(t.name) = 'usuario';

     IF @legacyTable IS NOT NULL
     BEGIN
       SELECT TOP 1 @legacyPasswordColumn = c.name
       FROM sys.columns c
       WHERE c.object_id = @legacyObjectId
         AND c.name LIKE 'contrase%';

       SELECT TOP 1 @legacyIdColumn = c.name
       FROM sys.columns c
       WHERE c.object_id = @legacyObjectId
         AND LOWER(c.name) IN ('id_usuario', 'idusuario', 'usuario_id', 'id');

       SELECT TOP 1 @legacyEmailColumn = c.name
       FROM sys.columns c
       WHERE c.object_id = @legacyObjectId
         AND LOWER(c.name) IN ('correo', 'email', 'correo_electronico');

       IF @legacyPasswordColumn IS NOT NULL
       BEGIN
         SET @sql = N'UPDATE ' + QUOTENAME(@legacySchema) + N'.' + QUOTENAME(@legacyTable) + N' SET ' + QUOTENAME(@legacyPasswordColumn) + N' = @passwordHash';

         IF @legacyIdColumn IS NOT NULL
         BEGIN
           SET @sql = @sql + N' WHERE ' + QUOTENAME(@legacyIdColumn) + N' = @userId';
         END
         ELSE IF @legacyEmailColumn IS NOT NULL
         BEGIN
           SET @sql = @sql + N' WHERE ' + QUOTENAME(@legacyEmailColumn) + N' = @email';
         END
         ELSE
         BEGIN
           SET @sql = NULL;
         END

         IF @sql IS NOT NULL
         BEGIN
           EXEC sp_executesql
             @sql,
             N'@passwordHash NVARCHAR(255), @userId INT, @email NVARCHAR(255)',
             @passwordHash = @passwordHash,
             @userId = @userId,
             @email = @email;
         END
       END
     END;`,
    {
      passwordHash,
      userId: resetToken.id_usuario,
      email: resetToken.correo,
    }
  )

  await execute(
    `UPDATE PasswordResetTokens
     SET usado_en = GETDATE()
     WHERE id_token_reset = @tokenId`,
    { tokenId: resetToken.id_token_reset }
  )

  return resetToken
}
