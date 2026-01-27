# Actualización 2026-01-26 — RF-EP04 (Backoffice)

## Resumen
Se implementó el epic **RF-EP04 — Procesos automáticos y operaciones (Backoffice)**.

Incluye:
1. **Proceso nocturno automático** para pasar reservas **ACTIVE** a **COMPLETED** cuando su `endTime` ya ocurrió.
2. **Sección “Operaciones”** en el panel de admin con procesos manuales:
   - **Completar reservas** (preview + ejecución por selección o por filtro)
   - **Facturación** (generación de liquidaciones por usuario o para un usuario específico)

## Cambios técnicos
### Backend
- Nuevos estados de reserva: `COMPLETED` y `PENALIZED`.
- Nuevos modelos Prisma:
  - `Liquidation`
  - `LiquidationItem` (1 a 1 con `Reservation` vía `reservationId` único)
- Nuevo router: `/api/admin/operations/*`
- Nuevo job: `startAutoCompleteJob()` iniciado en `src/server.js`

### Frontend
- Nuevo ítem de menú admin: **Operaciones**
- Nueva página: `/admin/operaciones`

## Settings (configuración)
Se pueden crear/editar estos settings (tabla `Setting`) para ajustar la hora del proceso automático:
- `AUTO_COMPLETE_HOUR` (NUMBER) — default 2
- `AUTO_COMPLETE_MINUTE` (NUMBER) — default 0

> Nota: el job utiliza el timezone del servidor. Recomendado fijar `TZ=Europe/Madrid` en el entorno de ejecución.

## Pasos de despliegue
1. Ejecutar migración de Prisma:
   - `npm run db:migrate` (dev) o `npm run db:deploy` (prod)
2. Re-generar Prisma Client si aplica.
3. Reiniciar backend.
