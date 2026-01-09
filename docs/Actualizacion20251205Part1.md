Actualización 2025-12-05 — Gestión de Usuarios y Mejoras de Reserva
🟦 1. Nueva funcionalidad: Gestión completa de usuarios para Administradores

Se incorporó una sección dedicada para administrar usuarios desde el panel de administrador.
Esto incluye:

✔ 1.1. Nueva página: AdminUsers.jsx

Listado completo de usuarios.

Filtros por:

Estado (Activo / Inactivo)

Rol (Admin / Cliente)

Texto (nombre, apellido o email)

Acciones rápidas:

Activar / Desactivar usuario

Editar usuario

Botón para crear nuevo usuario.

Esta separación mejora la organización del panel y evita sobrecargar el Dashboard Admin.
(Sigue el diseño modular descrito en la actualización del 04/12/2025).


🟦 2. Nueva página: AdminNewUser.jsx

Pantalla unificada para:

Crear usuario nuevo

Ver detalle de usuario

Editar usuario existente

✔ 2.1. Creación de usuarios (modo “nuevo”)

Formulario simple: nombre, apellidos, teléfono, email.

La contraseña no se gestiona aquí (flujo separado).

Botón principal “Crear cuenta”.

Estilo visual actualizado para coincidir con la pantalla proporcionada por el usuario.

✔ 2.2. Edición (modo “detalle”)

Permite modificar:

Nombre

Apellidos

Teléfono

Email

Rol (Admin / Cliente)

Estado (Activo / Inactivo)

La contraseña:

No es visible

No es editable

🟦 3. Historial de cambios del usuario (auditoría)

Se añadió trazabilidad para mantener un registro de modificaciones.

✔ 3.1. Nuevo modelo en base de datos: UserHistory

Incluye:

field modificado

Valor anterior

Valor nuevo

Fecha de modificación

Usuario administrador que realizó el cambio

Esto permite auditoría completa del ciclo de vida del usuario.

✔ 3.2. Nuevos endpoints

GET /users/:id/history → historial del usuario

PUT /users/:id → guarda cambios y genera las entradas de historial

El frontend muestra el historial en una tabla dentro de AdminNewUser.jsx.

🟦 4. Ajustes de navegación entre pantallas de usuarios
✔ 4.1. Nueva ruta:
/admin/usuarios


Lista de usuarios.

✔ 4.2. Nuevas rutas:
/admin/usuarios/nuevo
/admin/usuarios/:id


Crear nuevo usuario / ver y editar usuario existente.

✔ 4.3. Sidebar actualizado

Se agregó la entrada:

👥  Usuarios


Para acceso directo desde el menú lateral.

🟦 5. Corrección funcional: Reserva desde el modal de franjas (cliente)

Se solucionó un error importante detectado desde la vista:

Mis reservas → Modal del día → Franjas Disponibles

Antes:

Al hacer clic en una franja “Disponible”, se abría la pantalla
/user/reservar

Se precargaban fecha, hora inicio, hora fin

Pero NO el espacio seleccionado

Esto obligaba al usuario a volver a elegir manualmente el espacio.

✔ 5.1. Solución aplicada

Ahora, al hacer clic en una franja “Disponible”, se envía también:

spaceId=ID_DEL_ESPACIO

✔ 5.2. Ajustes en UserNewReservation.jsx

Se lee el nuevo parámetro spaceId desde la URL.

Se inicializa automáticamente el selector de espacio.

Esto funciona tanto en modo nueva reserva como edición.

Resultado:
✔ La reserva se precarga correctamente con todos los datos del contexto actual.

🟦 6. Cambios descartados

Se analizaron pero se decidió no implementar (por simplicidad o prioridad):

Reformar el Layout global del admin para evitar overflow lateral.

Estilos avanzados de la pantalla de nuevo usuario.

Botón/toggle “Día completo” para reservas.

Se mantienen documentados pero no incorporados.

🟩 Resumen general de la actualización
Área	Cambios
Admin – Usuarios	Nueva pantalla de listado, edición, creación.
Auditoría	Nuevo modelo UserHistory + endpoints + UI.
Reservas – Cliente	Corrección: ahora se envía spaceId al reservar desde el modal.
Navegación	Nuevas rutas /admin/usuarios, /admin/usuarios/nuevo, /admin/usuarios/:id.
UX	Estética de pantalla de creación de usuario alineada con mockup.
Descartado	Layout admin, toggle “día completo”, refactors de estilo.