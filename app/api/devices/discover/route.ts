import { exec as execCallback } from "child_process"
import { Socket } from "net"
import { networkInterfaces } from "os"
import { promisify } from "util"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"

interface NetworkCandidate {
  subnet: string
  base: string
}

interface ProbeTarget {
  ip: string
  port: number
  subnet: string
  manual?: boolean
}

interface HttpProbeTarget extends ProbeTarget {
  path: string
  url: string
}

interface DiscoveredDevice {
  ip: string
  port: number
  path: string
  url: string
  deviceName: string | null
  deviceCode: string | null
  firmwareVersion: string | null
  chipModel: string | null
  macAddress: string | null
  freeHeap: number | null
  rssi: number | null
  uptime: number | null
  cores: number | null
  clockSpeed: number | null
  confidence: "high" | "medium"
  source: string
}

const exec = promisify(execCallback)
const DEFAULT_PORTS = [80, 8080, 81, 8000, 8888, 3000, 5000]
const DEFAULT_PATHS = ["/status", "/api/status", "/info", "/api/info", "/device", "/health", "/json", "/"]
const DEFAULT_ESPRESSIF_OUIS = [
  "18:FE:34",
  "24:0A:C4",
  "24:58:7C",
  "24:62:AB",
  "24:6F:28",
  "24:B2:DE",
  "30:AE:A4",
  "30:C6:F7",
  "30:ED:A0",
  "3C:61:05",
  "40:22:D8",
  "58:BF:25",
  "5C:01:3B",
  "60:55:F9",
  "7C:9E:BD",
  "7C:DF:A1",
  "84:0D:8E",
  "84:F3:EB",
  "8C:4B:14",
  "8C:8C:29",
  "8C:BF:EA",
  "94:B9:7E",
  "A0:85:E3",
  "A4:CF:12",
  "B4:E6:2D",
  "C4:4F:33",
  "C8:2B:96",
  "CC:50:E3",
  "D8:13:2A",
  "DC:06:75",
  "DC:1E:D5",
  "E0:5A:1B",
  "E0:8C:FE",
  "EC:64:C9",
  "EC:DA:3B",
  "F0:08:D1",
  "F4:12:FA",
  "F4:65:0B",
]

function parseEnvInt(name: string, fallback: number, min: number, max: number) {
  const rawValue = process.env[name]
  if (!rawValue) return fallback

  const parsedValue = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsedValue)) return fallback

  return Math.min(max, Math.max(min, parsedValue))
}

function parseEnvList(name: string, fallback: string[]) {
  const rawValue = process.env[name]
  if (!rawValue) return fallback

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  return values.length > 0 ? Array.from(new Set(values)) : fallback
}

function parseEnvPorts() {
  const ports = parseEnvList("ESP32_DISCOVERY_PORTS", DEFAULT_PORTS.map(String))
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 65535)

  return ports.length > 0 ? Array.from(new Set(ports)) : DEFAULT_PORTS
}

function parseEnvPaths() {
  return parseEnvList("ESP32_DISCOVERY_PATHS", DEFAULT_PATHS).map((path) =>
    path.startsWith("/") ? path : `/${path}`
  )
}

function parseEnvOuiPrefixes() {
  return parseEnvList("ESP32_DISCOVERY_OUIS", DEFAULT_ESPRESSIF_OUIS)
    .map((value) => value.trim().toUpperCase().replace(/-/g, ":"))
    .filter((value) => /^([0-9A-F]{2}:){2}[0-9A-F]{2}$/.test(value))
}

const HTTP_PORTS = parseEnvPorts()
const HTTP_PATHS = parseEnvPaths()
const ESPRESSIF_OUIS = parseEnvOuiPrefixes()
const HOST_SCAN_START = parseEnvInt("ESP32_DISCOVERY_HOST_START", 1, 1, 254)
const HOST_SCAN_END = parseEnvInt("ESP32_DISCOVERY_HOST_END", 254, 1, 254)
const TCP_TIMEOUT_MS = parseEnvInt("ESP32_DISCOVERY_TCP_TIMEOUT_MS", 250, 100, 2000)
const REQUEST_TIMEOUT_MS = parseEnvInt("ESP32_DISCOVERY_TIMEOUT_MS", 800, 200, 5000)
const CONCURRENCY = parseEnvInt("ESP32_DISCOVERY_CONCURRENCY", 48, 1, 512)

