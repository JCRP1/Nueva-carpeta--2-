import sql from "mssql"
import { hashSync } from "bcryptjs"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const config: sql.config = {
  server: process.env.MSSQL_HOST || "localhost",
  port: Number(process.env.MSSQL_PORT || 1433),
  database: process.env.MSSQL_DATABASE || "GreenSenseDB",
  user: process.env.MSSQL_USER || "sa",
  password: process.env.MSSQL_PASSWORD || "",
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: process.env.MSSQL_TRUST_CERT !== "false",
  },
}

async function seed() {
  console.log("Connecting to SQL Server...")
  const pool = await sql.connect(config)
  console.log("Connected to:", config.database)

  // 1. Seed Empresas
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Empresas WHERE nombre = N'Invernadero Pedro Castillo')
    INSERT INTO Empresas (nombre, direccion, telefono, correo, estado, fecha_creacion)
    VALUES (N'Invernadero Pedro Castillo', N'San Jose de Ocoa, RD', '809-555-0100', 'info@greensense.io', 'Activa', GETDATE())
  `)
  const empResult = await pool.request().query("SELECT TOP 1 id_empresa FROM Empresas")
  const empresaId = empResult.recordset[0].id_empresa
  console.log("  Empresa ID:", empresaId)

  // 2. Seed Usuarios
  const users = [
    { nombre: "Carlos Martinez", email: "carlos@greensense.io", pass: "admin123", rol: "administrador" },
    { nombre: "Maria Lopez", email: "maria@greensense.io", pass: "tecnico123", rol: "tecnico" },
    { nombre: "Juan Perez", email: "juan@greensense.io", pass: "agri123", rol: "agricultor" },
    { nombre: "Ana Rodriguez", email: "ana@greensense.io", pass: "tecnico123", rol: "tecnico" },
  ]
  for (const u of users) {
    const exists = await pool.request()
      .input("email", sql.NVarChar, u.email)
      .query("SELECT 1 FROM Usuarios WHERE correo = @email")
    if (exists.recordset.length === 0) {
      const hash = hashSync(u.pass, 10)
      await pool.request()
        .input("nombre", sql.NVarChar, u.nombre)
        .input("email", sql.NVarChar, u.email)
        .input("hash", sql.NVarChar, hash)
        .input("rol", sql.NVarChar, u.rol)
        .input("empresaId", sql.Int, empresaId)
        .query(`INSERT INTO Usuarios (id_empresa, nombre, correo, [contraseña], rol, fecha_registro)
                VALUES (@empresaId, @nombre, @email, @hash, @rol, GETDATE())`)
      console.log(`  Created user: ${u.email} (${u.rol})`)
    } else {
      console.log(`  User exists: ${u.email}`)
    }
  }

  // 3. Seed Invernaderos
  const greenhouses = [
    { nombre: "Invernadero A - Tomates", ubicacion: "Sector Norte", area: 2500.0 },
    { nombre: "Invernadero B - Pimientos", ubicacion: "Sector Sur", area: 1800.0 },
    { nombre: "Invernadero C - Lechugas", ubicacion: "Sector Este", area: 1200.0 },
  ]
  for (const g of greenhouses) {
    const exists = await pool.request()
      .input("n", sql.NVarChar, g.nombre)
      .query("SELECT 1 FROM Invernaderos WHERE nombre = @n")
    if (exists.recordset.length === 0) {
      await pool.request()
        .input("n", sql.NVarChar, g.nombre)
        .input("u", sql.NVarChar, g.ubicacion)
        .input("a", sql.Decimal(10, 2), g.area)
        .input("e", sql.Int, empresaId)
        .query(`INSERT INTO Invernaderos (id_empresa, nombre, ubicacion, superficie_m2)
                VALUES (@e, @n, @u, @a)`)
      console.log(`  Created greenhouse: ${g.nombre}`)
    }
  }

  // Get greenhouse IDs
  const ghRows = await pool.request().query("SELECT id_invernadero, nombre FROM Invernaderos ORDER BY id_invernadero")
  const ghIds = ghRows.recordset

  // 4. Seed ZonasRiego
  const zones = [
    { nombre: "Zona 1 - Tomates Cherry", cultivo: "Tomate Cherry", ghIdx: 0, umbral: 35 },
    { nombre: "Zona 2 - Tomates Roma", cultivo: "Tomate Roma", ghIdx: 0, umbral: 35 },
    { nombre: "Zona 3 - Pimientos", cultivo: "Pimiento Morron", ghIdx: 1, umbral: 40 },
    { nombre: "Zona 4 - Lechugas", cultivo: "Lechuga Romana", ghIdx: 2, umbral: 45 },
  ]
  for (const z of zones) {
    const exists = await pool.request()
      .input("n", sql.NVarChar, z.nombre)
      .query("SELECT 1 FROM ZonasRiego WHERE nombre = @n")
    if (exists.recordset.length === 0 && ghIds[z.ghIdx]) {
      await pool.request()
        .input("n", sql.NVarChar, z.nombre)
        .input("inv", sql.Int, ghIds[z.ghIdx].id_invernadero)
        .input("c", sql.NVarChar, z.cultivo)
        .input("u", sql.Decimal(5, 2), z.umbral)
        .query(`INSERT INTO ZonasRiego (nombre, id_invernadero, tipo_cultivo, umbral_humedad, metodo_riego, estado)
                VALUES (@n, @inv, @c, @u, 'Automatico', 'Activa')`)
      console.log(`  Created zone: ${z.nombre}`)
    }
  }

  // Get zone IDs
  const zoneRows = await pool.request().query("SELECT id_zona, id_invernadero, nombre FROM ZonasRiego ORDER BY id_zona")

  // 5. Seed Sensores
  const sensores = [
    { nombre: "Humedad Suelo Z1", tipo: "humedad_suelo", zIdx: 0, uMin: 35, uMax: 75, unidad: "%" },
    { nombre: "Temp. Ambiental A", tipo: "temperatura", zIdx: 0, uMin: 18, uMax: 35, unidad: "C" },
    { nombre: "Humedad Amb. A", tipo: "humedad_ambiental", zIdx: 0, uMin: 40, uMax: 85, unidad: "%" },
    { nombre: "TDS Nutrientes A", tipo: "tds", zIdx: 0, uMin: 500, uMax: 1200, unidad: "ppm" },
    { nombre: "pH Agua A", tipo: "ph", zIdx: 0, uMin: 5.5, uMax: 7.0, unidad: "pH" },
    { nombre: "Humedad Suelo Z2", tipo: "humedad_suelo", zIdx: 1, uMin: 35, uMax: 75, unidad: "%" },
    { nombre: "pH Agua B", tipo: "ph", zIdx: 1, uMin: 5.5, uMax: 7.0, unidad: "pH" },
    { nombre: "TDS Nutrientes B", tipo: "tds", zIdx: 1, uMin: 500, uMax: 1200, unidad: "ppm" },
    { nombre: "Temp. Amb. B", tipo: "temperatura", zIdx: 2, uMin: 18, uMax: 35, unidad: "C" },
    { nombre: "pH Agua C", tipo: "ph", zIdx: 2, uMin: 5.5, uMax: 7.0, unidad: "pH" },
    { nombre: "TDS Nutrientes C", tipo: "tds", zIdx: 2, uMin: 500, uMax: 1200, unidad: "ppm" },
  ]
  for (const s of sensores) {
    const exists = await pool.request()
      .input("n", sql.NVarChar, s.nombre)
      .query("SELECT 1 FROM Sensores WHERE ubicacion_fisica = @n")
    if (exists.recordset.length === 0 && zoneRows.recordset[s.zIdx]) {
      const z = zoneRows.recordset[s.zIdx]
      await pool.request()
        .input("inv", sql.Int, z.id_invernadero)
        .input("tipo", sql.NVarChar, s.tipo)
        .input("estado", sql.NVarChar, "Activo")
        .input("mn", sql.Decimal(10, 2), s.uMin)
        .input("mx", sql.Decimal(10, 2), s.uMax)
        .input("u", sql.NVarChar, s.unidad)
        .input("ub", sql.NVarChar, s.nombre)
        .query(`INSERT INTO Sensores (id_invernadero, tipo, estado, rango_min, rango_max, unidad_medida, ubicacion_fisica, fecha_instalacion)
                VALUES (@inv, @tipo, @estado, @mn, @mx, @u, @ub, GETDATE())`)
      console.log(`  Created sensor: ${s.nombre}`)
    }
  }

  // 6. Seed some LecturasSensores (sample data)
  const sensorRows = await pool.request().query("SELECT id_sensor, tipo, unidad_medida FROM Sensores ORDER BY id_sensor")
  for (const sensor of sensorRows.recordset) {
    const countResult = await pool.request()
      .input("sid", sql.Int, sensor.id_sensor)
      .query("SELECT COUNT(*) AS cnt FROM LecturasSensores WHERE id_sensor = @sid")
    if (Number(countResult.recordset[0].cnt) < 5) {
      // Create 24 sample readings over the last 24 hours
      for (let h = 23; h >= 0; h--) {
        let valor = 0
        if (sensor.tipo === "humedad_suelo") valor = 35 + Math.random() * 30
        else if (sensor.tipo === "temperatura") valor = 22 + Math.random() * 10
        else if (sensor.tipo === "humedad_ambiental") valor = 50 + Math.random() * 30
        else if (sensor.tipo === "tds") valor = 600 + Math.random() * 500
        else if (sensor.tipo === "ph") valor = 5.2 + Math.random() * 2.3
        else valor = 20 + Math.random() * 20

        await pool.request()
          .input("sid", sql.Int, sensor.id_sensor)
          .input("val", sql.Decimal(10, 2), Math.round(valor * 100) / 100)
          .input("unid", sql.NVarChar, sensor.unidad_medida || "%")
          .input("h", sql.Int, h)
          .query(`INSERT INTO LecturasSensores (id_sensor, valor, unidad, fecha_hora)
                  VALUES (@sid, @val, @unid, DATEADD(HOUR, -@h, GETDATE()))`)
      }
      console.log(`  Created 24 readings for sensor ${sensor.id_sensor} (${sensor.tipo})`)
    }
  }

  // 7. Seed Riegos events
  const allZones = zoneRows.recordset
  for (let i = 0; i < allZones.length; i++) {
    const zoneId = allZones[i].id_zona
    const countResult = await pool.request()
      .input("zid", sql.Int, zoneId)
      .query("SELECT COUNT(*) AS cnt FROM Riegos WHERE id_zona = @zid")
    if (Number(countResult.recordset[0].cnt) === 0) {
      // 3 completed riegos per zone over the last 3 days
      for (let d = 2; d >= 0; d--) {
        await pool.request()
          .input("zid", sql.Int, zoneId)
          .input("tipo", sql.NVarChar, d % 2 === 0 ? "automatico" : "manual")
          .input("dur", sql.Int, 10 + Math.round(Math.random() * 20))
          .input("vol", sql.Decimal(10, 2), 80 + Math.round(Math.random() * 150))
          .input("d", sql.Int, d)
          .query(`INSERT INTO Riegos (id_zona, tipo, duracion_min, volumen_litros, fecha_inicio, fecha_fin)
                  VALUES (@zid, @tipo, @dur, @vol,
                    DATEADD(DAY, -@d, DATEADD(HOUR, -8, GETDATE())),
                    DATEADD(DAY, -@d, DATEADD(HOUR, -7, GETDATE())))`)
      }
      console.log(`  Created 3 riegos for zone ${zoneId}`)
    }
  }

  // 8. Seed ConfiguracionesSistema
  const configs: [string, string, string][] = [
    ["MQTTBroker", "mqtt://broker.greensense.local", "Broker MQTT"],
    ["MQTTPort", "1883", "Puerto MQTT"],
    ["MQTTTopic", "greensense/inv1/#", "Topic MQTT"],
    ["LecturaIntervalo", "30", "Intervalo de lectura (seg)"],
    ["NotifEmail", "true", "Notificaciones por email"],
    ["NotifSMS", "false", "Notificaciones por SMS"],
    ["AlertaCritica", "true", "Alertas criticas activas"],
    ["SesionTimeout", "30", "Timeout de sesion (min)"],
  ]
  for (const [param, valor, desc] of configs) {
    const exists = await pool.request()
      .input("p", sql.NVarChar, param)
      .input("e", sql.Int, empresaId)
      .query("SELECT 1 FROM ConfiguracionesSistema WHERE parametro = @p AND id_empresa = @e")
    if (exists.recordset.length === 0) {
      await pool.request()
        .input("e", sql.Int, empresaId)
        .input("p", sql.NVarChar, param)
        .input("v", sql.NVarChar, valor)
        .input("d", sql.NVarChar, desc)
        .input("u", sql.Int, 1) // admin user
        .query(`INSERT INTO ConfiguracionesSistema (id_empresa, parametro, valor, descripcion, creado_por, fecha_creacion)
                VALUES (@e, @p, @v, @d, @u, GETDATE())`)
    }
  }
  console.log("  Seeded system configurations")

  // 9. Seed Alertas
  const firstSensor = sensorRows.recordset[0]
  if (firstSensor) {
    const alertCount = await pool.request()
      .query("SELECT COUNT(*) AS cnt FROM Alertas")
    if (Number(alertCount.recordset[0].cnt) === 0) {
      await pool.request()
        .input("sid", sql.Int, firstSensor.id_sensor)
        .input("tipo", sql.NVarChar, "Humedad baja detectada")
        .input("val", sql.Decimal(10, 2), 28.5)
        .input("estado", sql.NVarChar, "Activa")
        .input("nivel", sql.NVarChar, "Advertencia")
        .input("accion", sql.NVarChar, "Verificar riego de la zona afectada")
        .input("mn", sql.Decimal(10, 2), 35)
        .input("mx", sql.Decimal(10, 2), 75)
        .query(`INSERT INTO Alertas (id_sensor, tipo_alerta, valor_detectado, estado, nivel, accion_recomendada, umbral_min, umbral_max, fecha_hora)
                VALUES (@sid, @tipo, @val, @estado, @nivel, @accion, @mn, @mx, GETDATE())`)

      await pool.request()
        .input("sid", sql.Int, firstSensor.id_sensor)
        .input("tipo", sql.NVarChar, "Sensor sin respuesta")
        .input("val", sql.Decimal(10, 2), 0)
        .input("estado", sql.NVarChar, "Activa")
        .input("nivel", sql.NVarChar, "Critico")
        .input("accion", sql.NVarChar, "Revisar conexion del sensor de humedad")
        .input("mn", sql.Decimal(10, 2), 0)
        .input("mx", sql.Decimal(10, 2), 0)
        .query(`INSERT INTO Alertas (id_sensor, tipo_alerta, valor_detectado, estado, nivel, accion_recomendada, umbral_min, umbral_max, fecha_hora)
                VALUES (@sid, @tipo, @val, @estado, @nivel, @accion, @mn, @mx, DATEADD(HOUR, -1, GETDATE()))`)

      console.log("  Created 2 sample alerts")
    }
  }

  console.log("\nSeed complete!")
  console.log("\nDemo credentials:")
  console.log("  Admin:      carlos@greensense.io / admin123")
  console.log("  Tecnico:    maria@greensense.io / tecnico123")
  console.log("  Agricultor: juan@greensense.io / agri123")

  await pool.close()
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
