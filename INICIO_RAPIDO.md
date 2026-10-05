# Inicio rápido · ISUP Aula Virtual en tu computadora

Guía para abrir el aula virtual en una computadora (Windows, Mac o Linux) sin conocimientos
técnicos. Todo funciona en tu equipo; no necesitas internet después de instalar Node.js.

## Requisito único: Node.js

1. Entra a **https://nodejs.org** y pulsa el botón verde **"LTS"** (versión 22 o superior).
2. Ejecuta el instalador con las opciones por defecto (Siguiente, Siguiente, Instalar).
3. Listo. Solo se hace una vez por computadora.

## Windows

1. Descarga el ZIP `isup-aula-virtual-local.zip`.
2. **Antes de extraerlo**: clic derecho sobre el ZIP → **Propiedades** → abajo, marca **Desbloquear** →
   Aceptar. (Quita la marca de "descargado de internet" y evita el aviso "Windows protegió su PC".)
3. Clic derecho sobre el ZIP → **Extraer todo…** → elige una carpeta sencilla, por ejemplo `C:\ISUP`.
   Evita el Escritorio o Documentos si están sincronizados con OneDrive.
4. Abre la carpeta extraída y haz **doble clic en `iniciar.bat`**.
   - Si aparece "Windows protegió su PC": pulsa **Más información → Ejecutar de todas formas**.
   - No lo ejecutes desde dentro del ZIP: primero extrae.
5. Se abre una ventana negra con el progreso y, a los pocos segundos, el navegador en
   `http://localhost:3000/login`. **Deja la ventana negra abierta** mientras uses el aula.

## Mac

1. Descarga y descomprime el ZIP (doble clic). Mueve la carpeta a Documentos o al Escritorio.
2. Abre la carpeta y haz **clic derecho sobre `iniciar.command` → Abrir → Abrir** (solo la primera vez;
   después basta el doble clic). Si macOS dice que "no se puede abrir porque es de un desarrollador no
   identificado", ve a **Ajustes del Sistema → Privacidad y seguridad** y pulsa **Abrir de todos modos**.
3. Se abre la Terminal con el progreso y luego el navegador en `http://localhost:3000/login`.
   Deja la Terminal abierta mientras uses el aula.

## Linux

1. Descomprime el ZIP y abre una terminal en la carpeta.
2. Ejecuta `./iniciar.sh` (si dice "permiso denegado": `chmod +x iniciar.sh iniciar.command` y repite).

## Primer ingreso

Usuarios de demostración (contraseña **`Isup2026!`** para todos):

| Rol | Correo |
|---|---|
| Estudiante | `estudiante@isup.edu.pe` |
| Docente | `docente@isup.edu.pe` |
| Administración | `admin@isup.edu.pe` |

En la pantalla de ingreso también hay tres botones de acceso rápido. Al entrar como estudiante aparece
el aviso de tratamiento de datos personales: márcalo y continúa. En `DEMO_ACCESOS.md` tienes un guion de
qué probar con cada rol.

## Detener y volver a abrir

- **Detener**: cierra la ventana negra (Windows) o la Terminal (Mac/Linux), o pulsa Ctrl+C en ella.
- **Volver a abrir**: doble clic otra vez en `iniciar.bat` / `iniciar.command`. Arranca en segundos y
  conserva todo lo que hiciste (la información se guarda en la carpeta `data`).
- Si haces doble clic con el aula ya abierta, solo se vuelve a abrir el navegador.

## Reiniciar la demo

Para volver a los datos de ejemplo originales (borra lo que hayas cambiado):

- Windows: en la carpeta, Shift + clic derecho → "Abrir ventana de PowerShell aquí" → `npm run seed`.
- Mac/Linux: en la terminal, dentro de la carpeta, `npm run seed`.

Hazlo con el aula cerrada.

## Entrar desde el celular (misma red Wi-Fi)

Abre el aula con la opción **red**:

- Windows: crea un acceso directo a `iniciar.bat`, edita sus propiedades y añade ` red` al final del
  campo Destino; o abre PowerShell en la carpeta y escribe `.\iniciar.bat red`.
- Mac/Linux: en la terminal, `./iniciar.sh --red`.

La ventana mostrará una dirección como `http://192.168.1.20:3000`; escríbela en el navegador del
celular. En Windows acepta el aviso del firewall marcando **redes privadas**. Sin la opción `red`, el
aula solo es accesible desde la propia computadora (más seguro).

## Problemas frecuentes

| Qué ves | Qué hacer |
|---|---|
| "No se encontró Node.js" | Instala Node.js desde https://nodejs.org (botón LTS) y vuelve a abrir. Si acabas de instalarlo, cierra la ventana y repite. |
| "Se necesita Node.js 22.13 o superior" | Tu Node.js es antiguo. Descarga la versión LTS actual e instálala encima. |
| "Este archivo se está ejecutando desde dentro del ZIP" | Extrae primero el ZIP completo y abre `iniciar.bat` desde la carpeta extraída. |
| "El puerto 3000 lo usa otro programa; se usará el 3001" | Normal: el aula se abre en el puerto indicado. |
| La ventana se abre y se cierra | Abre PowerShell en la carpeta y ejecuta `.\iniciar.bat` para ver el mensaje de error. |
| El navegador no se abre solo | Abre tú mismo `http://localhost:3000/login`. |
| "Windows protegió su PC" | Más información → Ejecutar de todas formas (o Desbloquear el ZIP antes de extraerlo). |
| Aviso de carpeta en OneDrive | Mueve la carpeta a `C:\ISUP` y vuelve a abrir. |
| Mac: "desarrollador no identificado" | Clic derecho → Abrir, o Ajustes → Privacidad y seguridad → Abrir de todos modos. |
| Olvidé la contraseña de un usuario | En la terminal, dentro de la carpeta: `node server/tools/reset-password.mjs correo@isup.edu.pe` |

## ¿Y para publicarla en internet?

Esta guía es para uso en una computadora. Para ponerla en un servidor con dominio propio y HTTPS,
sigue `DESPLIEGUE.md`.
