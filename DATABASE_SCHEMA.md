# GreenSenseDB - Esquema de Base de Datos

Base de datos SQL Server para el sistema de Fertirriego Inteligente.

---

## Relaciones entre Entidades

```
Empresas (1) ──── (N) Invernaderos
                    │
                    ├── (N) Cultivos
                    │       │
                    │       └── (1) CultivoDetalle (1) ──── (N) EtapasCultivo
                    │       │                              (N) PlanFertilizacion
                    │       │                                    │
                    │       │                                    └── (N) AplicacionesFertilizantes
                    │       └── (N) ControlPlagas
                    │
                    ├── (N) ZonasRiego
                    │       │
                    │       └── (N) Riegos
                    │
                    ├── (N) DispositivosIoT (1) ──── (N) Sensores
                    │       │                              │
                    │       │                              └── (N) LecturasSensores
                    │       │                              └── (N) Alertas
                    │       ├── (N) ComandosIoT
                    │       ├── (N) MantenimientoEquipos
                    │       └── (N) BitacoraMantenimiento
                    │       └── (N) IoTLog
                    │
                    ├── (N) Reportes
                    └── (N) ConfiguracionesSistema

Personas (1) ──── (N) Usuarios (1) ──── (N) Roles

Empresas (1) ──── (N) TareasProgramadas
```

---

## Tablas

### 1. Empresas
Empresas/clientes del sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_empresa | INT (PK) | Identificador único |
| nombre | NVARCHAR(150) | Nombre de la empresa |
| rnc | NVARCHAR(20) | RNC/identificación fiscal |
| direccion | NVARCHAR(200) | Dirección física |
| telefono | NVARCHAR(20) | Teléfono de contacto |
| correo | NVARCHAR(100) | Correo electrónico |
| estado | NVARCHAR(20) | Estado (default: 'Activa') |
| fecha_creacion | DATETIME | Fecha de registro (default: GETDATE()) |

---

### 2. Personas
Registro de personas (empleados, contactos).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_persona | INT (PK) | Identificador único |
| nombre | NVARCHAR(100) | Nombre completo |
| telefono | NVARCHAR(20) | Teléfono |
| puesto | NVARCHAR(50) | Cargo/posición |
| id_empresa | INT (FK) | Empresa a la que pertenece |
| cedula | NVARCHAR(20) | Cédula de identidad |
| registrado | DATETIME | Fecha de registro (default: GETDATE()) |

---

### 3. Usuarios
Usuarios del sistema con autenticación.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_usuario | INT (PK) | Identificador único |
| id_empresa | INT (FK) | Empresa a la que pertenece |
| nombre | NVARCHAR(100) | Nombre del usuario |
| correo | NVARCHAR(100) | Email (UNIQUE) |
| contraseña | NVARCHAR(255) | Hash de contraseña |
| rol | NVARCHAR(20) | Rol: administrador, tecnico, agricultor |
| fecha_registro | DATETIME | Fecha de registro (default: GETDATE()) |
| id_persona | INT (FK) | Persona asociada (nullable) |
| activo | BIT | Estado activo (default: 1) |

**FK:** Empresas(id_empresa), Personas(id_persona)

---

### 4. Roles
Definición de roles y permisos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| RolID | INT (PK) | Identificador único |
| Nombre | NVARCHAR(50) | Nombre del rol (UNIQUE) |
| Descripcion | NVARCHAR(200) | Descripción del rol |
| Permisos | NVARCHAR(MAX) | Lista de permisos (JSON) |
| Activo | BIT | Estado activo (default: 1) |

---

### 5. Invernaderos
Invernaderos belonging a empresa.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_invernadero | INT (PK) | Identificador único |
| id_empresa | INT (FK) | Empresa dueña |
| nombre | NVARCHAR(100) | Nombre del invernadero |
| ubicacion | NVARCHAR(150) | Ubicación física |
| superficie_m2 | DECIMAL(10,2) | Superficie en metros cuadrados |
| id_usuario | INT (FK) | Usuario responsable (nullable) |
| estado | NVARCHAR(20) | Estado del invernadero |

**FK:** Empresas(id_empresa), Usuarios(id_usuario)

---

