# GreenSenseDB Database Schema Documentation

## Overview

**GreenSenseDB** is a comprehensive relational database designed to support a smart greenhouse management system. It tracks companies, greenhouses, IoT devices, sensor readings, crops, fertilization plans, irrigation zones, user roles, alerts, system logs, and maintenance activities. The schema includes 30+ tables with well-defined relationships, constraints, and default values to ensure data integrity and operational efficiency.

This document provides a detailed description of every table, column, constraint, foreign key, and stored procedure contained in the database script.

---

## Table of Contents

- [Tables](#tables)
  - [Alertas](#alertas)
  - [AplicacionesFertilizantes](#aplicacionesfertilizantes)
  - [Bitacora](#bitacora)
  - [ComandosIoT](#comandosiot)
  - [ConfiguracionesSistema](#configuracionessistema)
  - [ConfiguracionSistema](#configuracionsistema)
  - [ControlPlagas](#controlplagas)
  - [CultivoDetalle](#cultivodetalle)
  - [Cosechas](#cosechas)
  - [Cultivos](#cultivos)
  - [DispositivosIoT](#dispositivosiot)
  - [Empresas](#empresas)
  - [EtapasCultivo](#etapascultivo)
  - [Fertilizantes](#fertilizantes)
  - [Invernaderos](#invernaderos)
  - [IoTLog](#iotlog)
  - [LecturasSensores](#lecturassensores)
  - [MantenimientoEquipos](#mantenimientoequipos)
  - [Marcas](#marcas)
  - [MetodoRiego](#metodoriego)
  - [Modelos](#modelos)
  - [PasswordResetTokens](#passwordresettokens)
  - [Personas](#personas)
  - [PlanFertilizacion](#planfertilizacion)
  - [Reportes](#reportes)
  - [Riegos](#riegos)
  - [Roles](#roles)
  - [Sensores](#sensores)
  - [TareasProgramadas](#tareasprogramadas)
  - [TiposSensor](#tipossensor)
  - [Usuarios](#usuarios)
  - [ZonasRiego](#zonasriego)
- [Stored Procedures](#stored-procedures)
  - [sp_EvaluarReglas](#sp_evaluarreglas)
- [Foreign Key Relationships Summary](#foreign-key-relationships-summary)

---

## Tables

### Alertas

Stores alerts generated when sensor readings exceed predefined thresholds or when abnormal conditions are detected.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_alerta` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented alert identifier. |
| `id_sensor` | `int` | NO | | Foreign key referencing `Sensores.id_sensor`. The sensor that triggered the alert. |
| `tipo_alerta` | `nvarchar(100)` | NO | | Type of alert (e.g., 'High Temperature', 'Low Humidity'). |
| `valor_detectado` | `decimal(10,2)` | YES | | The actual sensor reading that caused the alert. |
| `fecha_hora` | `datetime` | NO | `GETDATE()` | Timestamp when the alert was generated. |
| `estado` | `nvarchar(20)` | NO | | Current status (e.g., 'Pendiente', 'Atendida', 'Ignorada'). |
| `umbral_min` | `decimal(10,2)` | YES | | Minimum threshold value for this alert condition. |
| `umbral_max` | `decimal(10,2)` | YES | | Maximum threshold value for this alert condition. |
| `nivel` | `nvarchar(20)` | YES | | Severity level (e.g., 'Bajo', 'Medio', 'Alto'). |
| `accion_recomendada` | `nvarchar(200)` | YES | | Suggested action to resolve the alert. |
| `atendida_por` | `int` | YES | | Foreign key referencing `Usuarios.id_usuario`. User who handled the alert. |
| `fecha_atencion` | `datetime` | YES | | Timestamp when the alert was attended. |

**Primary Key:** `id_alerta`  
**Foreign Keys:** `FK_Alertas_Sensores` → `Sensores(id_sensor)`

---

### AplicacionesFertilizantes

Records the actual application of fertilizers according to a fertilization plan.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_aplicacion` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented application identifier. |
| `id_plan` | `int` | NO | | Foreign key referencing `PlanFertilizacion.id_plan`. |
| `fecha_aplicacion` | `datetime` | NO | `GETDATE()` | Date and time the fertilizer was applied. |
| `cantidad_aplicada` | `nvarchar(50)` | NO | | Amount of fertilizer applied (may include unit information). |
| `aplicado_por` | `int` | YES | | Foreign key referencing `Usuarios.id_usuario`. Person who applied the fertilizer. |
| `notas` | `nvarchar(max)` | YES | | Additional notes or observations. |

**Primary Key:** `id_aplicacion`  
**Foreign Keys:**  
- `FK_Aplicaciones_PlanFert` → `PlanFertilizacion(id_plan)`  
- `FK_Aplicaciones_Usuario` → `Usuarios(id_usuario)`

---

### Bitacora

General-purpose log table for tracking system events, user actions, device status changes, and other audit information.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_bitacora` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented log entry identifier. |
| `id_dispositivo` | `int` | YES | | Foreign key referencing `DispositivosIoT.id_dispositivo`. Device related to the event (if applicable). |
| `descripcion` | `nvarchar(max)` | NO | | Detailed description of the event or action. |
| `severidad` | `nvarchar(20)` | NO | `'info'` | Severity level: 'info', 'warning', 'error', 'critical'. |
| `fecha` | `datetime` | NO | `GETDATE()` | Timestamp of the event occurrence. |
| `id_usuario` | `int` | YES | | Foreign key referencing `Usuarios.id_usuario`. User who performed the action. |
| `notas` | `nvarchar(max)` | YES | | Additional context or notes. |
| `modulo` | `nvarchar(100)` | YES | | System module where the event originated. |
| `entidad` | `nvarchar(100)` | YES | | Affected entity type (e.g., 'Sensor', 'Greenhouse'). |
| `entidad_id` | `nvarchar(100)` | YES | | Identifier of the affected entity. |
| `accion` | `nvarchar(50)` | YES | | Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE'). |
| `valor_anterior` | `nvarchar(max)` | YES | | Previous value before change (for updates). |
| `valor_nuevo` | `nvarchar(max)` | YES | | New value after change (for updates). |
| `ip_origen` | `nvarchar(50)` | YES | | Source IP address of the request. |
| `origen` | `nvarchar(50)` | NO | `'sistema'` | Origin of the event: 'sistema', 'usuario', 'dispositivo'. |
| `fecha_creacion` | `datetime` | NO | `GETDATE()` | Timestamp when the log record was created. |

**Primary Key:** `id_bitacora`  
**Foreign Keys:**  
- `FK_Bitacora_Dispositivo` → `DispositivosIoT(id_dispositivo)`  
- `FK_Bitacora_Usuario` → `Usuarios(id_usuario)`

---

### ComandosIoT

Stores commands sent to IoT devices (e.g., actuators, valves, relays).

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_comando` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented command identifier. |
| `id_dispositivo` | `int` | NO | | Foreign key referencing `DispositivosIoT.id_dispositivo`. Target device. |
| `comando` | `nvarchar(100)` | NO | | Command name (e.g., 'TURN_ON', 'SET_TARGET'). |
| `parametros` | `nvarchar(max)` | YES | | JSON or string with command parameters. |
| `enviado_por` | `int` | YES | | Foreign key referencing `Usuarios.id_usuario`. User who sent the command. |
| `fecha_envio` | `datetime` | NO | `GETDATE()` | Timestamp when the command was sent. |
| `estado` | `nvarchar(20)` | NO | `'Pendiente'` | Command status: 'Pendiente', 'Enviado', 'Ejecutado', 'Error'. |

**Primary Key:** `id_comando`  
**Foreign Keys:**  
- `FK_Comandos_Dispositivo` → `DispositivosIoT(id_dispositivo)`  
- `FK_Comandos_Usuarios` → `Usuarios(id_usuario)`

---

### ConfiguracionesSistema

Stores company-specific system configuration parameters.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_config` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented configuration identifier. |
| `id_empresa` | `int` | NO | | Foreign key referencing `Empresas.id_empresa`. Company this configuration belongs to. |
| `parametro` | `nvarchar(100)` | NO | | Configuration parameter name. |
| `valor` | `nvarchar(100)` | NO | | Configuration parameter value. |
| `descripcion` | `nvarchar(max)` | YES | | Description of the parameter. |
| `fecha_creacion` | `datetime` | NO | `GETDATE()` | Creation timestamp. |
| `creado_por` | `int` | NO | | Foreign key referencing `Usuarios.id_usuario`. User who created this config. |
| `fecha_modificacion` | `datetime` | YES | | Last modification timestamp. |

**Primary Key:** `id_config`  
**Foreign Keys:**  
- `FK_Config_Empresa` → `Empresas(id_empresa)`  
- `FK_Config_Usuarios` → `Usuarios(id_usuario)`

---

### ConfiguracionSistema

Global system-wide configuration settings (independent of any specific company).

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `ConfigID` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented configuration identifier. |
| `Clave` | `nvarchar(100)` | NO | | Unique configuration key. |
| `Valor` | `nvarchar(500)` | NO | | Configuration value. |
| `Descripcion` | `nvarchar(500)` | YES | | Description of the setting. |
| `Categoria` | `nvarchar(50)` | YES | | Category grouping (e.g., 'Email', 'IoT'). |
| `FechaModificacion` | `datetime2(7)` | YES | `GETDATE()` | Last modification timestamp. |

**Primary Key:** `ConfigID`  
**Unique Constraint:** `UQ_ConfiguracionSistema_Clave` on `Clave`

---

### ControlPlagas

Logs pest control treatments applied to crops.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_plaga` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented treatment identifier. |
| `id_detalle` | `int` | NO | | Foreign key referencing `CultivoDetalle.id_detalle`. Crop detail record. |
| `tipo_plaga` | `nvarchar(100)` | YES | | Type of pest or disease treated. |
| `producto_usado` | `nvarchar(100)` | YES | | Pesticide or product name used. |
| `dosis` | `nvarchar(50)` | YES | | Dosage applied. |
| `fecha_aplicacion` | `datetime` | NO | `GETDATE()` | Application date and time. |
| `notas` | `nvarchar(max)` | YES | | Additional notes. |

**Primary Key:** `id_plaga`  
**Foreign Keys:** `FK_Plagas_CultivoDetalle` → `CultivoDetalle(id_detalle)`

---

### CultivoDetalle

Detailed cultivation information for a specific crop cycle, including dates and variety specifics.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_detalle` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented detail identifier. |
| `id_cultivo` | `int` | NO | | Foreign key referencing `Cultivos.id_cultivo`. |
| `fecha_siembra` | `date` | NO | | Actual planting date. |
| `fecha_cosecha_estimada` | `date` | YES | | Estimated harvest date. |
| `variedad` | `nvarchar(100)` | YES | | Specific variety name. |
| `tiempo_germinacion_dias` | `int` | YES | | Germination period in days. |
| `tiempo_crecimiento_dias` | `int` | YES | | Growth period in days. |
| `tiempo_cosecha_dias` | `int` | YES | | Harvest period in days. |
| `umbral_humedad` | `decimal(5,2)` | YES | | Target soil humidity threshold for this crop. |
| `umbral_ph` | `decimal(4,2)` | YES | | Target pH threshold for this crop. |
| `umbral_ec` | `decimal(5,2)` | YES | | Target EC threshold for this crop. |
| `umbral_tds` | `decimal(6,2)` | YES | | Target TDS threshold for this crop. |
| `notas` | `nvarchar(max)` | YES | | Additional notes. |

**Primary Key:** `id_detalle`  
**Foreign Keys:** `FK_Detalle_Cultivo` → `Cultivos(id_cultivo)`

---

### Cosechas

Stores harvested production records for crop detail cycles.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_cosecha` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented harvest identifier. |
| `id_detalle` | `int` | NO | | Foreign key referencing `CultivoDetalle.id_detalle`. |
| `id_zona` | `int` | YES | | Foreign key referencing `ZonasRiego.id_zona`, identifying where the crop was harvested. |
| `fecha_cosecha` | `date` | NO | | Harvest date. |
| `cantidad_cosechada_kg` | `decimal(12,2)` | YES | | Harvested quantity in kilograms. |
| `calidad` | `nvarchar(50)` | YES | | Harvest quality classification. |
| `rendimiento_m2` | `decimal(12,2)` | YES | | Yield per square meter. |
| `perdida_kg` | `decimal(12,2)` | YES | | Recorded loss in kilograms. |
| `observaciones` | `nvarchar(max)` | YES | | Harvest notes. |
| `registrado_por` | `int` | YES | | User who registered the harvest. |
| `fecha_registro` | `datetime` | YES | `GETDATE()` | Registration timestamp. |

**Primary Key:** `id_cosecha`  
**Foreign Keys:**  
- `id_detalle` â†’ `CultivoDetalle(id_detalle)`  
- `FK_Cosechas_ZonasRiego` â†’ `ZonasRiego(id_zona)`

---

### Cultivos

Represents crops planted in greenhouses.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_cultivo` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented crop identifier. |
| `nombre` | `nvarchar(100)` | NO | | Crop name (e.g., 'Tomato', 'Lettuce'). |
| `variedad` | `nvarchar(100)` | YES | | Variety name (optional at this level). |
| `id_invernadero` | `int` | NO | | Foreign key referencing `Invernaderos.id_invernadero`. |
| `fecha_siembra` | `date` | YES | | Planting date. |
| `umbral_humedad` | `decimal(5,2)` | YES | | Default soil humidity threshold for this crop. |
| `umbral_ph` | `decimal(4,2)` | YES | | Default pH threshold for this crop. |
| `umbral_ec` | `decimal(5,2)` | YES | | Default EC threshold for this crop. |
| `umbral_tds` | `decimal(6,2)` | YES | | Default TDS threshold for this crop. |

**Primary Key:** `id_cultivo`  
**Foreign Keys:** `FK_Cultivos_Invernaderos` → `Invernaderos(id_invernadero)`

---

### DispositivosIoT

Manages IoT devices installed in greenhouses (controllers, gateways, actuators).

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_dispositivo` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented device identifier. |
| `id_invernadero` | `int` | NO | | Foreign key referencing `Invernaderos.id_invernadero`. |
| `nombre` | `nvarchar(100)` | NO | | Device name/label. |
| `tipo` | `nvarchar(50)` | NO | | Device type (e.g., 'SensorHub', 'Actuator', 'Gateway'). |
| `firmware_version` | `nvarchar(50)` | YES | | Current firmware version. |
| `ip_local` | `nvarchar(50)` | YES | | Local network IP address. |
| `estado` | `nvarchar(20)` | NO | `'Activo'` | Operational status: 'Activo', 'Inactivo', 'Mantenimiento'. |
| `ultimo_reporte` | `datetime` | YES | | Timestamp of the last communication from device. |
| `codigo_dispositivo` | `nvarchar(100)` | YES | | Unique hardware identifier or serial number. |

**Primary Key:** `id_dispositivo`  
**Foreign Keys:** `FK_Dispositivos_Invernaderos` → `Invernaderos(id_invernadero)`

---

### Empresas

Represents companies that own one or more greenhouses.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_empresa` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented company identifier. |
| `nombre` | `nvarchar(150)` | NO | | Company name. |
| `rnc` | `nvarchar(20)` | YES | | Tax identification number (Dominican RNC). |
| `direccion` | `nvarchar(200)` | YES | | Physical address. |
| `telefono` | `nvarchar(20)` | YES | | Contact phone number. |
| `correo` | `nvarchar(100)` | YES | | Contact email address. |
| `estado` | `nvarchar(20)` | NO | `'Activa'` | Company status: 'Activa', 'Inactiva'. |
| `fecha_creacion` | `datetime` | NO | `GETDATE()` | Registration date. |

**Primary Key:** `id_empresa`

---

### EtapasCultivo

Tracks the different growth stages of a crop cycle.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_etapa` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented stage identifier. |
| `id_detalle` | `int` | NO | | Foreign key referencing `CultivoDetalle.id_detalle`. |
| `nombre_etapa` | `nvarchar(100)` | NO | | Stage name (e.g., 'Germination', 'Flowering', 'Fruiting'). |
| `fecha_inicio` | `date` | NO | | Start date of this stage. |
| `fecha_fin` | `date` | YES | | End date of this stage (if completed). |
| `notas` | `nvarchar(max)` | YES | | Observations specific to this stage. |

**Primary Key:** `id_etapa`  
**Foreign Keys:** `FK_Etapas_CultivoDetalle` → `CultivoDetalle(id_detalle)`

---

### Fertilizantes

Catalog of fertilizers available for use.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_fertilizante` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented fertilizer identifier. |
| `nombre` | `nvarchar(100)` | NO | | Fertilizer product name. |
| `tipo` | `nvarchar(50)` | NO | | Type (e.g., 'Liquid', 'Granular', 'Organic'). |
| `composicion` | `nvarchar(200)` | YES | | General composition description. |
| `fabricante` | `nvarchar(100)` | YES | | Manufacturer name. |
| `ph` | `decimal(4,2)` | YES | | pH value of the fertilizer solution. |
| `nitrogeno` | `decimal(5,2)` | YES | | Nitrogen percentage (N). |
| `fosforo` | `decimal(5,2)` | YES | | Phosphorus percentage (P). |
| `potasio` | `decimal(5,2)` | YES | | Potassium percentage (K). |
| `micronutrientes` | `nvarchar(200)` | YES | | Micronutrient content description. |
| `forma_aplicacion` | `nvarchar(50)` | YES | | Application method (e.g., 'Foliar', 'Drip'). |
| `riesgos` | `nvarchar(max)` | YES | | Safety warnings or risks. |
| `fecha_registro` | `datetime` | YES | `GETDATE()` | Date added to catalog. |

**Primary Key:** `id_fertilizante`

---

### Invernaderos

Represents individual greenhouses belonging to a company.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_invernadero` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented greenhouse identifier. |
| `id_empresa` | `int` | NO | | Foreign key referencing `Empresas.id_empresa`. |
| `nombre` | `nvarchar(100)` | NO | | Greenhouse name. |
| `ubicacion` | `nvarchar(150)` | YES | | Physical location description. |
| `superficie_m2` | `decimal(10,2)` | YES | | Total surface area in square meters. |
| `id_usuario` | `int` | YES | | Foreign key referencing `Usuarios.id_usuario`. Assigned manager/operator. |
| `estado` | `nvarchar(20)` | YES | | Operational status (e.g., 'Activo', 'Inactivo'). |

**Primary Key:** `id_invernadero`  
**Foreign Keys:**  
- `FK_Invernaderos_Empresas` → `Empresas(id_empresa)`  
- `FK_Invernaderos_Usuario` → `Usuarios(id_usuario)`

---

### IoTLog

Raw message log for IoT device communications (telemetry, commands, status).

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_log` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented log identifier. |
| `id_dispositivo` | `int` | NO | | Foreign key referencing `DispositivosIoT.id_dispositivo`. |
| `tipo_mensaje` | `nvarchar(50)` | NO | | Message type (e.g., 'Telemetry', 'CommandResponse', 'Heartbeat'). |
| `payload` | `nvarchar(max)` | YES | | Raw message content (JSON, string). |
| `fecha_evento` | `datetime` | NO | `GETDATE()` | Timestamp when the message was received. |
| `estado` | `nvarchar(20)` | NO | | Processing status: 'Recibido', 'Procesado', 'Error'. |

**Primary Key:** `id_log`  
**Foreign Keys:** `FK_IoTLog_Dispositivo` → `DispositivosIoT(id_dispositivo)`

---

### LecturasSensores

Time-series data of sensor readings.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_lectura` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented reading identifier. |
| `id_sensor` | `int` | NO | | Foreign key referencing `Sensores.id_sensor`. |
| `valor` | `decimal(10,2)` | NO | | Measured value. |
| `unidad` | `nvarchar(10)` | NO | | Unit of measurement (e.g., '°C', '%', 'ppm'). |
| `fecha_hora` | `datetime` | NO | `GETDATE()` | Timestamp of the reading. |

**Primary Key:** `id_lectura`  
**Foreign Keys:** `FK_Lecturas_Sensores` → `Sensores(id_sensor)`

---

### MantenimientoEquipos

Tracks maintenance activities performed on IoT devices.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_mantenimiento` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented maintenance record identifier. |
| `id_dispositivo` | `int` | NO | | Foreign key referencing `DispositivosIoT.id_dispositivo`. |
| `tipo_mantenimiento` | `nvarchar(20)` | NO | | Type: 'Preventivo', 'Correctivo'. |
| `descripcion` | `nvarchar(max)` | YES | | Description of work performed. |
| `realizado_por` | `int` | NO | | Foreign key referencing `Usuarios.id_usuario`. Technician who performed maintenance. |
| `fecha_mantenimiento` | `datetime` | NO | `GETDATE()` | Date and time maintenance was performed. |
| `proximo_mantenimiento` | `datetime` | YES | | Scheduled date for next maintenance. |
| `estado_equipo_post` | `nvarchar(20)` | NO | | Device status after maintenance (e.g., 'Operativo'). |
| `notas` | `nvarchar(max)` | YES | | Additional notes. |

**Primary Key:** `id_mantenimiento`  
**Foreign Keys:**  
- `FK_Mant_Dispositivo` → `DispositivosIoT(id_dispositivo)`  
- `FK_Mant_Usuario` → `Usuarios(id_usuario)`

---

### Marcas

Catalog of sensor and equipment manufacturers.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_marca` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented brand identifier. |
| `nombre` | `nvarchar(100)` | NO | | Brand name (unique). |
| `descripcion` | `nvarchar(200)` | YES | | Brief description of the brand. |
| `pais_origen` | `nvarchar(100)` | YES | | Country of origin. |
| `sitio_web` | `nvarchar(150)` | YES | | Manufacturer website URL. |
| `fecha_registro` | `datetime` | NO | `GETDATE()` | Date added to the system. |

**Primary Key:** `PK_Marcas` on `id_marca`  
**Unique Constraint:** `UQ_Marcas_nombre` on `nombre`

---

### MetodoRiego

Catalog of irrigation methods with efficiency ratings.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_metodo_riego` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented method identifier. |
| `nombre` | `nvarchar(50)` | NO | | Irrigation method name (e.g., 'Goteo', 'Aspersión'). |
| `descripcion` | `nvarchar(200)` | YES | | Description of the method. |
| `eficiencia` | `decimal(5,2)` | YES | | Typical efficiency percentage. |
| `activo` | `bit` | NO | `1` | Whether the method is active. |
| `fecha_creacion` | `datetime` | NO | `GETDATE()` | Creation timestamp. |

**Primary Key:** `id_metodo_riego`  
**Unique Constraint:** `UQ_MetodoRiego_nombre` on `nombre`

---

### Modelos

Catalog of specific sensor/equipment models belonging to a brand.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_modelo` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented model identifier. |
| `id_marca` | `int` | NO | | Foreign key referencing `Marcas.id_marca`. |
| `nombre` | `nvarchar(100)` | NO | | Model name (unique per brand). |
| `especificaciones` | `nvarchar(max)` | YES | | Technical specifications. |
| `rango_min_por_defecto` | `decimal(10,2)` | YES | | Default minimum measurement range. |
| `rango_max_por_defecto` | `decimal(10,2)` | YES | | Default maximum measurement range. |
| `precision_por_defecto` | `decimal(5,2)` | YES | | Default accuracy/precision. |
| `unidad_medida_por_defecto` | `nvarchar(10)` | YES | | Default unit of measurement. |
| `fecha_lanzamiento` | `date` | YES | | Release date. |
| `activo` | `bit` | NO | `1` | Whether the model is active in the system. |

**Primary Key:** `PK_Modelos` on `id_modelo`  
**Unique Constraint:** `UQ_Modelos_MarcaNombre` on (`id_marca`, `nombre`)  
**Foreign Keys:** `FK_Modelos_Marcas` → `Marcas(id_marca)` ON DELETE CASCADE

---

### PasswordResetTokens

Manages password reset tokens for user accounts.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_token_reset` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented token identifier. |
| `id_usuario` | `int` | NO | | Foreign key referencing `Usuarios.id_usuario`. |
| `token_hash` | `nvarchar(64)` | NO | | Hashed reset token. |
| `expira_en` | `datetime` | NO | | Token expiration timestamp. |
| `usado_en` | `datetime` | YES | | Timestamp when token was used (if any). |
| `fecha_creacion` | `datetime` | NO | `GETDATE()` | Token creation timestamp. |

**Primary Key:** `id_token_reset`  
**Foreign Keys:** `FK_PasswordResetTokens_Usuarios` → `Usuarios(id_usuario)`

---

### Personas

Stores personal information of individuals (employees, technicians, contacts).

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_persona` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented person identifier. |
| `nombre` | `nvarchar(100)` | YES | | Full name. |
| `telefono` | `nvarchar(20)` | YES | | Contact phone number. |
| `puesto` | `nvarchar(50)` | YES | | Job title/position. |
| `cedula` | `nvarchar(20)` | YES | | National ID number (Dominican Cedula). |
| `registrado` | `datetime` | NO | `GETDATE()` | Registration date. |
| `email` | `nvarchar(150)` | YES | | Personal email address. |

**Primary Key:** `id_persona`

---

### PlanFertilizacion

Defines fertilization schedules for specific crop cycles.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_plan` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented plan identifier. |
| `id_detalle` | `int` | NO | | Foreign key referencing `CultivoDetalle.id_detalle`. |
| `id_fertilizante` | `int` | NO | | Foreign key referencing `Fertilizantes.id_fertilizante`. |
| `dosis` | `nvarchar(50)` | NO | | Dosage to apply (e.g., '5 ml/L'). |
| `frecuencia_dias` | `int` | NO | | Frequency of application in days. |
| `inicio_aplicacion` | `date` | NO | | Start date for the plan. |
| `fin_aplicacion` | `date` | YES | | End date for the plan. |
| `notas` | `nvarchar(max)` | YES | | Additional notes. |

**Primary Key:** `id_plan`  
**Foreign Keys:**  
- `FK_PlanFert_CultivoDetalle` → `CultivoDetalle(id_detalle)`  
- `FK_PlanFert_Fertilizantes` → `Fertilizantes(id_fertilizante)`

---

### Reportes

Stores metadata for generated reports (e.g., PDF, Excel files).

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_reporte` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented report identifier. |
| `id_invernadero` | `int` | NO | | Foreign key referencing `Invernaderos.id_invernadero`. |
| `tipo` | `nvarchar(50)` | NO | | Report type (e.g., 'Temperatura', 'Rendimiento'). |
| `descripcion` | `nvarchar(max)` | YES | | Report description or title. |
| `fecha_generado` | `datetime` | NO | `GETDATE()` | Generation timestamp. |
| `generado_por` | `int` | YES | | Foreign key referencing `Usuarios.id_usuario`. |
| `rango_inicio` | `datetime` | YES | | Start date of the data range. |
| `rango_fin` | `datetime` | YES | | End date of the data range. |
| `formato` | `nvarchar(20)` | YES | | File format (e.g., 'PDF', 'Excel'). |
| `ruta_archivo` | `nvarchar(200)` | YES | | Server file path or URL to the report file. |
| `estado` | `nvarchar(20)` | YES | | Generation status (e.g., 'Completado', 'Error'). |

**Primary Key:** `id_reporte`  
**Foreign Keys:** `FK_Reportes_Invernaderos` → `Invernaderos(id_invernadero)`

---

### Riegos

Logs irrigation events for specific zones.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_riego` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented irrigation event identifier. |
| `id_zona` | `int` | NO | | Foreign key referencing `ZonasRiego.id_zona`. |
| `id_usuario` | `int` | YES | | Foreign key referencing `Usuarios.id_usuario`. User who initiated/authorized irrigation. |
| `tipo` | `nvarchar(20)` | NO | | Irrigation type: 'Manual', 'Automatico'. |
| `duracion_min` | `int` | NO | | Duration in minutes. |
| `volumen_litros` | `decimal(10,2)` | YES | | Estimated or measured water volume in liters. |
| `fecha_inicio` | `datetime` | NO | `GETDATE()` | Start timestamp. |
| `fecha_fin` | `datetime` | YES | | End timestamp (if completed). |

**Primary Key:** `id_riego`  
**Foreign Keys:**  
- `FK_Riegos_Usuarios` → `Usuarios(id_usuario)`  
- `FK_Riegos_Zonas` → `ZonasRiego(id_zona)`

---

### Roles

Defines user roles and their associated permissions.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `RolID` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented role identifier. |
| `Nombre` | `nvarchar(50)` | NO | | Unique role name (e.g., 'Administrador', 'Operador'). |
| `Descripcion` | `nvarchar(200)` | YES | | Role description. |
| `Permisos` | `nvarchar(max)` | YES | | JSON or comma-separated list of permissions. |
| `Activo` | `bit` | YES | `1` | Whether the role is active. |

**Primary Key:** `RolID`  
**Unique Constraint:** `UQ_Roles_Nombre` on `Nombre`

---

### Sensores

Represents individual sensors installed in greenhouses, with detailed metadata and calibration info.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_sensor` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented sensor identifier. |
| `id_invernadero` | `int` | NO | | Foreign key referencing `Invernaderos.id_invernadero`. |
| `id_dispositivo` | `int` | YES | | Foreign key referencing `DispositivosIoT.id_dispositivo`. Parent IoT device. |
| `tipo` | `nvarchar(30)` | NO | | Sensor type (e.g., 'Temperatura', 'Humedad', 'pH'). |
| `estado` | `nvarchar(20)` | NO | | Operational status: 'Activo', 'Inactivo', 'Calibrando'. |
| `rango_min` | `decimal(10,2)` | YES | | Minimum expected valid reading. |
| `rango_max` | `decimal(10,2)` | YES | | Maximum expected valid reading. |
| `unidad_medida` | `nvarchar(10)` | YES | | Unit of measurement (e.g., '°C', '%'). |
| `precision` | `decimal(5,2)` | YES | | Sensor accuracy specification. |
| `fecha_instalacion` | `date` | YES | | Installation date. |
| `ubicacion_fisica` | `nvarchar(100)` | YES | | Physical location description within greenhouse. |
| `ultimo_calibrado` | `date` | YES | | Date of last calibration. |
| `observaciones` | `nvarchar(max)` | YES | | General observations. |
| `id_marca` | `int` | NO | | Foreign key referencing `Marcas.id_marca`. |
| `id_modelo` | `int` | NO | | Foreign key referencing `Modelos.id_modelo`. |

**Primary Key:** `id_sensor`  
**Foreign Keys:**  
- `FK_Sensores_Dispositivos` → `DispositivosIoT(id_dispositivo)`  
- `FK_Sensores_Invernaderos` → `Invernaderos(id_invernadero)`  
- `FK_Sensores_Marcas` → `Marcas(id_marca)`  
- `FK_Sensores_Modelos` → `Modelos(id_modelo)`

---

### TareasProgramadas

Defines recurring tasks for greenhouse maintenance or operations.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_tarea` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented task identifier. |
| `id_empresa` | `int` | NO | | Foreign key referencing `Empresas.id_empresa`. |
| `titulo` | `nvarchar(150)` | NO | | Task title. |
| `descripcion` | `nvarchar(max)` | YES | | Detailed description. |
| `frecuencia` | `nvarchar(20)` | NO | | Recurrence pattern (e.g., 'Diaria', 'Semanal'). |
| `proxima_ejecucion` | `datetime` | NO | | Next scheduled execution date/time. |
| `responsable` | `int` | NO | | Foreign key referencing `Usuarios.id_usuario`. Assigned person. |
| `estado` | `nvarchar(20)` | NO | `'Activa'` | Task status: 'Activa', 'Completada', 'Cancelada'. |

**Primary Key:** `id_tarea`  
**Foreign Keys:**  
- `FK_Tareas_Empresas` → `Empresas(id_empresa)`  
- `FK_Tareas_Usuario` → `Usuarios(id_usuario)`

---

### TiposSensor

Lookup table for standardized sensor types with default ranges.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `TipoSensorID` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented type identifier. |
| `Nombre` | `nvarchar(100)` | NO | | Sensor type name (e.g., 'Temperature', 'Humidity'). |
| `Unidad` | `nvarchar(20)` | YES | | Typical unit of measurement. |
| `RangoMin` | `decimal(10,2)` | YES | | Recommended minimum range. |
| `RangoMax` | `decimal(10,2)` | YES | | Recommended maximum range. |
| `Descripcion` | `nvarchar(500)` | YES | | Description of the sensor type. |

**Primary Key:** `TipoSensorID`

---

### Usuarios

User accounts for system access, linked to a person record.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_usuario` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented user identifier. |
| `nombre` | `nvarchar(100)` | NO | | Display name or username. |
| `correo` | `nvarchar(100)` | NO | | Unique email address for login. |
| `contraseña` | `nvarchar(255)` | NO | | Hashed password. |
| `rol` | `nvarchar(20)` | NO | | User role (e.g., 'Admin', 'Operador', 'Consulta'). |
| `fecha_registro` | `datetime` | NO | `GETDATE()` | Account creation date. |
| `id_persona` | `int` | YES | | Foreign key referencing `Personas.id_persona`. |
| `activo` | `bit` | YES | `1` | Whether the account is active. |

**Primary Key:** `id_usuario`  
**Unique Constraint:** `UQ_Usuarios_Correo` on `correo`  
**Foreign Keys:** `FK_Usuarios_Personas` → `Personas(id_persona)`

---

### ZonasRiego

Defines irrigation zones within a greenhouse, with target thresholds.

| Column | Data Type | Nullable | Default | Description |
|--------|-----------|----------|---------|-------------|
| `id_zona` | `int` IDENTITY(1,1) | NO | | Primary key, auto-incremented zone identifier. |
| `nombre` | `nvarchar(100)` | NO | | Zone name (e.g., 'Zona Norte', 'Sector Lechugas'). |
| `id_invernadero` | `int` | NO | | Foreign key referencing `Invernaderos.id_invernadero`. |
| `id_metodo_riego` | `int` | NO | | Foreign key referencing `MetodoRiego.id_metodo_riego`. |
| `umbral_humedad` | `decimal(5,2)` | NO | | Target humidity threshold (percentage). |
| `estado` | `nvarchar(20)` | NO | `'Activa'` | Zone status: 'Activa', 'Inactiva'. |
| `tipo_cultivo` | `nvarchar(100)` | YES | | Type of crop grown in this zone. |
| `area_m2` | `decimal(10,2)` | YES | | Area in square meters. |
| `caudal_litros_min` | `decimal(10,2)` | YES | | Flow rate of irrigation system (L/min). |
| `fecha_creacion` | `datetime` | YES | `GETDATE()` | Creation date. |
| `observaciones` | `nvarchar(max)` | YES | | General notes. |
| `umbral_ph` | `decimal(4,2)` | YES | | Target pH for nutrient solution. |
| `umbral_ec` | `decimal(5,2)` | YES | | Target electrical conductivity (EC). |
| `umbral_tds` | `decimal(6,2)` | YES | | Target total dissolved solids (TDS). |
| `fecha_siembra` | `date` | YES | | Planting date for the crop assigned to this zone. |
| `fecha_cosecha_estimada` | `date` | YES | | Estimated harvest date for the crop assigned to this zone. |
| `tiempo_germinacion_dias` | `int` | YES | | Germination period for this zone crop cycle. |
| `tiempo_crecimiento_dias` | `int` | YES | | Growth period for this zone crop cycle. |
| `tiempo_cosecha_dias` | `int` | YES | | Harvest period for this zone crop cycle. |
| `cantidad_cultivo` | `int` | YES | | Quantity of crop units/plants planted in this zone. |
| `notas_cultivo` | `nvarchar(max)` | YES | | Crop cycle notes for this zone. |

**Primary Key:** `id_zona`  
**Foreign Keys:**  
- `FK_Zonas_Invernaderos` → `Invernaderos(id_invernadero)`  
- `FK_ZonasRiego_MetodoRiego` → `MetodoRiego(id_metodo_riego)`

---

## Stored Procedures

### sp_EvaluarReglas

Evaluates automation rules for a given irrigation zone based on the latest sensor readings.

**Parameters:**
- `@ZonaID INT` - The ID of the irrigation zone to evaluate.

**Logic:**
Retrieves all active automation rules associated with the zone, joins with sensor types, and fetches the most recent reading for each rule's sensor type. The rules are ordered by priority.

**Returns:**
A result set containing:
- `ReglaID`, `Nombre`, `Operador`, `ValorUmbral`, `AccionTipo`, `AccionParametros`
- `TipoSensor` (sensor type name)
- `UltimaLectura` (most recent sensor value)

This procedure is intended to be called by an automation engine that decides whether to trigger actions (e.g., turn on irrigation, send alert) based on the comparison between `UltimaLectura` and `ValorUmbral`.

```sql
CREATE PROCEDURE [dbo].[sp_EvaluarReglas]
    @ZonaID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.ReglaID,
        r.Nombre,
        r.Operador,
        r.ValorUmbral,
        r.AccionTipo,
        r.AccionParametros,
        ts.Nombre AS TipoSensor,
        (
            SELECT TOP 1 l.Valor
            FROM dbo.LecturasSensores l
            INNER JOIN dbo.Sensores s ON l.SensorID = s.SensorID
            WHERE s.ZonaID = @ZonaID AND s.TipoSensorID = r.TipoSensorID
            ORDER BY l.FechaHora DESC
        ) AS UltimaLectura
    FROM dbo.ReglasAutomatizacion r
    INNER JOIN dbo.TiposSensor ts ON r.TipoSensorID = ts.TipoSensorID
    WHERE r.ZonaID = @ZonaID AND r.Activo = 1
    ORDER BY r.Prioridad;
END

Note: The stored procedure references tables ReglasAutomatizacion and columns SensorID, ZonaID which are not present in the provided DDL script. This suggests the procedure may belong to a related or extended schema not fully captured in the script.

Foreign Key Relationships Summary
Child Table	Foreign Key Name	Parent Table
Alertas	FK_Alertas_Sensores	Sensores
AplicacionesFertilizantes	FK_Aplicaciones_PlanFert	PlanFertilizacion
AplicacionesFertilizantes	FK_Aplicaciones_Usuario	Usuarios
Bitacora	FK_Bitacora_Dispositivo	DispositivosIoT
Bitacora	FK_Bitacora_Usuario	Usuarios
ComandosIoT	FK_Comandos_Dispositivo	DispositivosIoT
ComandosIoT	FK_Comandos_Usuarios	Usuarios
ConfiguracionesSistema	FK_Config_Empresa	Empresas
ConfiguracionesSistema	FK_Config_Usuarios	Usuarios
ControlPlagas	FK_Plagas_CultivoDetalle	CultivoDetalle
CultivoDetalle	FK_Detalle_Cultivo	Cultivos
Cultivos	FK_Cultivos_Invernaderos	Invernaderos
DispositivosIoT	FK_Dispositivos_Invernaderos	Invernaderos
EtapasCultivo	FK_Etapas_CultivoDetalle	CultivoDetalle
Invernaderos	FK_Invernaderos_Empresas	Empresas
Invernaderos	FK_Invernaderos_Usuario	Usuarios
IoTLog	FK_IoTLog_Dispositivo	DispositivosIoT
LecturasSensores	FK_Lecturas_Sensores	Sensores
MantenimientoEquipos	FK_Mant_Dispositivo	DispositivosIoT
MantenimientoEquipos	FK_Mant_Usuario	Usuarios
MetodoRiego	(catalog table, no FK)	-
Modelos	FK_Modelos_Marcas	Marcas
PasswordResetTokens	FK_PasswordResetTokens_Usuarios	Usuarios
PlanFertilizacion	FK_PlanFert_CultivoDetalle	CultivoDetalle
PlanFertilizacion	FK_PlanFert_Fertilizantes	Fertilizantes
Reportes	FK_Reportes_Invernaderos	Invernaderos
Riegos	FK_Riegos_Usuarios	Usuarios
Riegos	FK_Riegos_Zonas	ZonasRiego
Sensores	FK_Sensores_Dispositivos	DispositivosIoT
Sensores	FK_Sensores_Invernaderos	Invernaderos
Sensores	FK_Sensores_Marcas	Marcas
Sensores	FK_Sensores_Modelos	Modelos
TareasProgramadas	FK_Tareas_Empresas	Empresas
TareasProgramadas	FK_Tareas_Usuario	Usuarios
Usuarios	FK_Usuarios_Personas	Personas
ZonasRiego	FK_Zonas_Invernaderos	Invernaderos
ZonasRiego	FK_ZonasRiego_MetodoRiego	MetodoRiego
