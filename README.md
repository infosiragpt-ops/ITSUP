# ISUP · Aula Virtual

Plataforma del **Instituto Superior Universitario Privado (ISUP)**: sitio web institucional
y aula virtual (LMS) para carreras técnicas 100% virtuales.

## Cómo ejecutar en local

Requiere Node.js 22.5 o superior (usa el SQLite incluido en Node; no hay que instalar base de datos).

```bash
npm install
npm run build
npm start
```

Abre http://localhost:3000. La primera vez se crea la base de datos con datos de ejemplo.
Los accesos están en [DEMO_ACCESOS.md](DEMO_ACCESOS.md).

Para desarrollar con recarga automática: `npm run dev:server` (API en :3000) y
`npm run dev:client` (interfaz en :5173) en dos terminales.

## Qué incluye

**Sitio público** — inicio con carrusel de 4 diapositivas, carreras y plan de estudios,
admisión con formulario de postulación, guía del aula virtual (requisitos, fechas, servicios).

**Aula virtual**

| Estudiante | Docente | Administración |
|---|---|---|
| Inicio con clase en vivo, pendientes y "continúa donde lo dejaste" | Crear unidades, lecturas, videos, archivos y enlaces | Usuarios (crear, editar, desactivar) |
| Contenido por unidades con progreso | Tareas y calificación con retroalimentación | Cursos, docentes y matrícula |
| Entrega de tareas con archivos | Evaluaciones con corrección automática | Carreras y plan de estudios |
| Evaluaciones con tiempo e intentos | Registro de notas y exportación CSV | Postulantes de admisión |
| Foros, sesiones en vivo, calendario | Sesiones en vivo y grabaciones | Soporte, comunicados y calendario |
| Calificaciones (escala 0–20), notificaciones, soporte | Anuncios y foros | Panel con indicadores |

Además: buscador global (⌘K / Ctrl+K), modo oscuro, diseño adaptable a celular.

## Estructura

```
server/            API (Express) y base de datos (SQLite)
  db.js            esquema y acceso a datos
  seed.js          datos de demostración (npm run seed)
  routes/          auth, público, cursos, actividades, comunidad, admin
client/src/        interfaz (React + Tailwind)
  pages/public/    sitio institucional
  pages/app/       aula virtual
  pages/admin/     panel de administración
data/              base de datos y archivos subidos (se crea sola)
```

## Imágenes

| Carpeta | Contenido | Origen |
|---|---|---|
| `client/public/img/carreras/` | Foto de cada carrera en 3 tamaños: `<carrera>.jpg` (portada), `-md` (tarjetas) y `-sm` (miniaturas) | Unsplash (licencia libre para uso comercial). Fotógrafos: Bluestonex, Vitaly Gariev, cornerstone accounting, Theme Photos, Mohammad Rahmani |
| `client/public/img/socios/` | Logos de Universidad Continental, Universidad César Vallejo y UPN | Sitios oficiales de Continental y UPN; Wikimedia Commons para UCV. Son marcas registradas de cada universidad |

La foto y el área de cada carrera se cambian en **Administración → Carreras → Editar**
(campo "Foto de la carrera": una ruta de esta carpeta o un enlace). Sin foto, la web usa el color y el ícono de la carrera.

## Configuración

| Variable | Uso | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `JWT_SECRET` | Firma de sesiones (obligatorio cambiar en producción) | valor de desarrollo |
| `DB_PATH` | Ruta del archivo de base de datos | `data/isup.db` |

Datos de contacto (WhatsApp, correos) en `client/src/components/brand.jsx`.
Las sesiones en vivo usan salas de Jitsi Meet por defecto; cada docente puede pegar
su propio enlace de Zoom, Meet o Teams al programar una sesión.
