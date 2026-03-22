import * as fs from 'fs';
import * as path from 'path';
import * as sql from 'mssql';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Database configuration from environment variables
const config = {
  user: process.env.MSSQL_USER || "",
  password: process.env.MSSQL_PASSWORD || "",
  server: process.env.MSSQL_HOST || "localhost",
  port: parseInt(process.env.MSSQL_PORT || "1433"),
  database: process.env.MSSQL_DATABASE || "GreenSenseDB",
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: process.env.MSSQL_TRUST_CERT !== "false",
  }
};

async function runMigration(migrationFile: string): Promise<void> {
  let pool: sql.ConnectionPool | null = null;
  
  try {
    console.log(`Running migration: ${migrationFile}`);
    console.log(`Connecting to ${config.server}:${config.port}/${config.database} as ${config.user}`);
    
    // Construct the full path to the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    
    // Check if file exists
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    // Read the SQL content
    const sqlQuery = fs.readFileSync(migrationPath, 'utf8');
    
    if (!sqlQuery.trim()) {
      throw new Error(`Migration file is empty: ${migrationFile}`);
    }
    
    // Connect to database
    pool = await sql.connect(config);
    console.log(`Connected to database: ${config.database}`);
    
    // Execute the migration
    const result = await pool.request().query(sqlQuery);
    console.log(`✅ Migration ${migrationFile} executed successfully`);
    console.log(`Rows affected: ${result.rowsAffected}`);
  } catch (error) {
    console.error(`❌ Failed to run migration ${migrationFile}:`, error);
    process.exit(1);
  } finally {
    // Close connection pool
    if (pool) {
      await pool.close();
    }
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  yarn simple-migration <migration-file>   # Run a specific migration');
  console.log('  yarn simple-migration all                # Run all migrations in order');
  console.log('');
  console.log('Examples:');
  console.log('  yarn simple-migration 001_init.sql');
  console.log('  yarn simple-migration all');
  process.exit(1);
}

const command = args[0];

if (command === 'all') {
  // Run all migrations in order
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir);
  const migrationFiles = files
    .filter(file => file.endsWith('.sql') && !file.includes('.md'))
    .sort();
    
  if (migrationFiles.length === 0) {
    console.log('No migration files found');
    process.exit(0);
  }
  
  console.log(`Found ${migrationFiles.length} migration(s):`);
  migrationFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });
  
  // Run each migration in order
  for (const migrationFile of migrationFiles) {
    await runMigration(migrationFile);
  }
  
  console.log('🎉 All migrations executed successfully');
} else {
  await runMigration(command);
}