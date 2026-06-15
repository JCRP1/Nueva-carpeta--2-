import { NextResponse } from "next/server"
import { compareSync } from "bcryptjs"
import { getUserByEmail, createSession, sanitizeUser } from "@/lib/auth"
import { registrarBitacora } from "@/lib/bitacora"
import { normalizeCompanyCode } from "@/lib/company-code"
import { query } from "@/lib/db"

interface EmpresaLoginRow {
  id_empresa: number
  codigo_empresa: string
  nombre: string
  estado: string
}

const loginAttempts = new Map<string, { count: number; lockedUntil: number | null }>()

async function getSecuritySettings(empresaId: number) {
  const rows = await query<Array<{ parametro: string; valor: string }>>(
    `SELECT parametro, valor
     FROM ConfiguracionesSistema
     WHERE id_empresa = @empresaId
       AND parametro IN ('maxLoginAttempts', 'lockoutMinutes')`,
    { empresaId }
  )
  const values = new Map(rows.map((row) => [row.parametro, row.valor]))
  const maxLoginAttempts = Number(values.get("maxLoginAttempts"))
  const lockoutMinutes = Number(values.get("lockoutMinutes"))

  return {
    maxLoginAttempts: Number.isFinite(maxLoginAttempts) && maxLoginAttempts > 0 ? maxLoginAttempts : 5,
    lockoutMinutes: Number.isFinite(lockoutMinutes) && lockoutMinutes > 0 ? lockoutMinutes : 15,
  }
}

function getAttemptKey(empresaId: number, email: string) {
  return `${empresaId}:${email.trim().toLowerCase()}`
}

function isLoginLocked(key: string) {
  const attempts = loginAttempts.get(key)
  if (!attempts?.lockedUntil) return false
  if (attempts.lockedUntil <= Date.now()) {
    loginAttempts.delete(key)
    return false
  }
  return true
}

function registerFailedLogin(key: string, maxLoginAttempts: number, lockoutMinutes: number) {
  const current = loginAttempts.get(key) || { count: 0, lockedUntil: null }
  const nextCount = current.count + 1
  const lockedUntil = nextCount >= maxLoginAttempts ? Date.now() + lockoutMinutes * 60 * 1000 : null
  loginAttempts.set(key, { count: nextCount, lockedUntil })
}

async function getEmpresaByCode(code: string) {
  const codigoEmpresa = normalizeCompanyCode(code)
  const rows = await query<EmpresaLoginRow[]>(
    `SELECT TOP 1
       id_empresa,
       codigo_empresa,
       nombre,
       COALESCE(estado, 'Activa') AS estado
     FROM Empresas
     WHERE UPPER(REPLACE(COALESCE(codigo_empresa, ''), ' ', '')) = @codigoEmpresa`,
    { codigoEmpresa }
  )

  return rows[0]
}

export async function POST(req: Request) {
  try {
    const { email, password, empresaCodigo, companyCode } = await req.json()
    const rawCompanyCode = String(empresaCodigo || companyCode || "").trim()

    if (!rawCompanyCode) {
      return NextResponse.json({ error: "Codigo de empresa requerido" }, { status: 400 })
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contrasena requeridos" }, { status: 400 })
    }

    const empresa = await getEmpresaByCode(rawCompanyCode)
    if (!empresa) {
      return NextResponse.json({ error: "Codigo de empresa no encontrado" }, { status: 404 })
    }

    if (String(empresa.estado || "").toLowerCase() === "inactiva") {
      return NextResponse.json({ error: "La empresa esta inactiva" }, { status: 403 })
    }

    const normalizedEmail = String(email).trim()
    const securitySettings = await getSecuritySettings(Number(empresa.id_empresa))
    const attemptKey = getAttemptKey(Number(empresa.id_empresa), normalizedEmail)
    if (isLoginLocked(attemptKey)) {
      return NextResponse.json(
        { error: `Cuenta bloqueada temporalmente. Intente nuevamente en ${securitySettings.lockoutMinutes} minutos.` },
        { status: 429 }
      )
    }

    const user = await getUserByEmail(normalizedEmail, Number(empresa.id_empresa))
    if (!user) {
      registerFailedLogin(attemptKey, securitySettings.maxLoginAttempts, securitySettings.lockoutMinutes)
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 })
    }

    if (!compareSync(password, user.passwordHash)) {
      registerFailedLogin(attemptKey, securitySettings.maxLoginAttempts, securitySettings.lockoutMinutes)
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 })
    }

    loginAttempts.delete(attemptKey)
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
      valorNuevo: {
        correo: user.correo,
        rol: user.rol,
        empresaId: empresa.id_empresa,
        codigoEmpresa: empresa.codigo_empresa,
      },
    })
    return NextResponse.json({
      user: sanitizeUser(user),
      empresa: {
        id: String(empresa.id_empresa),
        codigo: empresa.codigo_empresa,
        nombre: empresa.nombre,
      },
      message: `Bienvenido al sistema, ${user.nombre.split(" ")[0]}!`,
    })
  } catch (err) {
    console.error("[GreenSense] Login error:", err)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
