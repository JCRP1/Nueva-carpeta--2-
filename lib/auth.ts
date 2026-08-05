import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { query } from "./db"

const JWT_ISSUER = "greensense"
const JWT_AUDIENCE = "greensense-web"

function getJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim()
  if (!configured || configured.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must contain at least 32 characters in production")
    }
    return new TextEncoder().encode("greensense-development-only-secret-key")
  }
  return new TextEncoder().encode(configured)
}
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
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${durationSeconds}s`)
    .sign(getJwtSecret())

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
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    if (
      typeof payload.userId !== "number" ||
      typeof payload.email !== "string" ||
      typeof payload.rol !== "string" ||
      typeof payload.nombre !== "string" ||
      typeof payload.empresaId !== "number"
    ) return null
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

export async function hasPermission(session: SessionPayload, permission: string): Promise<boolean> {
  if (session.rol === "administrador") return true

  const rows = await query<Array<{ Permisos: string | null }>>(
    `SELECT TOP 1 Permisos
     FROM Roles
     WHERE LOWER(Nombre) = LOWER(@rol)
       AND Activo = 1`,
    { rol: session.rol }
  )

  try {
    const permisos = JSON.parse(rows[0]?.Permisos || "[]")
    return Array.isArray(permisos) && permisos.map(String).includes(permission)
  } catch {
    return false
  }
}

export async function requirePermission(permission: string): Promise<SessionPayload> {
  const session = await requireAuth()
  if (!(await hasPermission(session, permission))) throw new Error("FORBIDDEN")
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

export async function findEmailCompanyAssignment(
  email: string,
  excludeUserId?: number | null
): Promise<{ id_usuario: number; id_empresa: number | null } | undefined> {
  const rows = await query<Array<{ id_usuario: number; id_empresa: number | null }>>(
    `DECLARE @empresaColumn SYSNAME;
     DECLARE @empresaSelect NVARCHAR(MAX);
     DECLARE @excludeFilter NVARCHAR(MAX) = N'';
     DECLARE @sql NVARCHAR(MAX);

     SELECT TOP 1 @empresaColumn = name
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Usuarios')
       AND name = 'id_empresa';

     SET @empresaSelect = CASE
       WHEN @empresaColumn IS NOT NULL THEN N'u.id_empresa'
       ELSE N'NULL'
     END;

     IF @excludeUserId IS NOT NULL
     BEGIN
       SET @excludeFilter = N' AND u.id_usuario <> @excludeUserId';
     END

     SET @sql = N'
       SELECT TOP 1
         u.id_usuario,
         ' + @empresaSelect + N' AS id_empresa
       FROM Usuarios u
       WHERE LOWER(LTRIM(RTRIM(u.correo))) = LOWER(LTRIM(RTRIM(@email)))' + @excludeFilter + N'
       ORDER BY u.id_usuario';

     EXEC sp_executesql
       @sql,
       N'@email NVARCHAR(255), @excludeUserId INT',
       @email = @email,
       @excludeUserId = @excludeUserId;`,
    { email, excludeUserId: excludeUserId ?? null }
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
