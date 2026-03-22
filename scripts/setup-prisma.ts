#!/usr/bin/env tsx

/**
 * Script de automatización para migrar a Prisma
 * 
 * Ejecuta: npx tsx scripts/setup-prisma.ts
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '..')

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    success: '\x1b[32m[SUCCESS]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m'
  }
  console.log(`${prefix[type]} ${message}`)
}

function run(command: string, cwd: string = ROOT) {
  try {
    log(`Ejecutando: ${command}`)
    execSync(command, { cwd, stdio: 'inherit' })
    return true
  } catch (error) {
    log(`Error al ejecutar: ${command}`, 'error')
    return false
  }
}

async function main() {
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     GreenSense - Migración a Prisma con Migraciones       ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')

  log('Paso 1: Verificando archivo schema.prisma...')
  const schemaPath = resolve(ROOT, 'prisma', 'schema.prisma')
  
  if (!existsSync(schemaPath)) {
    log('schema.prisma no encontrado. Creando estructura básica...', 'error')
    run('npx prisma init')
  } else {
    log('schema.prisma encontrado ✓')
  }

  log('\nPaso 2: Generando cliente Prisma...')
  if (!run('npx prisma generate')) {
    log('Verifica que @prisma/client esté instalado', 'error')
    log('Ejecuta: yarn add @prisma/client', 'info')
  }

  log('\nPaso 3: Opciones de sincronización:', 'info')
  log('  A) db pull  - Generar schema desde BD existente (recomendado)', 'info')
  log('  B) db push  - Sincronizar schema a BD (sin migraciones)', 'info')
  log('  C) migrate  - Crear primera migración', 'info')
  log('\n  Para desarrollo inicial, usa: npx prisma db push', 'info')
  log('  Para producción, usa: npx prisma migrate dev', 'info')

  log('\n═══════════════════════════════════════════════════════════════')
  log('Comandos útiles después de configurar:')
  log('')
  log('  yarn db:generate    - Regenerar cliente Prisma', 'info')
  log('  yarn db:push        - Sincronizar cambios al schema', 'info')
  log('  yarn db:migrate     - Crear/aplicar migración', 'info')
  log('  yarn db:studio      - Abrir GUI de base de datos', 'info')
  log('')
  log('Para agregar una nueva tabla o campo:', 'info')
  log('  1. Edita prisma/schema.prisma', 'info')
  log('  2. Ejecuta: yarn db:push (desarrollo)', 'info')
  log('  3. O: yarn db:migrate (producción)', 'info')
  log('═══════════════════════════════════════════════════════════════\n')

  log('Setup completado. Revisa PRISMA_MIGRATION_GUIDE.md para más detalles.', 'success')
}

main().catch(console.error)
