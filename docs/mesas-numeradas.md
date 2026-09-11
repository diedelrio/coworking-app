# Mesas numeradas de Sinergia

## Activación

El esquema principal es backend/prisma/schema.prisma (PostgreSQL). Las copias históricas schema.postgres.prisma y schema.sqlite.prisma no contienen todo el modelo actual y no se usan para este cambio.

Desde backend, aplicar las migraciones con npm run db:deploy y regenerar el cliente con npm run prisma:gen:pg. Reiniciar el backend si estaba en ejecución.

En Administración → Espacios → Editar Sinergia, seleccionar un tipo compartido (FLEX_DESK o SHARED_TABLE), revisar la capacidad y activar «Mesas numeradas». Se crean números del 1 a la capacidad. Las reservas activas y pendientes que todavía no han finalizado reciben una mesa por asistente dentro de la misma transacción. Si alguna no cabe, la activación se revierte por completo; hay que revisar esas reservas antes de reintentar.

Usar «Gestionar mesas» para ajustar los números reales y registrar ocupantes fijos. Cada asignación tiene nombre, fecha inicial y fecha final opcional. Bloquea días completos en Europe/Madrid, incluida la fecha final; sin fecha final permanece vigente indefinidamente. No se pueden introducir asignaciones fijas que se crucen con reservas o con otra asignación fija. Los nombres solo se muestran a administradores.

## Reservas

- Los usuarios ven el estado de cada mesa y reciben automáticamente una mesa por asistente al guardar. Un puesto fijo queda fuera del reparto, incluso si quien reserva es su ocupante.
- Los administradores eligen tantos números libres como asistentes. Las mesas seleccionadas se comprueban en todas las fechas de una serie.
- Cada mesa debe estar libre durante todo el intervalo. Las reservas adyacentes no se solapan; una mesa ocupada en cualquier parte del intervalo solicitado no se puede asignar.
- ACTIVE y PENDING bloquean. Cancelar, rechazar o completar libera disponibilidad y conserva la relación histórica con la mesa.
- Al editar, el usuario conserva sus mesas si siguen disponibles; de lo contrario recibe otras libres. La edición de una serie es atómica. Los números pueden variar por fecha en las asignaciones automáticas.
- La disponibilidad se consulta al cambiar fecha/horario y cada 30 segundos. Guardar vuelve a comprobarla en una transacción con bloqueo de fila del espacio. La selección visual no mantiene un puesto retenido.
- Aumentar la capacidad añade mesas con números nuevos. Deshabilitar una mesa reduce la capacidad; no se permite si tiene reservas o asignaciones fijas vigentes/futuras. El número identifica la mesa actual, por lo que renumerarla también cambia el número mostrado en su historial.

## Verificación

Desde backend: npm run test:desks y npm run test:desks:integration. Las pruebas de integración solo aceptan PostgreSQL local, crean un esquema desk_test_* único, comprueban la migración y los endpoints HTTP y eliminan ese esquema al terminar. Opcionalmente usan DESK_TEST_DATABASE_URL. No modifican los registros del esquema de la aplicación.

Desde frontend: npm run build.
