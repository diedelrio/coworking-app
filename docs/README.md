# 🏢 Coworking Sinergia – Sistema de Reservas  
### Gestión completa de espacios, usuarios y reservas para coworking

![Banner](./docs/banner.png)

Coworking Sinergia es una aplicación full-stack creada para gestionar reservas de espacios de trabajo, salas de reuniones, puestos fijos/flex y disponibilidad por día, semana o mes.

El sistema soporta dos perfiles:
- **Cliente:** puede crear, cancelar y consultar reservas.
- **Administrador:** puede gestionar espacios, usuarios, ver calendarios completos y bloquear franjas.

El proyecto está construido en **React + Node.js + Prisma + SQLite**, con autenticación JWT y una interfaz moderna.

---

## 🚀 Características principales

### 👨‍💼 Cliente
- Registro e inicio de sesión con JWT  
- Dashboard con mensaje dinámico  
- Carrusel automático  
- Calendario mensual con días destacados  
- Modal detallado por día  
- Crear reservas con franjas horarias  
- Cancelar reservas  
- Ver historial  

### 🛠️ Administrador
- Panel de administración  
- Gestión de usuarios  
- Gestión de espacios  
- Calendario por espacio (día, semana, mes)  
- Modo “Todos los espacios” con múltiples calendarios  
- Bloqueo de franjas  
- Ver reservas activas/canceladas  

---

## 🧱 Arquitectura

```
frontend/        → React + Vite
backend/         → Node.js + Express
prisma/          → ORM + Base de datos SQLite
docs/            → Imágenes y documentación
```

---

## 🗄️ Base de datos (Prisma)

### Modelos principales

```prisma
model User {
  id         Int           @id @default(autoincrement())
  name       String
  lastName   String
  email      String  @unique
  phone      String?
  password   String
  role       String  @default("CLIENT")
  reservations Reservation[]
}

model Space {
  id         Int           @id @default(autoincrement())
  name       String
  type       String
  capacity   Int
  active     Boolean @default(true)
  reservations Reservation[]
}

model Reservation {
  id        Int     @id @default(autoincrement())
  date      DateTime
  startTime DateTime
  endTime   DateTime
  status    String  @default("ACTIVE")
  userId    Int
  spaceId   Int
}
```

---

## ⚙️ Instalación

### Requisitos
- Node.js ≥ 18  
- npm o yarn  
- Git  

---

## Paso 1 — Clonar

```bash
git clone https://github.com/tuusuario/coworking-sinergia.git
cd coworking-sinergia
```

---

## Paso 2 — Instalar dependencias

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd ../frontend
npm install
```

---

## Paso 3 — Variables de entorno

Crear `/backend/.env`:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET=tu_secreto_seguro
PORT=4000
```

---

## Paso 4 — Migraciones

```bash
cd backend
npx prisma migrate dev --name init
```

---

## Paso 5 — Ejecutar

### Backend
```bash
npm run dev
```

### Frontend
```bash
cd frontend
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000  

---

## 📸 Capturas

_Reemplazar con imágenes reales._

---

## 🧭 Roadmap

- Exportar reservas  
- Recuperar contraseña  
- Reglas avanzadas  
- Dashboard analítico  
- App móvil  
- Integración Google Calendar  

---

## 📄 Licencia

MIT License.

---

