# 📊 EP - Reportes: Consulta de Usuarios y Reservas

## 🧩 Descripción general

Se implementa el módulo inicial de **Reportes** dentro del panel de administración, incorporando dos nuevas funcionalidades:

* Consulta de Usuarios
* Consulta de Reservas

Ambas permiten:

* visualización completa
* aplicación de filtros
* exportación a Excel

---

## 🧑‍💼 Reporte de Usuarios

### 📍 Ruta

`/admin/reportes/usuarios`

### 🔎 Filtros disponibles 

* Búsqueda por:

  * nombre
  * apellido
  * email
* Estado:

  * Activo / Inactivo
* Clasificación:

  * GOOD / REGULAR / BAD / Sin clasificación
* Tag

### 📄 Datos mostrados

* Nombre y apellido
* Email
* Teléfono
* Rol
* Clasificación
* Estado
* Tags asociados
* Fecha de alta

### 📥 Exportación

* Archivo: `reporte_usuarios.xlsx`
* Respeta los filtros aplicados

---

## 📅 Reporte de Reservas

### 📍 Ruta

`/admin/reportes/reservas`

### 🔎 Filtros disponibles

* Usuario
* Espacio
* Estado

### 📄 Datos mostrados

* Fecha
* Hora inicio / fin
* Espacio
* Usuario
* Email
* Estado
* Cantidad de asistentes
* Propósito y notas (en Excel)

### 📥 Exportación

* Archivo: `reporte_reservas.xlsx`
* Respeta los filtros aplicados

---

## 🧭 Navegación

Se actualiza el menú lateral:

```
Reportes
  ├── Consulta usuarios
  └── Consulta reservas
```

* "Reportes" pasa a ser contenedor con submenú
* Soporte para menú colapsado/expandido
* Activación automática según ruta

---

## ⚙️ Backend

### `/api/users`

Se agregan filtros:

* `search`
* `status`
* `classify`
* `tagId`

Incluye:

* relación con tags (`userTags`)
* ordenamiento por apellido / nombre

---

### `/api/reservations`

Se agregan filtros:

* `userId`
* `spaceId`
* `status`

Incluye:

* relación con `user`
* relación con `space`
* ordenamiento por fecha descendente

---

## 💻 Frontend

### Nuevas pantallas

* `AdminUsersReport.jsx`
* `AdminReservationsReport.jsx`

Ubicación:

```
src/pages/reports/
```

### Funcionalidades

* filtros dinámicos
* consumo de endpoints con query params
* tablas con resultados
* exportación a Excel usando `xlsx`

---

## 📦 Dependencias

Se agrega:

```
xlsx
```

---

## 🧪 Validación

* ✅ Filtros funcionando correctamente
* ✅ Exportación respeta dataset filtrado
* ✅ Navegación consistente con sidebar colapsado
* ✅ Sin impacto en módulos existentes (usuarios / reservas)

---

## 🚀 Próximos pasos sugeridos

* Filtro por rango de fechas en reservas
* Paginación (para datasets grandes)
* Exportación backend (para datasets masivos)
* Nuevos reportes:

  * ingresos / liquidaciones
  * ocupación por espacio
  * uso por cliente

---

## 🏁 Resultado

Se incorpora un primer módulo de reportes funcional, reutilizable y extensible, alineado con la estructura actual del sistema.
