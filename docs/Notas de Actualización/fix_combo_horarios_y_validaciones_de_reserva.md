# Fix – Combo de horarios y validaciones de reservas

## Contexto
Se corrigió el comportamiento del formulario **UserNewReservation** para que los combos de **Hora de Inicio** y **Hora de Fin** solo muestren opciones válidas según las reglas de negocio del coworking, evitando selecciones que luego fallaban en validación.

El problema principal era que el frontend permitía seleccionar horas que no cumplían la **duración mínima de reserva**, por ejemplo `17:30–18:00`, y el error recién aparecía al enviar el formulario.

---

## Objetivos
- Evitar que el usuario pueda **seleccionar horarios inválidos** desde el combo.
- Centralizar la lógica de cálculo de horarios.
- Alinear frontend con validaciones backend.
- Mejorar la experiencia de usuario (menos errores post-submit).

---

## Reglas de negocio aplicadas

### Horarios generales
- Apertura: `OFFICE_OPEN_HOUR`
- Cierre: `OFFICE_CLOSE_HOUR`
- Step de horarios: `RESERVATION_STEP_MINUTES`

### Duración mínima
- La **duración mínima de una reserva** se define como:
  - `RESERVATION_MIN_MINUTES` (cuando exista en backend)
  - fallback: `RESERVATION_STEP_MINUTES`

### Combo Hora de Inicio
- Se genera desde:
  - `OFFICE_OPEN_HOUR`
  - hasta `OFFICE_CLOSE_HOUR - duración mínima`
- Ejemplo:
  - Cierre 18:00
  - Duración mínima 60 min
  - Último inicio permitido: **17:00**
  - **17:30 no se muestra**

### Combo Hora de Fin
- Se genera desde:
  - `startTime + duración mínima`
  - hasta `OFFICE_CLOSE_HOUR`

---

## Cambios técnicos realizados

### 1. Nuevo helper reutilizable

**Archivo:** `frontend/src/utils/timeUtils.js`

Responsabilidades:
- Conversión HH:mm ↔ minutos
- Cálculo de slots válidos de inicio y fin
- Aplicación de reglas de apertura, cierre y duración mínima

Funciones clave:
- `buildStartTimeOptions()`
- `buildEndTimeOptions()`

---

### 2. UserNewReservation.jsx

**Archivo:** `frontend/src/pages/UserNewReservation.jsx`

Cambios:
- Se mueve toda la lógica de cálculo de horarios al componente padre.
- Se obtienen las settings desde `/api/public/settings`.
- Se calculan:
  - `startTimeOptions`
  - `endTimeOptions`
- Se corrige automáticamente el horario seleccionado si deja de ser válido.

El formulario **ya no permite** seleccionar combinaciones que violen las reglas.

---

### 3. ReservationTimeFields.jsx

**Archivo:** `frontend/src/components/ReservationTimeFields.jsx`

Cambios:
- El componente deja de generar horarios internamente.
- Pasa a ser un componente **presentacional**.
- Renderiza únicamente las opciones recibidas por props:
  - `startTimeOptions`
  - `endTimeOptions`

Esto evita inconsistencias y duplicación de lógica.

---

## Validaciones backend (sin cambios)

Algunas validaciones **siguen siendo backend-only**, por ejemplo:

- Máximo de horas por día por tipo de espacio
  - Mensaje:
    > "Superas el máximo de 8 horas por día para este tipo de espacio"

Estas validaciones:
- Se ejecutan en `POST /api/reservations`
- Dependen de reservas existentes y reglas de negocio
- El frontend solo muestra el mensaje devuelto

Esto es correcto a nivel arquitectura.

---

## Resultado final

- ❌ Ya no se puede seleccionar `17:30` si no entra la duración mínima.
- ✅ Los combos solo muestran opciones válidas.
- ✅ Menos errores al enviar el formulario.
- ✅ Lógica reutilizable y centralizada.
- ✅ Frontend y backend alineados.

---

## Próximos pasos sugeridos

- Agregar en backend las settings:
  - `RESERVATION_MIN_MINUTES`
  - `MIN_HOURS_BEFORE`
- Activar reglas avanzadas de edición/creación con antelación mínima.
- Anticipar en frontend warnings de límites diarios (UX).

---

**Estado:** ✔️ Implementado y probado con éxito

