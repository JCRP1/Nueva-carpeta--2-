import { query } from "@/lib/db"

let hasPhysicalDeviceCodeColumnPromise: Promise<boolean> | null = null

export function buildVirtualDeviceCodeExpression(tableAlias = "d") {
  return `CONCAT('DEV-', RIGHT('0000' + CAST(${tableAlias}.id_dispositivo AS VARCHAR(10)), 4))`
}

export async function hasPhysicalDeviceCodeColumn() {
  if (!hasPhysicalDeviceCodeColumnPromise) {
    hasPhysicalDeviceCodeColumnPromise = query<Array<{ existsFlag: number }>>(
      `SELECT TOP 1 1 AS existsFlag
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'DispositivosIoT'
         AND COLUMN_NAME = 'codigo_dispositivo'`
    ).then((rows) => rows.length > 0)
  }

  return hasPhysicalDeviceCodeColumnPromise
}
