import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { query } from "./db"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "greensense-secret-key-change-in-production-2026"
)
const COOKIE_NAME = "gs_session"

export interface DbUser {
  id_usuario: number
  id_empresa: number
  nombre: string
  correo: string
  contraseña: string
  rol: string
  fecha_registro: string
}

export async function createSession(user: DbUser) {
  const token = await new SignJWT({
    userId: user.id_usuario,
    email: user.correo,
    rol: user.rol,
    nombre: user.nombre,
    empresaId: user.id_empresa,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
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
    return payload as unknown as SessionPayload
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

export async function getUserByEmail(email: string): Promise<DbUser | undefined> {
  const rows = await query<DbUser[]>(
    "SELECT * FROM Usuarios WHERE correo = @email",
    { email }
  )
  return rows[0]
}

export function sanitizeUser(user: DbUser) {
  return {
    id: String(user.id_usuario),
    nombre: user.nombre,
    email: user.correo,
    rol: user.rol,
    empresaId: String(user.id_empresa),
    activo: true,
    ultimoAcceso: user.fecha_registro,
  }
}
