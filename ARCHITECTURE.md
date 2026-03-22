# Arquitectura GreenSense - Sistema de Fertirriego Inteligente

## 1. Stack Tecnológico

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Componentes**: Radix UI (shadcn/ui)
- **Estilos**: Tailwind CSS 3.4
- **Estado/Data**: SWR para fetching
- **Iconos**: Lucide React
- **Gráficos**: Recharts
- **Formularios**: React Hook Form + Zod
- **Autenticación**: JWT (jose)

### Backend
- **Runtime**: Next.js API Routes (Edge)
- **Base de Datos**: SQL Server (MSSQL)
- **ORM**: mssql (consultasraw)
- **Auth**: JWT con cookies httpOnly
- **Contraseñas**: bcryptjs

### Base de Datos
- **Motor**: SQL Server
- **Host**: Variable de entorno MSSQL_HOST
- **Puerto**: 1433 (default)

---

## 2. Estructura del Proyecto

```
/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   ├── logout/
│   │   │   └── me/
│   │   ├── users/
│   │   ├── greenhouses/
│   │   ├── crops/
│   │   ├── zones/
│   │   ├── sensors/
│   │   ├── alerts/
│   │   ├── dashboard/
│   │   └── settings/
│   ├── layout.tsx
│   ├── page.tsx           # SPA principal
│   └── globals.css
│
├── components/             # Componentes React
│   ├── ui/               # Componentes shadcn/ui
│   ├── login-view.tsx
│   ├── dashboard-view.tsx
│   ├── zones-view.tsx
│   ├── alerts-view.tsx
│   ├── greenhouses-view.tsx
│   ├── users-view.tsx
│   ├── reports-view.tsx
│   ├── settings-view.tsx
│   └── app-sidebar.tsx
│
├── lib/                   # Utilidades
│   ├── db.ts             # Conexión MSSQL
│   ├── auth.ts           # Funciones JWT
│   ├── api-client.ts     # Cliente API frontend
│   ├── greensense-data.ts # Tipos y datos mock
│   └── utils.ts          # Utilidades
│
├── hooks/                 # Custom hooks
│   └── use-toast.ts
│
├── scripts/               # Scripts de migración/seed
│   ├── migration/
│   ├── seed.ts
│   └── gen-hashes.ts
│
└── public/
```

---

## 3. Base de Datos - Esquema Principal

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `Empresas` | Empresas/clientes del sistema |
| `Usuarios` | Usuarios con roles: administrador, tecnico, agricultor |
| `Invernaderos` | Invernaderos belonging a empresa |
| `Cultivos` | Cultivos plantados en invernaderos |
| `CultivoDetalle` | Detalles adicionales de cultivos (fechas, tiempos, notas) |
| `ZonasRiego` | Zonas de riego dentro de invernaderos |
| `Sensores` | Sensores IoT (humedad, temperatura, TDS, pH) |
| `LecturasSensores` | Histórico de lecturas de sensores |
| `Riegos` | Eventos de riego (automático/manual) |
| `Alertas` | Alertas del sistema |
| `Configuraciones` | Configuraciones globales |

### Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `administrador` | Acceso total: dashboard, zonas, alertas, invernaderos, reportes, usuarios, configuración |
| `tecnico` | Restricted: no usuarios ni configuración |
| `agricultor` | Solo lectura en zonas y configuraciones |

---

## 4. Autenticación y Autorización

### Flujo de Login

1. Usuario envía email/password al endpoint `/api/auth/login`
2. Backend consulta tabla `Usuarios` y verifica contraseña con bcrypt
3. Server crea JWT con payload: `{ userId, email, rol, nombre, empresaId }`
4. JWT almacenado en cookie `gs_session` (httpOnly, 24h)
5. Frontend usa `/api/auth/me` para verificar sesión existente

### Protección de Rutas

```typescript
// Middleware a nivel de API route
requireAuth()    // Requiere cualquier usuario logueado
requireAdmin()  // Solo administrador
```

