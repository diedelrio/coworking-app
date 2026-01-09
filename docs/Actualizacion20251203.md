📝 Actualización 2025-12-03 — Mejoras Backend, Frontend y Notificaciones
🟦 1. Implementación de reglas avanzadas por tipo de espacio

Agregamos un nuevo conjunto de reglas configurables para cada tipo de espacio:

FLEX_DESK (Escritorios comunitarios)

FIX_DESK (Despacho privado)

MEETING_ROOM (Sala de reuniones)

Nuevas reglas añadidas

Para cada tipo se agregaron:

*_MAX_SPACES_PER_DAY_PER_USER → Límite de cantidad de espacios distintos por día

*_MAX_OVERLAPPING_SPACES_PER_USER → Límite simultáneo

Reconfiguración de:

*_MAX_HOURS_PER_DAY_PER_USER

*_MAX_HOURS_PER_WEEK_PER_USER

Nueva validación en backend

En validateAndBuildReservation() incorporamos:

Validación por espacios distintos por día
(si se supera → error DAY_SPACES_LIMIT_EXCEEDED)

Lógica extendida y unificada por tipo de espacio

Información adicional en errores para habilitar “Solicitar más”

🟦 2. Nuevos settings dinámicos para alertas por límites

Se agregaron settings administrables desde el panel:

limit_alert_emails → destinatarios del correo

limit_alert_subject → asunto del correo

limit_alert_template_id → template utilizado

Estos settings permiten configurar fácilmente cómo y a quién se le envía la alerta cuando un usuario excede límites de reserva.

🟦 3. Creación del sistema de plantillas de email (EmailTemplate)
Nuevo modelo Prisma

Se añadió a schema.prisma:

model EmailTemplate {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  name      String
  subject   String
  body      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

Migración creada:
add_email_templates

Semilla inicial (seedEmailTemplates.js)

Creamos el template inicial:

key = "limit_override_request"

id = 1

subject, body con variables dinámicas ({{userName}}, etc.)

Esto habilita el motor de plantillas para futuras notificaciones.

🟦 4. Servicio de alertas y envío de correos
Agregamos:

emailService.js → con integración real de Nodemailer
limitAlertService.js → lógica para construir y enviar alertas

Variables necesarias en .env:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu_cuenta@gmail.com
SMTP_PASS=contraseña_aplicacion_google

Flujo final del correo:

Usuario rompe una regla

Backend devuelve:

canRequestOverride=true

código del límite

El frontend muestra modal

Si confirma → el backend envía correo real al administrador

🟦 5. Nuevo modal para solicitar excepción (frontend)
Cambios principales:

Modal separado:
frontend/src/components/LimitOverrideModal.jsx

Estados y handlers integrados en
UserNewReservation.jsx:

overrideInfo

showOverrideModal

sendingOverride

Nuevo flujo de UI:

Error aparece

Botón “Solicitar más”

Modal con detalles

Envío de solicitud

🟦 6. Integración completa en UserNewReservation.jsx

Reemplazo de handleSubmit con detección de canRequestOverride

Render del modal en el return

Botón para reabrir modal desde el mensaje de error

Validación consistente con backend

🟦 7. Creación del endpoint real de solicitud
POST /api/reservations/limit-override-request


Guarda información del límite

Envía correo al administrador

Devuelve confirmación al usuario

🟦 8. Estructura futura propuesta para el Dashboard Admin

Diseño definido para la próxima iteración:

Header

Botón para colapsar/expandir el sidebar

Logo del coworking

Contenido principal al iniciar:

Tarjeta para crear reserva en nombre de un usuario

Calendario por espacio (vista diaria por defecto)

Grilla con reservas:

del día + futuras

paginación en 10 filas

Sidenav colapsable
Dashboard
Configuración
  ├─ Espacios
  ├─ Reglas de Negocio
Usuarios
Reportes
  ├─ Reservas (TBD)
  ├─ Usuarios (TBD)

🟩 RESUMEN GLOBAL DE LA ACTUALIZACIÓN
Área	Cambios implementados
Reglas de negocio	Nuevas reglas por tipo de espacio, validación por espacios distintos/día
Backend	Mejoras en validación, modelo EmailTemplate, servicio de alertas, nodemailer integrado
Base de datos	Nueva tabla EmailTemplate + migración + seed
Frontend	Modal de solicitud de excepción, Hook de override, UI mejorada, estructura separada
Notificaciones	Sistema completo de envío de mails por Gmail / SMTP
Admin Dashboard	Rediseño funcional aprobado para siguiente sprint