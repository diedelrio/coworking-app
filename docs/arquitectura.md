# Arquitectura del proyecto

## 1. Tecnologías principales

### Backend
- Node.js + Express
- Prisma ORM
- SQLite
- JWT (jsonwebtoken)
- bcryptjs para hashing
- Dotenv para variables de entorno

### Frontend
- React + Vite
- Axios para llamadas a API
- React Router para navegación
- CSS simple + estilos inline + tarjetas "admin-card"

---

## 2. Estructura del backend

backend/
├── src/
│ ├── server.js
│ ├── prisma.js
│ ├── middlewares/
│ │ ├── auth.js
│ │ └── requireAdmin.js
│ ├── routes/
│ │ ├── auth.js
│ │ ├── spaces.js
│ │ ├── reservations.js
│ │ ├── users.js
│ │ └── calendar.js (para admin)
│ └── utils/
│ └── dateHelpers.js
├── prisma/
│ └── schema.prisma
└── .env


### Modelos principales
- **User**
- **Space**
- **Reservation**

### Endpoints clave
- `/api/auth/login`, `/register`
- `/api/spaces`
- `/api/reservations`, `/reservations/my`
- `/api/users`
- `/api/admin/calendar`

---

## 3. Estructura del frontend

frontend/
├── src/
│ ├── pages/
│ │ ├── Login.jsx
│ │ ├── Register.jsx
│ │ ├── DashboardUser.jsx
│ │ ├── UserReservations.jsx
│ │ ├── UserNewReservation.jsx
│ │ ├── DashboardAdmin.jsx
│ │ └── SpaceCalendar.jsx
│ ├── components/
│ │ ├── Header.jsx
│ │ └── Carousel.jsx
│ ├── api/axiosClient.js
│ ├── utils/auth.js
│ └── images/
├── index.css
└── main.jsx


---

## 4. Base de datos (Prisma + SQLite)

### Relations
- 1 usuario → muchas reservas  
- 1 espacio → muchas reservas  

### Campos importantes
- Reservation: date, startTime, endTime, status  
- User: name, lastName, email, phone, role  
- Space: name, capacity, type, active  

---

## 5. Flujo completo típico

1. Usuario inicia sesión  
2. Ve su dashboard con:
   - Próxima reserva
   - Última reserva
   - Banner / carousel  
3. Puede:
   - Ver mis reservas → calendario + tabla  
   - Agendar nueva reserva  
4. Admin:
   - Ve panel principal  
   - Gestiona espacios  
   - Gestiona usuarios  
   - Calendario por espacio  
   - Modo “Todos los espacios” → múltiples calendarios  
