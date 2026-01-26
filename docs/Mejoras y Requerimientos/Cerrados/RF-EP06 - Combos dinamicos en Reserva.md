Requerimiento funcional actualizado – UserNewReservation (crear / editar)
Parámetros involucrados

OFFICE_OPEN_HOUR

OFFICE_CLOSE_HOUR

RESERVATION_STEP_MINUTES

RESERVATION_MIN_MINUTES

MIN_HOURS_BEFORE (tu min_hours_before: antelación mínima para poder crear/modificar reservas en una fecha/hora)

Reglas generales de combos (aplica siempre)
A) Combo “Hora de inicio”

Se genera siempre desde:

OFFICE_OPEN_HOUR
hasta

OFFICE_CLOSE_HOUR - RESERVATION_MIN_MINUTES

(Con saltos de RESERVATION_STEP_MINUTES)

Esto garantiza que el usuario nunca seleccione un inicio que no permita cumplir la reserva mínima.

B) Combo “Hora de fin”

Se genera siempre desde:

startTime + RESERVATION_MIN_MINUTES
hasta

OFFICE_CLOSE_HOUR

(Con saltos de RESERVATION_STEP_MINUTES)

Reglas específicas por caso
1) Creación de reserva
1.1 Fecha futura

Se muestran horas de inicio según regla general (A).

Además se valida que cumpla MIN_HOURS_BEFORE respecto a “ahora” si el usuario elige “mañana temprano” no hay problema; la regla impacta fuerte cuando la fecha es hoy.

1.2 Fecha hoy

El combo de inicio no arranca en OPEN, arranca en:

max( ceilToStep(now, STEP), OFFICE_OPEN_HOUR )

Y además debe cumplirse:

startTime >= now + MIN_HOURS_BEFORE

Si por configuración/hora actual ya no existe ningún startTime válido hoy, entonces:

la fecha no puede ser hoy (debe ser futura)

se muestra error/advertencia clara (ver sección Mensajes).

Ejemplo: 17:05 con MIN_HOURS_BEFORE > 0 y/o RESERVATION_MIN_MINUTES (y close 18:00) ⇒ no hay ventana posible hoy, entonces hay que forzar fecha futura.

2) Edición de reserva (UserNewReservation con ?edit)
2.1 Regla de “se puede editar hasta min_hours_before”

Solo se permite modificar si se cumple:

startOriginal - now >= MIN_HOURS_BEFORE

Si no se cumple, el formulario debe quedar en modo “solo lectura” para los campos editables (o bloquear submit) y mostrar mensaje.

2.2 Si SÍ se permite modificar

Acá va tu regla clave:

El combo “Hora de inicio” se pinta desde la hora de inicio original de esa reserva.

Es decir, aunque sea “hoy”, no se recalcula desde la hora actual, sino desde startOriginal.

Igual se respeta el techo: OFFICE_CLOSE_HOUR - RESERVATION_MIN_MINUTES.

Motivo: si el usuario está editando dentro de la ventana permitida, no debe “perder” opciones previas; el punto de partida lógico es el slot original.

En resumen edición:

si editable: baseStart = startOriginal

si no editable: no hay cambios posibles.

2.3 Combo “Hora de fin” en edición

Se aplica regla general (B), partiendo del startTime seleccionado.

Mensajes de error y advertencias (UX)
Caso A: “Hoy ya no se puede reservar”

Condición típica:

No existe ningún startTime válido hoy por:

now + MIN_HOURS_BEFORE supera el último inicio posible (close - min)

o directamente ya estás fuera del horario operativo

Mensaje (advertencia/bloqueante):

“Ya no es posible reservar para hoy. Por favor selecciona una fecha futura.”

Texto secundario recomendado:

“Las reservas deben hacerse/modificarse con al menos {MIN_HOURS_BEFORE}h de anticipación y con duración mínima de {RESERVATION_MIN_MINUTES} min.”

Acción UX:

Marcar el datepicker en error

(Opcional) auto-setear fecha a mañana y mostrar toast informativo

Caso B: “No se puede editar por min_hours_before”

Mensaje (bloqueante):

“Esta reserva ya no puede modificarse porque faltan menos de {MIN_HOURS_BEFORE} horas para el inicio.”

Acción UX:

Deshabilitar inputs de fecha/hora/asistentes/espacio (según tu alcance)

Deshabilitar botón Guardar

Caso C: “Fecha hoy seleccionada pero hora actual + reglas no permiten”

Mensaje:

“Para hoy no hay horarios disponibles. Selecciona otro día.”