import sql from "mssql";
import dotenv from "dotenv";
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file (same as seed.ts but using .env)
dotenv.config({ path: ".env" });

async function runMigration() {
  console.log("Connecting to SQL Server...");
  
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
    const pool = await sql.connect(config);
    console.log("Connected to:", config.database);

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_init.sql');
    const sqlQuery = fs.readFileSync(migrationPath, 'utf8');
    
    if (!sqlQuery.trim()) {
      throw new Error(`Migration file is empty: 001_init.sql`);
    }
    
    // Execute migration
    await pool.request().query(sqlQuery);
    console.log("✅ Migration 001_init.sql executed successfully");
    
    await pool.close();
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();