1. Estructura del backend (descrito)

backend/
├── prisma/
│ └── schema.prisma 						# Esquema Prisma: datasource (Neon/Postgres), generator, modelos (User, Space, Reservation, Setting, EmailTemplate, PasswordResetToken, etc.) y enums (Role, ReservationStatus, UserClassify…).
├── scripts/
│ └── migrate-sqlite-to-postgres.mjs 		# Script para migrar datos desde SQLite (dev inicial) a Postgres/Neon (producción), transformando formatos si aplica.
├── src/
│ ├── middlewares/
│ │ └── auth.js 							# Middleware de autenticación/autorización: valida JWT, inyecta req.user, y expone guards como authRequired y requireAdmin.
│ ├── routes/
│ │ ├── adminEmailTemplates.js 			# Endpoints admin para CRUD/gestión de plantillas de email (asunto/cuerpo/keys), vista previa y actualización en DB.
│ │ ├── auth.js 							# Endpoints de login/registro, emisión de JWT, “forgot password”/“reset password”, validación de token, cambio de contraseña.
│ │ ├── public.js 							# Endpoints públicos sin auth (ej. obtener settings públicos como horarios OFFICE_OPEN_HOUR / OFFICE_CLOSE_HOUR usados por el frontend).
│ │ ├── reservations.js 					# Endpoints de reservas: crear/editar/cancelar, listar (admin y usuario), pendientes (admin), aprobar/rechazar, validaciones de horario, solapes, límites por día/semana, capacidad, etc.
│ │ ├── settings.js 						# Endpoints admin para gestionar reglas de negocio (settings en DB), historial de cambios y claves operativas (horarios, step/min, límites, etc.).
│ │ ├── spaces.js 							# Endpoints de espacios: CRUD admin, activar/desactivar, obtener listados “activos” para reservas, detalle de espacio (tipo/capacidad).
│ │ └── users.js 							# Endpoints admin y usuario: gestión de usuarios, clasificación (GOOD/REGULAR/BAD), activación, perfil, listados y utilidades relacionadas.
│ ├── scripts/
│ │ ├── seedEmailForgotPassword.js 		# Seed inicial de template/setting relacionado a “forgot password” (plantilla y/o subject/body).
│ │ ├── seedEmailPasswordChange.js 		# Seed inicial de template/setting para “password changed” (aviso de seguridad).
│ │ ├── seedEmailTemplates.js 				# Seed masivo de EmailTemplates base (keys normalizadas) para eventos (pending/approved/rejected/limit exceeded/etc.).
│ │ └── seedHorarios.js 					# Seed de settings de horarios operativos (apertura/cierre), step, minDuration, y cualquier clave base que el validador requiere.
│ ├── services/
│ │ ├── alertNotificationService.js 		# Orquestador de notificaciones por eventos del negocio (reserva pending/approved/rejected, etc.). Resuelve template, arma variables y llama a emailService.
│ │ ├── emailService.js 					# Infra de envío: nodemailer (Gmail SMTP con App Password), configuración por env vars, transporte, “from”, manejo de errores y logs.
│ │ ├── emailTemplateService.js 			# Acceso/gestión de plantillas en DB: obtener por key, renderizado con variables (si aplica), fallback/validaciones de existencia.
│ │ ├── limitAlertService.js 				# Notificaciones cuando el usuario intenta exceder reglas (p.ej. solicitud de override al admin), arma payload y dispara email/alerta.
│ │ ├── reservationOccupancy.js 			# Cálculo de ocupación: cuenta reservas solapadas por espacio/slot; usado para capacidad en shared y disponibilidad en exclusivos.
│ │ ├── reservationStatus.js 				# Regla central para decidir status inicial de reserva (ACTIVE/PENDING/BLOCKED) según rol y clasificación del usuario.
│ │ ├── reservationValidationService.js 	# Reglas por tipo de espacio (FLEX/SHARED_TABLE/MEETING_ROOM/OFFICE/etc.): máximos por día/semana, solapes permitidos, max espacios distintos, etc.
│ │ ├── settingsService.js 				# Lectura de settings desde DB y helpers (getReservationRules, getSettingValue, normalización de tipos, defaults seguros).
│ │ └── spaceCapacity.js 					# Helpers de capacidad y tipo: detecta tipos compartidos vs exclusivos y calcula capacidad efectiva del espacio.
│ └── utils/
│ │ ├── bootstrapAdmin.js 					# Bootstrap al iniciar el server: crea el master admin si no existe, valida env y asegura estado mínimo del sistema.
│ │ └── reservationTimeValidator.js 		# Valida reglas temporales: horario apertura/cierre, step (grilla), duración mínima, etc. (leyendo settings en DB).
│ ├── prisma.js 							# Cliente Prisma singleton y configuración de conexión (usa DATABASE_URL).
│ ├── server.js 							# Entry point: Express app, middlewares globales, registro de rutas, health/logs, arranque del server y bootstrap inicial.
└── .env 									# Variables locales: DATABASE_URL, JWT_SECRET, SMTP_HOST/PORT/SECURE/USER/PASS, MAIL_FROM, etc. (no commitear).

