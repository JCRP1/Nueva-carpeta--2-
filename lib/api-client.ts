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

  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  validateResetPasswordToken: (token: string) =>
    request<{ valid: boolean; email?: string; nombre?: string }>(
      "/auth/reset-password?token=" + encodeURIComponent(token)
    ),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  // Data
  greenhouses: () =>
    request<Array<Record<string, unknown>>>("/greenhouses"),

  createGreenhouses: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/greenhouses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateGreenhouses: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/greenhouses", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    }),

  deleteGreenhouses: (id: string) =>
    request<Record<string, unknown>>("/greenhouses", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),

  // Crops
  crops: (greenhouse?: string) =>
    request<Array<Record<string, unknown>>>(`/crops${greenhouse ? `?greenhouse=${greenhouse}` : ""}`),

  createCrop: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/crops", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCrop: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/crops", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    }),

  deleteCrop: (id: string) =>
    request<Record<string, unknown>>("/crops", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),

  dashboard: (greenhouse: string) =>
    request<Record<string, unknown>>(`/dashboard?greenhouse=${greenhouse}`),

  sensors: (greenhouse?: string) =>
    request<Array<Record<string, unknown>>>(`/sensors${greenhouse ? `?greenhouse=${greenhouse}` : ""}`),

  createSensor: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/sensors", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSensor: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/sensors", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    }),

  getSensorProgramming: (sensorId: string) =>
    request<{ programacion: Record<string, unknown> | null }>(`/sensors/${sensorId}/program`),

  programSensor: (sensorId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/sensors/${sensorId}/program`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

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


deleteUser: (id: string) =>
  request<Record<string, unknown>>("/users", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  }),

  // People
  people: () =>
    request<Array<Record<string, unknown>>>("/people"),

  createPerson: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/people", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePerson: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/people", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    }),

  deletePerson: (id: string) =>
    request<Record<string, unknown>>("/people", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),
  
  // Settings
  settings: () =>
    request<Record<string, unknown>>("/settings"),

  updateSettings: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Devices
  devices: () =>
    request<Array<Record<string, unknown>>>("/devices"),

  createDevice: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/devices", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDevice: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/devices", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    }),

  deleteDevice: (id: string) =>
    request<Record<string, unknown>>("/devices", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),

  createMetodoRiego: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/metodos-riego", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}

export const fetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: "include",
  })
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`)
    throw error
  }
  return res.json()
}
