# Gestión de Pólizas de Seguros de Inmuebles e Inquilinos

Aplicación web completa para gestionar pólizas de seguro de inmuebles e inquilinos, con alertas automáticas por email cuando las pólizas están próximas a vencer.

## Stack tecnológico

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Base de datos**: PostgreSQL
- **Emails**: Gmail SMTP via Nodemailer
- **Despliegue**: Render.com

---

## Instalación local

### Requisitos previos

- Node.js >= 18
- PostgreSQL (local o remoto)
- Cuenta de Gmail con contraseña de aplicación

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd seguros-inmuebles
```

### 2. Configurar el backend

```bash
cd backend
npm install
cp .env.example .env
```

Edita el archivo `.env` con tus valores (ver sección de variables de entorno).

### 3. Configurar el frontend

```bash
cd ../frontend
npm install
```

### 4. Iniciar en desarrollo

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

**Credenciales por defecto:**
- Email: `admin@seguros.com`
- Contraseña: `Admin1234!`

> ⚠️ Cambia la contraseña del admin tras el primer acceso.

---

## Variables de entorno

Crea el archivo `backend/.env` con las siguientes variables:

```env
# Base de datos PostgreSQL
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/seguros_inmuebles

# JWT (usa una cadena larga y aleatoria)
JWT_SECRET=tu_secreto_jwt_muy_largo_y_seguro_aqui

# Gmail SMTP
GMAIL_USER=tu_correo@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Email del administrador que recibirá las alertas
ADMIN_EMAIL=admin@tudominio.com

# URL del frontend (para CORS)
FRONTEND_URL=http://localhost:5173

# Puerto
PORT=3000

