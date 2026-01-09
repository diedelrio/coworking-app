# Historial de decisiones del proyecto

## Backend
- Se eligió **Prisma + SQLite** para facilitar desarrollo local sin servidor externo.
- Se implementó **JWT** por simplicidad y compatibilidad con frontend SPA.
- Se descartó temporalmente regla de “máximo 4 horas por día” para liberar desarrollo.
- Se unificaron endpoints `/reservations/my`, `/reservations`.
- Se movió la lógica de colisiones a una función central.
- Para calendario admin se decidió generar:
  - Vista día/semana/mes
  - Endpoint universal filtrable por espacio

## Frontend
- Se eliminó código duplicado entre DashboardUser y UserReservations.
- Se estandarizó el encabezado con Header.jsx.
- Se introdujo un **carousel automático** para el home del usuario.
- Se decidió que todas las pantallas se centran horizontalmente y se anclan arriba verticalmente.
- Se agregó modal popup para detalle del día.
- Las franjas disponibles son clickeables y abren reserva pre-llenada.
- En calendario admin se agregó:
  - Vista “Todos los espacios”
  - Grilla responsive 2 columnas
  - Un calendario por espacio

## UX / UI
- Se aplicó el estilo “tarjetas blancas” con bordes suaves.
- Se ajustó el tamaño del modal y la card de reserva a ¾ del ancho.
- Las etiquetas Activa / Cancelada llevan colores pastel.
- Se agregaron iconos (calendario, reloj).
- Se reemplazó layout de calendario usuario por diseño más limpio y minimalista.

## Organización
- Se divide el proyecto en backend / frontend independientes.
- Se decidió subirlo luego a un Proyecto de ChatGPT para continuar su evolución con un Agente.
