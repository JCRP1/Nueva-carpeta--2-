# GreenSense Database Migrations

## Overview
This directory contains SQL migration scripts for the GreenSense IoT Dashboard database schema. Migrations are used to version-control database changes and ensure consistency across development, staging, and production environments.

## Current Status
**Important**: As of the latest check, all required tables for the GreenSense project already exist in the database:
- Empresas
- Usuarios
- Invernaderos
- ZonasRiego
- Sensores
- LecturasSensores
- Riegos
- ConfiguracionesSistema
- Alertas

Por lo tanto, la migración inicial (`001_init.sql`) no necesita ser ejecutada, ya que las tablas están presentes.

## Migration Naming Convention
Migration files should be named using the format: `###_description.sql`
- `###`: Three-digit version number (001, 002, 003, etc.)
- `description`: Brief, lowercase description of the change using underscores

Example: `002_add_sensor_calibration_table.sql`

## Existing Migration Files
- `001_init.sql`: Initial database schema creation (tables for Empresas, Usuarios, Invernaderos, ZonasRiego, Sensores, LecturasSensores, Riegos, ConfiguracionesSistema, Alertas)
  - **Status**: Not required to run (tables already exist)

## How to Apply Future Migrations

### Option 1: Using sqlcmd (Command Line)
1. Open Command Prompt or PowerShell
2. Navigate to the migrations directory:
   ```bash
   cd D:\GreenSence\Nueva-carpeta--2-\migrations
   ```
3. Run the migration:
   ```bash
   sqlcmd -S VLAD\SQLEXPRESS -d GreenSenseDB -U "Daril Steven" -P "123456" -i 002_nombre_migracion.sql
   ```
   Note: Adjust server, database, username, and password according to your .env file

### Option 2: Using SQL Server Management Studio (SSMS)
1. Open SSMS
2. Connect to your SQL Server instance (VLAD\SQLEXPRESS)
3. Open the migration file
4. Execute the script (F5 or Execute button)

### Option 3: Using Azure Data Studio
1. Open Azure Data Studio
2. Connect to your SQL Server instance
3. Open the migration file
4. Execute the script

### Option 4: Using Node.js Scripts
You can use the existing scripts in the project:

```bash
# Run a specific migration
yarn run-migration 002_nombre_migracion.sql

# Run all pending migrations
yarn run-migration all
```

## Best Practices for Migrations

1. **Never modify existing migrations** - Once a migration is applied to any environment, treat it as immutable
2. **Create new migrations for changes** - To modify a table, create a new migration with ALTER TABLE statements
3. **Test migrations locally** - Always test migrations on a copy of production data before applying to staging/production
4. **Include rollback logic when possible** - For complex migrations, consider creating down migrations
5. **Keep migrations focused** - Each migration should do one logical change
6. **Use transactions** - Wrap migration steps in transactions when appropriate to ensure atomicity

## Example: Adding a Column (Future Migration)
If you need to add a column to an existing table, create a new migration like:

```sql
-- 002_add_notification_preference.sql
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('Usuarios') 
               AND name = 'notificaciones_activas')
BEGIN
    ALTER TABLE Usuarios 
    ADD notificaciones_activas BIT DEFAULT 1;
END
```

## Troubleshooting

### Permission Errors
Ensure your database user has sufficient permissions to create tables and modify schema.

### Migration Already Applied
If you get errors about objects already existing, verify:
- You're running against the correct database
- The migration hasn't already been applied
- You're not trying to apply an older migration after a newer one

### Connection Issues
Check your .env file matches the connection parameters you're using:
- MSSQL_HOST
- MSSQL_PORT
- MSSQL_DATABASE
- MSSQL_USER
- MSSQL_PASSWORD

## Seeding Data
You can seed initial data using:
```bash
yarn db:seed
```
This runs the script in `scripts/seed.ts` which populates the database with sample data.

## Maintenance
- Backup your database before applying migrations to production
- Keep track of which migrations have been applied to each environment
- Consider implementing a migration tracking table in the future for automated migration detection