# Entorno
NODE_ENV=development
```

---

## Cómo obtener la contraseña de aplicación de Gmail

Las contraseñas de aplicación permiten que apps de terceros accedan a tu cuenta de Gmail sin usar tu contraseña principal.

1. Ve a tu cuenta de Google: [myaccount.google.com](https://myaccount.google.com)
2. En el menú lateral, selecciona **Seguridad**
3. Asegúrate de tener la **Verificación en dos pasos** activada
4. Busca **Contraseñas de aplicaciones** (puede aparecer en "¿Cómo inicias sesión en Google?")
5. En el desplegable "Seleccionar aplicación", elige **Otra (nombre personalizado)**
6. Escribe un nombre, por ejemplo: `Gestión Seguros`
7. Haz clic en **Generar**
8. Copia la contraseña de 16 caracteres generada (con espacios)
9. Pégala en `GMAIL_APP_PASSWORD` en tu archivo `.env`

> La contraseña de aplicación tiene el formato: `xxxx xxxx xxxx xxxx`

---

## Despliegue en Render

### Paso 1: Preparar el repositorio

Asegúrate de que tu código está en un repositorio de GitHub, GitLab o Bitbucket.

Crea el archivo `.gitignore` en la raíz:
```
node_modules/
.env
backend/uploads/
```

### Paso 2: Crear cuenta en Render

Regístrate en [render.com](https://render.com) y conecta tu repositorio.

### Paso 3: Desplegar con render.yaml (automático)

Render detectará automáticamente el archivo `render.yaml` y configurará:
- Un **Web Service** para el backend (que también sirve el frontend)
- Una **base de datos PostgreSQL** gratuita

1. Ve a [dashboard.render.com](https://dashboard.render.com)
2. Haz clic en **New** → **Blueprint**
3. Selecciona tu repositorio
4. Render leerá el `render.yaml` y creará los servicios automáticamente

### Paso 4: Configurar las variables de entorno secretas

En el panel de Render, ve al Web Service → **Environment** y añade:

| Variable | Valor |
|----------|-------|
| `GMAIL_USER` | tu_correo@gmail.com |
| `GMAIL_APP_PASSWORD` | xxxx xxxx xxxx xxxx |
| `ADMIN_EMAIL` | email_admin@tudominio.com |
| `FRONTEND_URL` | https://tu-app.onrender.com |

### Paso 5: Primer despliegue

El proceso de build ejecuta automáticamente:
1. Instala dependencias del frontend y construye los estáticos
2. Instala dependencias del backend
3. Al arrancar, crea las tablas en la base de datos y el usuario admin

El primer despliegue puede tardar 5-10 minutos.

### Paso 6: Acceder a la aplicación

La URL de tu aplicación aparecerá en el panel de Render una vez completado el despliegue.

---

## Estructura del proyecto

```
seguros-inmuebles/
├── backend/
│   ├── server.js                 # Punto de entrada
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── config/
│       │   └── database.js       # Conexión y creación de tablas
│       ├── middleware/
│       │   ├── auth.js           # Verificación JWT
│       │   └── upload.js         # Multer para PDFs
│       ├── routes/
│       │   ├── auth.js
│       │   ├── inmuebles.js
│       │   ├── polizas.js
│       │   ├── inquilinos.js
│       │   ├── polizasInquilinos.js
│       │   ├── alertas.js
│       │   ├── upload.js
│       │   └── usuarios.js
│       ├── services/
│       │   └── emailService.js   # Envío de emails con Nodemailer
│       └── cron/
│           └── alertasCron.js    # Tarea programada diaria (9:00 AM)
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx               # Router principal
│       ├── main.jsx
│       ├── index.css
│       ├── api/
│       │   └── index.js          # Cliente Axios + todas las llamadas API
│       ├── context/
│       │   └── AuthContext.jsx   # Contexto de autenticación
│       ├── components/
│       │   ├── Layout.jsx        # Barra lateral + estructura
│       │   ├── Modal.jsx         # Modal reutilizable
│       │   ├── Tabla.jsx         # Tabla con paginación
│       │   └── UploadPDF.jsx     # Subida de documentos
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Inmuebles.jsx
│           ├── Polizas.jsx
│           ├── Inquilinos.jsx
│           ├── PolizasInquilinos.jsx
│           ├── Alertas.jsx
│           └── Usuarios.jsx
│
├── render.yaml                   # Configuración de despliegue en Render
└── README.md
```

---

## Funcionalidades

- **Login seguro** con JWT (expiración 24h)
- **Gestión de inmuebles**: alta, edición, eliminación con confirmación
- **Pólizas de inmuebles**: filtrado por inmueble y tipo, badge de estado (vigente/próxima/vencida), subida de PDF
- **Gestión de inquilinos**: vinculados a inmuebles
- **Pólizas de inquilinos**: igual que pólizas de inmuebles
- **Sistema de alertas**: vista dedicada con clasificación por urgencia (urgente/muy próximo/próximo)
- **Email automático** diario a las 9:00 AM con lista de pólizas próximas a vencer
- **Gestión de usuarios** (solo admins): crear, editar, eliminar usuarios del equipo
- **Dashboard** con resumen general y tarjetas de navegación rápida

---

## Backup de la base de datos

### Ejecutar backup manual

Desde la carpeta `backend/`:

```bash
cd ~/gestion-polizas/seguros-inmuebles/backend
npm run backup
```

El backup se guarda en `~/gestion-polizas/backups/` con el nombre `backup_YYYY-MM-DD_HHhMM.json`.

### Restaurar desde un backup

```bash
cd ~/gestion-polizas/seguros-inmuebles/backend
npm run restore -- --file ~/gestion-polizas/backups/backup_2026-03-07_10h30.json
```

> ⚠️ La restauración **borrará y reemplazará** todos los datos actuales. Se pedirá confirmación escribiendo `RESTAURAR`.

### Backup automático con cron (opcional)

Para ejecutar un backup diario a las 2:00 AM, añade esta línea con `crontab -e`:

```
0 2 * * * cd ~/gestion-polizas/seguros-inmuebles/backend && npm run backup >> ~/gestion-polizas/backups/cron.log 2>&1
```

---

## Licencia

MIT
