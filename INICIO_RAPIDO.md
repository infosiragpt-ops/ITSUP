# Inicio rápido · ISUP Aula Virtual en tu computadora

Guía para abrir el aula virtual en una computadora (Windows, Mac o Linux) sin conocimientos técnicos.
Todo funciona dentro de tu equipo: con el paquete ZIP no necesitas internet después de instalar Node.js,
y nadie fuera de tu Wi-Fi puede ver el aula.

## Requisito único: Node.js

1. Entra a **https://nodejs.org** y pulsa el botón verde **Download Node.js (LTS)**. Sirve cualquier versión
   22 o más nueva: si el botón dice 24.x (o superior), está bien.
2. Abre el archivo descargado (Windows: `node-v24…-x64.msi`; Mac: `node-v24….pkg`) y pulsa Siguiente/Continuar
   hasta terminar. Acepta "¿Quieres permitir que esta aplicación realice cambios?" o escribe tu contraseña del Mac.
   En Windows deja **desmarcada** la casilla "Automatically install the necessary tools" (no hace falta).
3. Si la computadora es del instituto y no te deja instalar, pide a Sistemas que instale Node.js LTS.
   No hace falta instalar nada más (ni base de datos ni otros programas).
4. Si Windows está "en modo S" no permite instalar Node.js: Configuración → Sistema → Activación →
   **Salir del modo S** (gratis; no se puede deshacer).

## Windows

1. Descarga `isup-aula-virtual-local.zip`. **Antes de extraerlo**: clic derecho sobre el ZIP → **Propiedades** →
   abajo, marca **Desbloquear** → Aceptar. (Quita la marca "descargado de internet": evita el aviso
   "Windows protegió su PC" y el bloqueo de Smart App Control.)
2. Clic derecho sobre el ZIP → **Extraer todo…** → elige una carpeta sencilla, por ejemplo `C:\ISUP`.
   Evita el Escritorio o Documentos si están sincronizados con OneDrive (la ventana negra te avisará si es el caso).
   No abras nada desde dentro del ZIP: da error.
3. Entra a la carpeta extraída y haz doble clic en **iniciar** (si ves las extensiones, es `iniciar.bat`, tipo
   "Archivo por lotes de Windows"). Ignora `iniciar.sh` e `iniciar.command`: son para Mac/Linux.
   - "Windows protegió su PC" → **Más información** → **Ejecutar de todas formas**.
   - "Advertencia de seguridad al abrir archivo" → **Ejecutar**.
   - "Smart App Control bloqueó una aplicación" (Windows 11 nuevos): borra la carpeta extraída, haz el paso 1
     (Desbloquear) sobre el ZIP y vuelve a extraer. Si persiste: Seguridad de Windows → Control de aplicaciones y
     navegador → Configuración de Smart App Control → **Desactivado** (no se puede volver a activar).
4. Se abre una ventana negra "ISUP Aula Virtual" con el progreso. Con el paquete ZIP no instala nada: en pocos
   segundos dice **"✔ Aula virtual lista"** (en Windows 10 se ve "OK Aula virtual lista") y el navegador se abre solo
   en `http://localhost:3000/login`. Si no se abre, ábrelo tú y escribe esa dirección.
5. **Deja la ventana negra abierta** mientras uses el aula (puedes minimizarla).

## Mac

1. Descarga el ZIP y haz doble clic para descomprimirlo. Deja la carpeta en **Descargas** o muévela a tu carpeta
   personal (por ejemplo una carpeta `ISUP` dentro de tu usuario). **No la pongas en Escritorio ni Documentos si usas
   iCloud Drive**: la base de datos puede dañarse al sincronizarse (la ventana te avisará).
2. Abre la carpeta y haz doble clic en **iniciar.command** (si Finder oculta las extensiones, es el "iniciar" con
   icono de Terminal; el `.sh` se abre en un editor de texto y no sirve para arrancar). macOS bloquea una vez los
   archivos descargados de internet:
   - **macOS 15 Sequoia o 26 Tahoe**: aviso «No se ha abierto "iniciar.command"… Apple no ha podido verificar…» →
     pulsa **Listo** (no "Mover a la papelera") → **Ajustes del Sistema → Privacidad y seguridad** → baja hasta
     *Seguridad* → **Abrir de todos modos** → contraseña o Touch ID → vuelve a hacer doble clic → **Abrir de todos
     modos**. Solo la primera vez.
   - **macOS 13 o 14**: aviso «…es de un desarrollador no identificado» → Aceptar → **Control + clic** sobre
     `iniciar.command` → **Abrir** → **Abrir**.
   - Si dice «no tienes los privilegios de acceso adecuados» o no ocurre nada: abre **Terminal** (Launchpad → Otros →
     Terminal), escribe `bash ` (con un espacio al final), arrastra el archivo `iniciar.sh` a la ventana de Terminal y
     pulsa Intro. Esta vía funciona siempre y no pide permisos de administrador.
