import { execute } from "@/lib/db"
import type { SessionPayload } from "@/lib/auth"

type Severidad = "info" | "advertencia" | "critica"
type Origen = "web" | "api" | "iot" | "sistema"

interface BitacoraInput {
  session?: SessionPayload | null
  req?: Request
  descripcion: string
  modulo: string
  entidad: string
  entidadId?: string | number | null
  accion: string
  severidad?: Severidad
  idDispositivo?: number | null
  valorAnterior?: unknown
  valorNuevo?: unknown
  notas?: string | null
  origen?: Origen
}

function toJson(value: unknown) {
  if (value == null) return null
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getIpFromRequest(req?: Request) {
  if (!req) return null
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null
  }
  return req.headers.get("x-real-ip") || null
}

export async function registrarBitacora(input: BitacoraInput) {
  try {
    await execute(
      `INSERT INTO Bitacora
        (id_dispositivo, descripcion, severidad, fecha, id_usuario, notas, modulo, entidad, entidad_id, accion, valor_anterior, valor_nuevo, ip_origen, origen, fecha_creacion)
       SELECT
        CASE
          WHEN @idDispositivo IS NOT NULL
           AND EXISTS (SELECT 1 FROM DispositivosIoT WHERE id_dispositivo = @idDispositivo)
          THEN @idDispositivo
          ELSE NULL
        END,
        @descripcion,
        @severidad,
        GETDATE(),
        CASE
          WHEN @idUsuario IS NOT NULL
           AND EXISTS (SELECT 1 FROM Usuarios WHERE id_usuario = @idUsuario)
          THEN @idUsuario
          ELSE NULL
        END,
        @notas,
        @modulo,
        @entidad,
        @entidadId,
        @accion,
        @valorAnterior,
        @valorNuevo,
        @ipOrigen,
        @origen,
        GETDATE()`,
      {
        idDispositivo: input.idDispositivo ?? null,
        descripcion: input.descripcion,
        severidad: input.severidad || "info",
        idUsuario: input.session?.userId ?? null,
        notas: input.notas || null,
        modulo: input.modulo,
        entidad: input.entidad,
        entidadId: input.entidadId != null ? String(input.entidadId) : null,
        accion: input.accion,
        valorAnterior: toJson(input.valorAnterior),
        valorNuevo: toJson(input.valorNuevo),
        ipOrigen: getIpFromRequest(input.req),
        origen: input.origen || "web",
      }
    )
  } catch (error: any) {
    console.error("[Bitacora]", {
      message: error?.message,
      number: error?.number,
      state: error?.state,
      lineNumber: error?.lineNumber,
    })
  }
}
