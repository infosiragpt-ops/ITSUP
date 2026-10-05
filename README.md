# ISUP · Aula Virtual

Plataforma del **Instituto Superior Universitario Privado (ISUP)**: sitio web institucional
y aula virtual (LMS) para carreras técnicas 100% virtuales, alineada a la normativa del
Ministerio de Educación del Perú para institutos de educación superior (Ley 30512, su
Reglamento y los Lineamientos Académicos Generales), a la Ley de Protección de Datos
Personales (29733) y a pautas de accesibilidad y seguridad. Ver [NORMATIVA.md](NORMATIVA.md).

## Cómo ejecutar en local

Solo necesitas **Node.js 22.13 o superior** (botón "LTS" de https://nodejs.org; hoy ofrece 24.x y sirve). Usa el SQLite
incluido en Node, así que no hay que instalar ninguna base de datos. Guía paso a paso para personas no técnicas:
[INICIO_RAPIDO.md](INICIO_RAPIDO.md). Paquete ZIP listo para usar (interfaz compilada y dependencias incluidas):
`bash scripts/empaquetar.sh` (ejecutar en Linux/macOS para conservar los permisos de los lanzadores).

**Opción 1 · doble clic**

- Windows: `iniciar.bat` (desbloquea y extrae el ZIP antes; si sale "Windows protegió su PC": Más información → Ejecutar de todas formas)
- macOS: `iniciar.command` (la primera vez macOS lo bloquea: Ajustes del Sistema → Privacidad y seguridad → Abrir de todos modos;
  en macOS 13/14 basta Control+clic → Abrir; alternativa: en Terminal `bash iniciar.sh`)
- Linux: `bash iniciar.sh`

El script instala las dependencias la primera vez (no hace falta con el ZIP), compila la interfaz si hace falta,
arranca el servidor y abre http://localhost:3000/login en el navegador. Por defecto solo escucha en esta computadora;
para entrar desde el celular en la misma red Wi-Fi usa `iniciar.bat red` (o `iniciar-red.bat`) / `./iniciar.sh --red`.
Para volver a la demo con fechas de hoy: `iniciar.bat reiniciar` / `./iniciar.sh --reiniciar` (con el aula cerrada).

**Opción 2 · terminal**

```bash
npm install
npm run build
npm start        # o: npm run local (hace todo lo anterior y abre el navegador)
```

Abre http://localhost:3000. La primera vez se crea la base de datos con datos de ejemplo.
Los accesos están en [DEMO_ACCESOS.md](DEMO_ACCESOS.md).

Para desarrollar con recarga automática: `npm run dev:server` (API en :3000) y
`npm run dev:client` (interfaz en :5173) en dos terminales.

## Qué incluye

**Sitio público** — inicio con carrusel, carreras y plan de estudios, admisión con formulario de
postulación (con consentimiento de datos), guía del aula virtual con la normativa académica,
política de privacidad y **verificación pública de documentos** (`/verificar`).

**Aula virtual**

| Estudiante | Docente | Administración |
|---|---|---|
| Inicio con clase en vivo, pendientes, alertas académicas y "continúa donde lo dejaste" | Sílabo estructurado (competencia, capacidades, indicadores, criterios ponderados) editable e imprimible | Gestión académica: periodos, actas e indicadores (aprobación, DPI, asistencia) |
| Sílabo, contenido por unidades con progreso | Unidades, lecturas, videos, archivos y enlaces | Reapertura de actas con motivo auditado |
| Entrega de tareas con rúbrica visible | Tareas con criterio de evaluación y rúbrica; calificación por criterios | Configuración institucional y normativa (nota mínima, límite de inasistencias, recuperación) |
| Evaluaciones con tiempo e intentos | Evaluaciones con corrección automática | Usuarios con DNI, bloqueo/desbloqueo, consentimientos |
| Asistencia por sesión, % y alertas de límite (DPI) | Registro de asistencia por sesión (P/T/F/J), automático al unirse | Cursos con módulo formativo, tipo, horas y créditos; matrícula |
| Calificaciones ponderadas, nota final, condición y recuperación | Registro de evaluación, acta de evaluación imprimible, cierre de acta | Programas con nivel formativo, título, créditos/horas y resolución |
| Récord académico por periodo, constancias y boletas verificables | Seguimiento con alerta temprana exportable | Auditoría completa exportable |
| Foros, sesiones en vivo, calendario, notificaciones, soporte | Anuncios, foros, sesiones y grabaciones | Postulantes, soporte, comunicados, calendario |

Además: aceptación versionada de la política de datos personales, buscador global (⌘K / Ctrl+K),
modo oscuro, impresión/PDF de sílabos, actas y documentos, diseño adaptable a celular.

## Reglas académicas implementadas

- Escala vigesimal (0–20); nota mínima aprobatoria **13**; la fracción 0.5 o más se redondea a favor del estudiante.
- Promedio ponderado por **criterios de evaluación** definidos en el sílabo (pesos que suman 100 %).
- **DPI**: más del 30 % de inasistencias injustificadas desaprueba la unidad didáctica.
- **Recuperación** para notas finales entre 10 y 12; la nota reemplaza a la final.
- **1 crédito = 16 h teóricas o 32 h prácticas**; mínimos por nivel formativo en los programas.
- **Acta de evaluación** por unidad didáctica con cierre, bloqueo y reapertura auditada.

Los umbrales se configuran desde Administración y pueden ajustarse por curso.

## Estructura

```
server/            API (Express) y base de datos (SQLite)
  db.js            esquema, migraciones, auditoría y configuración institucional
  academic.js      motor académico: promedios ponderados, asistencia, actas, récord, documentos
  seed.js          datos de demostración (npm run seed)
  routes/          auth, público, cursos, actividades, comunidad, académico, admin
client/src/        interfaz (React + Tailwind)
  pages/public/    sitio institucional, verificación de documentos, privacidad
  pages/app/       aula virtual (curso: sílabo, asistencia, calificaciones, acta, seguimiento)
  pages/admin/     panel de administración (gestión académica, auditoría)
data/              base de datos y archivos subidos (se crea sola)
```

## Imágenes

| Carpeta | Contenido | Origen |
|---|---|---|
| `client/public/img/carreras/` | Foto de cada carrera en 3 tamaños: `<carrera>.jpg` (portada), `-md` (tarjetas) y `-sm` (miniaturas) | Unsplash (licencia libre para uso comercial). Fotógrafos: Bluestonex, Vitaly Gariev, cornerstone accounting, Theme Photos, Mohammad Rahmani |
| `client/public/img/socios/` | Logos de Universidad Continental, Universidad César Vallejo y UPN | Sitios oficiales de Continental y UPN; Wikimedia Commons para UCV. Son marcas registradas de cada universidad |

La foto y el área de cada carrera se cambian en **Administración → Programas de estudio → Editar**
(campo "Foto de la carrera": una ruta de esta carpeta o un enlace). Sin foto, la web usa el color y el ícono de la carrera.

## Configuración

| Variable | Uso | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `HOST` | Interfaz de escucha (`127.0.0.1` solo esta computadora; el lanzador local usa `0.0.0.0` únicamente con `red`) | `0.0.0.0` |
| `DATA_DIR` | Carpeta de datos (base de datos y archivos subidos) | `data/` |
| `ISUP_SEED` | `minimal` crea solo la cuenta de administración; `demo` carga los datos de demostración | `demo` (en producción `minimal`) |
| `JWT_SECRET` | Firma de sesiones y huella de documentos (en producción el servidor no arranca sin él) | valor de desarrollo |
| `SESSION_HOURS` | Duración de la sesión | `168` (7 días) |
| `DB_PATH` | Ruta del archivo de base de datos | `DATA_DIR/isup.db` |
| `VITE_DEMO_MODE` | `false` al compilar (`npm run build`) oculta los accesos rápidos de demostración | `true` |
| `NODE_ENV` | `production` activa HSTS, exige `JWT_SECRET` y usa la semilla mínima por defecto | — |
| `TRUST_PROXY` | `1` acepta la IP real del cliente enviada por el proxy local (Caddy en 127.0.0.1) | — |
| `TRUST_PROXY` | `1` si se sirve detrás de un proxy (IP real en la auditoría) | — |

Los datos institucionales (nombre, código, resolución, director, secretaría académica) y las reglas
académicas se editan en **Administración → Gestión académica → Configuración**.
Datos de contacto (WhatsApp, correos) en `client/src/components/brand.jsx`.
Las sesiones en vivo usan salas de Jitsi Meet por defecto; cada docente puede pegar
su propio enlace de Zoom, Meet o Teams al programar una sesión.
