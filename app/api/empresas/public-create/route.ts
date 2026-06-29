import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"
import { generateCompanyCode, normalizeCompanyCode, parseCompanyCode } from "@/lib/company-code"
import { createSession, sanitizeUser, type DbUser } from "@/lib/auth"
import { query } from "@/lib/db"

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || ""
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || ""

function normalizeCompanyStatus(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === "activa" || normalized === "activo") return "Activa"
  if (normalized === "inactiva" || normalized === "inactivo") return "Inactiva"
  return null
}

async function validateAdminCredentials(email: string, password: string): Promise<boolean> {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    throw new Error("SUPER_ADMIN_NOT_CONFIGURED")
  }

  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD
}

async function ensureCompanyAdminUser({
  idEmpresa,
  nombre,
  correo,
  password,
}: {
  idEmpresa: number
  nombre: string
  correo: string
  password: string
}) {
  const existing = await query<Array<{ total: number }>>(
    `DECLARE @hasEmpresaColumn BIT = 0;
     DECLARE @sql NVARCHAR(MAX);

     IF EXISTS (
       SELECT 1
       FROM sys.columns
       WHERE object_id = OBJECT_ID('Usuarios')
         AND name = 'id_empresa'
     )
     BEGIN
       SET @hasEmpresaColumn = 1;
     END

     IF @hasEmpresaColumn = 1
     BEGIN
       SET @sql = N'
         SELECT COUNT(1) AS total
         FROM Usuarios
         WHERE LOWER(correo) = LOWER(@correo)
           AND id_empresa = @idEmpresa';
     END
     ELSE
     BEGIN
       SET @sql = N'
         SELECT COUNT(1) AS total
         FROM Usuarios
         WHERE LOWER(correo) = LOWER(@correo)';
     END

     EXEC sp_executesql
       @sql,
       N'@idEmpresa INT, @correo NVARCHAR(255)',
       @idEmpresa = @idEmpresa,
       @correo = @correo;`,
    { idEmpresa, correo }
  )

  if (Number(existing[0]?.total || 0) > 0) {
    throw new Error("Ya existe un usuario administrador con ese correo para esta empresa")
  }

  await query(
    `DECLARE @passwordColumn SYSNAME;
     DECLARE @hasEmpresaColumn BIT = 0;
     DECLARE @sql NVARCHAR(MAX);

     SELECT TOP 1 @passwordColumn = name
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Usuarios')
       AND name LIKE 'contrase%';

     IF @passwordColumn IS NULL
     BEGIN
       THROW 50001, 'No se encontro la columna de contrasena en Usuarios.', 1;
     END

     IF EXISTS (
       SELECT 1
       FROM sys.columns
       WHERE object_id = OBJECT_ID('Usuarios')
         AND name = 'id_empresa'
     )
     BEGIN
       SET @hasEmpresaColumn = 1;
     END

     IF @hasEmpresaColumn = 1
     BEGIN
       SET @sql = N'
         INSERT INTO Usuarios (id_empresa, nombre, correo, ' + QUOTENAME(@passwordColumn) + N', rol, activo, fecha_registro)
         VALUES (@idEmpresa, @nombre, @correo, @password, @rol, 1, GETDATE())';
     END
     ELSE
     BEGIN
       SET @sql = N'
         INSERT INTO Usuarios (nombre, correo, ' + QUOTENAME(@passwordColumn) + N', rol, activo, fecha_registro)
         VALUES (@nombre, @correo, @password, @rol, 1, GETDATE())';
     END

     EXEC sp_executesql
       @sql,
       N'@idEmpresa INT, @nombre NVARCHAR(150), @correo NVARCHAR(255), @password NVARCHAR(255), @rol NVARCHAR(50)',
       @idEmpresa = @idEmpresa,
       @nombre = @nombre,
       @correo = @correo,
       @password = @password,
       @rol = @rol;`,
    {
      nombre,
      idEmpresa,
      correo,
      password: hashSync(password, 10),
      rol: "administrador",
    }
  )
}

async function createUniqueCompanyCode(): Promise<string> {
  const rows = await query<Array<{ codigo_empresa: string }>>(
    `SELECT codigo_empresa
     FROM Empresas
     WHERE UPPER(codigo_empresa) LIKE 'EMP-%'`
  )
  const maxSequence = rows.reduce((max, row) => {
    const parsed = parseCompanyCode(String(row.codigo_empresa || ""))
    return parsed == null ? max : Math.max(max, parsed)
  }, -1)

  for (let attempt = 1; attempt <= 10; attempt++) {
    const codigoEmpresa = generateCompanyCode(maxSequence + attempt)
    const existing = await query<Array<{ id_empresa: number }>>(
      "SELECT id_empresa FROM Empresas WHERE UPPER(codigo_empresa) = @codigoEmpresa",
      { codigoEmpresa }
    )
    if (existing.length === 0) return codigoEmpresa
  }
  throw new Error("No se pudo generar un codigo de empresa unico")
}

