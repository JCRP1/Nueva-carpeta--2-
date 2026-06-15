import { NextResponse } from "next/server"
import { normalizeCompanyCode } from "@/lib/company-code"
import { query } from "@/lib/db"

interface EmpresaRow {
  id_empresa: number
  codigo_empresa: string
  nombre: string
  rnc: string
  estado: string
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json()
    const rawCode = String(code || "").trim()

    if (!rawCode) {
      return NextResponse.json({ error: "Ingrese el codigo de empresa" }, { status: 400 })
    }

    const normalized = normalizeCompanyCode(rawCode)
    const rows = await query<EmpresaRow[]>(
      `SELECT TOP 1
         id_empresa,
         codigo_empresa,
         nombre,
         COALESCE(rnc, '') AS rnc,
         COALESCE(estado, 'Activa') AS estado
       FROM Empresas
       WHERE
         UPPER(REPLACE(COALESCE(codigo_empresa, ''), ' ', '')) = @codigoEmpresa`,
      {
        codigoEmpresa: normalized,
      }
    )

    const empresa = rows[0]
    if (!empresa) {
      return NextResponse.json({ error: "Codigo de empresa no encontrado" }, { status: 404 })
    }

    if (String(empresa.estado || "").toLowerCase() === "inactiva") {
      return NextResponse.json({ error: "La empresa esta inactiva" }, { status: 403 })
    }

    return NextResponse.json({
      empresa: {
        id_empresa: empresa.id_empresa,
        codigo_empresa: empresa.codigo_empresa,
        nombre: empresa.nombre,
        rnc: empresa.rnc,
        codigo: empresa.codigo_empresa,
      },
    })
  } catch (error) {
    console.error("[Empresas verify error]", error)
    return NextResponse.json({ error: "Error al verificar empresa" }, { status: 500 })
  }
}