3. Si pregunta «"Terminal" quiere acceder a los archivos de tu carpeta Descargas» → **Aceptar**. (Si lo negaste por
   error: Ajustes del Sistema → Privacidad y seguridad → Archivos y carpetas → Terminal.)
4. La ventana de Terminal muestra el progreso y, cuando dice **"✔ Aula virtual lista"**, el navegador se abre en
   `http://localhost:3000/login`. Deja la Terminal abierta mientras uses el aula.
5. No muevas `iniciar.command` solo al Escritorio ni al Dock: debe quedarse dentro de la carpeta. Si quieres un
   acceso directo: Control + clic → **Crear alias**.

## Linux

1. Instala Node.js 22 o superior (el paquete `nodejs` de Ubuntu/Debian suele ser antiguo; usa nvm, NodeSource o el
   `.tar.xz` de https://nodejs.org).
2. Descomprime el ZIP, clic derecho en la carpeta → **Abrir en un terminal** y escribe `bash iniciar.sh`
   (el doble clic sobre el archivo normalmente abre un editor o no muestra nada).
3. Cuando diga "✔ Aula virtual lista", abre `http://localhost:3000/login` si el navegador no se abrió solo.

## Primer ingreso

- Dirección: **http://localhost:3000/login** (si el puerto 3000 estaba ocupado, la ventana indica otro, por ejemplo
  3001, y el navegador se abre allí).
- Pulsa uno de los tres botones de **Acceso rápido de demostración**: Estudiante (Valeria), Docente (Carla) o
  Administración (Lucía). Entras sin escribir nada.
- O escribe el correo `estudiante@isup.edu.pe`, `docente@isup.edu.pe` o `admin@isup.edu.pe` (o los códigos
  N00260001, D00260001, A00260001) y la contraseña **`Isup2026!`** (con el signo de exclamación).
- A la estudiante le aparece el aviso de protección de datos (Ley 29733): márcalo y pulsa **Acepto y continúo**.
- 5 contraseñas mal seguidas bloquean esa cuenta 15 minutos: entra con otra cuenta o, como Administración →
  **Usuarios**, desbloquéala.
- Más cuentas y un recorrido sugerido por rol: `DEMO_ACCESOS.md`.

## Detener y volver a abrir

- **Detener**: cierra la ventana negra (Windows) o la de Terminal (Mac: ⌘W y, si pregunta, **Terminar**). También
  sirve Ctrl+C; en Windows, si pregunta "¿Desea terminar el trabajo por lotes (S/N)?", escribe `S` y Enter.
  El navegador mostrará "No se puede acceder a este sitio": es normal.
- **Volver a abrir**: doble clic otra vez en `iniciar` / `iniciar.command`. No instala nada; en segundos se abre el
  navegador. Todo lo que registraste (notas, asistencia, archivos) se conserva en la carpeta **`data`**, dentro de la
  carpeta del aula. La sesión del navegador dura 7 días.
- Si haces doble clic con el aula ya abierta, solo se vuelve a abrir el navegador (la ventana nueva se puede cerrar).

## Reiniciar la demo (datos de ejemplo con fechas de hoy)

Las fechas de la demo (clase "en vivo", tareas por vencer, asistencia pendiente) se calculan el día en que se cargan
los datos. Antes de una presentación, o para borrar lo que probaste:

1. Cierra la ventana del aula.
2. Windows: entra a la carpeta, escribe `cmd` en la barra de direcciones del Explorador, pulsa Enter y escribe
   `iniciar.bat reiniciar`. Mac/Linux: en Terminal escribe `bash `, arrastra `iniciar.sh`, añade ` --reiniciar` y
   pulsa Intro. Verás "Demo reiniciada" y luego "Base de datos vacía: cargando datos de demostración…".
   Es lo mismo que **borrar la carpeta `data`** (con el aula cerrada) y volver a abrir el aula con doble clic.
3. (Técnico) En una terminal dentro de la carpeta también sirve `npm run seed`, con el aula cerrada.

## Copia de seguridad y versiones nuevas

- **Respaldo**: cierra el aula y copia la carpeta **`data`** completa (contiene `isup.db`, `isup.db-wal`,
  `isup.db-shm` y `uploads/`) a un USB o a la nube. No la copies con el aula abierta: la base de datos podría quedar
  a medias.
- **Restaurar**: cierra el aula, reemplaza la carpeta `data` por la copia y vuelve a abrir.
- **Versión nueva** (otro ZIP): extráelo en una carpeta nueva, cierra el aula antigua, copia la carpeta `data` de la
  antigua a la nueva y abre la nueva con doble clic (la base de datos se actualiza sola). La versión instalada está en
  `VERSION.txt`.

## Entrar desde el celular (misma red Wi-Fi)

