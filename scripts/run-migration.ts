import { execute } from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Run a specific migration file
 * @param migrationFile - The migration filename (e.g., '001_init.sql')
 */
async function runMigration(migrationFile: string): Promise<void> {
  try {
    console.log(`Running migration: ${migrationFile}`);
    
    // Construct the full path to the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    
    // Check if file exists
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    // Read the SQL content
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    if (!sql.trim()) {
      throw new Error(`Migration file is empty: ${migrationFile}`);
    }
    
    // Execute the migration
    await execute(sql);
    
    console.log(`✅ Migration ${migrationFile} executed successfully`);
  } catch (error) {
    console.error(`❌ Failed to run migration ${migrationFile}:`, error);
    process.exit(1);
  }
}

/**
 * Run all migrations in order
 */
async function runAllMigrations(): Promise<void> {
  try {
    console.log('Running all migrations...');
    
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    
    // Read all files in migrations directory
    const files = fs.readdirSync(migrationsDir);
    
    // Filter for SQL migration files and sort them
    const migrationFiles = files
      .filter(file => file.endsWith('.sql') && !file.includes('.md')) // Exclude markdown files
      .sort(); // This will sort 001_, 002_, etc. correctly
    
    if (migrationFiles.length === 0) {
      console.log('No migration files found');
      return;
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
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  yarn run-migration <migration-file>   # Run a specific migration');
  console.log('  yarn run-migration all                # Run all migrations in order');
  console.log('');
  console.log('Examples:');
  console.log('  yarn run-migration 001_init.sql');
  console.log('  yarn run-migration all');
  process.exit(1);
}

const command = args[0];

if (command === 'all') {
  runAllMigrations().catch(console.error);
} else {
  runMigration(command).catch(console.error);
}