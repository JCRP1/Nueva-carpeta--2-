# Auditoría de seguridad — GreenSense

Fecha: 2026-08-05  
Alcance: aplicación Next.js, rutas API, autenticación/autorización, SQL Server, IoT, configuración, dependencias y artefactos del repositorio. Revisión estática y verificación de build/dependencias; no se ejecutaron pruebas intrusivas contra sistemas externos.

## Resumen ejecutivo

Se identificaron **15 hallazgos**: **1 crítico, 5 altos, 6 medios y 3 bajos**. Se corrigieron total o parcialmente 8 sin retirar funcionalidad. Los riesgos dominantes eran exposición de hashes de contraseña, secretos de respaldo predecibles, lectura de roles sin autorización, dependencias vulnerables y ausencia de cabeceras defensivas. La separación por empresa está generalmente presente en las APIs de negocio, pero debe reforzarse con pruebas automáticas de IDOR.

Puntuación después de las correcciones: **74/100** (antes: 48/100). La puntuación no equivale a certificación ni sustituye pruebas dinámicas en el entorno de producción.

## Hallazgos

### GS-01 — Hashes de contraseña expuestos — Critical — corregido

- OWASP/CWE: A01 Broken Access Control, A02 Cryptographic Failures; CWE-200/CWE-522.
- Archivo/línea: `app/api/users/route.ts`, aproximadamente líneas 7–18, 65–75 y 155–165.
- Riesgo: un usuario con permiso de gestión recibía el hash bcrypt de todos los usuarios de su empresa. La filtración permite ataques offline y reutilización contra otras cuentas.
- Explotación conceptual: consultar la lista de usuarios y extraer el campo `contraseña` de la respuesta JSON.
- Corrección: el hash fue eliminado del mapeo de salida y de ambos `SELECT`. Nunca deben serializarse credenciales, aun cifradas o hasheadas.

### GS-02 — Secreto JWT predecible y validación incompleta — High — corregido

- OWASP/CWE: A02, A07; CWE-321/CWE-347.
- Archivo/línea: `lib/auth.ts`, aproximadamente líneas 5–30 y 65–125.
- Riesgo: ante una variable ausente se utilizaba una clave pública conocida; además no se fijaban issuer/audience durante verificación.
- Explotación conceptual: en un despliegue mal configurado, un tercero podría fabricar una sesión con rol administrador.
- Corrección: producción exige al menos 32 caracteres; se fijaron algoritmo HS256, issuer y audience, y se validó la forma del payload. El fallback queda limitado a desarrollo.

### GS-03 — Clave IoT débil y reutilización del secreto JWT — High — corregido

- OWASP/CWE: A02, A07; CWE-798.
- Archivo/línea: `lib/iot-auth.ts`, aproximadamente líneas 10–22.
- Riesgo: una clave IoT ausente heredaba JWT_SECRET o una constante pública, dando acceso a inserción de lecturas y comandos.
- Explotación conceptual: enviar datos de sensores usando la clave de desarrollo conocida.
- Corrección: `IOT_API_KEY` es independiente, obligatoria y de 24 caracteres como mínimo; en caso contrario se rechaza la petición.

### GS-04 — Lectura de roles sin autenticación — High — corregido

- OWASP/CWE: A01; CWE-862.
- Archivo/línea: `app/api/roles/route.ts` y `app/api/roles/[id]/route.ts`, al inicio de cada GET.
- Riesgo: cualquier visitante podía enumerar roles y permisos, facilitando reconocimiento y ataques de escalada.
- Explotación conceptual: solicitar `/api/roles` sin cookie de sesión.
- Corrección: los GET ahora requieren el permiso `roles` y devuelven 401/403 apropiadamente.

### GS-05 — IDOR al resolver una persona durante creación de usuario — High — corregido

- OWASP/CWE: A01; CWE-639.
- Archivo/línea: `app/api/users/route.ts`, aproximadamente líneas 110–125.
- Riesgo: se consultaba `Personas` únicamente por ID, permitiendo vincular información de otra empresa.
- Explotación conceptual: usar un identificador válido perteneciente a otro tenant al crear un usuario.
- Corrección: la búsqueda se restringe a la empresa o a sus invernaderos.

### GS-06 — Componentes vulnerables y desactualizados — High — mitigado

