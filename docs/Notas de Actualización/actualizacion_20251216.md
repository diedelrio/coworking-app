# Actualización del Proyecto – 16/12/2025

## 📌 Resumen Ejecutivo
Durante esta actualización se completó con éxito la **migración total del backend desde SQLite a PostgreSQL (Neon)**, se dejó el proyecto **operativo en Render (frontend + backend)** y se resolvieron múltiples incidencias propias del paso a producción (variables de entorno, rutas, CORS, secuencias de IDs, etc.).

El proyecto queda ahora en un estado **estable, persistente y listo para crecimiento**, manteniendo un stack gratuito.

---

## 🗄️ Base de Datos

### 🔄 Migración SQLite → PostgreSQL (Neon)
- Se creó un proyecto en **Neon (PostgreSQL serverless)**.
- Se migró el esquema completo a PostgreSQL usando Prisma.
- Se desarrolló un **script custom de migración** para copiar datos desde SQLite a PostgreSQL.
- Se resolvió el problema típico de PostgreSQL con **secuencias desincronizadas** tras migraciones manuales.

### 🛠 Fix aplicado (secuencias)
```sql
SELECT setval(pg_get_serial_sequence('"Reservation"', 'id'), (SELECT MAX(id) FROM "Reservation"));
SELECT setval(pg_get_serial_sequence('"User"', 'id'), (SELECT MAX(id) FROM "User"));
SELECT setval(pg_get_serial_sequence('"Space"', 'id'), (SELECT MAX(id) FROM "Space"));
```

Esto evitó errores `P2002 Unique constraint failed on id` al crear nuevos registros.

---

## 📐 Prisma

### Schemas
- `schema.prisma` → PostgreSQL (producción)
- `schema.sqlite.prisma` → SQLite (solo para migración legacy)

### Decisiones
- Se eliminan las migraciones históricas de SQLite.
- Se mantiene **una única migración base** para PostgreSQL.
- Carpetas **NO versionadas**:
  - `generated/`
  - `.prisma/`
  - `.env`

---

## ⚙️ Backend (Node + Express)

### Deploy en Render
- Tipo de servicio: **Web Service**
- Root directory: `backend`

### Comandos configurados
**Build Command**
```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

**Start Command**
```bash
npm start
```

### Variables de entorno
- `DATABASE_URL` → PostgreSQL Neon
- `JWT_SECRET`
- Uso correcto de `process.env.PORT` (Render)

### Rutas
- Todas las rutas expuestas bajo `/api/*`
- Login correcto en `/api/auth/login`

---

## 🌐 Frontend (React + Vite)

### Deploy en Render
- Tipo de servicio: **Static Site**

### Configuración clave
- Se introduce el uso de `VITE_API_URL` para desacoplar frontend y backend.

#### Local
```env
VITE_API_URL=http://localhost:4000/api
```

#### Producción (Render)
```env
VITE_API_URL=https://<backend>.onrender.com/api
```

### Axios
- Se eliminan referencias hardcodeadas a `localhost`.
- El frontend ahora funciona correctamente en local y producción.

---

## 🔐 Autenticación

### Login
- Se corrigió el endpoint de login para que **devuelva JSON válido**:
```json
{
  "token": "...",
  "user": {
    "id": 1,
    "email": "...",
    "role": "ADMIN"
  }
}
```

- Se evita que el frontend lea propiedades de respuestas vacías.

---

## 🧪 Errores resueltos

- ❌ `ERR_NETWORK` por llamadas a `localhost` en producción
- ❌ `404 /auth/login` (ruta incorrecta)
- ❌ `200 OK` sin body en login
- ❌ `P2002 Unique constraint failed on id`
- ❌ Timeout de Render por puerto hardcodeado

---

## 📊 Estado actual del proyecto

✅ Backend operativo en Render
✅ Frontend operativo en Render
✅ Base de datos persistente (Neon)
✅ Autenticación funcional
✅ Creación de reservas funcional

---

## 🚀 Próximos pasos sugeridos

1. Limpieza definitiva de código legacy SQLite
2. Manejo más granular de errores (400 / 409 en reservas)
3. Seeds de datos demo
4. Hardening de CORS
5. Dominio propio + HTTPS
6. Backups / branching en Neon

---

📅 **Fecha**: 16/12/2025

✍️ **Estado**: Migración a producción completada con éxito

