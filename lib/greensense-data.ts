// GreenSense IoT Dashboard - Types & Mock Data

export type UserRole = "administrador" | "tecnico" | "agricultor"

export interface User {
  id: string
  nombre: string
  email: string
  rol: UserRole
  empresaId: string
  activo: boolean
  ultimoAcceso: string
}

export interface Empresa {
  id: string
  nombre: string
  ubicacion: string
}

export interface Invernadero {
  id: string
  nombre: string
  empresaId: string
  ubicacion: string
  area: number
  estado: "activo" | "inactivo" | "mantenimiento"
}

export interface Cultivo {
  id: string
  nombre: string
  variedad: string
  invernaderoId: string
  fechaSiembra: string
  detalle?: {
    id: string
    fechaCosechaEstimada: string
    tiempoGerminacionDias: number
    tiempoCrecimientoDias: number
    tiempoCosechaDias: number
    notas: string
  }
}

export interface Sensor {
  id: string
  tipo: "humedad_suelo" | "temperatura" | "humedad_ambiental" | "tds" | "ph"
  nombre: string
  invernaderoId: string
  zonaRiegoId: string
  estado: "activo" | "inactivo" | "error"
  ultimaLectura: number
  unidad: string
  umbralMin: number
  umbralMax: number
  ultimaActualizacion: string
}

export interface ZonaRiego {
  id: string
  nombre: string
  invernaderoId: string
  cultivoActual: string
  estadoRiego: "activo" | "inactivo" | "programado"
  umbralHumedad: number
  humedadActual: number
  ultimoRiego: string
  duracionUltimoRiego: number
  volumenUltimoRiego: number
}

export interface Alerta {
  id: string
  tipo: "critica" | "advertencia" | "info"
  mensaje: string
  sensorId: string
  invernaderoId: string
  timestamp: string
  resuelta: boolean
}

export interface EventoRiego {
  id: string
  zonaRiegoId: string
  zonaNombre: string
  tipo: "automatico" | "manual"
  inicio: string
  fin: string
  duracion: number
  volumen: number
  estado: "completado" | "en_curso" | "cancelado"
}

export interface LecturaSensor {
  timestamp: string
  valor: number
}

// Mock data
export const currentUser: User = {
  id: "u1",
  nombre: "Carlos Martinez",
  email: "carlos@greensense.io",
  rol: "administrador",
  empresaId: "e1",
  activo: true,
  ultimoAcceso: "2026-02-07T10:30:00Z",
}

export const empresa: Empresa = {
  id: "e1",
  nombre: "Invernadero Pedro Castillo",
  ubicacion: "San Jose de Ocoa, RD",
}

export const invernaderos: Invernadero[] = [
  { id: "inv1", nombre: "Invernadero A - Tomates", empresaId: "e1", ubicacion: "Sector Norte", area: 2500, estado: "activo" },
  { id: "inv2", nombre: "Invernadero B - Pimientos", empresaId: "e1", ubicacion: "Sector Sur", area: 1800, estado: "activo" },
  { id: "inv3", nombre: "Invernadero C - Lechugas", empresaId: "e1", ubicacion: "Sector Este", area: 1200, estado: "mantenimiento" },
]

