export function formatCompanyCode(id: number | string): string {
  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId < 0) return ""
  return `EMP-${String(Math.trunc(numericId)).padStart(4, "0")}`
}

export function normalizeCompanyCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "")
}

export function parseCompanyCode(code: string): number | null {
  const normalized = normalizeCompanyCode(code)
  const empMatch = normalized.match(/^EMP-?(\d{1,})$/)
  if (empMatch) {
    const parsed = Number(empMatch[1])
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }

  return null
}

export function generateCompanyCode(sequence: number): string {
  return formatCompanyCode(sequence)
}