function isPrivateIpv4(ip: string) {
  return ip.startsWith("10.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
}

function isIpv4(ip: string) {
  const octets = ip.trim().split(".")
  if (octets.length !== 4) return false

  return octets.every((octet) => {
    if (!/^\d{1,3}$/.test(octet)) return false
    const value = Number(octet)
    return value >= 0 && value <= 255
  })
}

function parseTargetIps(value: string | null) {
  if (!value) return []

  return Array.from(
    new Set(
      value
        .split(/[,\s;]+/)
        .map((ip) => ip.trim())
        .filter((ip) => isIpv4(ip))
    )
  )
}

function getNetworkCandidates() {
  const blockedNames = ["virtual", "vmware", "vethernet", "loopback", "bluetooth", "tailscale", "docker"]
  const seen = new Set<string>()
  const candidates: NetworkCandidate[] = []

  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (!addresses) continue
    const normalizedName = name.toLowerCase()
    if (blockedNames.some((item) => normalizedName.includes(item))) continue

    for (const address of addresses) {
      if (address.family !== "IPv4" || address.internal) continue
      if (!isPrivateIpv4(address.address)) continue

      const octets = address.address.split(".")
      if (octets.length !== 4) continue

      const base = `${octets[0]}.${octets[1]}.${octets[2]}`
      if (seen.has(base)) continue

      seen.add(base)
      candidates.push({ subnet: `${base}.0/24`, base })
    }
  }

  return candidates
}

function getNetworkCandidatesFromIps(ips: string[]) {
  const seen = new Set<string>()
  const candidates: NetworkCandidate[] = []

  for (const ip of ips) {
    const octets = ip.split(".")
    const base = `${octets[0]}.${octets[1]}.${octets[2]}`
    if (seen.has(base)) continue

    seen.add(base)
    candidates.push({ subnet: `${base}.0/24`, base })
  }

  return candidates
}

function buildTcpTargets(networks: NetworkCandidate[]) {
  const targets: ProbeTarget[] = []
  const hostStart = Math.min(HOST_SCAN_START, HOST_SCAN_END)
  const hostEnd = Math.max(HOST_SCAN_START, HOST_SCAN_END)

  for (const network of networks) {
    for (let host = hostStart; host <= hostEnd; host += 1) {
      const ip = `${network.base}.${host}`
      for (const port of HTTP_PORTS) {
        targets.push({ ip, port, subnet: network.subnet })
      }
    }
  }

  return targets
}

function buildTcpTargetsFromIps(ips: string[]) {
  return ips.flatMap((ip) =>
    HTTP_PORTS.map((port) => ({
      ip,
      port,
      subnet: `${ip.split(".").slice(0, 3).join(".")}.0/24`,
      manual: true,
    }))
  )
}

function buildHttpTargets(openTargets: ProbeTarget[]) {
  return openTargets.flatMap((target) =>
    HTTP_PATHS.map((path) => ({
      ...target,
      path,
      url: `http://${target.ip}:${target.port}${path}`,
    }))
  )
}

function extractValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" || typeof value === "boolean") return String(value)
  }
  return null
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsedValue = Number(value)
    if (Number.isFinite(parsedValue)) return parsedValue
  }
  return null
}

function isMacAddress(value: string) {
  return /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value)
}

function normalizeDeviceCode(value: string | null) {
  if (!value) return null
  const normalizedValue = value.trim().replace(/\s+/g, "-").toUpperCase()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizeMacAddress(value: string | null) {
  if (!value) return null
  const cleanedValue = value.trim()
  return isMacAddress(cleanedValue) ? cleanedValue.toUpperCase().replace(/-/g, ":") : null
}

function isEspressifMac(value: string | null) {
  const macAddress = normalizeMacAddress(value)
  if (!macAddress) return false
  const prefix = macAddress.split(":").slice(0, 3).join(":")
  return ESPRESSIF_OUIS.includes(prefix)
}

function extractTextMatch(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (!match) continue

    const value = (match[1] || match[0] || "").trim()
    if (value) return value
  }

  return null
}

