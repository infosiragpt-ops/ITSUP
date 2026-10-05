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

## Reiniciar la demo

```bash
npm run seed
```

Borra la base de datos y los archivos subidos, y vuelve a cargar los datos de ejemplo
(las fechas se calculan respecto al día en que se ejecuta, así siempre hay una clase
"en vivo", tareas por vencer y notas publicadas).

> Antes de publicar en internet: cambia las contraseñas, define `JWT_SECRET`
> y pon `DEMO_MODE = false` en `client/src/pages/public/Login.jsx`.
