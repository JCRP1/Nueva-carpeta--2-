# Guía: Sistema de Migraciones con Prisma + SQL Server

## Índice
1. [¿Por qué usar Prisma?](#por-qué-usar-prisma)
2. [Instalación y Configuración](#instalación-y-configuración)
3. [Configurar schema.prisma](#configurar-schemaprisma)
4. [Convertir tu Base de Datos Actual a Prisma](#convertir-tu-base-de-datos-actual-a-prisma)
5. [Flujo de Trabajo con Migraciones](#flujo-de-trabajo-con-migraciones)
6. [Trabajo en Equipo](#trabajo-en-equipo)
7. [Buenas Prácticas](#buenas-prácticas)
8. [Comandos Esenciales](#comandos-esenciales)

---

## ¿Por qué usar Prisma?

| Sistema Manual (Actual) | Prisma |
|------------------------|--------|
| SQL escrito a mano | Modelos declarativos en TypeScript |
| Difícil rastrear cambios | Historial automático de migraciones |
| Conflictos en equipo | Sincronización via git |
| Sin validación de tipos | Type-safety completo |
| Migraciones `IF NOT EXISTS` | Migraciones idempotentes automáticas |

---

## Instalación y Configuración

### Paso 1: Instalar Prisma CLI y Cliente

```bash
npm install prisma --save-dev
npm install @prisma/client
```

O si usas yarn/pnpm como en tu proyecto:

```bash
yarn add prisma --dev
yarn add @prisma/client
```

### Paso 2: Inicializar Prisma

```bash
npx prisma init
```

Esto creará:
- `prisma/schema.prisma` - Tu archivo de esquemas
- `.env` - Variables de entorno (actualiza tu `.env` existente)

### Paso 3: Configurar la conexión a SQL Server

Edita `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

### Paso 4: Actualizar .env

```env
# Reemplaza tu configuración actual de MSSQL_* con:
DATABASE_URL="sqlserver://VLAD\\SQLEXPRESS:1433;database=GreenSenseDB;user=Daril Steven;password=123456;trustServerCertificate=true"
```

> **Nota**: El doble backslash `\\` es necesario para escapar en la URL de conexión.

---

## Configurar schema.prisma

### Paso 1: Definir tus modelos (basado en tu schema actual)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

model Empresas {
  id_empresa    Int                      @id @default(identity())
  nombre        String                   @db.NVarChar(200)
  direccion     String?                  @db.NVarChar(500)
  telefono      String?                  @db.NVarChar(50)
  correo        String?                  @db.NVarChar(200)
  estado        String?                  @db.NVarChar(50)
  fecha_creacion DateTime               @default(now())
  
  usuarios      Usuarios[]
  invernaderos  Invernaderos[]
  configuraciones ConfiguracionesSistema[]
  
  @@map("Empresas")
}

model Usuarios {
  id_usuario      Int         @id @default(identity())
  id_empresa      Int
  nombre          String      @db.NVarChar(200)
  correo          String      @unique @db.NVarChar(200)
  contraseña      String      @db.NVarChar(255)
  rol             String      @db.NVarChar(50)
  fecha_registro  DateTime   @default(now())
  activo          Boolean     @default(true)
  
  empresa         Empresas    @relation(fields: [id_empresa], references: [id_empresa])
  configuraciones ConfiguracionesSistema[]
  
  @@map("Usuarios")
}

model Invernaderos {
  id_invernadero Int       @id @default(identity())
  id_empresa     Int
  nombre         String    @db.NVarChar(200)
  ubicacion      String?   @db.NVarChar(500)
  superficie_m2  Decimal?  @db.Decimal(10, 2)
  estado         String?   @db.NVarChar(50) @default("activo")
  
  empresa    Empresas  @relation(fields: [id_empresa], references: [id_empresa])
  zonas      ZonasRiego[]
  sensores   Sensores[]
  alertas    Alertas[]
  
  @@map("Invernaderos")
}

model ZonasRiego {
  id_zona               Int       @id @default(identity())
  id_invernadero        Int
  nombre                String    @db.NVarChar(200)
  cultivoActual         String?   @db.NVarChar(200)
  estadoRiego           String?   @db.NVarChar(50) @default("inactivo")
  umbralHumedad         Decimal?  @db.Decimal(5, 2)
  humedadActual         Decimal?  @db.Decimal(5, 2) @default(0)
  ultimoRiego           DateTime?
  duracionUltimoRiego   Int       @default(0)
  volumenUltimoRiego    Decimal?  @db.Decimal(10, 2) @default(0)
  
  invernaderos Invernaderos @relation(fields: [id_invernadero], references: [id_invernadero])
  sensores     Sensores[]
  riegos       Riegos[]
  
  @@map("ZonasRiego")
}

model Sensores {
  id_sensor          Int       @id @default(identity())
  id_invernadero    Int
  tipo              String    @db.NVarChar(50)
  nombre            String    @db.NVarChar(200)
  estado            String?   @db.NVarChar(50) @default("activo")
  ultimaLectura     Decimal?  @db.Decimal(10, 2) @default(0)
  unidad            String?   @db.NVarChar(20)
  umbralMin         Decimal?  @db.Decimal(10, 2)
  umbralMax         Decimal?  @db.Decimal(10, 2)
  ultimaActualizacion DateTime @default(now())
  zonaRiegoId       Int?
  
  invernaderos Invernaderos  @relation(fields: [id_invernadero], references: [id_invernadero])
  zonaRiego   ZonasRiego?   @relation(fields: [zonaRiegoId], references: [id_zona])
  lecturas    LecturasSensores[]
  alertas     Alertas[]
  
  @@map("Sensores")
}

model LecturasSensores {
  id_lectura Int       @id @default(identity())
  id_sensor  Int
  valor      Decimal   @db.Decimal(10, 2)
  unidad     String?   @db.NVarChar(20)
  fecha_hora DateTime  @default(now())
  
  sensor     Sensores  @relation(fields: [id_sensor], references: [id_sensor])
  
  @@map("LecturasSensores")
}

model Riegos {
  id_riego    Int       @id @default(identity())
  zonaRiegoId Int
  tipo        String    @db.NVarChar(50)
  inicio      DateTime
  fin         DateTime?
  duracion    Int       @default(0)
  volumen     Decimal?  @db.Decimal(10, 2) @default(0)
  estado      String?   @db.NVarChar(50) @default("completado")
  
  zonaRiego   ZonasRiego @relation(fields: [zonaRiegoId], references: [id_zona])
  
  @@map("Riegos")
}

model ConfiguracionesSistema {
  id_config      Int       @id @default(identity())
  id_empresa     Int
  parametro      String    @db.NVarChar(200)
  valor          String?   @db.NVarChar(500)
  descripcion    String?   @db.NVarChar(500)
  creado_por     Int?
  fecha_creacion DateTime  @default(now())
  
  empresa        Empresas @relation(fields: [id_empresa], references: [id_empresa])
  creador        Usuarios? @relation(fields: [creado_por], references: [id_usuario])
  
  @@map("ConfiguracionesSistema")
}

model Alertas {
  id_alerta      Int       @id @default(identity())
  tipo           String    @db.NVarChar(50)
  mensaje        String    @db.NVarChar(500)
  sensorId       Int?
  invernaderoId  Int?
  timestamp      DateTime  @default(now())
  resuelta       Boolean   @default(false)
  
  sensor         Sensores?    @relation(fields: [sensorId], references: [id_sensor])
  invernadero    Invernaderos? @relation(fields: [invernaderoId], references: [id_invernadero])
  
  @@map("Alertas")
}
```

### Paso 2: Entender las anotaciones

| Anotación | Descripción |
|-----------|-------------|
| `@id` | Marca la clave primaria |
| `@default(identity())` | Auto-incremento (como IDENTITY en SQL Server) |
| `@unique` | Constraint unique |
| `@relation` | Define relaciones entre tablas |
| `String?` | Campo opcional (nullable) |
| `@db.NVarChar(200)` | Tipo específico de SQL Server |
| `@@map("NombreTabla")` | Mapeo al nombre real de la tabla |

---

## Convertir tu Base de Datos Actual a Prisma

### Opción A: Si tu BD ya existe (tu caso)

Usa `prisma db pull` para introspeccionar tu base de datos existente:

```bash
npx prisma db pull
```

Esto generará automáticamente el `schema.prisma` basándose en tus tablas existentes.

### Opción B: Si partes de cero

```bash
# 1. Crea el schema con tus modelos
# 2. Genera la primera migración
npx prisma migrate dev --name init

# 3. Esto creará las tablas en tu BD
```

---

## Flujo de Trabajo con Migraciones

### Flujo Normal de Desarrollo

```
1. Modificar schema.prisma (definir nuevo modelo/campo)
2. npx prisma migrate dev --name descripcion_del_cambio
3. Revisar el SQL generado en prisma/migrations/
4. Confirmar (si todo está bien)
5. Git push
6. Equipo hace git pull
7. npx prisma migrate deploy
```

### Ejemplo Práctico: Agregar una tabla de SensoresExternos

**Paso 1**: Editar `prisma/schema.prisma`

```prisma
// Agregar al final del archivo
model SensoresExternos {
  id              Int       @id @default(identity())
  nombre          String    @db.NVarChar(100)
  tipo            String    @db.NVarChar(50)
  ubicacion       String?   @db.NVarChar(200)
  activo         Boolean   @default(true)
  fecha_creacion  DateTime  @default(now())
  
  @@map("SensoresExternos")
}
```

**Paso 2**: Generar la migración

```bash
npx prisma migrate dev --name add_sensores_externos_table
```

**Paso 3**: Revisar lo que se generó

Prisma creará un archivo en `prisma/migrations/` como:

```
prisma/migrations/
└── 20240101000000_add_sensores_externos_table/
    └── migration.sql
```

Contenido de `migration.sql`:

```sql
-- CreateTable
CREATE TABLE [SensoresExternos] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [nombre] NVARCHAR(100) NOT NULL,
    [tipo] NVARCHAR(50) NOT NULL,
    [ubicacion] NVARCHAR(200),
    [activo] BIT NOT NULL DEFAULT CAST(1 AS BIT),
    [fecha_creacion] DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SensoresExternos_pkey] PRIMARY KEY ([id])
);
```

### Ejemplo: Modificar una tabla existente

**Agregar un campo:**

```prisma
model Usuarios {
  // ... campos existentes ...
  
  telefono String? @db.NVarChar(20)  // AGREGADO
  fotoPerfil String? @db.NVarChar(500)  // AGREGADO
}
```

```bash
npx prisma migrate dev --name add_telefono_and_foto_to_usuarios
```

---

## Trabajo en Equipo

### Configuración con Git

**1. Asegúrate que `.gitignore` incluya:**

```gitignore
# Prisma
prisma/migrations/*.sql

# Pero NO ignores:
# prisma/migrations/
# prisma/schema.prisma
```

**2. Estructura de migraciones (lo que debe ir en git):**

```
tu-proyecto/
├── prisma/
│   ├── schema.prisma        ✓ En git
│   └── migrations/          ✓ En git (carpeta completa)
└── ...
```

### Flujo en Equipo

```
┌─────────────────────────────────────────────────────────────┐
│                    EQUIPO (3 desarrolladores)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Desarrollador A          Desarrollador B      Desarrollador C│
│       │                        │                    │        │
│       ▼                        ▼                    ▼        │
│  git pull                 git pull               git pull     │
│       │                        │                    │        │
│       ▼                        ▼                    ▼        │
│  Modifica schema          Modifica schema       Modifica    │
│  ├─ agrega modelo X        ├─ agrega modelo Y    schema     │
│  │                         │                      ├─ agrega  │
│  │                         │                      │ modelo Z│
│       │                        │                    │        │
│       ▼                        ▼                    ▼        │
│  npx prisma migrate     << Esperar a que A       │         │
│  dev --name add_X       << complete y suba >>    │         │
│       │                        │                    │        │
│       ▼                        │                    ▼        │
│  git add + commit       git pull                  │         │
│       │                   (trae los cambios)      │         │
│       ▼                        │                    │         │
│  git push                     │                    │         │
│       │                        ▼                    │         │
│       │                   Resuelve conflictos     │         │
│       │                   (si hay)                │         │
│       │                        │                    ▼         │
│       │                        │              npx prisma    │
│       │                        │              migrate dev  │
│       │                        │              --name add_Z │
│       │                        │                    │         │
│       │                        │                    ▼         │
│       │                        │              git push      │
│       ▼                        ▼                    ▼         │
└─────────────────────────────────────────────────────────────┘
```

### Cuando otro desarrollador hace pull

```bash
# 1. Actualizar código
git pull

# 2. Aplicar migraciones pendientes
npx prisma migrate deploy

# 3. Regenerar cliente (por si hay cambios)
npx prisma generate
```

---

## Buenas Prácticas

### 1. Nombres de Migraciones - Usar Snake Case

```bash
# ✅ BIEN
npx prisma migrate dev --name add_user_phone_field
npx prisma migrate dev --name create_products_table
npx prisma migrate dev --name alter_orders_add_status

# ❌ MAL
npx prisma migrate dev --name addPhoneToUser
npx prisma migrate dev --name AddUserPhone
npx prisma migrate dev --name phone
```

### 2. Una migración = Un cambio lógico

```bash
# ✅ BIEN - Una migración por cambio
npx prisma migrate dev --name add_email_to_users
npx prisma migrate dev --name add_phone_to_users

# ❌ MAL - Múltiples cambios en una migración
npx prisma migrate dev --name add_email_phone_address_to_users_and_create_products_and_update_orders
```

### 3. Nunca modificar migraciones existentes

```bash
# ❌ NUNCA hacer esto
# Editar archivos en prisma/migrations/ que ya fueron aplicados

# ✅ CORRECTO
# Si necesitas revertir, crear una nueva migración
npx prisma migrate dev --name revert_email_change
```

### 4. Verificar el SQL generado antes de aplicar

Revisa siempre `prisma/migrations/YYYYMMDDHHMMSS_nombre/migration.sql` antes de confirmar.

### 5. Usar transacciones cuando sea necesario

Prisma genera transacciones automáticamente para migraciones multi-paso. Pero si necesitas lógica personalizada:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.$transaction([
    prisma.user.create({ data: { name: 'Alice' } }),
    prisma.user.create({ data: { name: 'Bob' } }),
  ])
}
```

### 6. Backups antes de migrar a producción

```bash
# Siempre hacer backup antes de aplicar migraciones en producción
# (Depende de tu SQL Server, pero típicamente)

# SQL Server Management Studio o:
BACKUP DATABASE GreenSenseDB TO DISK = 'backup.bak'
```

---

## Comandos Esenciales

| Comando | Uso |
|---------|-----|
| `npx prisma init` | Inicializar Prisma en el proyecto |
| `npx prisma db pull` | Generar schema desde BD existente |
| `npx prisma db push` | Sincronizar schema con BD (sin migraciones) |
| `npx prisma migrate dev` | Crear y aplicar nueva migración (desarrollo) |
| `npx prisma migrate deploy` | Aplicar migraciones pendientes (producción) |
| `npx prisma migrate status` | Ver estado de migraciones |
| `npx prisma migrate reset` | Resetear BD y re-aplicar migraciones (¡CUIDADO!) |
| `npx prisma generate` | Generar cliente Prisma |
| `npx prisma studio` | Abrir GUI para explorar datos |

---

## Migrar tu código actual

### Antes (mssql manual)

```typescript
// lib/db.ts
import * as sql from "mssql"

export async function getUsers() {
  const pool = await getPool()
  const result = await pool.request().query("SELECT * FROM Usuarios")
  return result.recordset
}
```

### Después (Prisma)

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

```typescript
// En tus routes
import { prisma } from '@/lib/db'

export async function GET() {
  const users = await prisma.usuarios.findMany()
  return Response.json(users)
}
```

### Ejemplo completo de CRUD

```typescript
import { prisma } from '@/lib/db'

// CREATE
const newUser = await prisma.usuarios.create({
  data: {
    nombre: 'Juan Pérez',
    correo: 'juan@example.com',
    contraseña: 'hashed_password',
    rol: 'admin',
    id_empresa: 1
  }
})

// READ
const user = await prisma.usuarios.findUnique({
  where: { id_usuario: 1 }
})

const allUsers = await prisma.usuarios.findMany({
  where: { id_empresa: 1 },
  include: { empresa: true }
})

// UPDATE
await prisma.usuarios.update({
  where: { id_usuario: 1 },
  data: { nombre: 'Juan Actualizado' }
})

// DELETE
await prisma.usuarios.delete({
  where: { id_usuario: 1 }
})
```

---

## Ejemplo: Agregar scripts npm

En `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

---

## Solución de Problemas Comunes

### Error: Can't reach database server

```
Error: P1001: Can't reach database server
```

**Solución**: Verifica tu `DATABASE_URL` en `.env`:

```env
# Formato correcto para SQL Server con instancia nombrada
DATABASE_URL="sqlserver://localhost\\SQLEXPRESS:1433;database=GreenSenseDB;user=sa;password=tu_password;trustServerCertificate=true"
```

### Error: Migration file out of order

```
Error: P3012: Migration file is out of order
```

**Solución**: 
```bash
# Elimina migraciones no aplicadas y regenera
npx prisma migrate resolve --rolled-back "nombre_migracion"
```

### Error: Table already exists

```
Error: P2002: Unique constraint failed
```

**Solución**: Si es en desarrollo, puedes hacer:
```bash
npx prisma migrate reset
```

> ⚠️ **Esto borra todos los datos. Solo en desarrollo.**

---

## Resumen del Flujo Completo

```
┌──────────────────────────────────────────────────────────────────┐
│                    MIGRACIÓN COMPLETA A PRISMA                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. INSTALACIÓN                                                   │
│     yarn add prisma @prisma/client --dev                         │
│     npx prisma init                                              │
│                                                                   │
│  2. CONFIGURAR                                                    │
│     - Crear schema.prisma con tus modelos                       │
│     - Actualizar .env con DATABASE_URL                           │
│                                                                   │
│  3. INTROSPECTAR BD EXISTENTE (tu caso)                         │
│     npx prisma db pull                                           │
│                                                                   │
│  4. ACTUALIZAR CÓDIGO                                            │
│     - Reemplazar lib/db.ts con PrismaClient                      │
│     - Actualizar routes para usar prisma.*                      │
│                                                                   │
│  5. GENERAR Y APLICAR MIGRACIONES                                │
│     npx prisma migrate dev --name init_schema                   │
│                                                                   │
│  6. TRABAJO EN EQUIPO                                            │
│     git add . && git commit -m "feat: add prisma migrations"   │
│     git push                                                    │
│                                                                   │
│  7. OTRO DESARROLLADOR                                           │
│     git pull                                                     │
│     npx prisma migrate deploy                                    │
│     npx prisma generate                                          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

Esta guía te permite pasar de un sistema de migraciones manual (SQL scripts en `/migrations/`) a un sistema profesional con Prisma que:

- ✅ Genera migraciones automáticamente
- ✅ Mantiene historial en Git
- ✅ Sincroniza cambios en equipo fácilmente
- ✅ Proporciona type-safety en todo el código
- ✅ Permite trabajo paralelo sin conflictos