### 6. Cultivos
Cultivos plantados en invernaderos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_cultivo | INT (PK) | Identificador único |
| nombre | NVARCHAR(100) | Nombre del cultivo |
| variedad | NVARCHAR(100) | Variedad específica |
| id_invernadero | INT (FK) | Invernadero donde se plantó |
| fecha_siembra | DATE | Fecha de siembra |

**FK:** Invernaderos(id_invernadero)

---

### 7. CultivoDetalle
Detalles adicionales de cada cultivo (cronograma, tiempos).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_detalle | INT (PK) | Identificador único |
| id_cultivo | INT (FK) | Cultivo asociado |
| fecha_siembra | DATE | Fecha de siembra |
| fecha_cosecha_estimada | DATE | Fecha estimada de cosecha |
| variedad | NVARCHAR(100) | Variedad del cultivo |
| tiempo_germinacion_dias | INT | Días de germinación |
| tiempo_crecimiento_dias | INT | Días de crecimiento |
| tiempo_cosecha_dias | INT | Días hasta cosecha |
| notas | NVARCHAR(MAX) | Notas adicionales |

**FK:** Cultivos(id_cultivo)

---

### 8. EtapasCultivo
Etapas del ciclo de vida del cultivo.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_etapa | INT (PK) | Identificador único |
| id_detalle | INT (FK) | Detalle de cultivo |
| nombre_etapa | NVARCHAR(100) | Nombre de la etapa |
| fecha_inicio | DATE | Inicio de la etapa |
| fecha_fin | DATE | Fin de la etapa (nullable) |
| notas | NVARCHAR(MAX) | Notas |

**FK:** CultivoDetalle(id_detalle)

---

### 9. Fertilizantes
Catálogo de fertilizantes disponibles.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_fertilizante | INT (PK) | Identificador único |
| nombre | NVARCHAR(100) | Nombre del fertilizante |
| tipo | NVARCHAR(50) | Tipo (orgánico, sintético, etc.) |
| composicion | NVARCHAR(200) | Composición química |
| fabricante | NVARCHAR(100) | Fabricante/proveedor |
| ph | DECIMAL(4,2) | pH del producto |
| nitrogeno | DECIMAL(5,2) | Porcentaje de Nitrógeno (N) |
| fosforo | DECIMAL(5,2) | Porcentaje de Fósforo (P) |
| potasio | DECIMAL(5,2) | Porcentaje de Potasio (K) |
| micronutrientes | NVARCHAR(200) | Lista de micronutrientes |
| forma_aplicacion | NVARCHAR(50) | Forma de aplicación |
| riesgos | NVARCHAR(MAX) | Riesgos de manejo |
| fecha_registro | DATETIME | Fecha de registro (default: GETDATE()) |

---

### 10. PlanFertilizacion
Planes de fertilización para cultivos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_plan | INT (PK) | Identificador único |
| id_detalle | INT (FK) | CultivoDetalle asociado |
| id_fertilizante | INT (FK) | Fertilizante a usar |
| dosis | NVARCHAR(50) | Dosis recomendada |
| frecuencia_dias | INT | Frecuencia en días |
| inicio_aplicacion | DATE | Fecha de inicio del plan |
| fin_aplicacion | DATE | Fecha de fin (nullable) |
| notas | NVARCHAR(MAX) | Notas adicionales |

**FK:** CultivoDetalle(id_detalle), Fertilizantes(id_fertilizante)

---

### 11. AplicacionesFertilizantes
Registro de aplicaciones reales de fertilizante.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_aplicacion | INT (PK) | Identificador único |
| id_plan | INT (FK) | Plan de fertilización |
| fecha_aplicacion | DATETIME | Fecha y hora de aplicación (default: GETDATE()) |
| cantidad_aplicada | NVARCHAR(50) | Cantidad aplicada |
| aplicado_por | INT (FK) | Usuario que realizó la aplicación |
| notas | NVARCHAR(MAX) | Notas de la aplicación |

**FK:** PlanFertilizacion(id_plan), Usuarios(id_usuario)

---