function parseDevicePayload(source: string, contentType: string) {
  const trimmedSource = source.trim()
  if (!trimmedSource) return null

  if (contentType.includes("json") || trimmedSource.startsWith("{") || trimmedSource.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmedSource) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }

  return null
}

function payloadContainsEsp32(payload: Record<string, unknown> | null) {
  if (!payload) return false

  const candidateKeys = ["chipModel", "model", "board", "chip", "deviceName", "name", "deviceCode", "code"]
  return candidateKeys.some((key) => {
    const value = payload[key]
    return typeof value === "string" && value.toLowerCase().includes("esp32")
  })
}

function matchesEsp32Signature(payload: Record<string, unknown> | null, source: string) {
  const sourceLower = source.toLowerCase()
  const hasEsp32TextMarker =
    sourceLower.includes("esp32") ||
    /\besp32(?:-[a-z0-9]+)?\b/i.test(source) ||
    /\bchip(?:\s*model)?[:\s=]+esp32\b/i.test(source)

  const hasEsp32PayloadMarker = payloadContainsEsp32(payload)
  const hasEspressifPlusEsp32Hints =
    sourceLower.includes("espressif") &&
    (sourceLower.includes("chipid") ||
      sourceLower.includes("freeheap") ||
      sourceLower.includes("firmware") ||
      sourceLower.includes("rssi") ||
      sourceLower.includes("uptime"))

  return hasEsp32TextMarker || hasEsp32PayloadMarker || hasEspressifPlusEsp32Hints
}

