# Roadmap de desarrollo

## 1. Mejoras inmediatas (alto valor)
- Crear modo edición de reserva para usuarios.
- Añadir disponibilidad en tiempo real.
- Implementar reglas configurables:
  - Horas máximas por día.
  - Horas máximas por semana.
  - Antelación mínima.
- Añadir validaciones más robustas en backend.

## 2. UI / UX
- Agregar tema oscuro.
- Mejorar animación del modal.
- Añadir skeletons para estados de carga.
- Agregar tooltips en calendario.

## 3. Admin
- Panel de métricas:
  - Uso del coworking por día
  - Franjas más demandadas
  - Espacios más usados
- Exportaciones avanzadas:
  - PDF con reservas del mes
  - Excel multiespacio

## 4. Base de datos
- Migrar de SQLite a PostgreSQL para producción.
- Generar seeds para entornos dev/staging.

## 5. Seguridad
- Implementar refresh tokens.
- Recuperar contraseña (email real / OTP).
- Auditoría de acciones admin.

## 6. Escalabilidad
- Separar backend en microservicio de reservas.
- Implementación de colas (bullmq) para envíos de email.
- Carga diferida de calendarios en modo all-spaces.

## 7. Versiones futuras
- App móvil (React Native).
- Mapa interactivo de puestos.
- Integración con Google Calendar.