### 12. ControlPlagas
Registro de controles de plagas realizados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_plaga | INT (PK) | Identificador único |
| id_detalle | INT (FK) | CultivoDetalle asociado |
| tipo_plaga | NVARCHAR(100) | Tipo de plaga detectada |
| producto_usado | NVARCHAR(100) | Producto aplicado |
| dosis | NVARCHAR(50) | Dosis utilizada |
| fecha_aplicacion | DATETIME | Fecha de aplicación (default: GETDATE()) |
| notas | NVARCHAR(MAX) | Notas |

**FK:** CultivoDetalle(id_detalle)

---

### 13. ZonasRiego
Zonas de riego dentro de invernaderos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_zona | INT (PK) | Identificador único |
| nombre | NVARCHAR(100) | Nombre de la zona |
| id_invernadero | INT (FK) | Invernadero al que pertenece |
| umbral_humedad | DECIMAL(5,2) | Umbral de humedad para activar riego |
| estado | NVARCHAR(20) | Estado (default: 'Activa') |
| tipo_cultivo | NVARCHAR(100) | Tipo de cultivo en la zona |
| area_m2 | DECIMAL(10,2) | Área de la zona |
| caudal_litros_min | DECIMAL(10,2) | Caudal del sistema |
| metodo_riego | NVARCHAR(50) | Método (goteo, aspersión, etc.) |
| fecha_creacion | DATETIME | Fecha de creación (default: GETDATE()) |
| observaciones | NVARCHAR(MAX) | Notas |
| umbral_ph | DECIMAL(4,2) | Umbral de pH (default: 7, CHECK 0-14) |
| umbral_ec | DECIMAL(5,2) | Umbral de conductividad eléctrica |
| umbral_tds | DECIMAL(6,2) | Umbral de TDS |

**FK:** Invernaderos(id_invernadero)
**CHECK:** umbral_ph >= 0 AND umbral_ph <= 14

---

### 14. Riegos
Eventos de riego (automático o manual).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_riego | INT (PK) | Identificador único |
| id_zona | INT (FK) | Zona de riego |
| id_usuario | INT (FK) | Usuario que inició (nullable) |
| tipo | NVARCHAR(20) | Tipo: automatico, manual |
| duracion_min | INT | Duración en minutos |
| volumen_litros | DECIMAL(10,2) | Volumen de agua usado |
| fecha_inicio | DATETIME | Inicio del riego (default: GETDATE()) |
| fecha_fin | DATETIME | Fin del riego (nullable) |

**FK:** ZonasRiego(id_zona), Usuarios(id_usuario)

---

### 15. DispositivosIoT
Dispositivos IoT conectados a invernaderos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_dispositivo | INT (PK) | Identificador único |
| id_invernadero | INT (FK) | Invernadero al que pertenece |
| nombre | NVARCHAR(100) | Nombre del dispositivo |
| tipo | NVARCHAR(50) | Tipo (gateway, controlador, etc.) |
| codigo_dispositivo | NVARCHAR(100) UNIQUE | Codigo fisico/estable usado por el hardware |
| firmware_version | NVARCHAR(50) | Versión del firmware |
| ip_local | NVARCHAR(50) | IP en la red local |
| estado | NVARCHAR(20) | Estado (default: 'Activo') |
| ultimo_reporte | DATETIME | Última vez que reportó (nullable) |

**FK:** Invernaderos(id_invernadero)

---

### 16. Sensores
Sensores IoT instalados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_sensor | INT (PK) | Identificador único |
| id_invernadero | INT (FK) | Invernadero |
| id_dispositivo | INT (FK) | Dispositivo al que está conectado (nullable) |
| tipo | NVARCHAR(30) | Tipo: humedad_suelo, temperatura, humedad_ambiental, TDS, pH |
| modelo | NVARCHAR(50) | Modelo del sensor |
| estado | NVARCHAR(20) | Estado operativo |
| marca | NVARCHAR(50) | Marca del sensor |
| rango_min | DECIMAL(10,2) | Rango mínimo de medición |
| rango_max | DECIMAL(10,2) | Rango máximo de medición |
| unidad_medida | NVARCHAR(10) | Unidad (%, °C, ppm, etc.) |
| precision | DECIMAL(5,2) | Precisión del sensor |
| fecha_instalacion | DATE | Fecha de instalación |
| ubicacion_fisica | NVARCHAR(100) | Ubicación dentro del invernadero |
| ultimo_calibrado | DATE | Última calibración |
| observaciones | NVARCHAR(MAX) | Notas |

