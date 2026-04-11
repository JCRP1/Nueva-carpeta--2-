import { timingSafeEqual } from "crypto"

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export function isValidIotKey(req: Request): boolean {
  const configured = process.env.IOT_API_KEY || process.env.JWT_SECRET || "greensense-dev-iot-key"
  const headerKey =
    req.headers.get("x-iot-key") ||
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    ""

  if (!headerKey) return false
  return safeEqual(headerKey, configured)
}
