# 📝 Actualización – Módulo Comercial (Asignaciones y Reservas Asociadas)

**Fecha:** 2026-03-22
**Versión:** v2.1 (Comercial – Fase 1 cerrada)

---

## 🎯 Objetivo de la iteración

Implementar la base del módulo comercial que permita:

* Definir productos comerciales
* Asignarlos a usuarios
* Generar beneficios/saldos automáticamente
* Soportar productos con ocupación fija mediante reservas asociadas

---

## ✅ Funcionalidades implementadas

### 1. 📦 Productos comerciales

Se consolidó el modelo de productos comerciales con:

* Tipología (`PLAN`, `BONUS`, etc.)
* Tarifas (`rates`)
* Beneficios (`benefits`)
* Configuración de comportamiento:

  * `requiresReservation` → indica si el producto genera reserva automática
  * `defaultSpaceId` (opcional)

---

### 2. 👤 Asignación de productos a usuarios

Nuevo flujo administrativo:

* Selección de usuario
* Selección de producto
* Definición de:

  * vigencia
  * precio snapshot
  * impuestos
  * notas

Al confirmar:

✔ Se crea `UserCommercialProduct`
✔ Se generan automáticamente `UserBenefitBalance` (si aplica)

---

### 3. 💰 Generación automática de saldos

Para productos con beneficios:

* Se crean balances por:

  * tipo de recurso (ej: sala)
  * unidad (horas, días, etc.)
* Se soporta:

  * crédito inicial
  * expiración
  * reseteo periódico (ej: mensual)

---

### 4. 🏢 Reserva asociada automática

Nueva capacidad clave:

Cuando el producto tiene:

```txt
requiresReservation = true
```

El sistema permite:

* activar “crear reserva automáticamente”
* seleccionar espacio
* agregar notas

Y al guardar:

✔ Se crea la asignación comercial
✔ Se crean balances (si aplica)
✔ Se crea una `Reservation` asociada
✔ Se vincula mediante `userCommercialProductId`

---

### 5. 🔗 Modelo de relación consolidado

Se estableció el siguiente modelo:

* `CommercialProduct` → definición del producto
* `UserCommercialProduct` → asignación al usuario
* `UserBenefitBalance` → saldo disponible
* `Reservation` → ocupación real
* Relación:

  * `Reservation.userCommercialProductId`

---

### 6. 🧠 Integración backend

Se extendió:

**Endpoint:**

```txt
POST /api/admin/commercial/assignments
```

Soporta ahora:

```json
{
  "createReservation": true,
  "reservation": {
    "spaceId": 1,
    "notes": "..."
  }
}
```

Incluye:

* validaciones
* transacción única
* creación de reserva compatible con modelo actual (`date`, `startTime`, `endTime`)

---

### 7. 🖥️ UI Admin

Nueva pantalla:

**Comercial → Asignaciones**

Incluye:

* selector de usuarios
* formulario de asignación
* autocompletado desde producto
* bloque dinámico de reserva asociada
* visualización de:

  * balances generados
  * reservas asociadas
* acciones:

  * activar
  * cancelar
  * expirar

---

## ⚠️ Consideraciones técnicas

* El modelo `Reservation` utiliza:

  * `date`
  * `startTime`
  * `endTime`
* Se adaptó la creación automática para respetar este esquema
* Se agregó cálculo de:

  * `durationMinutes`
  * `hourlyRateSnapshot` (temporal)

---

## 🧩 Estado actual del módulo

✔ Base comercial operativa
✔ Flujo admin completo
✔ Integración con reservas iniciada
❌ Consumo automático de saldo (pendiente)

---

## 🚀 Resultado

El sistema ya permite:

✔ Vender productos comerciales
✔ Asignarlos a usuarios
✔ Generar beneficios automáticamente
✔ Gestionar ocupación fija mediante reservas

Esto establece la base para un sistema comercial completo tipo coworking / membership / SaaS.

---