export const sensores: Sensor[] = [
  { id: "s1", tipo: "humedad_suelo", nombre: "Humedad Suelo Z1", invernaderoId: "inv1", zonaRiegoId: "z1", estado: "activo", ultimaLectura: 42, unidad: "%", umbralMin: 35, umbralMax: 75, ultimaActualizacion: "2026-02-07T10:28:00Z" },
  { id: "s2", tipo: "temperatura", nombre: "Temp. Ambiental", invernaderoId: "inv1", zonaRiegoId: "z1", estado: "activo", ultimaLectura: 28.5, unidad: "C", umbralMin: 18, umbralMax: 35, ultimaActualizacion: "2026-02-07T10:28:00Z" },
  { id: "s3", tipo: "humedad_ambiental", nombre: "Humedad Amb.", invernaderoId: "inv1", zonaRiegoId: "z1", estado: "activo", ultimaLectura: 68, unidad: "%", umbralMin: 40, umbralMax: 85, ultimaActualizacion: "2026-02-07T10:28:00Z" },
  { id: "s4", tipo: "tds", nombre: "TDS Nutrientes", invernaderoId: "inv1", zonaRiegoId: "z1", estado: "activo", ultimaLectura: 850, unidad: "ppm", umbralMin: 500, umbralMax: 1200, ultimaActualizacion: "2026-02-07T10:28:00Z" },
  { id: "s5", tipo: "humedad_suelo", nombre: "Humedad Suelo Z2", invernaderoId: "inv1", zonaRiegoId: "z2", estado: "activo", ultimaLectura: 31, unidad: "%", umbralMin: 35, umbralMax: 75, ultimaActualizacion: "2026-02-07T10:27:00Z" },
  { id: "s6", tipo: "temperatura", nombre: "Temp. Amb. B", invernaderoId: "inv2", zonaRiegoId: "z3", estado: "activo", ultimaLectura: 26.8, unidad: "C", umbralMin: 18, umbralMax: 35, ultimaActualizacion: "2026-02-07T10:28:00Z" },
  { id: "s7", tipo: "humedad_suelo", nombre: "Humedad Suelo Z3", invernaderoId: "inv2", zonaRiegoId: "z3", estado: "error", ultimaLectura: 0, unidad: "%", umbralMin: 35, umbralMax: 75, ultimaActualizacion: "2026-02-07T09:15:00Z" },
  { id: "s8", tipo: "tds", nombre: "TDS Nutrientes B", invernaderoId: "inv2", zonaRiegoId: "z3", estado: "activo", ultimaLectura: 720, unidad: "ppm", umbralMin: 500, umbralMax: 1200, ultimaActualizacion: "2026-02-07T10:28:00Z" },
]

export const zonasRiego: ZonaRiego[] = [
  { id: "z1", nombre: "Zona 1 - Tomates Cherry", invernaderoId: "inv1", cultivoActual: "Tomate Cherry", estadoRiego: "inactivo", umbralHumedad: 35, humedadActual: 42, ultimoRiego: "2026-02-07T08:00:00Z", duracionUltimoRiego: 15, volumenUltimoRiego: 120 },
  { id: "z2", nombre: "Zona 2 - Tomates Roma", invernaderoId: "inv1", cultivoActual: "Tomate Roma", estadoRiego: "activo", umbralHumedad: 35, humedadActual: 31, ultimoRiego: "2026-02-07T10:25:00Z", duracionUltimoRiego: 0, volumenUltimoRiego: 0 },
  { id: "z3", nombre: "Zona 3 - Pimientos", invernaderoId: "inv2", cultivoActual: "Pimiento Morron", estadoRiego: "inactivo", umbralHumedad: 40, humedadActual: 55, ultimoRiego: "2026-02-07T07:30:00Z", duracionUltimoRiego: 20, volumenUltimoRiego: 180 },
  { id: "z4", nombre: "Zona 4 - Lechugas", invernaderoId: "inv3", cultivoActual: "Lechuga Romana", estadoRiego: "inactivo", umbralHumedad: 45, humedadActual: 52, ultimoRiego: "2026-02-06T16:00:00Z", duracionUltimoRiego: 10, volumenUltimoRiego: 80 },
]

export const alertas: Alerta[] = [
  { id: "a1", tipo: "critica", mensaje: "Sensor de humedad Z3 sin respuesta desde hace 1h", sensorId: "s7", invernaderoId: "inv2", timestamp: "2026-02-07T10:15:00Z", resuelta: false },
  { id: "a2", tipo: "advertencia", mensaje: "Humedad del suelo por debajo del umbral en Zona 2", sensorId: "s5", invernaderoId: "inv1", timestamp: "2026-02-07T10:25:00Z", resuelta: false },
  { id: "a3", tipo: "info", mensaje: "Riego automatico iniciado en Zona 2", sensorId: "s5", invernaderoId: "inv1", timestamp: "2026-02-07T10:25:30Z", resuelta: false },
  { id: "a4", tipo: "advertencia", mensaje: "Temperatura cercana al limite superior (33C)", sensorId: "s2", invernaderoId: "inv1", timestamp: "2026-02-07T09:45:00Z", resuelta: true },
  { id: "a5", tipo: "critica", mensaje: "Fallo en valvula solenoide Zona 4", sensorId: "", invernaderoId: "inv3", timestamp: "2026-02-06T15:30:00Z", resuelta: true },
  { id: "a6", tipo: "info", mensaje: "Mantenimiento programado Invernadero C completado", sensorId: "", invernaderoId: "inv3", timestamp: "2026-02-06T12:00:00Z", resuelta: true },
]

