import * as sql from "mssql"

// Connection config from environment variables
const config: sql.config = {
  server: process.env.MSSQL_HOST || "localhost",
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DATABASE || "GreenSenseDB",
  user: process.env.MSSQL_USER || "sa",
  password: process.env.MSSQL_PASSWORD || "",
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: process.env.MSSQL_TRUST_CERT !== "false",
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

// Singleton pool
let poolPromise: Promise<sql.ConnectionPool> | null = null

export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log("[GreenSense] Connected to SQL Server:", config.database)
        return pool
      })
      .catch((err) => {
        poolPromise = null
        throw err
      })
  }
  return poolPromise
}

// Helper to run queries
export async function query<T = sql.IRecordSet<Record<string, unknown>>>(
  sqlText: string,
  params?: Record<string, unknown>
): Promise<T> {
  const pool = await getPool()
  const request = pool.request()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value)
    }
  }
  const result = await request.query(sqlText)
  return result.recordset as T
}

// Helper for mutations (INSERT, UPDATE, DELETE)
export async function execute(
  sqlText: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<Record<string, unknown>>> {
  const pool = await getPool()
  const request = pool.request()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value)
    }
  }
  return request.query(sqlText)
}