2. Estructura del frontend (descrito)

frontend/
├── public/
│ ├── vite.svg 							# Asset default de Vite (puede quedar o eliminarse).
├── src/
│ ├── api/
│ │ ├── axiosClient.js 					# Cliente Axios central: baseURL, interceptores, inyección de token JWT, manejo de errores.
│ │ ├── settings.js 						# Helpers de frontend para leer settings públicos (horarios, step, etc.) y cachearlos si aplica.
│ ├── assets/
│ │ ├── dashdoard/ 						# Imágenes usadas en dashboard (cards/hero/background).
│ │ │ ├── 1.jpg
│ │ │ ├── 2.jpg
│ │ │ ├── 3.jpg
│ │ │ ├── 4.jpg
│ │ ├── react.svg 							# Asset default de React/Vite.
│ ├── components/
│ │ ├── AdminDashboardWidgets.jsx 			# Widgets del dashboard admin (KPIs, accesos rápidos, resumen de pendientes, etc.).
│ │ ├── AdminDayResourcesCalendar.jsx 		# Vista tipo calendario “día” para admin: recursos/espacios y reservas del día (operación).
│ │ ├── AdminUsersWithoutClassify.jsx 		# Componente para detectar/gestionar usuarios sin clasificación (acción admin).
│ │ ├── Header.jsx 						# Header superior: branding, usuario logueado, acciones rápidas (logout, navegación contextual).
│ │ ├── Layout.jsx 						# Layout general (principalmente admin): integra Navbar + contenido, maneja el estado collapsed, contenedores y estilos comunes.
│ │ ├── LimitOverrideModal.jsx 			# Modal para solicitar excepción/override cuando se exceden límites (flujo usuario → admin).
│ │ ├── Navbar.jsx 						# Sidebar/menú admin: links, estado colapsado, item activo por ruta, y consistencia visual.
│ │ ├── ProtectedRoute.jsx 				# Guard de rutas: exige auth y/o rol; redirige a login o a pantalla permitida.
│ │ ├── ReservationsCalendar.jsx 			# Render calendario día (time-grid): slots, reservas dibujadas en su rango horario, click para reservar/editar.
│ │ ├── ReservationsGrid.jsx 				# Tabla/grilla de reservas: filtros por estado, acciones (cancelar/editar), refresco y callbacks.
│ │ └── SettingHistoryModal.jsx 			# Modal para ver historial de cambios de settings/reglas (auditoría admin).
│ ├── images/
│ │ ├── calendar-illustration.png 			# Imagen usada en pantallas relacionadas a calendario/reservas.
│ │ └── logo.png 							# Logo de la app.
│ ├── pages/
│ │ ├── AdminUserProfile.jsx				# Perfil detallado de usuario (admin): datos, clasificación, actividad relacionada.
│ │ ├── AdminUsers.jsx 					# Listado de usuarios (admin): búsqueda/filtros y navegación a detalle.
│ │ ├── DashboardAdmin.jsx 				# Home admin: resumen operativo, accesos, alertas, pendientes.
│ │ ├── DashboardUser.jsx 					# Home usuario: accesos a reservar, mis reservas, resumen rápido.
│ │ ├── ForgotPassword.jsx 				# Solicitud de recuperación: envía email con token.
│ │ ├── Login.jsx 							# Login: credenciales, almacenamiento de token, redirección según rol.
│ │ ├── Register.jsx 						# Registro: alta de usuario y primera autenticación.
│ │ ├── ResetPassword.jsx 					# Reseteo con token: formulario de nueva contraseña y validación.
│ │ ├── SpaceCalendar.jsx 					# Calendario por espacio (vista admin o usuario según rutas): filtro por espacio + reservas en grilla.
│ │ ├── UserNewReservation.jsx 			# Formulario para crear/editar reserva: validaciones UI, mensajes, modal pending approval y modal override.
│ │ ├── UserProfile.jsx 					# Perfil de usuario (self-service): datos básicos y acciones permitidas.
│ │ └── UserReservations.jsx 				# “Mis reservas”: calendario + grilla, filtros y acciones (editar/cancelar).
│ ├── utils/
│ │ ├── auth.js 							# Helpers auth: get/set token, getCurrentUser (decode JWT), logout, protección.
│ │ └── reservationsCalendar.js 			# Helpers de calendario: armado de slots, normalización de fechas/horas, mapeo de reservas a eventos UI.
│ ├── App.css 								# Estilos de App (si aplica).
│ ├── App.jsx 								# Router principal: define rutas admin/user, protected routes, layout y navegación.
│ ├── index.css 							# Estilos base/globales (reset, tipografía, body).
│ ├── main.jsx 							# Entry React: monta App, providers, router, etc.
│ └── styles.css 							# Estilos principales del sistema (botones, cards, layout, grids, overrides).
├── index.html 							# HTML base de Vite.
└── README.md 								# Instrucciones del frontend: instalación, scripts, variables, build.