- OWASP/CWE: A06; CWE-1104.
- Archivo/línea: `package.json`, `package-lock.json`.
- Riesgo inicial: 11 avisos npm (7 high, 3 moderate, 1 low), incluidos Next.js, Nodemailer, PostCSS, lodash, sharp e ip-address.
- Explotación conceptual: activar rutas afectadas por DoS, bypass, SSRF o procesamiento malicioso según el componente.
- Corrección: Next.js 16.3.0, Nodemailer y PostCSS fueron actualizados, junto con dependencias transitivas. Resultado: 1 aviso low de esbuild, limitado al servidor de desarrollo en Windows.

### GS-07 — Sin rate limiting distribuido — Medium — pendiente

- OWASP/CWE: A04, A07; CWE-307/CWE-770.
- Archivo/línea: `app/api/auth/login/route.ts` (aprox. 15–60), `forgot-password/route.ts`, `empresas/verify/route.ts` y endpoints IoT.
- Riesgo: el Map de login se pierde al reiniciar y no se comparte entre instancias; recuperación, verificación e IoT carecen de límites.
- Explotación conceptual: repartir intentos entre instancias o reinicios para evadir el bloqueo.
- Recomendación: rate limiting atómico en Redis/Upstash o gateway, por IP + cuenta/empresa, con límites diferenciados y telemetría.

### GS-08 — CSRF basado sólo en SameSite=Lax — Medium — pendiente

- OWASP/CWE: A01; CWE-352.
- Archivo/línea: `lib/auth.ts` (cookie) y todas las rutas mutables bajo `app/api`.
- Riesgo: SameSite reduce el riesgo, pero no valida explícitamente Origin/Host ni usa token anti-CSRF.
- Explotación conceptual: un sitio externo intenta inducir una operación autenticada en navegadores/proxies con comportamiento permisivo.
- Recomendación: validar `Origin` contra una allowlist para POST/PUT/PATCH/DELETE y añadir token CSRF si se admiten formularios cross-origin. No se aplicó globalmente para no romper clientes IoT/API existentes.

### GS-09 — Rate limiting de login en memoria y enumeración lateral — Medium — pendiente

- OWASP/CWE: A07; CWE-204/CWE-307.
- Archivo/línea: `app/api/auth/login/route.ts`, aproximadamente líneas 15–145.
- Riesgo: algunas respuestas distinguen empresa inexistente/inactiva/código incorrecto, y el control depende del correo+empresa.
- Explotación conceptual: comparar estados para inferir asociaciones de cuentas y empresas.
- Recomendación: respuesta pública uniforme, registro interno detallado y contador distribuido.

### GS-10 — SSRF/escaneo interno administrativo — Medium — pendiente por diseño

- OWASP/CWE: A10 SSRF; CWE-918.
- Archivo/línea: `app/api/devices/discover/route.ts`, aproximadamente líneas 480–700; `app/api/alerts/route.ts`, aproximadamente líneas 50–100.
- Riesgo: administradores pueden provocar conexiones a IP/puertos internos; es funcionalidad de descubrimiento, pero amplía el impacto de una cuenta comprometida.
- Explotación conceptual: proporcionar IPs internas para observar conectividad o respuestas parciales.
- Recomendación: allowlist CIDR privada de la empresa, bloquear loopback/link-local/metadata/cloud y limitar puertos, concurrencia y tamaño de respuesta. Mantener esta función en un worker de red aislado.

### GS-11 — Confianza en `x-forwarded-host` para reset — Medium — pendiente

- OWASP/CWE: A04/A07; CWE-601/CWE-640.
- Archivo/línea: `app/api/auth/forgot-password/route.ts`, aproximadamente líneas 6–17.
- Riesgo: si el proxy no sanea cabeceras, el enlace de recuperación puede apuntar a un host controlado.
- Explotación conceptual: alterar Forwarded Host para que el correo contenga otro dominio.
- Recomendación: construir siempre desde `APP_URL` validada; no se cambió porque podría afectar despliegues LAN no documentados.

### GS-12 — Cabeceras defensivas ausentes — Medium — corregido

- OWASP/CWE: A05; CWE-1021/CWE-693.
- Archivo/línea: `next.config.mjs`, aproximadamente líneas 15–33.
- Riesgo: clickjacking, MIME sniffing y mayor impacto de una inyección de contenido.
- Explotación conceptual: embeber la aplicación en un iframe para inducir clics.
- Corrección: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy, CSP base y eliminación de `X-Powered-By`.

### GS-13 — Credenciales débiles/realistas en archivos de ejemplo y migración — Low — parcialmente corregido

