🧾 Actualización – Dashboard Usuario & Pricing Compartidos

Fecha: 21/01/2026
Proyecto: Coworking Sinergia
Tipo: Feature + UI/UX + Regla de negocio

🚀 Nuevas funcionalidades
1. Nuevo Dashboard de Usuario

Rediseño completo del Dashboard User alineado a los nuevos mockups.

Botón “Nueva reserva” alineado visualmente con título y subtítulo.

Cards de Próximas reservas:

Estado visible junto al nombre del espacio.

Acciones claras: Ver detalles, Editar, Cancelar.

Métricas visibles:

Reservas totales

Próximas reservas

Reservas de hoy

2. Nuevo formulario “Nueva Reserva” (User)

Reimplementación completa del formulario según mock:

Card central “Detalles de la Reserva”.

Header con flecha de volver alineado al formulario.

Campos alineados y consistentes (date / time / text).

Card dinámica del espacio:

Capacidad

Precio por hora

Descripción

Cálculo en tiempo real:

Duración (en horas)

Costo total estimado

Soporte completo para:

Crear reserva

Editar reserva existente

Sin uso de Layout (exclusivo Admin).

💰 Cambios en reglas de Pricing
Nueva regla para espacios compartidos

Se implementa pricing diferenciado según tipo de espacio:

🔹 Espacios NO compartidos

(MEETING_ROOM, OFFICE, FIX_DESK)

total = hourlyRate * horas

🔹 Espacios COMPARTIDOS

(FLEX_DESK, SHARED_TABLE)

total = hourlyRate * horas * attendees

Detalles clave

El precio se congela al crear la reserva (hourlyRateSnapshot).

En edición:

Se recalcula duración y total

Se reutiliza el snapshot original (no el precio actual del espacio).

Redondeo seguro a 2 decimales usando Prisma.Decimal.

🧠 Backend – Cambios técnicos
pricing.js

Soporte para:

shared

attendees

Cálculo centralizado y consistente entre CREATE y UPDATE.

reservations.js

POST /api/reservations

Pricing snapshot incluye multiplier por asistentes si el espacio es compartido.

PUT /api/reservations/:id

Recalcula total respetando snapshot original.

Validaciones reforzadas:

Capacidad en espacios compartidos.

Ocupación por asistentes.

Reglas de solapamiento por tipo de espacio.

🎨 Frontend – Cambios técnicos

Nuevo CSS específico para:

User New Reservation

Alineación exacta según mock

Lógica de cálculo de precio en frontend alineada 1:1 con backend.

Mejoras UX:

Feedback inmediato del costo.

Mensajes claros según tipo de espacio.

Deshabilitación inteligente de asistentes en espacios no compartidos.

⚠️ Consideraciones

El cálculo final siempre se valida en backend (el frontend es solo informativo).

El precio histórico de una reserva no cambia aunque se edite el espacio.

El flujo Admin no se ve afectado por estos cambios.

✅ Estado

Feature completa

Probada en flujo User (create / edit)

Lista para merge a rama principal

Cuando quieras, en el próximo día podemos:

limpiar commits antes del merge

o preparar el CHANGELOG.md acumulativo del proyecto

o armar el tag de release (v0.x.x)

Buen cierre de jornada 👌