// API client for frontend -> backend communication
const BASE = "/api"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Error de red" }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// Auth
export const api = {
  login: (email: string, password: string) =>
    request<{ user: Record<string, unknown> }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  me: () =>
    request<{ user: Record<string, unknown> | null }>("/auth/me"),

  // Data
  greenhouses: () =>
    request<Array<Record<string, unknown>>>("/greenhouses"),

  dashboard: (greenhouse: string) =>
    request<Record<string, unknown>>(`/dashboard?greenhouse=${greenhouse}`),

  sensors: (greenhouse?: string) =>
    request<Array<Record<string, unknown>>>(`/sensors${greenhouse ? `?greenhouse=${greenhouse}` : ""}`),

  // Zones
  zones: (greenhouse?: string) =>
    request<Array<Record<string, unknown>>>(`/zones${greenhouse ? `?greenhouse=${greenhouse}` : ""}`),

  createZone: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/zones", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateZone: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/zones", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    }),

  // Alerts
  alerts: () =>
    request<Array<Record<string, unknown>>>("/alerts"),

  resolveAlert: (id: string) =>
    request<Record<string, unknown>>("/alerts", {
      method: "PATCH",
      body: JSON.stringify({ id }),
    }),

  resolveAllAlerts: () =>
    request<Record<string, unknown>>("/alerts", {
      method: "PATCH",
      body: JSON.stringify({ action: "resolve_all" }),
    }),

  clearResolvedAlerts: () =>
    request<Record<string, unknown>>("/alerts", {
      method: "PATCH",
      body: JSON.stringify({ action: "clear_resolved" }),
    }),

  // Users
  users: () =>
    request<Array<Record<string, unknown>>>("/users"),

  createUser: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/users", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    }),

  // Settings
  settings: () =>
    request<Record<string, unknown>>("/settings"),

  updateSettings: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
}

// SWR fetcher
export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })
