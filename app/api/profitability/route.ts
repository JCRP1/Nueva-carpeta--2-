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
          ${hasZona ? "MAX(ISNULL(z.produccion_estimada, 0))" : "0"} AS produccionEstimada,
          ${hasZona ? "MAX(ISNULL(z.unidad_rendimiento, 'kg'))" : "'kg'"} AS unidadRendimiento,
          ${hasZona ? "MAX(ISNULL(z.ingreso_estimado, 0))" : "0"} AS ingresoEstimado,
          SUM(ISNULL(co.cantidad_cosechada_kg, 0)) AS kgCosechados,
          SUM(ISNULL(co.perdida_kg, 0)) AS kgPerdidos,
          SUM(ISNULL(ventas.kgVendidos, 0)) AS kgVendidos,
          SUM(ISNULL(ventas.ingresoTotal, 0)) AS ingresoTotal,
          ISNULL(costos.totalCostos, 0) AS costos
        FROM dbo.Cosechas co
        INNER JOIN dbo.CultivoDetalle cd ON cd.id_detalle = co.id_detalle
        INNER JOIN dbo.Cultivos c ON c.id_cultivo = cd.id_cultivo
        ${hasZona ? "LEFT JOIN dbo.ZonasRiego z ON z.id_zona = co.id_zona" : ""}
        INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        OUTER APPLY (
          SELECT
            SUM(v.cantidad_kg) AS kgVendidos,
            SUM(v.ingreso_total) AS ingresoTotal
          FROM dbo.VentasCosecha v
          WHERE v.id_cosecha = co.id_cosecha
        ) ventas
        OUTER APPLY (
          SELECT SUM(cc.monto) AS totalCostos
          FROM dbo.CostosCultivo cc
          WHERE cc.id_cultivo = c.id_cultivo
             OR (${hasZona ? "cc.id_zona = z.id_zona" : "1 = 0"})
        ) costos
        ${where}
        GROUP BY ${hasZona ? "z.id_zona, z.nombre," : ""} c.id_cultivo, c.nombre, i.nombre, costos.totalCostos
        ORDER BY SUM(ISNULL(v.ingreso_total, 0)) - ISNULL(costos.totalCostos, 0) DESC
      `,
      params
    )

    return NextResponse.json(rows.map((row) => {
      const ingresos = Number(row.ingresoTotal) || 0
      const costos = Number(row.costos) || 0
      const kg = Number(row.kgCosechados) || 0
      const produccionEstimada = Number(row.produccionEstimada) || 0
      const kgVendidos = Number(row.kgVendidos) || 0
      const ingresoEstimado = Number(row.ingresoEstimado) || 0
      const diferenciaProduccion = kg - produccionEstimada
      const diferenciaIngresos = ingresos - ingresoEstimado
      return {
        idZona: row.idZona != null ? String(row.idZona) : "",
        zonaNombre: String(row.zonaNombre || "Sin zona"),
        idCultivo: String(row.idCultivo || ""),
        cultivoNombre: String(row.cultivoNombre || ""),
        invernaderoNombre: String(row.invernaderoNombre || ""),
        produccionEstimada,
        unidadRendimiento: String(row.unidadRendimiento || "kg"),
        kgCosechados: kg,
        kgVendidos,
        kgDisponible: Math.max(0, kg - kgVendidos),
        cumplimientoProduccion: produccionEstimada > 0 ? (kg / produccionEstimada) * 100 : 0,
        diferenciaProduccion,
        kgPerdidos: Number(row.kgPerdidos) || 0,
        ingresoEstimado,
        ingresos,
        diferenciaIngresos,
        cumplimientoIngresos: ingresoEstimado > 0 ? (ingresos / ingresoEstimado) * 100 : 0,
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
