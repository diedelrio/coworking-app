# Copia local de producción (Docker)

Datos reales de Neon -> Postgres en Docker -> anonimizados. Los emails están desactivados.

1. `$env:NEON_DATABASE_URL = "<conexión directa de Neon>"` y `./dump-from-neon.ps1`
2. `./restore-and-anonymize.ps1`
3. En `backend/`: `npx prisma migrate status` y, si hay migraciones pendientes, `npx dotenv -e local-db/.env.local -- prisma migrate deploy`
4. En `backend/`: `npm run dev:local`  (frontend: `npm run dev` en `frontend/`)

Login: `admin<id>@example.test` o `user<id>@example.test`, contraseña `Test1234!`.
Al terminar: `docker compose down -v` y borrar `dump/prod.dump`.

## Cambiar la región de la base en Neon (migrar a otro proyecto)

Neon no permite cambiar la región de un proyecto existente: se crea uno nuevo y se copian los datos.
`migrate-neon-region.ps1` lee del proyecto actual (solo lectura), restaura en el nuevo (debe estar vacío)
y compara las filas de cada tabla; si algo no coincide, falla y NO hay que cambiar `DATABASE_URL`.

1. En Neon: crear un proyecto nuevo en la región deseada (p. ej. AWS Europe - Frankfurt, `eu-central-1`) con la
   misma versión de Postgres. No crear tablas: la base `neondb` debe quedar vacía.
2. Elegir un momento de poco uso. Para asegurar que no se pierdan escrituras, suspender el servicio en Render
   (Settings → Suspend) mientras dura la copia (unos minutos).
3. `$env:OLD_DATABASE_URL` y `$env:NEW_DATABASE_URL` con las conexiones **directas** (sin `-pooler`) y `./migrate-neon-region.ps1`.
4. Si termina en OK: en Render cambiar `DATABASE_URL` por la URL del proyecto nuevo (la **pooled**, con `-pooler`,
   termina en `?sslmode=require`) y reanudar el servicio.
5. Probar (login, nueva reserva, editar una serie). Conservar el proyecto viejo unos días por si hay que volver atrás
   y después borrarlo. Borrar `dump/migrate.dump` (contiene datos reales) y rotar la contraseña del proyecto viejo.