---

## 5. API Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login con email/password |
| POST | `/api/auth/logout` | Destruir sesión |
| GET | `/api/auth/me` | Obtener usuario actual |

### Datos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST/PATCH | `/api/users` |Gestión usuarios (admin only) |
| GET/POST/PATCH/DELETE | `/api/greenhouses` | Gestión invernaderos |
| GET/POST/PATCH | `/api/zones` | Gestión zonas de riego |
| GET | `/api/sensors` | Lecturas de sensores |
| GET | `/api/dashboard` | Datos para dashboard |
| GET/PATCH | `/api/alertas` | Gestión alertas |
| GET/PATCH | `/api/settings` | Configuración global |

---

## 6. Comunicación Frontend-Backend

### Cliente API (`lib/api-client.ts`)

```typescript
// Métodos disponibles
api.login(email, password)      // Login
api.logout()                    // Logout
api.me()                        // Usuario actual
api.greenhouses()              // Listar invernaderos
api.zones(greenhouseId)        // Listar zonas
api.sensors(greenhouseId)      // Listar sensores
api.alerts()                    // Listar alertas
api.users()                     // Listar usuarios (admin)
```

### Uso de SWR

```typescript
const { data } = useSWR('/api/zones', fetcher)
```

---

## 7. Componentes Principales

### Vistas

| Componente | Descripción |
|------------|-------------|
| `LoginView` | Formulario de login |
| `DashboardView` | Dashboard principal con métricas |
| `ZonesView` | Gestión de zonas de riego |
| `AlertsView` | Lista y gestión de alertas |
| `GreenhousesView` | Gestión de invernaderos |
| `UsersView` | Gestión de usuarios (admin) |
| `ReportsView` | Reportes y gráficos |
| `SettingsView` | Configuración del sistema |

### UI Components (shadcn/ui)

El proyecto usa componentes de Radix UI via shadcn/ui:
- Button, Input, Select, Dialog, Dropdown...
- Table, Tabs, Card, Badge
- Toast (sonner), Sidebar
- Chart, Slider, Switch, Toggle...

---

## 8. Variables de Entorno

```env
# Base de datos
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_DATABASE=GreenSenseDB
MSSQL_USER=sa
MSSQL_PASSWORD=<password>
MSSQL_ENCRYPT=true
MSSQL_TRUST_CERT=false

# Auth
JWT_SECRET=<secret-key>
NODE_ENV=development
```

---

## 9. scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build       # Produccion
npm run lint        # Linter
npm run db:seed     # Poblar base de datos
npm run run-migration # Ejecutar migraciones
```

---

## 10. Flujo de Datos

```
[Frontend - React/SWR]
        │
        ▼ (fetch API)
[Next.js API Routes]
        │
        ▼ (mssql query)
[SQL Server]
        │
        ▼ (result)
[Frontend - UI Update]
```

---

## 11. Características IoT

- **Sensores**: humedad_suelo, temperatura, humedad_ambiental, TDS, pH
- **Alertas**: criticas, advertencias, info
- **Riegos**: automatico (por umbral) o manual
- **Monitoreo**: Tiempo real via MQTT (simulado)
- **Historial**: Lecturas cada 15 minutos

---

## 12. Tech Stack Detallado

| Categoría | Tecnología | Versión |
|-----------|------------|---------|
| Runtime | Node.js | - |
| Framework | Next.js | 16.1.6 |
| UI | React | 19 |
| CSS | Tailwind CSS | 3.4.17 |
| Components | Radix UI / shadcn | - |
| DB | mssql | 11.0.1 |
| Auth | jose + bcryptjs | 5.9.0 |
| Forms | React Hook Form + Zod | 7.54.1 / 3.24.1 |
| Charts | Recharts | 2.15.0 |
| Icons | Lucide React | 0.544.0 |
| HTTP | SWR | 2.2.6 |