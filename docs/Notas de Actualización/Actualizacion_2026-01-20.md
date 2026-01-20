# Actualización – 20/01/2026  
## Coworking App – Bugfixes + Mejora UX

### Contexto
Se trabajó sobre dos bugs críticos detectados en el flujo de reservas y, aprovechando la corrección, se incorporó una mejora menor de UX para evitar confusión en el dashboard del usuario.

---

## 🐞 BUG-0001 – Reserva creada por Admin se asociaba al usuario incorrecto

**Descripción**  
Al crear una reserva desde el rol Administrador en nombre de un usuario, la reserva quedaba asociada al usuario administrador autenticado y no al usuario seleccionado en el formulario.

**Causa raíz**  
El backend utilizaba siempre el `userId` del token (`req.user.id`) al persistir la reserva, ignorando el `userId` enviado en el payload cuando el actor era ADMIN.

**Solución implementada**
- Se corrigió la lógica del endpoint de creación de reservas:
  - Si el actor es **ADMIN** y se envía `userId`, la reserva se asocia correctamente a ese usuario.
  - Las validaciones de disponibilidad y reglas se ejecutan contra el usuario destino.
  - Si un usuario no-admin intenta crear una reserva para otro usuario → se devuelve `403`.

**Resultado**
- El admin puede crear reservas válidas en nombre de terceros.
- Las reservas aparecen correctamente en el dashboard del usuario correspondiente.

---

## 🐞 BUG-0002 – Grilla de “Próximas reservas” mostraba solo 3 registros

**Descripción**  
En el dashboard del usuario, la grilla de “Próximas reservas” mostraba únicamente 3 registros, independientemente de la cantidad real existente.

**Causa raíz**  
Limitación visual heredada (slice hardcodeado) en el frontend.

**Solución implementada**
- Se eliminó la restricción fija.
- La grilla ahora respeta el conjunto completo de reservas futuras retornadas por el backend.

**Resultado**
- El usuario visualiza todas sus reservas futuras relevantes.

---

## ✨ Mejora UX – Leyenda informativa en “Próximas reservas”

**Motivación**  
Para evitar confusión sobre el alcance temporal de la grilla de “Próximas reservas”, se agregó una leyenda aclaratoria basada en configuración.

**Implementación**
- Se reutiliza el parámetro de configuración global:
  - `MAX_DAYS_UPCOMING_BOOKING` (NUMBER, default: 7)
- El valor se expone a través del endpoint público de settings.
- Se muestra una leyenda debajo del título de la sección.

**Texto UX**
> *Se muestran las reservas programadas para los próximos **N** días.*

(donde **N** es el valor de `MAX_DAYS_UPCOMING_BOOKING`)

**Beneficios**
- Mayor claridad para el usuario final.
- Coherencia entre comportamiento funcional y comunicación visual.
- Preparado para futuros ajustes sin cambios de código (solo configuración).

---

## 📁 Archivos impactados

### Backend
- `backend/src/routes/reservations.js`
- `backend/src/routes/public.js`

### Frontend
- `frontend/src/pages/DashboardUser.jsx`
- `frontend/src/styles.css` (si aplica)

---

## Estado
✅ Bugs corregidos y validados en entorno local  
✅ Mejora UX implementada y validada  
➡️ Listo para commit y merge

---
