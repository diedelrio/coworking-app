# 🚀 Versión 2.2 — Rendimiento de series, avisos de cancelación y correcciones

**Fecha:** 2026-10-28

## 🧩 Descripción general

Versión centrada en la estabilidad de las reservas recurrentes (tiempos de espera y errores intermitentes reportados), nuevos avisos al administrador cuando se cancela una reserva y refuerzos de seguridad.

---

## 📣 Mensaje emergente para administradores

Publicar desde **Operaciones → Mensajes emergentes** con:

* Título: `Actualización de la plataforma Versión 2.2`
* Portal: `ADMIN` · Categoría: `RELEASE` (Novedades / versión)
* Mostrar una vez: sí · Requiere confirmación: sí
* Se publica como mensaje **nuevo** (el de la 2.1 ya fue leído por los administradores y, con "mostrar una vez", no volvería a aparecer).

Texto:

```
Te informamos que se ha actualizado la aplicación con mejoras y correcciones:

MEJORAS
1. Reservas recurrentes mucho más rápidas.
    a. Crear o editar una serie (hasta 100 reservas) ya no se queda esperando ni da error de tiempo agotado.
    b. Si la fecha de fin genera más de 100 reservas, se avisa con un mensaje claro en lugar de cortar la serie sin avisar.
2. Aprobación de reservas recurrentes.
    a. Al aprobar una serie pendiente, ahora puedes elegir entre aprobar toda la serie o resolver las fechas una a una (aprobar o rechazar cada fecha).
    b. Si apruebas toda la serie, el usuario recibe un solo email; si las resuelves una a una, recibe un email por cada fecha.
3. Avisos de cancelación para el administrador.
    a. Cuando un cliente cancela una reserva, se envía un email a los administradores.
    b. Además aparece un popup al ingresar: si hay varias cancelaciones acumuladas se muestran juntas en un solo mensaje.
    c. Con la sesión abierta, las nuevas cancelaciones aparecen a medida que ocurren (hasta 15 segundos de demora, o al instante al volver a la pestaña).
4. Nuevo en Reglas de negocio: los máximos de horas por día/semana, espacios por día y espacios simultáneos de cada tipo de espacio se pueden ajustar (claves MAX_HOURS_PER_DAY_<TIPO>, MAX_HOURS_PER_WEEK_<TIPO>, MAX_SPACES_PER_DAY_<TIPO> y MAX_OVERLAPPING_SPACES_<TIPO>).
5. Más seguridad: se limita la cantidad de intentos de inicio de sesión y de recuperación de contraseña, y las cuentas desactivadas pierden el acceso como máximo en 1 minuto.

CORRECCIONES
1. Las reglas de horario (apertura, cierre, duración mínima e intervalos) a veces se aplicaban con valores por defecto en lugar de los configurados. Ahora se respetan siempre.
2. Al editar una reserva sin cambiar la hora, esta podía correrse 1 o 2 horas.
3. Las series diarias ahora saltan correctamente los feriados y cierres del coworking, y los límites diarios y semanales se calculan de forma consistente.
4. Los límites por día y por semana ahora cuentan también las otras fechas de la misma serie recurrente (antes una serie podía superar el máximo semanal del cliente).
5. Se evita que dos reservas simultáneas ocupen el mismo espacio o superen su capacidad.
6. Solo se pueden cancelar reservas activas o pendientes.
```

---

## 🔧 Detalle técnico

### Rendimiento de series recurrentes

* `POST /reservations` precarga espacio, reglas, cierres y reservas de toda la serie y valida en memoria (antes ~8 consultas por fecha; una serie de 100 pasaba de ~1.000 consultas a ~108).
* `PUT /reservations/:id` (aplicar a la serie) usa el mismo esquema (~209 consultas para 100 reservas).
* Re-chequeo de solapes/capacidad con el espacio bloqueado (`FOR UPDATE`) en una sola consulta.
* Timeout de 30 s en el cliente HTTP (90 s al crear reservas); el email de aprobación de series ya no bloquea la respuesta.
* Una recurrencia que genera más de 100 fechas se rechaza con un mensaje claro.

### Errores intermitentes

* **Caché de settings:** guardaba solo las claves del primer llamador y el resto caía a valores por defecto. Ahora cachea todos los settings activos.
* **Zona horaria:** rangos de día/semana, cierres, fecha de fin de recurrencia y `toHHMM` usan Europe/Madrid, no la hora del servidor. Los cierres se guardan siempre como medianoche UTC.
* Los límites diarios/semanales acumulan las fechas de la propia serie.
* Si falla la consulta de cierres, ya no se reserva "a ciegas".

### Avisos de cancelación

* Cuando un **no administrador** cancela (`PATCH /:id/cancel` o `DELETE /:id`): email a los admins activos y popup (portal ADMIN, categoría `CANCELLATION`, vence a los 14 días).
* Plantilla opcional `RESERVATION_CANCELLED_ADMIN` (variables: `userName`, `userEmail`, `spaceName`, `date`, `startTime`, `endTime`, `reservationId`); si no existe se usa un texto por defecto.
* Al iniciar sesión (`GET /popup-messages/pending?group=1`) las cancelaciones pendientes se agrupan en un solo popup; confirmar lo marca todo como leído.
* Con la sesión abierta, el portal admin consulta cada 15 s (y de inmediato al volver a la pestaña) y muestra las nuevas de a una.

### Aprobación de series recurrentes

* Al aprobar una serie pendiente se abre un modal (`SeriesApprovalModal`): "Aprobar toda la serie (N)" o aprobar/rechazar cada fecha por separado.
* Nuevo `GET /reservations/series/:seriesId/pending` (solo admin) con las fechas pendientes, mesas y conteo de aprobadas.
* Aprobar toda la serie envía un solo email al usuario; resolver una a una envía uno por fecha.

### Seguridad y mantenimiento

* Límite de intentos en login, registro, recuperación/restablecimiento de contraseña y reenvío de activación.
* Las cuentas desactivadas dejan de operar como máximo en 60 s (aunque el token siga vigente).
* Variables nuevas/obligatorias: `JWT_SECRET` y `DATABASE_URL` (el servidor no arranca sin ellas); `CORS_ORIGIN` y `TRUST_PROXY` recomendadas en producción.
* Reglas por tipo de espacio configurables desde Settings (`MAX_HOURS_PER_DAY_<TIPO>`, `MAX_HOURS_PER_WEEK_<TIPO>`, `MAX_SPACES_PER_DAY_<TIPO>`, `MAX_OVERLAPPING_SPACES_<TIPO>`); sin definirlas se mantienen los valores anteriores.
* `adminOperations.js` dividido en `routes/operations/*`, recurrencia extraída a `services/recurrence.js`, esquemas de Prisma duplicados (SQLite/Postgres) eliminados y tests nuevos (`npm test`).