function extractDeviceData(target: HttpProbeTarget, payload: Record<string, unknown> | null, source: string) {
  const sourceLower = source.toLowerCase()

  let deviceName =
    extractValue(payload ?? {}, ["deviceName", "name", "hostname", "device", "boardName"]) ??
    extractTextMatch(source, [
      /(?:Device|Nombre|Name|Hostname)[:\s=]+([^\n\r<]+)/i,
      /<title>([^<]{1,120})<\/title>/i,
    ])

  let deviceCode =
    normalizeDeviceCode(
      extractValue(payload ?? {}, ["deviceCode", "code", "chipId", "deviceId", "serial", "id"]) ??
        extractTextMatch(source, [
          /DeviceCode[:\s=]+([A-Z0-9-_]+)/i,
          /Code[:\s=]+([A-Z0-9-_]+)/i,
          /\b(ESP32[-_A-Z0-9]+)\b/i,
          /ChipID[:\s=]+([A-F0-9]{6,16})/i,
        ])
    )

  let firmwareVersion =
    extractValue(payload ?? {}, ["firmwareVersion", "firmware", "version", "fw_version"]) ??
    extractTextMatch(source, [
      /(?:Firmware|Version|FW|Ver)[\s:=]+([0-9][0-9A-Za-z.\-_]*)/i,
      /\bv([0-9][0-9A-Za-z.\-_]*)\b/i,
    ])

  let chipModel =
    extractValue(payload ?? {}, ["chipModel", "model", "board", "chip"]) ??
    extractTextMatch(source, [/\b(ESP32(?:-[A-Z0-9]+)?)\b/i])

  if (!chipModel) {
    if (sourceLower.includes("esp32")) chipModel = "ESP32"
  }

  const macAddress = normalizeMacAddress(
    extractValue(payload ?? {}, ["macAddress", "mac", "hwaddr", "ethMac", "staMac"]) ??
      extractTextMatch(source, [
        /MAC(?:\s*Address)?[:\s=]+(([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})/i,
        /(([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})/,
      ])
  )

  const freeHeap =
    parseNumber(payload?.freeHeap) ??
    parseNumber(
      extractTextMatch(source, [
        /Free\s*Heap[:\s=]+(\d+)/i,
        /Heap[:\s=]+(\d+)/i,
      ])
    )

  const rssi =
    parseNumber(payload?.rssi) ??
    parseNumber(
      extractTextMatch(source, [
        /RSSI[:\s=]+(-?\d+)/i,
        /Signal[:\s=]+(-?\d+)/i,
      ])
    )

  const uptime =
    parseNumber(payload?.uptime) ??
    parseNumber(
      extractTextMatch(source, [
        /Uptime[:\s=]+(\d+)/i,
        /Running\s*time[:\s=]+(\d+)/i,
      ])
    )

  const cores =
    parseNumber(payload?.cores) ??
    parseNumber(extractTextMatch(source, [/Cores?[:\s=]+(\d+)/i]))

  const clockSpeed =
    parseNumber(payload?.clockSpeed) ??
    parseNumber(
      extractTextMatch(source, [
        /Clock\s*Speed[:\s=]+(\d+)/i,
        /CPU[:\s=]+(\d+)/i,
      ])
    )

  if (!deviceCode && macAddress) {
    deviceCode = `ESP32-${macAddress.replace(/:/g, "")}`
  }

  if (!deviceName && deviceCode) {
    deviceName = deviceCode
  }

  const isEsp32Device =
    sourceLower.includes("esp32") ||
    (chipModel ? chipModel.toLowerCase().includes("esp32") : false) ||
    (deviceCode ? deviceCode.toLowerCase().includes("esp32") : false) ||
    payloadContainsEsp32(payload)

  if (!isEsp32Device) return null

  const evidenceCount = [deviceName, deviceCode, firmwareVersion, chipModel, macAddress].filter(Boolean).length
  if (evidenceCount === 0) return null

  return {
    subnet: target.subnet,
    ip: target.ip,
    port: target.port,
    path: target.path,
    url: target.url,
    deviceName: deviceName || null,
    deviceCode: deviceCode || null,
    firmwareVersion: firmwareVersion || null,
    chipModel: chipModel || null,
    macAddress,
    freeHeap,
    rssi,
    uptime,
    cores,
    clockSpeed,
    confidence: evidenceCount >= 2 ? "high" : "medium",
    source: source.slice(0, 200),
  }
}

async function probeTcpPort(target: ProbeTarget) {
  return new Promise<ProbeTarget | null>((resolve) => {
    const socket = new Socket()
    let settled = false

    const finish = (result: ProbeTarget | null) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(TCP_TIMEOUT_MS)
    socket.once("connect", () => finish(target))
    socket.once("timeout", () => finish(null))
    socket.once("error", () => finish(null))
    socket.once("close", () => finish(null))
    socket.connect(target.port, target.ip)
  })
}

async function probeHttpTarget(target: HttpProbeTarget) {
  try {
    const response = await fetch(target.url, {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/json, text/plain;q=0.9, text/html;q=0.8",
      },
      cache: "no-store",
    })

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || ""
    const source = await response.text()
    if (!source.trim()) return null

    const payload = parseDevicePayload(source, contentType)
    if (!matchesEsp32Signature(payload, source)) {
      if (!target.manual) return null

      return {
        subnet: target.subnet,
        ip: target.ip,
        port: target.port,
        path: target.path,
        url: target.url,
        deviceName: `Dispositivo HTTP ${target.ip}`,
        deviceCode: null,
        firmwareVersion: null,
        chipModel: null,
        macAddress: null,
        freeHeap: null,
        rssi: null,
        uptime: null,
        cores: null,
        clockSpeed: null,
        confidence: "medium" as const,
        source: source.slice(0, 200),
      }
    }

    return extractDeviceData(target, payload, source)
  } catch {
    return null
  }
}

async function readArpTable() {
  try {
    const { stdout } = await exec("arp -a")
    return stdout
  } catch {
    return ""
  }
}

function extractArpEntries(arpTable: string, networks: NetworkCandidate[]) {
  const allowedBases = new Set(networks.map((network) => network.base))
  const entries: Array<{ ip: string; macAddress: string }> = []
  const linePattern = /(\d+\.\d+\.\d+\.\d+)\s+(([0-9a-f]{2}-){5}[0-9a-f]{2})/i

  for (const rawLine of arpTable.split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = line.match(linePattern)
    if (!match) continue

    const ip = match[1]
    const octets = ip.split(".")
    if (octets.length !== 4) continue

    const base = `${octets[0]}.${octets[1]}.${octets[2]}`
    if (!allowedBases.has(base)) continue

    const macAddress = normalizeMacAddress(match[2])
    if (!macAddress) continue

    entries.push({ ip, macAddress })
  }

  return entries
}

function buildArpOnlyDevices(
  arpEntries: Array<{ ip: string; macAddress: string }>,
  discovered: Array<DiscoveredDevice & { subnet: string }>,
  networks: NetworkCandidate[]
) {
  const discoveredIps = new Set(discovered.map((device) => device.ip))
  const subnetByBase = new Map(networks.map((network) => [network.base, network.subnet]))

  return arpEntries
    .filter((entry) => isEspressifMac(entry.macAddress) && !discoveredIps.has(entry.ip))
    .map((entry) => {
      const octets = entry.ip.split(".")
      const base = `${octets[0]}.${octets[1]}.${octets[2]}`

      return {
        subnet: subnetByBase.get(base) || `${base}.0/24`,
        ip: entry.ip,
        port: 0,
        path: "",
        url: "",
        deviceName: "ESP32 detectado por red",
        deviceCode: `ESP32-${entry.macAddress.replace(/:/g, "")}`,
        firmwareVersion: null,
        chipModel: "ESP32",
        macAddress: entry.macAddress,
        freeHeap: null,
        rssi: null,
        uptime: null,
        cores: null,
        clockSpeed: null,
        confidence: "medium" as const,
        source: "arp-espressif",
      }
    })
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = []
  let index = 0

  async function runWorker() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await worker(items[currentIndex])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()))
  return results
}