Por seguridad, el aula normal solo se ve en esta computadora. Para verla desde el celular ábrela con la opción **red**:

- Windows: doble clic en **iniciar-red** (`iniciar-red.bat`), o en cmd: `iniciar.bat red`.
- Mac/Linux: en Terminal, `bash iniciar.sh --red`.

1. Windows preguntará por el **Firewall** ("Node.js JavaScript Runtime"): marca **las dos casillas** (redes privadas y
   públicas) y pulsa **Permitir acceso**. Si pulsaste Cancelar: Seguridad de Windows → Firewall y protección de red →
   "Permitir que una aplicación pase a través del firewall" → Node.js JavaScript Runtime → marca Privada y Pública.
   En Mac, si pregunta si "node" acepta conexiones entrantes → **Permitir**.
2. En la ventana del aula busca la línea **"Desde celular: http://192.168.x.x:3000"**. Escríbela completa en Chrome o
   Safari del celular (mismo Wi-Fi, sin VPN). La dirección puede cambiar de un día a otro: vuelve a leerla.
3. Si no carga: en redes del instituto, hoteles o Wi-Fi de invitados los equipos suelen estar aislados entre sí;
   comparte internet desde el celular (zona Wi-Fi) y conecta la computadora a ese Wi-Fi.

## Problemas frecuentes

| Qué ves | Qué hacer |
|---|---|
| "No se encontró Node.js en este equipo" | Instala Node.js (arriba). Si ya lo instalaste, cierra la ventana y vuelve a hacer doble clic; si persiste, reinicia la computadora. |
| "Tu Node.js es antiguo" / "Se necesita Node.js 22.13 o superior" | Instala la versión LTS actual de nodejs.org encima de la antigua y reintenta. |
| "Este archivo se está ejecutando desde dentro del ZIP" / "Cannot find module …scripts\local.mjs" | Extrae todo el ZIP y abre `iniciar` desde la carpeta extraída (no desde el ZIP ni desde una copia suelta del archivo). |
| "El puerto 3000 lo usa otro programa; se usará el 3001" | Normal: el aula se abre en el puerto indicado. |
| "El aula virtual ya está abierta…" | Ya hay una ventana con el aula: usa el navegador y cierra la ventana nueva. |
| La ventana se abre y se cierra sin poder leer nada | Windows: escribe `cmd` en la barra de direcciones del Explorador (dentro de la carpeta) y ejecuta `iniciar.bat` para ver el mensaje. Mac: usa `bash` + arrastrar `iniciar.sh`. |
| "Windows protegió su PC" / "Smart App Control bloqueó…" | Ver la sección Windows (Desbloquear el ZIP antes de extraerlo). |
| "Instalando dependencias falló" (solo si no usas el ZIP) | Falta internet o la red bloquea descargas: conéctate a otra red (zona Wi-Fi del celular) y vuelve a abrir. |
| El navegador no se abre solo | Abre Chrome/Edge/Safari y escribe `http://localhost:3000/login`. |
| "No se puede acceder a este sitio" / "localhost rechazó la conexión" | La ventana del aula está cerrada o aún no dice "lista". Ábrela con doble clic y espera. |
| "El servidor todavía no responde" | Espera unos segundos y recarga el navegador; si sigue igual, cierra y vuelve a abrir. Si hay antivirus, permite `node.exe`. |
| Aviso de carpeta en OneDrive o iCloud | Mueve la carpeta a `C:\ISUP` (Windows) o a tu carpeta personal (Mac) y vuelve a abrir. |
| Mac: "Apple no pudo verificar…", "desarrollador no identificado", "privilegios de acceso" | Ver la sección Mac (Abrir de todos modos, o `bash` + arrastrar `iniciar.sh`). |
| Mac: la ventana dice "[Proceso completado]" | Es normal cuando el aula termina; ciérrala con ⌘W. |
| "Cuenta bloqueada temporalmente" | Espera 15 minutos o entra con otra cuenta; Administración → Usuarios la desbloquea. |
| Las fechas de la demo se ven antiguas | Reinicia la demo (sección anterior). |
| Desde el celular no carga | Abre con la opción red, misma Wi-Fi sin VPN, firewall permitido, dirección 192.168… (ver "Entrar desde el celular"). |
| Olvidé la contraseña de un usuario | Entra como Administración → **Usuarios** → edita el usuario → "Nueva contraseña". Si es la de Administración: en una terminal, dentro de la carpeta, `node server/tools/reset-password.mjs admin@isup.edu.pe` (o reinicia la demo). |
| Otro error | Toma una foto de la ventana con el mensaje, cierra, intenta una vez más y, si se repite, envía la foto a quien te entregó el programa. |

## ¿Y para publicarla en internet?

Esta guía es para uso en una computadora. Para ponerla en un servidor con dominio propio y HTTPS,
sigue `DESPLIEGUE.md`.
