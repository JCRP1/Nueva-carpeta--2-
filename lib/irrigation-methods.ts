import { execute, query } from "@/lib/db"

type MethodStorage = "table" | "column"

let storagePromise: Promise<MethodStorage> | null = null

async function detectMethodStorage(): Promise<MethodStorage> {
  const tableRows = await query<Array<{ cnt: number }>>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'MetodoRiego'`
  )

  if (Number(tableRows[0]?.cnt) > 0) {
    return "table"
  }

  const columnRows = await query<Array<{ cnt: number }>>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'ZonasRiego' AND COLUMN_NAME = 'metodo_riego'`
  )

  if (Number(columnRows[0]?.cnt) > 0) {
    return "column"
  }

  throw new Error("IRRIGATION_METHOD_STORAGE_NOT_FOUND")
}

export async function getIrrigationMethodStorage(): Promise<MethodStorage> {
  if (!storagePromise) {
    storagePromise = detectMethodStorage().catch((err) => {
      storagePromise = null
      throw err
    })
  }

  return storagePromise
}

function normalizeMethodName(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function listIrrigationMethods() {
  const storage = await getIrrigationMethodStorage()

  if (storage === "table") {
    return query<Array<Record<string, unknown>>>(
      `SELECT
         CAST(id_metodo_riego AS NVARCHAR(50)) AS id,
         nombre,
         descripcion,
         eficiencia,
         activo
       FROM MetodoRiego
       ORDER BY nombre`
    )
  }

  const rows = await query<Array<{ nombre: string }>>(
    `SELECT DISTINCT LTRIM(RTRIM(metodo_riego)) AS nombre
     FROM ZonasRiego
     WHERE metodo_riego IS NOT NULL
       AND LTRIM(RTRIM(metodo_riego)) <> ''
     ORDER BY LTRIM(RTRIM(metodo_riego))`
  )

  const defaults = ["goteo", "aspersion", "manual", "automatico"]
  const byName = new Map<string, Record<string, unknown>>()

  for (const nombre of defaults) {
    byName.set(nombre.toLowerCase(), {
      id: nombre,
      nombre,
      descripcion: "",
      eficiencia: null,
      activo: true,
    })
  }

  for (const row of rows) {
    const nombre = normalizeMethodName(row.nombre)
    if (!nombre) continue
    byName.set(nombre.toLowerCase(), {
      id: nombre,
      nombre,
      descripcion: "",
      eficiencia: null,
      activo: true,
    })
  }

  return Array.from(byName.values()).sort((a, b) =>
    String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" })
  )
}

export async function resolveIrrigationMethodValue(input: unknown) {
  const storage = await getIrrigationMethodStorage()

  if (storage === "table") {
    const numericId = Number(input)
    if (Number.isFinite(numericId) && numericId > 0) {
      return { storage, id_metodo_riego: numericId, metodo_riego: null }
    }

    const nombre = normalizeMethodName(input)
    if (!nombre) {
      return { storage, id_metodo_riego: 1, metodo_riego: null }
    }

    const rows = await query<Array<{ id_metodo_riego: number }>>(
      `SELECT TOP 1 id_metodo_riego
       FROM MetodoRiego
       WHERE nombre = @nombre`,
      { nombre }
    )

    return {
      storage,
      id_metodo_riego: Number(rows[0]?.id_metodo_riego) || 1,
      metodo_riego: null,
    }
  }

  const nombre = normalizeMethodName(input) || "goteo"
  return { storage, id_metodo_riego: null, metodo_riego: nombre }
}

export async function createIrrigationMethod(data: {
  nombre: unknown
  descripcion?: unknown
  eficiencia?: unknown
}) {
  const storage = await getIrrigationMethodStorage()
  const nombre = normalizeMethodName(data.nombre)

  if (!nombre) {
    throw new Error("METHOD_NAME_REQUIRED")
  }

  if (storage === "table") {
    const result = await execute(
      `INSERT INTO MetodoRiego (nombre, descripcion, eficiencia, activo)
       OUTPUT INSERTED.id_metodo_riego
       VALUES (@nombre, @descripcion, @eficiencia, 1)`,
      {
        nombre,
        descripcion: normalizeMethodName(data.descripcion) || "",
        eficiencia: typeof data.eficiencia === "number" ? data.eficiencia : Number(data.eficiencia) || 0.8,
      }
    )

    return {
      storage,
      id: String(result.recordset?.[0]?.id_metodo_riego ?? nombre),
      nombre,
      descripcion: normalizeMethodName(data.descripcion) || "",
      eficiencia: typeof data.eficiencia === "number" ? data.eficiencia : Number(data.eficiencia) || 0.8,
      activo: true,
      persisted: true,
    }
  }

  return {
    storage,
    id: nombre,
    nombre,
    descripcion: normalizeMethodName(data.descripcion) || "",
    eficiencia: typeof data.eficiencia === "number" ? data.eficiencia : Number(data.eficiencia) || 0.8,
    activo: true,
    persisted: false,
  }
}
