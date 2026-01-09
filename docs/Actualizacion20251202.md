Actualización 2025-12-02
Contexto general

Seguimos evolucionando el flujo de reservas de la app de coworking, con foco en:

Dar más control al usuario sobre sus propias reservas (modo edición).

Hacer que la sección “Mis reservas” se centre realmente en lo que tiene el usuario, no en la disponibilidad general.

Unificar las reglas de negocio de crear y editar reservas (límite de horas, antelación, solapes, etc.).

Funcionalidades nuevas / modificadas
1. Edición de reservas por parte del usuario

Objetivo: permitir que un usuario pueda modificar una reserva futura activa (fecha, franja horaria y espacio), respetando las mismas reglas que al crear.

Cambios clave:

Desde la vista de “Mis reservas”:

En la tabla de reservas, se mantiene el botón de Cancelar para reservas futuras activas.

En el calendario, al seleccionar un día, en el modal se listan las reservas del usuario de ese día con un botón “Editar” (solo para reservas activas y futuras).

Se reutiliza el formulario de reservas (/user/reservar) en modo edición, usando el query param:

?edit={reservationId} → carga datos de la reserva y hace PUT en lugar de POST.

Restricciones de negocio para editar:

No se puede editar:

Una reserva cancelada.

Una reserva cuyo inicio ya esté en el pasado.

Se aplican las mismas reglas que en la creación:

Validación de solapes por espacio.

Límite de horas por día.

Límite de horas por semana.

Tiempo mínimo de antelación antes del inicio.

2. Reenfoque de la UX de “Mis reservas”

Objetivo: que “Mis reservas” muestre información centrada en la agenda personal del usuario.

Cambios:

En el modal del calendario:

Se eliminó la grilla de franjas 09:00–18:00 con estado “Disponible/Reservado”.

Ahora solo se muestran las reservas del usuario para ese día:

Hora inicio – fin.

Espacio.

Estado (Activa / Cancelada).

Botón “Editar” en reservas activas futuras.

La vista de disponibilidad por franja horaria queda reservada para la pantalla de agendar nueva reserva, no para “Mis reservas”.

Resultado:
“Mis reservas” es ahora un espacio de consulta y gestión personal (ver, editar, cancelar), mientras que la lógica de exploración de disponibilidad y creación de nueva reserva se mantiene en la pantalla específica de reserva.

Cambios técnicos
1. Backend
1.1. Nuevo endpoint: GET /api/reservations/:id

Permite obtener el detalle de una reserva.

Reglas de acceso:

Usuarios normales: solo pueden ver sus propias reservas.

Admin: puede ver cualquier reserva.

Incluye los datos necesarios para precargar el formulario de edición (fecha, horarios, espacio, etc.).

1.2. Nuevo endpoint: PUT /api/reservations/:id

Permite editar una reserva existente.

Reglas de acceso:

Usuario: solo puede editar sus propias reservas.

Admin: puede editar cualquier reserva.

Validaciones aplicadas:

La reserva debe existir.

No se puede editar si status === 'CANCELLED'.

No se puede editar si la reserva ya ha empezado (reserva en el pasado).

Cálculo de nuevos startTime y endTime a partir de date, startTime (HH:MM) y endTime (HH:MM) del body.

Límite de horas por día y por semana, excluyendo la propia reserva actual de los cálculos.

Comprobación de solapes en el espacio:

Se buscan reservas activas en ese espacio que se solapen con la nueva franja, excluyendo la reserva actual.

Comprobación de que el espacio existe y está activo.

Respuesta en caso de éxito:

Mensaje de confirmación.

Objeto reserva actualizado.

Nota: la lógica de validación se ha diseñado para ser coherente con la creación de reservas. El siguiente paso natural será extraer esta lógica común a un helper único compartido por POST y PUT.

2. Frontend
2.1. UserNewReservation.jsx – modo creación / edición

El componente ahora soporta dos modos:

Create (por defecto): sin ?edit → hace POST /reservations.

Edit: con ?edit={id} → hace GET /reservations/{id} para precargar datos y PUT /reservations/{id} al guardar.

Se detecta el modo mediante el query param:

editId = searchParams.get('edit')

isEditMode = Boolean(editId)

En modo edición:

Se cargan espacios.

Se llama a GET /reservations/{id}.

Se normalizan date, startTime y endTime al formato de los inputs.

Cambios de UX:

Título dinámico:

Crear: “Agendar una reserva”.

Editar: “Editar reserva”.

Texto descriptivo ajustado según modo.

Botón de envío dinámico:

Crear: “Reservar” / “Creando reserva…”.

Editar: “Guardar cambios” / “Guardando cambios…”.

Gestión de errores:

Se muestran mensajes específicos si falla la creación o la edición, utilizando el message devuelto por el backend cuando existe.

2.2. UserReservations.jsx – calendario + modal de día

Se mantiene la lógica de:

Carga de reservas del usuario con GET /reservations/my.

Pintado de días con reserva en el calendario (marcados en azul).

Nuevo comportamiento del modal:

Seleccionar un día abre un modal propio (UserReservationsModal) que:

Muestra una lista de reservas del usuario para ese día.

Para cada reserva:

Espacio.

Franja horaria.

Estado (Activa/Cancelada).

Botón Editar (si la reserva es activa y futura → navega a /user/reservar?edit={id}).

Se elimina la grilla de franjas horarias con “Disponible/Reservado” de este modal.

El listado inferior de reservas (“tabla de reservas”) se mantiene:

Muestra todas las reservas del usuario.

Permite cancelar reservas futuras activas.

2.3. Nuevo componente: UserReservationsModal.jsx

Encapsula el modal utilizado en la página de Mis reservas.

Recibe props:

dayReservations: array de reservas del usuario para el día seleccionado.

closeModal: callback para cerrar el modal.

Contenido:

Lista de franjas reservadas:

HH:MM – HH:MM + nombre del espacio.

Botón Editar para reservas futuras activas.

Botón de cerrar.

Estilos:

Overlay semitransparente fullscreen.

Card central con bordes redondeados, sombra y estructura clara.

Decisiones de diseño y UX

Separar “ver lo mío” vs “ver disponibilidad”

“Mis reservas” se centra exclusivamente en lo que el usuario ya tiene reservado.

La exploración de disponibilidad del espacio se mantiene en la pantalla de nueva reserva.

Reutilizar el formulario de reservas para editar

Menos duplicación de código.

UX consistente: mismo formulario para crear y editar, con ligeros cambios de texto.

Mantener reglas de negocio coherentes entre creación y edición

Las restricciones (horas por día, semana, solapes, antelación, estados) deben aplicarse igual.

Evita inconsistencias como “puedo crear pero luego editar a algo que rompería las reglas”.