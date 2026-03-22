import sql from "mssql";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config({ path: ".env" });

async function debugConnection() {
  console.log("Debugging SQL Server connection...");
  
  // Same config as in seed.ts and db.ts
  const config = {
    server: process.env.MSSQL_HOST || "localhost",
    port: Number(process.env.MSSQL_PORT || 1433),
    database: process.env.MSSQL_DATABASE || "GreenSenseDB",
    user: process.env.MSSQL_USER || "sa",
    password: process.env.MSSQL_PASSWORD || "",
    options: {
      encrypt: process.env.MSSQL_ENCRYPT === "true",
      trustServerCertificate: process.env.MSSQL_TRUST_CERT !== "false",
    },
  };

  try {
    console.log(`Connecting to ${config.server}:${config.port}/${config.database} as ${config.user}`);
    const pool = await sql.connect(config);
    console.log("✅ Connected successfully!");
    console.log(`Connected to: ${config.database}`);

    // Check what tables exist
    const tableResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log("\nExisting tables:");
    if (tableResult.recordset.length === 0) {
      console.log("  No tables found");
    } else {
      tableResult.recordset.forEach((row: any) => {
        console.log(`  - ${row.TABLE_NAME}`);
      });
    }

    // Check if our specific tables exist
    const tablesToCheck = ['Empresas', 'Usuarios', 'Invernaderos', 'ZonasRiego', 'Sensores', 'LecturasSensores', 'Riegos', 'ConfiguracionesSistema', 'Alertas'];
    console.log("\nChecking for GreenSense tables:");
    for (const tableName of tablesToCheck) {
      const result = await pool.request()
        .query(`SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${tableName}'`);
      const exists = Number(result.recordset[0].count) > 0;
      console.log(`  ${tableName}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    }

    await pool.close();
  } catch (error) {
    console.error("❌ Connection failed:", error);
    process.exit(1);
  }
}

debugConnection();