- OWASP/CWE: A02/A05; CWE-798.
- Archivo/línea: `.env.example` y `migrations/002_create_app_user.sql` (aprox. línea 6).
- Riesgo: copiar ejemplos a producción crea credenciales conocidas; la migración conserva una contraseña inicial estática.
- Explotación conceptual: probar credenciales documentadas en despliegues que reutilizaron ejemplos.
- Corrección: `.env.example` ahora usa placeholders no funcionales. Pendiente: sustituir la contraseña de la migración por un secreto aportado en despliegue o deshabilitar el usuario hasta su activación.

### GS-14 — Artefactos sensibles/innecesarios versionados — Low — mitigado

- OWASP/CWE: A05/A09; CWE-200.
- Archivo/línea: `cookies.txt`, `next-dev-*.log`, `next-start-*.log`, ejecutable cloudflared; `.gitignore`.
- Riesgo: cookies, trazas, topología y binarios no auditados pueden filtrarse o confundirse con artefactos productivos.
- Explotación conceptual: leer una cookie o error histórico desde el repositorio.
- Corrección: se añadieron patrones de exclusión. Los archivos ya versionados no se eliminaron para preservar trabajo del usuario; deben retirarse del índice e invalidar cualquier sesión contenida.

### GS-15 — Pipeline no garantiza calidad/seguridad — Low — parcialmente corregido

- OWASP/CWE: A08/A09; CWE-1104.
- Archivo/línea: `next.config.mjs`, `package.json`, `tsconfig.json`.
- Riesgo: se ignoraban errores TypeScript y el script `lint` no funciona porque ESLint no figura como dependencia.
- Explotación conceptual: desplegar una ruta con tipos/configuración incoherentes sin que CI falle.
- Corrección: `ignoreBuildErrors` quedó en false. Pendiente: añadir ESLint y CI con `npm ci`, lint, typecheck, test, build, audit/SCA y secret scanning.

## Cobertura OWASP y pruebas negativas

- SQL Injection: las consultas revisadas emplean parámetros; el SQL dinámico de esquema usa `QUOTENAME` y parámetros. No se confirmó SQLi explotable.
- Command Injection/RCE: `arp -a` es una constante sin entrada de usuario. No se confirmó inyección de comandos.
- XSS: no se encontraron `dangerouslySetInnerHTML`, `eval` ni asignaciones DOM inseguras en código de aplicación. React escapa texto por defecto.
- Path traversal/file upload/open redirect/CORS: no se identificaron endpoints de upload, lectura arbitraria de rutas, redirects controlados por usuario ni CORS permisivo.
- Cookies/JWT: cookie HttpOnly, Secure en producción y SameSite=Lax; no se observó session fixation porque cada login emite un JWT nuevo.
- SQL/tenant isolation: muchas rutas filtran `empresaId`; deben añadirse pruebas de matriz usuario/rol/tenant para evitar regresiones IDOR.
- Logging: existe bitácora para operaciones relevantes, pero falta correlación, alertas, retención, redacción central y monitoreo de anomalías.
- Docker/GitHub Actions: no existen archivos Docker ni workflows en el repositorio inspeccionado; no pueden evaluarse controles de imagen/CI.

## Archivos modificados por esta auditoría

- `.env.example`, `.gitignore`, `next.config.mjs`
- `lib/auth.ts`, `lib/iot-auth.ts`
- `app/api/users/route.ts`, `app/api/roles/route.ts`, `app/api/roles/[id]/route.ts`
- `package.json`, `package-lock.json`
- `SECURITY_AUDIT.md`

El repositorio ya estaba ampliamente modificado antes de la auditoría; la lista anterior se limita a cambios de seguridad realizados en esta revisión.

## Verificación y riesgos de producción

- `npm audit`: 1 low restante (esbuild de desarrollo en Windows); 0 critical/high/moderate.
- `next build`: compilación de código iniciada, bloqueada al descargar Inter/JetBrains Mono desde Google Fonts por restricciones de red. Se recomienda autoalojar fuentes para builds reproducibles.
- `tsc --noEmit`: bloqueado por tipos antiguos bajo `.next/dev/types` después de actualizar Next; limpiar `.next` y regenerar en CI.
- `npm run lint`: falla porque `eslint` no está instalado.

Antes de producción: rotar JWT/IOT/SMTP/super-admin y cookies históricas; TLS obligatorio; SQL Server con certificado válido (`trustServerCertificate=false`); secrets manager; rate limiting distribuido; validación Origin/CSRF; sanitización de forwarded headers; segmentación del escáner IoT; CI reproducible; backups cifrados; SAST/DAST/SCA y alertas sobre bitácora.
