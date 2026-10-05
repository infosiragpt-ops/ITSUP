# Accesos de demostración · ISUP Aula Virtual

URL local: **http://localhost:3000** · Ingreso: **http://localhost:3000/login**

Todas las cuentas de demostración usan la misma contraseña: **`Isup2026!`**
(en la pantalla de ingreso también hay tres botones de "Acceso rápido de demostración").

| Rol | Correo | Código | Persona |
|---|---|---|---|
| Estudiante | `estudiante@isup.edu.pe` | `N00260001` | Valeria Mendoza Ríos · Desarrollo de Sistemas, ciclo 3 |
| Docente | `docente@isup.edu.pe` | `D00260001` | Carla Ramírez Vega · Desarrollo Web e IA Aplicada |
| Administración | `admin@isup.edu.pe` | `A00260001` | Lucía Paredes Montoya · Coordinación académica |

Se puede ingresar con el correo o con el código.

Otras cuentas útiles (misma contraseña):

- Docentes: `jorge.quispe@isup.edu.pe`, `mariana.torres@isup.edu.pe`, `daniel.flores@isup.edu.pe`, `rosa.chavez@isup.edu.pe`
- Estudiantes: `diego.castillo@isup.edu.pe`, `camila.rojas@isup.edu.pe` (Sistemas) · `renato.salazar@isup.edu.pe` (Administración)
- `sebastian.gutierrez@isup.edu.pe`: estudiante con más del 30 % de inasistencias (ver la alerta DPI)

## Qué probar en la demo

**Estudiante (Valeria)**
1. Al ingresar aparece el aviso de tratamiento de datos personales (Ley 29733): acéptalo para continuar.
2. Curso *Desarrollo Web Full Stack* → **Sílabo** (competencia, capacidades, criterios de evaluación; botón Imprimir/PDF).
3. **Asistencia**: porcentaje, faltas permitidas y registro por sesión.
4. **Calificaciones**: promedio ponderado por criterio, nota final proyectada y condición.
5. Menú **Calificaciones y récord** → *Historial* (periodo 2026-I cerrado con actas) y *Documentos*: emite una
   constancia de matrícula o boleta de notas y verifícala en `http://localhost:3000/verificar/<código>`.
6. Abre la Tarea 3: incluye una rúbrica de evaluación.

**Docente (Carla)**
1. Inicio: alerta temprana (estudiantes en riesgo) y sesiones sin asistencia registrada.
2. Curso → **Asistencia**: pulsa una fecha con punto naranja para registrar la asistencia de esa sesión.
3. **Registro de evaluación**: notas por criterio, asistencia, recuperación habilitada (10–12), condición;
   menú `⋯` para registrar recuperación/observaciones o retirar; **Vista previa del acta** y **Cerrar acta**.
4. **Seguimiento**: tabla de alerta temprana exportable.
5. **Sílabo → Editar sílabo**: criterios de evaluación con pesos que deben sumar 100 %.
6. Tareas → Nueva tarea: criterio de evaluación y rúbrica.

**Administración (Lucía)**
1. **Gestión académica**: actas e indicadores del periodo (tasa de aprobación, DPI, asistencia), reapertura de
   actas con motivo, periodos académicos (crear, activar, cerrar) y configuración institucional/normativa.
2. **Auditoría**: bitácora de accesos, notas, actas, usuarios y consentimientos (exportable).
3. **Cursos y matrícula**: módulo formativo, tipo de unidad didáctica, horas y créditos sugeridos, periodo.
4. **Programas de estudio**: nivel formativo, título, créditos/horas del plan y resolución.
5. **Usuarios**: DNI, desbloqueo de cuentas bloqueadas por intentos fallidos.

## Reiniciar la demo

```bash
npm run seed
```

Borra la base de datos y los archivos subidos, y vuelve a cargar los datos de ejemplo
(las fechas se calculan respecto al día en que se ejecuta, así siempre hay una clase
"en vivo", tareas por vencer, asistencia por registrar y un periodo anterior cerrado).

> Antes de publicar en internet: cambia las contraseñas, define `JWT_SECRET`,
> completa los datos institucionales en Gestión académica → Configuración y pon
> `DEMO_MODE = false` en `client/src/pages/public/Login.jsx`. Ver [NORMATIVA.md](NORMATIVA.md).