export const eventosRiego: EventoRiego[] = [
  { id: "r1", zonaRiegoId: "z2", zonaNombre: "Zona 2 - Tomates Roma", tipo: "automatico", inicio: "2026-02-07T10:25:00Z", fin: "", duracion: 0, volumen: 0, estado: "en_curso" },
  { id: "r2", zonaRiegoId: "z1", zonaNombre: "Zona 1 - Tomates Cherry", tipo: "automatico", inicio: "2026-02-07T08:00:00Z", fin: "2026-02-07T08:15:00Z", duracion: 15, volumen: 120, estado: "completado" },
  { id: "r3", zonaRiegoId: "z3", zonaNombre: "Zona 3 - Pimientos", tipo: "manual", inicio: "2026-02-07T07:30:00Z", fin: "2026-02-07T07:50:00Z", duracion: 20, volumen: 180, estado: "completado" },
  { id: "r4", zonaRiegoId: "z4", zonaNombre: "Zona 4 - Lechugas", tipo: "automatico", inicio: "2026-02-06T16:00:00Z", fin: "2026-02-06T16:10:00Z", duracion: 10, volumen: 80, estado: "completado" },
  { id: "r5", zonaRiegoId: "z1", zonaNombre: "Zona 1 - Tomates Cherry", tipo: "automatico", inicio: "2026-02-06T14:00:00Z", fin: "2026-02-06T14:12:00Z", duracion: 12, volumen: 95, estado: "completado" },
  { id: "r6", zonaRiegoId: "z2", zonaNombre: "Zona 2 - Tomates Roma", tipo: "automatico", inicio: "2026-02-06T13:30:00Z", fin: "2026-02-06T13:48:00Z", duracion: 18, volumen: 145, estado: "completado" },
]

// Generate time-series sensor data for charts
export function generateSensorHistory(baseValue: number, variance: number, points: number): LecturaSensor[] {
  const data: LecturaSensor[] = []
  const now = new Date("2026-02-07T10:30:00Z")
  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 15 * 60 * 1000)
    const noise = (Math.random() - 0.5) * variance * 2
    data.push({
      timestamp: time.toISOString(),
      valor: Math.round((baseValue + noise) * 10) / 10,
    })
  }
  return data
}

export const humedadSueloHistory = generateSensorHistory(42, 8, 48)
export const temperaturaHistory = generateSensorHistory(28.5, 3, 48)
export const humedadAmbientalHistory = generateSensorHistory(68, 6, 48)
export const tdsHistory = generateSensorHistory(850, 100, 48)

// Daily water consumption
export const consumoAgua = [
  { dia: "Lun", litros: 850 },
  { dia: "Mar", litros: 920 },
  { dia: "Mie", litros: 780 },
  { dia: "Jue", litros: 1100 },
  { dia: "Vie", litros: 950 },
  { dia: "Sab", litros: 620 },
  { dia: "Dom", litros: 480 },
]

export const usuarios: User[] = [
  { id: "u1", nombre: "Carlos Martinez", email: "carlos@greensense.io", rol: "administrador", empresaId: "e1", activo: true, ultimoAcceso: "2026-02-07T10:30:00Z" },
  { id: "u2", nombre: "Maria Lopez", email: "maria@greensense.io", rol: "tecnico", empresaId: "e1", activo: true, ultimoAcceso: "2026-02-07T09:15:00Z" },
  { id: "u3", nombre: "Juan Perez", email: "juan@greensense.io", rol: "agricultor", empresaId: "e1", activo: true, ultimoAcceso: "2026-02-06T17:00:00Z" },
  { id: "u4", nombre: "Ana Rodriguez", email: "ana@greensense.io", rol: "tecnico", empresaId: "e1", activo: false, ultimoAcceso: "2026-01-28T11:00:00Z" },
]

// Demo credentials for login
export const demoCredentials: { email: string; password: string; user: User }[] = [
  { email: "carlos@greensense.io", password: "admin123", user: { id: "u1", nombre: "Carlos Martinez", email: "carlos@greensense.io", rol: "administrador", empresaId: "e1", activo: true, ultimoAcceso: "2026-02-07T10:30:00Z" } },
  { email: "maria@greensense.io", password: "tecnico123", user: { id: "u2", nombre: "Maria Lopez", email: "maria@greensense.io", rol: "tecnico", empresaId: "e1", activo: true, ultimoAcceso: "2026-02-07T09:15:00Z" } },
  { email: "juan@greensense.io", password: "agri123", user: { id: "u3", nombre: "Juan Perez", email: "juan@greensense.io", rol: "agricultor", empresaId: "e1", activo: true, ultimoAcceso: "2026-02-06T17:00:00Z" } },
]
