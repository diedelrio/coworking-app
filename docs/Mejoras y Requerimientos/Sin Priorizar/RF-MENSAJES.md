# RF-MSG-01 — Mensajería y Notificaciones

## Descripción
Comunicación interna entre admin y usuario con alertas y emails.

## Actores
- Administrador
- Usuario

## Alcance
Incluye inbox y notificaciones.
No incluye chat grupal.

## Criterios de aceptación
- Mensaje genera notificación y email
- Lectura marca como visto

## Impacto técnico
- Backend: messaging
- Frontend: adminMessaging, clientInbox
- DB: Conversation, Message, Notification
