# Copia local de producción (Docker)

Datos reales de Neon -> Postgres en Docker -> anonimizados. Los emails están desactivados.

1. `$env:NEON_DATABASE_URL = "<conexión directa de Neon>"` y `./dump-from-neon.ps1`
2. `./restore-and-anonymize.ps1`
3. En `backend/`: `npx prisma migrate status` y, si hay migraciones pendientes, `npx dotenv -e local-db/.env.local -- prisma migrate deploy`
4. En `backend/`: `npm run dev:local`  (frontend: `npm run dev` en `frontend/`)

Login: `admin<id>@example.test` o `user<id>@example.test`, contraseña `Test1234!`.
Al terminar: `docker compose down -v` y borrar `dump/prod.dump`.