function dedupeDiscoveredDevices(devices: Array<DiscoveredDevice & { subnet: string }>) {
  const byAddress = new Map<string, DiscoveredDevice & { subnet: string }>()

  for (const device of devices) {
    const key = device.macAddress || device.deviceCode || `${device.ip}:${device.port}`
    const existing = byAddress.get(key)
    if (!existing) {
      byAddress.set(key, device)
      continue
    }

    const existingScore = [existing.deviceName, existing.deviceCode, existing.firmwareVersion, existing.macAddress].filter(Boolean).length
    const nextScore = [device.deviceName, device.deviceCode, device.firmwareVersion, device.macAddress].filter(Boolean).length

    if (nextScore > existingScore || (nextScore === existingScore && device.path !== "/")) {
      byAddress.set(key, device)
    }
  }

  return Array.from(byAddress.values()).sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1
    return a.ip.localeCompare(b.ip) || a.port - b.port
  })
}

export async function GET(req: Request) {
  try {
    await requireAdmin()

    const startedAt = Date.now()
    const { searchParams } = new URL(req.url)
    const targetIps = parseTargetIps(searchParams.get("ips"))
    const manualScan = targetIps.length > 0
    const networks = manualScan ? getNetworkCandidatesFromIps(targetIps) : getNetworkCandidates()
    const tcpTargets = manualScan ? buildTcpTargetsFromIps(targetIps) : buildTcpTargets(networks)
    const openTargets = (await mapWithConcurrency(tcpTargets, CONCURRENCY, probeTcpPort)).filter(
      (item): item is ProbeTarget => Boolean(item)
    )

    const httpTargets = buildHttpTargets(openTargets)
    const httpDiscovered = (await mapWithConcurrency(httpTargets, CONCURRENCY, probeHttpTarget)).filter(
      (item): item is DiscoveredDevice & { subnet: string } => Boolean(item)
    )
    const arpEntries = manualScan ? [] : extractArpEntries(await readArpTable(), networks)
    const arpOnlyDiscovered = buildArpOnlyDevices(arpEntries, httpDiscovered, networks)
    const discovered = dedupeDiscoveredDevices(
      [...httpDiscovered, ...arpOnlyDiscovered]
    )

    return NextResponse.json({
      networks: networks.map((network) => network.subnet),
      manualScan,
      targetIps,
      scannedTargets: tcpTargets.length,
      liveTargets: openTargets.length,
      httpTargets: httpTargets.length,
      arpCandidates: arpEntries.length,
      hostRange: [Math.min(HOST_SCAN_START, HOST_SCAN_END), Math.max(HOST_SCAN_START, HOST_SCAN_END)],
      ports: HTTP_PORTS,
      paths: HTTP_PATHS,
      tcpTimeoutMs: TCP_TIMEOUT_MS,
      timeoutMs: REQUEST_TIMEOUT_MS,
      durationMs: Date.now() - startedAt,
      discovered,
    })
  } catch (error: any) {
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }

    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    console.error("[Devices Discover]", error)
    return NextResponse.json({ error: "No se pudo escanear la red local" }, { status: 500 })
  }
}
