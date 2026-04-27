import { query } from "@/lib/db"

let cachedSensorZoneColumn: string | null | undefined

export async function getSensorZoneColumn() {
  if (cachedSensorZoneColumn !== undefined) {
    return cachedSensorZoneColumn
  }

  const rows = await query<Record<string, unknown>[]>(
    `SELECT COLUMN_NAME AS columnName
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'Sensores'
       AND COLUMN_NAME IN ('id_zona', 'zonaRiegoId')
     ORDER BY CASE WHEN COLUMN_NAME = 'id_zona' THEN 0 ELSE 1 END`
  )

  cachedSensorZoneColumn = rows[0]?.columnName ? String(rows[0].columnName) : null
  return cachedSensorZoneColumn
}