**FK:** Invernaderos(id_invernadero), DispositivosIoT(id_dispositivo)

---

### 17. TiposSensor
Catálogo de tipos de sensores disponibles.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| TipoSensorID | INT (PK) | Identificador único |
| Nombre | NVARCHAR(100) | Nombre del tipo |
| Unidad | NVARCHAR(20) | Unidad de medida |
| RangoMin | DECIMAL(10,2) | Rango mínimo |
| RangoMax | DECIMAL(10,2) | Rango máximo |
| Descripcion | NVARCHAR(500) | Descripción |

---

### 18. LecturasSensores
Histórico de lecturas de sensores.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_lectura | INT (PK) | Identificador único |
| id_sensor | INT (FK) | Sensor que tomó la lectura |
| valor | DECIMAL(10,2) | Valor medido |
| unidad | NVARCHAR(10) | Unidad de medida |
| fecha_hora | DATETIME | Timestamp (default: GETDATE()) |

**FK:** Sensores(id_sensor)

---

### 19. Alertas
Alertas generadas por el sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_alerta | INT (PK) | Identificador único |
| id_sensor | INT (FK) | Sensor que generó la alerta |
| tipo_alerta | NVARCHAR(100) | Tipo: humedad_baja, temperatura_alta, etc. |
| valor_detectado | DECIMAL(10,2) | Valor que causó la alerta |
| fecha_hora | DATETIME | Timestamp (default: GETDATE()) |
| estado | NVARCHAR(20) | Estado: pendiente, atendida, resuelta |
| umbral_min | DECIMAL(10,2) | Umbral mínimo |
| umbral_max | DECIMAL(10,2) | Umbral máximo |
| nivel | NVARCHAR(20) | Nivel: critico, advertencia, info |
| accion_recomendada | NVARCHAR(200) | Acción sugerida |
| atendida_por | INT (FK) | Usuario que atendió (nullable) |
| fecha_atencion | DATETIME | Fecha de atención (nullable) |

**FK:** Sensores(id_sensor), Usuarios(id_usuario)

---

### 20. ComandosIoT
Comandos enviados a dispositivos IoT.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_comando | INT (PK) | Identificador único |
| id_dispositivo | INT (FK) | Dispositivo destino |
| comando | NVARCHAR(100) | Comando a ejecutar |
| parametros | NVARCHAR(MAX) | Parámetros del comando |
| enviado_por | INT (FK) | Usuario que envió (nullable) |
| fecha_envio | DATETIME | Fecha de envío (default: GETDATE()) |
| estado | NVARCHAR(20) | Estado (default: 'Pendiente') |

**FK:** DispositivosIoT(id_dispositivo), Usuarios(id_usuario)

---

### 21. MantenimientoEquipos
Registro de mantenimiento de dispositivos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_mantenimiento | INT (PK) | Identificador único |
| id_dispositivo | INT (FK) | Dispositivo mantenido |
| tipo_mantenimiento | NVARCHAR(20) | Tipo: preventivo, correctivo |
| descripcion | NVARCHAR(MAX) | Descripción del trabajo |
| realizado_por | INT (FK) | Usuario que lo realizó |
| fecha_mantenimiento | DATETIME | Fecha (default: GETDATE()) |
| proximo_mantenimiento | DATETIME | Próximo mantenimiento (nullable) |
| estado_equipo_post | NVARCHAR(20) | Estado después del mantenimiento |
| notas | NVARCHAR(MAX) | Notas adicionales |

**FK:** DispositivosIoT(id_dispositivo), Usuarios(id_usuario)

---

### 22. BitacoraMantenimiento
Bitácora de eventos de mantenimiento.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_bitacora | INT (PK) | Identificador único |
| id_dispositivo | INT (FK) | Dispositivo |
| descripcion_evento | NVARCHAR(MAX) | Descripción del evento |
| severidad | NVARCHAR(20) | Severidad: info, warning, error, critical |
| fecha_evento | DATETIME | Fecha del evento (default: GETDATE()) |
| registrado_por | INT (FK) | Usuario que registró |
| notas | NVARCHAR(MAX) | Notas adicionales |

