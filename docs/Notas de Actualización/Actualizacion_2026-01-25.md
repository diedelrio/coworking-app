# RF-EP02 – Reservas Recurrentes y Gestión Avanzada

Este documento describe las mejoras funcionales y técnicas implementadas sobre el flujo de **reservas recurrentes**, edición de reservas y aprobación por parte del administrador.

---

## 1. Objetivo

Completar y robustecer el manejo de reservas recurrentes en la aplicación de coworking, garantizando:

- Correcta creación de recurrencias (semanales / mensuales).
- Manejo de feriados y cierres (`officeClosures`).
- Aprobación centralizada por parte del administrador.
- Edición flexible de reservas recurrentes (una sola cita o toda la serie).
- Experiencia de usuario clara y consistente.

---

## 2. Cambios en Backend

### 2.1 Modelo de recurrencias

- Se utiliza el campo `seriesId` para identificar reservas pertenecientes a una misma recurrencia.
- Todas las ocurrencias se crean como registros independientes, pero vinculados por `seriesId`.

Campos relevantes:
- `seriesId`
- `recurrencePattern` (DAILY | WEEKLY | MONTHLY)
- `recurrenceEndDate`
- `recurrenceCount`

---

### 2.2 Creación de reservas recurrentes

- Endpoint: `POST /api/reservations`
- Se generan todas las ocurrencias antes de persistir.
- Validaciones:
  - Horarios (open/close, step, duración mínima).
  - Capacidad (espacios compartidos).
  - Solapamientos (espacios no compartidos).
  - Límites diarios y semanales por tipo de espacio.
- **Office Closures**:
  - Si la tabla `officeClosures` está vacía → no hay feriados → NO se genera error.
  - Si existen feriados/cierres, las ocurrencias mensuales se ajustan automáticamente al día hábil anterior.

---

### 2.3 Aprobación por parte del administrador

#### Problema previo
El administrador veía **todas las ocurrencias individuales** de una reserva recurrente.

#### Solución implementada
- El admin ve **solo una fila por serie** (la “cita padre”).
- La aprobación o rechazo se aplica **a todas las ocurrencias** de la serie.

Endpoints afectados:
- `GET /api/reservations/pending`
- `PATCH /api/reservations/:id/approve`
- `PATCH /api/reservations/:id/reject`

Comportamiento:
- Si la reserva tiene `seriesId`, la acción se aplica a todas las reservas con ese `seriesId`.
- Si no tiene `seriesId`, se comporta como una reserva simple.

---

### 2.4 Edición de reservas recurrentes

Endpoint:
PUT /api/reservations/:id

Nuevo parámetro:
```json
{
  "applyTo": "ONE" | "SERIES"
}

Comportamiento:

ONE: modifica solo la ocurrencia seleccionada.

SERIES: modifica la ocurrencia actual y todas las futuras de la misma serie.

Restricciones:

No se permite editar reservas pasadas.

En edición por serie:

No se permite cambiar la fecha base.

Sí se permite cambiar horario, asistentes, propósito y notas.

El pricing se recalcula siempre usando hourlyRateSnapshot (no el precio actual del espacio).

3. Cambios en Frontend
3.1 UserNewReservation.jsx

Se unificó la creación y edición en un único componente usando ?edit=:id.

Creación

Toggle “Haz recurrente tu reserva”.

Selección de patrón:

Diario

Semanal

Mensual

Regla de fin:

Fecha de fin

Cantidad de ocurrencias

Resumen visual de la recurrencia.

3.2 Edición de reservas recurrentes

Cuando el usuario edita una reserva que pertenece a una serie:

Se muestra un modal de confirmación preguntando:

“¿Deseas aplicar los cambios solo a esta cita o a toda la serie?”

Opciones:

Solo esta cita

Esta y las siguientes

El valor seleccionado se envía al backend mediante applyTo.

3.3 UX / UI

Se corrigió el layout de la sección de recurrencia:

Repetir (izquierda)

Regla de fin (derecha)

Se agregó resumen visual:

Patrón

Fecha de inicio

Fecha de fin / cantidad de ocurrencias

El administrador visualiza claramente cuándo una reserva es recurrente.

Se mantiene coherencia visual con los mocks definidos.

4. Casos cubiertos

Usuario regular crea reserva recurrente.

Usuario con mala clasificación → reservas quedan en PENDING.

Admin aprueba/rechaza una serie completa.

Usuario edita:

Una sola ocurrencia.

Toda la serie.

No existen feriados → sistema funciona sin errores.

Existen feriados → recurrencias mensuales se ajustan automáticamente.

5. Estado

✅ RF-EP02 completado
Backend y Frontend alineados y funcionales.
Flujo de reservas recurrentes cerrado de punta a punta.


