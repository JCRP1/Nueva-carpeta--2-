import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

async function hasHarvestZoneColumn() {
  const rows = await query<{ existsFlag: number }[]>(
    "SELECT CASE WHEN COL_LENGTH('dbo.Cosechas', 'id_zona') IS NULL THEN 0 ELSE 1 END AS existsFlag"
  )
  return Number(rows[0]?.existsFlag || 0) === 1
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouse = searchParams.get("greenhouse")
    const hasZona = await hasHarvestZoneColumn()

    const params: Record<string, unknown> = { empresaId: session.empresaId }
    let where = "WHERE i.id_empresa = @empresaId"
    if (greenhouse) {
      where += ` AND ${hasZona ? "COALESCE(z.id_invernadero, c.id_invernadero)" : "c.id_invernadero"} = @greenhouseId`
      params.greenhouseId = Number(greenhouse)
    }

    const rows = await query<Record<string, unknown>[]>(
      `
        SELECT
          ${hasZona ? "z.id_zona" : "NULL"} AS idZona,
          ${hasZona ? "z.nombre" : "NULL"} AS zonaNombre,
          c.id_cultivo AS idCultivo,
          c.nombre AS cultivoNombre,
          i.nombre AS invernaderoNombre,
          SUM(ISNULL(co.cantidad_cosechada_kg, 0)) AS kgCosechados,
          SUM(ISNULL(co.perdida_kg, 0)) AS kgPerdidos,
          SUM(ISNULL(v.ingreso_total, 0)) AS ingresos,
          ISNULL(costos.totalCostos, 0) AS costos
        FROM dbo.Cosechas co
        INNER JOIN dbo.CultivoDetalle cd ON cd.id_detalle = co.id_detalle
        INNER JOIN dbo.Cultivos c ON c.id_cultivo = cd.id_cultivo
        ${hasZona ? "LEFT JOIN dbo.ZonasRiego z ON z.id_zona = co.id_zona" : ""}
        INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        LEFT JOIN dbo.VentasCosecha v ON v.id_cosecha = co.id_cosecha
        OUTER APPLY (
          SELECT SUM(cc.monto) AS totalCostos
          FROM dbo.CostosCultivo cc
          WHERE cc.id_cultivo = c.id_cultivo
             OR (${hasZona ? "cc.id_zona = z.id_zona" : "1 = 0"})
        ) costos
        ${where}
        GROUP BY ${hasZona ? "z.id_zona, z.nombre," : ""} c.id_cultivo, c.nombre, i.nombre, costos.totalCostos
        ORDER BY ingresos - ISNULL(costos.totalCostos, 0) DESC
      `,
      params
    )

    return NextResponse.json(rows.map((row) => {
      const ingresos = Number(row.ingresos) || 0
      const costos = Number(row.costos) || 0
      const kg = Number(row.kgCosechados) || 0
      return {
        idZona: row.idZona != null ? String(row.idZona) : "",
        zonaNombre: String(row.zonaNombre || "Sin zona"),
        idCultivo: String(row.idCultivo || ""),
        cultivoNombre: String(row.cultivoNombre || ""),
        invernaderoNombre: String(row.invernaderoNombre || ""),
        kgCosechados: kg,
        kgPerdidos: Number(row.kgPerdidos) || 0,
        ingresos,
        costos,
        ganancia: ingresos - costos,
        costoPorKg: kg > 0 ? costos / kg : 0,
      }
    }))
  } catch (err) {
    console.error("[profitability] GET Error:", err)
    return NextResponse.json({ error: "No se pudo cargar la rentabilidad" }, { status: 500 })
  }
}
