import { NextResponse } from "next/server"
import { compareSync, hashSync } from "bcryptjs"
import { generateCompanyCode, normalizeCompanyCode, parseCompanyCode } from "@/lib/company-code"
import { query } from "@/lib/db"

const ADMIN_EMAIL = "jean@greensense.com"
const ADMIN_PASSWORD = "admin123"

async function validateAdminCredentials(email: string, password: string): Promise<boolean> {
  if (email.toLowerCase() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return false

  const passwordRows = await query<Array<{ passwordHash: string }>>(
    `DECLARE @passwordColumn SYSNAME;
     DECLARE @sql NVARCHAR(MAX);

     SELECT TOP 1 @passwordColumn = name
     FROM sys.columns
     WHERE object_id = OBJECT_ID('Usuarios')
       AND name LIKE 'contrase%';

     IF @passwordColumn IS NULL
     BEGIN
       SELECT CAST('' AS NVARCHAR(255)) AS passwordHash;
       RETURN;
     END

     SET @sql = N'
       SELECT TOP 1 CAST(' + QUOTENAME(@passwordColumn) + N' AS NVARCHAR(255)) AS passwordHash
       FROM Usuarios
       WHERE LOWER(correo) = LOWER(@correo)';

     EXEC sp_executesql @sql, N'@correo NVARCHAR(255)', @correo = @correo;`,
    { correo: ADMIN_EMAIL }
  )

  const storedHash = passwordRows[0]?.passwordHash
  return !storedHash || compareSync(password, storedHash)
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

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const adminEmail = String(data.adminEmail || "").trim()
    const adminPassword = String(data.adminPassword || "")

    if (!(await validateAdminCredentials(adminEmail, adminPassword))) {
      return NextResponse.json({ error: "Credenciales de administrador invalidas" }, { status: 401 })
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