async function getCompanyAccessUser(idEmpresa: number): Promise<DbUser | undefined> {
  const rows = await query<DbUser[]>(
    `DECLARE @passwordColumn SYSNAME;
     DECLARE @hasEmpresaColumn BIT = 0;
     DECLARE @passwordSelect NVARCHAR(MAX);
     DECLARE @empresaFilter NVARCHAR(MAX) = N'';
     DECLARE @sql NVARCHAR(MAX);

     SELECT TOP 1 @passwordColumn = name
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Usuarios')
       AND name LIKE 'contrase%';

     IF EXISTS (
       SELECT 1
       FROM sys.columns
       WHERE object_id = OBJECT_ID('Usuarios')
         AND name = 'id_empresa'
     )
     BEGIN
       SET @hasEmpresaColumn = 1;
       SET @empresaFilter = N' AND id_empresa = @idEmpresa';
     END

     SET @passwordSelect = CASE
       WHEN @passwordColumn IS NOT NULL THEN N'CAST(' + QUOTENAME(@passwordColumn) + N' AS NVARCHAR(255))'
       ELSE N'CAST('''' AS NVARCHAR(255))'
     END;

     SET @sql = N'
       SELECT TOP 1
         id_usuario,
         @idEmpresa AS id_empresa,
         nombre,
         correo,
         ' + @passwordSelect + N' AS passwordHash,
         rol,
         fecha_registro
       FROM Usuarios
       WHERE LOWER(rol) = ''administrador''' + @empresaFilter + N'
       ORDER BY id_usuario';

     EXEC sp_executesql @sql, N'@idEmpresa INT', @idEmpresa = @idEmpresa;`,
    { idEmpresa }
  )

  return rows[0]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminEmail = String(searchParams.get("adminEmail") || "").trim()
    const adminPassword = String(searchParams.get("adminPassword") || "")

    if (!(await validateAdminCredentials(adminEmail, adminPassword))) {
      return NextResponse.json({ error: "Credenciales de administrador invalidas" }, { status: 401 })
    }

    const empresas = await query(
      `SELECT
         id_empresa,
         COALESCE(codigo_empresa, '') AS codigo_empresa,
         nombre,
         COALESCE(rnc, '') AS rnc,
         COALESCE(direccion, '') AS direccion,
         COALESCE(telefono, '') AS telefono,
         COALESCE(correo, '') AS correo,
         COALESCE(estado, 'Activa') AS estado,
         fecha_creacion
       FROM Empresas
       ORDER BY nombre`
    )

    return NextResponse.json({ success: true, empresas })
  } catch (error: unknown) {
    console.error("[Empresas public-create GET error]", error)
    const message = error instanceof Error ? error.message : "desconocido"
    return NextResponse.json({ error: "Error al obtener empresas: " + message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const data = await request.json()
    const adminEmail = String(data.adminEmail || "").trim()
    const adminPassword = String(data.adminPassword || "")

    if (!(await validateAdminCredentials(adminEmail, adminPassword))) {
      return NextResponse.json({ error: "Credenciales de administrador invalidas" }, { status: 401 })
    }

    const idEmpresa = Number(data.id_empresa || data.idEmpresa || data.id)
    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
      return NextResponse.json({ error: "El id de la empresa es obligatorio" }, { status: 400 })
    }

    const estado = normalizeCompanyStatus(String(data.estado || ""))
    if (!estado) {
      return NextResponse.json({ error: "Estado invalido. Use Activa o Inactiva" }, { status: 400 })
    }

    const existing = await query<Array<{ id_empresa: number; nombre: string }>>(
      `SELECT id_empresa, nombre
       FROM Empresas
       WHERE id_empresa = @idEmpresa`,
      { idEmpresa }
    )

    if (existing.length === 0) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 })
    }

    await query(
      `UPDATE Empresas
       SET estado = @estado
       WHERE id_empresa = @idEmpresa`,
      { idEmpresa, estado }
    )

    return NextResponse.json({
      success: true,
      empresa: {
        id_empresa: idEmpresa,
        nombre: existing[0].nombre,
        estado,
      },
    })
  } catch (error: unknown) {
    console.error("[Empresas public-create PATCH error]", error)
    const message = error instanceof Error ? error.message : "desconocido"
    return NextResponse.json({ error: "Error al cambiar estado de empresa: " + message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const adminEmail = String(data.adminEmail || "").trim()
    const adminPassword = String(data.adminPassword || "")

    if (!(await validateAdminCredentials(adminEmail, adminPassword))) {
      return NextResponse.json({ error: "Credenciales de administrador invalidas" }, { status: 401 })
    }

    if (data.action === "accessCompany") {
      const idEmpresa = Number(data.id_empresa || data.idEmpresa || data.id)
      if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        return NextResponse.json({ error: "El id de la empresa es obligatorio" }, { status: 400 })
      }

      const empresas = await query<Array<{ id_empresa: number; codigo_empresa: string; nombre: string }>>(
        `SELECT TOP 1
           id_empresa,
           COALESCE(codigo_empresa, '') AS codigo_empresa,
           nombre
         FROM Empresas
         WHERE id_empresa = @idEmpresa`,
        { idEmpresa }
      )

      if (empresas.length === 0) {
        return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 })
      }

      const user = await getCompanyAccessUser(idEmpresa)
      if (!user) {
        return NextResponse.json(
          { error: "Esta empresa no tiene un usuario administrador para acceder" },
          { status: 404 }
        )
      }

      await createSession(user)
      return NextResponse.json({
        success: true,
        user: sanitizeUser(user),
        empresa: {
          id: String(empresas[0].id_empresa),
          codigo: empresas[0].codigo_empresa,
          nombre: empresas[0].nombre,
        },
      })
    }

    const nombre = String(data.nombre || "").trim()
    if (!nombre) {
      return NextResponse.json({ error: "El nombre de la empresa es obligatorio" }, { status: 400 })
    }

    const adminUserName = String(data.userName || data.usuarioNombre || "").trim()
    const adminUserEmail = String(data.userEmail || data.usuarioEmail || "").trim()
    const adminUserPassword = String(data.userPassword || data.usuarioPassword || "")

    if (!adminUserName || !adminUserEmail || !adminUserPassword) {
      return NextResponse.json(
        { error: "Nombre, correo y contrasena del usuario administrador son obligatorios" },
        { status: 400 }
      )
    }

    if (adminUserPassword.length < 8) {
      return NextResponse.json(
        { error: "La contrasena del usuario administrador debe tener al menos 8 caracteres" },
        { status: 400 }
      )
    }

    const codigoEmpresa = normalizeCompanyCode(
      String(data.codigo_empresa || data.codigo || await createUniqueCompanyCode())
    )

    const existing = await query<{ id_empresa: number }[]>(
      `SELECT id_empresa
       FROM Empresas
       WHERE LOWER(nombre) = LOWER(@nombre)
          OR UPPER(codigo_empresa) = @codigoEmpresa`,
      { nombre, codigoEmpresa }
    )

    if (existing.length > 0) {
      return NextResponse.json({ error: "Ya existe una empresa con este nombre o codigo" }, { status: 400 })
    }

    const result = await query<Array<{ id_empresa: number; codigo_empresa: string }>>(
      `INSERT INTO Empresas (codigo_empresa, nombre, rnc, direccion, telefono, correo, estado)
       VALUES (@codigoEmpresa, @nombre, @rnc, @direccion, @telefono, @correo, 'Activa');
       SELECT id_empresa, codigo_empresa
       FROM Empresas
       WHERE id_empresa = CAST(SCOPE_IDENTITY() AS INT);`,
      {
        codigoEmpresa,
        nombre,
        rnc: data.rnc || "",
        direccion: data.direccion || "",
        telefono: data.telefono || "",
        correo: data.correo || "",
      }
    )

    const idEmpresa = Number(result[0]?.id_empresa)
    await ensureCompanyAdminUser({
      idEmpresa,
      nombre: adminUserName,
      correo: adminUserEmail,
      password: adminUserPassword,
    })

    const createdCodigoEmpresa = String(result[0]?.codigo_empresa || codigoEmpresa)
    return NextResponse.json({
      success: true,
      empresa: {
        id_empresa: idEmpresa,
        codigo_empresa: createdCodigoEmpresa,
        nombre,
        rnc: data.rnc || "",
        codigo: createdCodigoEmpresa,
      },
      usuario: {
        nombre: adminUserName,
        correo: adminUserEmail,
        rol: "administrador",
      },
    })
  } catch (error: unknown) {
    console.error("[Empresas public-create error]", error)
    const message = error instanceof Error ? error.message : "desconocido"
    return NextResponse.json({ error: "Error al crear empresa: " + message }, { status: 500 })
  }
}