**FK:** DispositivosIoT(id_dispositivo), Usuarios(id_usuario)

---

### 23. IoTLog
Log de comunicación con dispositivos IoT.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_log | INT (PK) | Identificador único |
| id_dispositivo | INT (FK) | Dispositivo |
| tipo_mensaje | NVARCHAR(50) | Tipo de mensaje |
| payload | NVARCHAR(MAX) | Contenido del mensaje |
| fecha_evento | DATETIME | Timestamp (default: GETDATE()) |
| estado | NVARCHAR(20) | Estado del mensaje |

**FK:** DispositivosIoT(id_dispositivo)

---

### 24. Reportes
Reportes generados por el sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_reporte | INT (PK) | Identificador único |
| id_invernadero | INT (FK) | Invernadero relacionado |
| tipo | NVARCHAR(50) | Tipo de reporte |
| descripcion | NVARCHAR(MAX) | Descripción |
| fecha_generado | DATETIME | Fecha de generación (default: GETDATE()) |
| generado_por | INT (FK) | Usuario que generó (nullable) |
| rango_inicio | DATETIME | Inicio del rango de datos |
| rango_fin | DATETIME | Fin del rango de datos |
| formato | NVARCHAR(20) | Formato: PDF, Excel, etc. |
| ruta_archivo | NVARCHAR(200) | Ruta del archivo generado |
| estado | NVARCHAR(20) | Estado |

**FK:** Invernaderos(id_invernadero), Usuarios(id_usuario)

---

### 25. TareasProgramadas
Tareas programadas para ejecución.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_tarea | INT (PK) | Identificador único |
| id_empresa | INT (FK) | Empresa dueña |
| titulo | NVARCHAR(150) | Título de la tarea |
| descripcion | NVARCHAR(MAX) | Descripción |
| frecuencia | NVARCHAR(20) | Frecuencia: diaria, semanal, mensual |
| proxima_ejecucion | DATETIME | Próxima fecha de ejecución |
| responsable | INT (FK) | Usuario responsable |
| estado | NVARCHAR(20) | Estado (default: 'Activa') |

**FK:** Empresas(id_empresa), Usuarios(id_usuario)

---

### 26. ConfiguracionesSistema
Configuraciones específicas por empresa.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_config | INT (PK) | Identificador único |
| id_empresa | INT (FK) | Empresa |
| parametro | NVARCHAR(100) | Nombre del parámetro |
| valor | NVARCHAR(100) | Valor del parámetro |
| descripcion | NVARCHAR(MAX) | Descripción |
| fecha_creacion | DATETIME | Fecha de creación (default: GETDATE()) |
| creado_por | INT (FK) | Usuario que creó |
| fecha_modificacion | DATETIME | Última modificación |

**FK:** Empresas(id_empresa), Usuarios(id_usuario)

---

### 27. ConfiguracionSistema
Configuraciones globales del sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| ConfigID | INT (PK) | Identificador único |
| Clave | NVARCHAR(100) | Clave (UNIQUE) |
| Valor | NVARCHAR(500) | Valor |
| Descripcion | NVARCHAR(500) | Descripción |
| Categoria | NVARCHAR(50) | Categoría |
| FechaModificacion | DATETIME2(7) | Última modificación (default: GETDATE()) |

---

## Índices y Constraints

### Unique Constraints
- `Usuarios.correo` - No permite emails duplicados
- `Roles.Nombre` - No permite roles con el mismo nombre
- `ConfiguracionSistema.Clave` - No permite claves duplicadas

### Check Constraints
- `ZonasRiego.umbral_ph` - Solo valores entre 0 y 14

---

## Notas de Implementación

1. **Foreign Keys**: Todas las FK son opcionales de eliminar (ON DELETE NO ACTION por defecto)
2. **Valores por Defecto**: Los timestamps usan GETDATE(), estados usan 'Activo'/'Activa'
3. **Tipos de Sensores Comunes**: humedad_suelo, temperatura, humedad_ambiental, TDS, pH
4. **Roles**: administrador, tecnico, agricultor
5. **Tipos de Riego**: automatico, manual
6. **Niveles de Alerta**: critico, advertencia, info
