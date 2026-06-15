import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { query } from "./db"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "greensense-secret-key-change-in-production-2026"
)
const COOKIE_NAME = "gs_session"

export interface DbUser {
  id_usuario: number
  id_empresa?: number | null
  nombre: string
  correo: string
  passwordHash: string
  rol: string
  fecha_registro: string
}

async function resolveDefaultEmpresaId(): Promise<number> {
  const empresaRows = await query<Array<{ id_empresa: number }>>(
    "SELECT TOP 1 id_empresa FROM Empresas ORDER BY id_empresa"
  )

  if (empresaRows[0]?.id_empresa != null) {
    return Number(empresaRows[0].id_empresa)
  }

  const greenhouseRows = await query<Array<{ id_empresa: number }>>(
    "SELECT TOP 1 id_empresa FROM Invernaderos ORDER BY id_empresa"
  )

  if (greenhouseRows[0]?.id_empresa != null) {
    return Number(greenhouseRows[0].id_empresa)
  }

  return 1
}

async function getSessionDurationSeconds(empresaId: number): Promise<number> {
  const rows = await query<Array<{ valor: string }>>(
    `SELECT TOP 1 valor
     FROM ConfiguracionesSistema
     WHERE id_empresa = @empresaId
       AND parametro = 'sesionTimeout'`,
    { empresaId }
  )

  const minutes = Number(rows[0]?.valor)
  if (!Number.isFinite(minutes) || minutes <= 0) return 60 * 60 * 24
  return Math.max(60, Math.round(minutes * 60))
}

export async function createSession(user: DbUser) {
  const empresaId =
    user.id_empresa != null ? Number(user.id_empresa) : await resolveDefaultEmpresaId()
  const durationSeconds = await getSessionDurationSeconds(empresaId)

  const token = await new SignJWT({
    userId: user.id_usuario,
    email: user.correo,
    rol: user.rol,
    nombre: user.nombre,
    empresaId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${durationSeconds}s`)
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: durationSeconds,
    path: "/",
  })

  return token
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export interface SessionPayload {
  userId: number
  email: string
  rol: string
  nombre: string
  empresaId: number
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const session = payload as unknown as SessionPayload
    if (session.empresaId == null || Number.isNaN(Number(session.empresaId))) {
      session.empresaId = await resolveDefaultEmpresaId()
    }
    return session
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new Error("UNAUTHORIZED")
  return session
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth()
  if (session.rol !== "administrador") throw new Error("FORBIDDEN")
  return session
}

export async function getUserByEmail(email: string, empresaId?: number | null): Promise<DbUser | undefined> {
  const rows = await query<DbUser[]>(
    `DECLARE @passwordColumn SYSNAME;
     DECLARE @empresaColumn SYSNAME;
     DECLARE @empresaSelect NVARCHAR(MAX);
     DECLARE @empresaFilter NVARCHAR(MAX) = N'';
     DECLARE @sql NVARCHAR(MAX);

     SELECT TOP 1 @passwordColumn = name
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Usuarios')
       AND name LIKE 'contrase%';

     IF @passwordColumn IS NULL
     BEGIN
       THROW 50001, 'No se encontro la columna de contrasena en Usuarios.', 1;
     END

     SELECT TOP 1 @empresaColumn = name
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Usuarios')
       AND name = 'id_empresa';

     SET @empresaSelect = CASE
       WHEN @empresaColumn IS NOT NULL THEN N'COALESCE(u.id_empresa, CAST((SELECT TOP 1 id_empresa FROM Empresas ORDER BY id_empresa) AS INT))'
       ELSE N'CAST((SELECT TOP 1 id_empresa FROM Empresas ORDER BY id_empresa) AS INT)'
     END;

     IF @empresaId IS NOT NULL AND @empresaColumn IS NOT NULL
     BEGIN
       SET @empresaFilter = N' AND COALESCE(u.id_empresa, CAST((SELECT TOP 1 id_empresa FROM Empresas ORDER BY id_empresa) AS INT)) = @empresaId';
     END

     SET @sql = N'
       SELECT
         u.id_usuario,
         ' + @empresaSelect + N' AS id_empresa,
         u.nombre,
         u.correo,
         CAST(u.' + QUOTENAME(@passwordColumn) + N' AS NVARCHAR(255)) AS passwordHash,
         u.rol,
         u.fecha_registro
       FROM Usuarios u
       WHERE u.correo = @email' + @empresaFilter;

     EXEC sp_executesql
       @sql,
       N'@email NVARCHAR(255), @empresaId INT',
       @email = @email,
       @empresaId = @empresaId;`,
    { email, empresaId: empresaId ?? null }
  )
  return rows[0]
}

export function sanitizeUser(user: DbUser) {
  return {
    id: String(user.id_usuario),
    nombre: user.nombre,
    email: user.correo,
    rol: user.rol,
    empresaId: String(user.id_empresa ?? ""),
    activo: true,
    ultimoAcceso: user.fecha_registro,
  }
}
