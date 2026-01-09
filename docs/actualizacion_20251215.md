# Actualización del Proyecto – 15/12/2025

## Contexto general
Durante esta iteración se consolidaron cambios estructurales importantes tanto en backend como frontend, orientados a:
- Mejorar el control administrativo del coworking
- Introducir clasificación de usuarios
- Incorporar flujos de aprobación de reservas
- Implementar recuperación segura de contraseña
- Unificar experiencia visual del panel administrador

Esta actualización deja la aplicación en un estado **funcionalmente sólido y coherente**, lista para evolución futura.

---

## 1. Espacios (SpaceType)

### Cambios realizados
- Se ampliaron los tipos de espacio:
  - `OFFICE`
  - `SHARED_TABLE`
- Se mantuvieron los existentes:
  - `FIX_DESK`
  - `FLEX_DESK`
  - `MEETING_ROOM`

### Impacto
- Cambio realizado únicamente a nivel de enum (sin migración de datos).
- Frontend actualizado para reflejar los nuevos tipos en los combos de creación/edición.

---

## 2. Reservas

### Nuevo estado `PENDING`
- Se agregó el estado `PENDING` al modelo de reservas.
- Representa reservas que requieren aprobación administrativa.

### Lógica según clasificación del usuario
- **GOOD** → reserva creada directamente en estado `ACTIVE`.
- **REGULAR / sin classify** → reserva creada en estado `PENDING`.
- **BAD** → no se permite crear la reserva.
- **ADMIN** → siempre crea reservas `ACTIVE`, incluso para otros usuarios.

### Dashboard Admin
- Nueva sección: **Reservas pendientes de aprobación**.
- Acciones disponibles:
  - Aprobar reserva
  - Cancelar reserva

---

## 3. Clasificación de usuarios (Classify)

### Backend
- Se agregó el campo `classify` al modelo `User`.
- Valores soportados:
  - `GOOD`
  - `REGULAR`
  - `BAD`
- Endpoints admin actualizados para leer y modificar este campo.

### Frontend
- El campo **NO se muestra al crear usuarios** (default: `GOOD`).
- El campo **SÍ se muestra al editar usuarios** (solo admin).
- Se creó una vista específica para:
  - **Usuarios sin classify**

---

## 4. Gestión de usuarios (Admin)

### Nueva pantalla dedicada
- Se separó la gestión de usuarios del dashboard principal.
- Estructura final:
  - Usuarios sin clasificación (bloque destacado)
  - Filtros por nombre, estado y rol
  - Tabla principal de usuarios

### Estilos
- Se unificó el diseño visual:
  - Cards limpias
  - Badges de estado
  - Chips de rol
  - Acciones alineadas

---

## 5. Autenticación y seguridad

### Registro
- Registro de usuarios funcional.
- Los usuarios creados por admin reciben password temporal.

### Forgot / Reset Password (NUEVO)

#### Forgot password
- Endpoint: `POST /api/auth/forgot-password`
- Genera token seguro con vencimiento.
- Envía email con link de recuperación usando templates.

#### Reset password
- Endpoint: `POST /api/auth/reset-password`
- Reglas:
  - Token válido por 60 minutos
  - Token se invalida al usarse
  - Password obligatorio con confirmación doble (frontend)

#### Notificación de seguridad
- Al cambiar la contraseña se envía email indicando:
  - Fecha y hora
  - Acción realizada

---

## 6. Emails dinámicos

### Infraestructura
- Se reutilizó el sistema existente de envío de mails.
- Se consolidó el uso de la tabla `EmailTemplate`:
  - `key`
  - `subject`
  - `body`

### Nuevos templates
- Recuperación de contraseña
- Confirmación de cambio de contraseña

Los textos son ahora **100% configurables sin tocar código**.

---

## 7. Arquitectura y calidad

### Refactors clave
- Centralización de validaciones de reservas.
- Servicios reutilizables:
  - `emailTemplateService`
  - `emailService`
- Manejo consistente de errores y respuestas genéricas (anti user-enumeration).

---

## Estado final

✅ Funcionalidades críticas completas
✅ Flujos admin consolidados
✅ Seguridad reforzada
✅ UX consistente

La aplicación queda preparada para:
- Métricas
- Roles avanzados
- Automatización de mails
- Auditoría extendida

---

**Próximo paso sugerido**
- Pulido final de dashboard admin (UX)
- Tests básicos de flujos críticos
- Deploy con seeds definitivos de templates

