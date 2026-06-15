import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { execute, query } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(req.url)
    const greenhouse = searchParams.get("greenhouse")

    const params: Record<string, unknown> = { empresaId: session.empresaId }
    let where = "WHERE i.id_empresa = @empresaId"
    if (greenhouse) {
      where += " AND c.id_invernadero = @greenhouseId"
      params.greenhouseId = Number(greenhouse)
    }

    const rows = await query<Record<string, unknown>[]>(
      `
        SELECT
          p.id_perfil AS idPerfil,
          c.id_cultivo AS idCultivo,
          c.nombre AS cultivoNombre,
          c.variedad,
          i.nombre AS invernaderoNombre,
          p.densidad_plantas_m2 AS densidadPlantasM2,
          p.sustrato_suelo AS sustratoSuelo,
          p.observaciones,
          fert.fertilizacion,
          manejo.manejo,
          sanidad.sanidad
        FROM dbo.Cultivos c
        INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        LEFT JOIN dbo.CultivoPerfilAgronomico p ON p.id_cultivo = c.id_cultivo
        OUTER APPLY (
          SELECT STRING_AGG(CONCAT(f.etapa, ': ', f.recomendacion), CHAR(10)) AS fertilizacion
          FROM dbo.CultivoFertilizacionEtapa f
          WHERE f.id_perfil = p.id_perfil
        ) fert
        OUTER APPLY (
          SELECT STRING_AGG(CONCAT(m.etapa, ': ', m.recomendacion), CHAR(10)) AS manejo
          FROM dbo.CultivoManejoEtapa m
          WHERE m.id_perfil = p.id_perfil
        ) manejo
        OUTER APPLY (
          SELECT STRING_AGG(CONCAT(s.nombre, ' (', s.nivel_riesgo, ')'), ', ') AS sanidad
          FROM dbo.CultivoPlagasEnfermedades s
          WHERE s.id_perfil = p.id_perfil
        ) sanidad
        ${where}
        ORDER BY c.nombre ASC
      `,
      params
    )

    return NextResponse.json(rows.map((row) => ({
      idPerfil: row.idPerfil != null ? String(row.idPerfil) : "",
      idCultivo: String(row.idCultivo || ""),
      cultivoNombre: String(row.cultivoNombre || ""),
      variedad: String(row.variedad || ""),
      invernaderoNombre: String(row.invernaderoNombre || ""),
      densidadPlantasM2: String(row.densidadPlantasM2 || ""),
      sustratoSuelo: String(row.sustratoSuelo || ""),
      observaciones: String(row.observaciones || ""),
      fertilizacion: String(row.fertilizacion || ""),
      manejo: String(row.manejo || ""),
      sanidad: String(row.sanidad || ""),
    })))
  } catch (err) {
    console.error("[agronomic-plan] GET Error:", err)
    return NextResponse.json({ error: "No se pudo cargar el plan agronomico" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const idCultivo = Number(body.idCultivo)
    if (!idCultivo) return NextResponse.json({ error: "Cultivo requerido" }, { status: 400 })

    const exists = await query<{ idPerfil: number }[]>(
      `
        SELECT p.id_perfil AS idPerfil
        FROM dbo.CultivoPerfilAgronomico p
        INNER JOIN dbo.Cultivos c ON c.id_cultivo = p.id_cultivo
        INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        WHERE p.id_cultivo = @idCultivo
          AND i.id_empresa = @empresaId
      `,
      { idCultivo, empresaId: session.empresaId }
    )

    if (exists[0]?.idPerfil) {
      await execute(
        `
          UPDATE dbo.CultivoPerfilAgronomico
          SET densidad_plantas_m2 = @densidad,
              sustrato_suelo = @sustrato,
              observaciones = @observaciones,
              fecha_actualizacion = GETDATE()
          WHERE id_perfil = @idPerfil
        `,
        {
          idPerfil: exists[0].idPerfil,
          densidad: body.densidadPlantasM2 || null,
          sustrato: body.sustratoSuelo || null,
          observaciones: body.observaciones || null,
        }
      )
      return NextResponse.json({ ok: true, id: String(exists[0].idPerfil) })
    }

    const result = await execute(
      `
        INSERT INTO dbo.CultivoPerfilAgronomico (
          id_cultivo, densidad_plantas_m2, sustrato_suelo, observaciones, fecha_creacion
        )
        OUTPUT INSERTED.id_perfil
        SELECT @idCultivo, @densidad, @sustrato, @observaciones, GETDATE()
        WHERE EXISTS (
          SELECT 1
          FROM dbo.Cultivos c
          INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
          WHERE c.id_cultivo = @idCultivo
            AND i.id_empresa = @empresaId
        )
      `,
      {
        idCultivo,
        empresaId: session.empresaId,
        densidad: body.densidadPlantasM2 || null,
        sustrato: body.sustratoSuelo || null,
        observaciones: body.observaciones || null,
      }
    )

    return NextResponse.json({ ok: true, id: String(result.recordset?.[0]?.id_perfil || "") })
  } catch (err) {
    console.error("[agronomic-plan] POST Error:", err)
    return NextResponse.json({ error: "No se pudo guardar el perfil agronomico" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  return POST(req)
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAuth()
    const { idPerfil } = await req.json()
    if (!idPerfil) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

    await execute(
      `
        DELETE p
        FROM dbo.CultivoPerfilAgronomico p
        INNER JOIN dbo.Cultivos c ON c.id_cultivo = p.id_cultivo
        INNER JOIN dbo.Invernaderos i ON i.id_invernadero = c.id_invernadero
        WHERE p.id_perfil = @idPerfil
          AND i.id_empresa = @empresaId
      `,
      { idPerfil: Number(idPerfil), empresaId: session.empresaId }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[agronomic-plan] DELETE Error:", err)
    return NextResponse.json({ error: "No se pudo eliminar el perfil" }, { status: 500 })
  }
}
