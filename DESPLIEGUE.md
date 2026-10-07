# Puesta en producción · VPS Hostinger (Ubuntu 24.04) + dominio en GoDaddy

Guía paso a paso para dejar el Aula Virtual funcionando en **https://tepsup.com** (o en
**https://aula.tepsup.com**) con certificado HTTPS, arranque automático, firewall, autocomprobación y
copias de seguridad diarias verificadas. Tiempo estimado: 20 minutos, más la propagación del DNS.

## Antes de empezar

- VPS en Hostinger con **Ubuntu 24.04 LTS** (plan KVM 2 recomendado) y su contraseña de root.
- Acceso al panel de GoDaddy del dominio **tepsup.com**.
- Un correo para la cuenta de administración (por ejemplo `admin@tepsup.com`). Se usa como **usuario de
  ingreso** y como contacto de la cuenta de certificados; **no necesita existir como buzón** (hoy
  tepsup.com no tiene correo configurado). Si prefieres un contacto real para los certificados, añade
  `ACME_EMAIL=tu@gmail.com` delante del comando del Paso 3.
- **El día anterior (opcional, recomendable):** en GoDaddy → DNS → Registros DNS, edita el registro
  `A @` cambiando SOLO el TTL a **Personalizado → 600** (deja el dato como está) y guarda. Así, cuando
  cambies la IP, el mundo verá el nuevo valor en unos 10 minutos en vez de hasta 1 hora. Si GoDaddy no
  te deja editar ese registro, sáltate este paso: el cambio tardará hasta 1 hora, nada más.

## ¿Raíz o subdominio? Elige antes de empezar

Hoy tepsup.com muestra un sitio hecho con el creador de webs de GoDaddy (el registro `A @` dice
"WebsiteBuilder Site"). Tienes dos opciones:

| | **Opción A · https://tepsup.com** | **Opción B · https://aula.tepsup.com** |
|---|---|---|
| Web actual de GoDaddy | Deja de verse (la sustituye el aula) | Sigue funcionando en tepsup.com y www.tepsup.com |
| Registros en GoDaddy | Editar `A @` (puede estar bloqueado por el creador de webs) | Añadir un registro nuevo; no se toca nada existente |
| Interrupción | Minutos, mientras propaga el DNS | Ninguna |
| Comando del instalador | `bash -s -- tepsup.com admin@tepsup.com` | `WWW=0 bash -s -- aula.tepsup.com admin@tepsup.com` |

Si quieres conservar la web institucional actual, elige la **Opción B** y enlaza el aula desde el menú
de esa web. Si la web de GoDaddy ya no se usa, la **Opción A** da la dirección más corta.

## Paso 1 · Obtener la IP del VPS (Hostinger)

1. Entra en **hpanel.hostinger.com → VPS → Administrar** (tu servidor con Ubuntu 24.04).
2. En **Información general** está la **dirección IPv4** (formato `187.xx.xx.xx`): cópiala. Ignora la
   IPv6 (la línea larga con `:`); el aula no la necesita.
3. Para abrir una consola sin instalar nada: botón **Terminal** (Terminal del navegador) en esa misma
   pantalla. Si pide usuario, escribe `root` y la contraseña del VPS.
4. **Firewall de hPanel (VPS → Seguridad → Firewall)**: déjalo como está (desactivado). Si algún día
   activas uno, añade antes reglas **Aceptar / TCP** para los puertos **22**, **80** y **443**; un
   firewall de hPanel activo sin esas reglas bloquea el aula y la emisión de certificados.

## Paso 2 · Apuntar el dominio al VPS (GoDaddy)

Entra en **GoDaddy → Dominios → tepsup.com → pestaña DNS → Registros DNS**.

**Opción A (tepsup.com):**

| Acción | Tipo | Nombre | Datos | TTL |
|---|---|---|---|---|
| **Editar** el registro existente | A | `@` | la IP del VPS (sustituye "WebsiteBuilder Site") | 600 segundos |
| **Mantener** | CNAME | `www` | `tepsup.com.` | 1 hora |

Si el lápiz de **Editar** del registro `A @` está deshabilitado o GoDaddy avisa de que el registro lo
gestiona tu sitio web, primero desconecta el dominio del creador de webs: en la misma página de
Registros DNS, si aparece el nombre de tu sitio con un botón **Quitar conexión / Eliminar**, púlsalo; o
ve a **Mis productos → Websites + Marketing → tu sitio → Configuración → Dominio** y desconecta
tepsup.com. Después el registro `A @` se puede editar normalmente.

**Opción B (aula.tepsup.com):** pulsa **Añadir un registro nuevo** y no toques nada más.

| Tipo | Nombre | Datos | TTL |
|---|---|---|---|
| A | `aula` | la IP del VPS | 600 segundos |

En ningún caso toques los registros NS, SOA, `_domainconnect` ni el TXT `_dmarc`. No crees registros
AAAA salvo que sean la IPv6 del propio VPS.

> Opción A: al cambiar el registro A, el sitio del creador de webs dejará de mostrarse en tepsup.com
> y en su lugar aparecerá el aula virtual. Si en ese sitio hay contenido que quieras conservar,
> cópialo antes.

La propagación suele tardar entre 5 y 30 minutos (hasta 1 hora si el TTL anterior era de 1 hora).
Compruébala en https://dnschecker.org buscando el nombre elegido (tipo A): la mayoría de ubicaciones
deben mostrar la IP del VPS. **Espera a que esto ocurra antes del Paso 3**: si instalas antes, Caddy
pedirá certificados a un servidor que aún no es el tuyo y Let's Encrypt lo penaliza durante una hora
(el instalador espera por su cuenta hasta 5 minutos, pero no más).

## Paso 3 · Instalar el aula (un solo comando)

Abre la Terminal del navegador (Paso 1) o `ssh root@IP-DEL-VPS`. Pega el comando de tu opción y pulsa Enter:

```bash
# Opción A · https://tepsup.com
curl -fsSL https://raw.githubusercontent.com/infosiragpt-ops/ITSUP/claude/eager-cannon-kh8czm/deploy/install-ubuntu.sh | BRANCH=claude/eager-cannon-kh8czm bash -s -- tepsup.com admin@tepsup.com
```

```bash
# Opción B · https://aula.tepsup.com
curl -fsSL https://raw.githubusercontent.com/infosiragpt-ops/ITSUP/claude/eager-cannon-kh8czm/deploy/install-ubuntu.sh | BRANCH=claude/eager-cannon-kh8czm WWW=0 bash -s -- aula.tepsup.com admin@tepsup.com
```

Cuando el PR esté fusionado a `main`, el mismo comando funciona con `main` en los dos sitios. El
instalador se niega a desplegar una rama que no incluya el modo producción (carpeta `deploy/`), así
que nunca publicará la versión de demostración por error.

Para que el nombre de la institución aparezca ya configurado, añade variables delante de `BRANCH=`:

```bash
… | INSTITUTION="Instituto de Educación Superior Tecnológico Privado TEPSUP" SHORT="TEPSUP" BRANCH=claude/eager-cannon-kh8czm bash -s -- tepsup.com admin@tepsup.com
```

El instalador tarda unos minutos y al final muestra:

- la dirección del aula (`https://tepsup.com/login`; `www.tepsup.com` redirige allí),
- el **correo y la contraseña de la cuenta de administración** (guárdalos; quedan en
  `/var/lib/isup/ADMIN_INICIAL.txt` y ese archivo se borra solo cuando cambies la contraseña),
- un aviso si el dominio aún no apunta al servidor.

Volver a ejecutar el instalador es seguro: actualiza el código de la rama ya desplegada y conserva
datos, configuración y secretos. Si un paso falla, corrige la causa y vuelve a lanzarlo.

## Paso 3b · Comprobar que todo quedó bien

**Desde tu computadora** (Windows: PowerShell; Mac/Linux: Terminal), con el nombre que elegiste:

```
nslookup tepsup.com 8.8.8.8          # debe devolver la IP del VPS
curl -I http://tepsup.com            # esperado: HTTP/1.1 308 Permanent Redirect  Location: https://tepsup.com/
curl -I https://tepsup.com           # esperado: HTTP/2 200 … strict-transport-security
curl https://tepsup.com/api/health   # esperado: {"ok":true,"name":"ISUP Aula Virtual",...}
```

**En el servidor**:

```
systemctl status isup caddy fail2ban --no-pager      # todo "active"
systemctl list-timers 'isup-*' --no-pager             # copias diarias y autocomprobación programadas
journalctl -u caddy -n 50 --no-pager | grep -E 'certificate obtained|error'
```

Debe aparecer `certificate obtained successfully` para cada nombre. Significado de los errores de Caddy:

| Mensaje en `journalctl -u caddy` | Causa | Qué hacer |
|---|---|---|
| `Invalid response … 404` | El DNS aún apunta a GoDaddy | Espera la propagación y `sudo systemctl reload caddy` |
| `NXDOMAIN` | El nombre no existe en el DNS | Revisa el registro A (o CNAME `www`) en GoDaddy |
| `Timeout during connect (likely firewall problem)` | Puerto 80/443 cerrado (firewall de hPanel) | Permite 80 y 443 en hPanel |
| `too many failed authorizations recently` | Límite de Let's Encrypt por intentos fallidos | Espera 60 minutos y `sudo systemctl restart caddy` |
| `certificate obtained successfully` | Todo bien | — |

## Paso 4 · Primer ingreso y configuración

1. Entra en `https://tepsup.com/login` con la cuenta de administración.
2. **Mi perfil → Cambiar contraseña** (esto invalida la contraseña inicial y borra el archivo que la guardaba).
3. **Gestión académica → Configuración**: nombre de la institución, código, resolución de
   licenciamiento, dirección, director(a), secretaría académica y correo de protección de datos.
4. **Gestión académica → Periodos**: revisa las fechas del periodo activo.
5. **Programas de estudio**, **Cursos y matrícula** y **Usuarios**: carga la oferta real. Al crear un
   usuario sin contraseña, el sistema genera una temporal que se muestra una sola vez.
6. Sube y descarga un archivo en un curso de prueba para confirmar que la carpeta de datos funciona.

En producción no se cargan datos de demostración ni se muestran los botones de acceso rápido.

## Despliegue automático

El servidor sigue la rama desplegada por sí solo: cada 5 minutos `isup-autoupdate.timer` consulta GitHub y, si hay
commits nuevos, hace copia de seguridad, actualiza, compila, reinicia, comprueba que el aula responde y ejecuta las
tareas posteriores (`deploy/post-update.sh`, por ejemplo el catálogo de carreras). Si el instalador cambió, lo vuelve a
ejecutar con los datos guardados en `/etc/isup/isup.env`. Si un despliegue falla, restaura la versión anterior y no
vuelve a intentar ese commit hasta que aparezca otro.

| Qué | Cómo |
|---|---|
| Ver estado | `sudo isup-autoupdate --estado` |
| Forzar ahora | `sudo isup-autoupdate` |
| Registro | `journalctl -t isup-autoupdate` o `/var/log/isup-autoupdate.log` |
| Pausar | `sudo systemctl stop isup-autoupdate.timer` (reanudar: `start`) o fijar una versión con `sudo isup-update --ref <commit>` |

Para que los despliegues sean seguros, a la rama desplegada solo deben llegar commits probados: el servidor aplica
todo lo que se publique en ella.

## Carreras (programas de estudio)

El catálogo de carreras de TEPSUP está en `deploy/programas-tepsup.json` (nombre, título, área, créditos, horas,
perfil, campo laboral y plan de estudios por ciclo). Se carga o actualiza en el servidor con:

```bash
sudo isup-carreras
```

Cada carrera se identifica por su `slug`: repetir el comando actualiza los datos sin duplicar. Para editar una
carrera en caliente (foto, resolución, plan de estudios) usa Administración → Programas de estudio; para cambios
masivos edita el JSON en la rama y vuelve a ejecutar `sudo isup-update && sudo isup-carreras`.

## Cursos (catálogo académico)

Cada curso del plan de estudios tiene su paquete en `deploy/catalogo/cursos/<slug>.json` (sumilla, competencia,
capacidades, indicadores, metodología, bibliografía, sistema de evaluación, 4 unidades con diapositivas, lectura,
caso de estudio, tarea con rúbrica y cuestionario, y cronograma de 16 semanas). `deploy/catalogo/cursos-index.json`
indica en qué carrera, ciclo y código se dicta cada uno. El despliegue automático los importa al periodo activo:

```bash
sudo isup-cursos              # crea los cursos que falten; actualiza datos, sílabo y diapositivas de los existentes
sudo isup-cursos --rehacer    # vuelve a crear el contenido de los cursos sin matrículas ni calificaciones
```

Las presentaciones (PowerPoint) se generan en el servidor a partir del paquete y quedan en `/var/lib/isup/uploads`
como `catalogo-<slug>-uN.pptx`; se regeneran solo cuando cambia el contenido. Un curso ya existente conserva lo que
el docente haya editado o añadido. Para validar un paquete antes de publicarlo:
`node deploy/catalogo/validar.mjs deploy/catalogo/cursos/<slug>.json`.

## Operación diaria

| Tarea | Cómo |
|---|---|
| Ver estado | `systemctl status isup caddy` |
| Ver registro del aula | `journalctl -u isup -f` |
| Actualizar a la última versión | automático cada 5 min; a mano: `sudo isup-update` (hace copia previa, descarga, compila y reinicia) |
| Volver a una versión anterior | `sudo isup-update --ref <commit>` (el commit anterior lo imprime isup-update) |
| Copia de seguridad manual | `sudo isup-backup` |
| Restaurar una copia | `sudo isup-restore` (lista las copias) → `sudo isup-restore AAAAMMDD-HHMMSS` |
| Contraseña olvidada o cuenta bloqueada | `sudo isup-reset-password correo@dominio` (muestra una contraseña nueva una sola vez) |
| Cargar o actualizar el catálogo de carreras | `sudo isup-carreras` (importa `deploy/programas-tepsup.json`; con otro archivo: `sudo isup-carreras /ruta/archivo.json`) |
| Cerrar todas las sesiones abiertas (incidente) | cambia `JWT_SECRET` en `/etc/isup/isup.env` y `sudo systemctl restart isup` |
| Dónde están los datos | `/var/lib/isup` (base de datos `isup.db` y carpeta `uploads/`) |
| Copias automáticas | `/var/backups/isup`, cada día a las 03:30 hora de Lima, 14 días; incluyen la base verificada, los archivos subidos y `isup.env` |
| Configuración y secretos | `/etc/isup/isup.env` (no compartir) |
| Reiniciar | `sudo systemctl restart isup` |
| Autocomprobación | cada 2 minutos (`isup-health.timer`); si el aula no responde se reinicia sola |
| Mantenimiento mensual | `sudo apt update && sudo apt upgrade -y` y reinicia el VPS si cambió el kernel; vigila `df -h` y `journalctl --disk-usage` |

Las personalizaciones del servicio systemd se hacen con `sudo systemctl edit isup` (sobreviven a las
reinstalaciones); `/etc/systemd/system/isup.service` y `/etc/caddy/Caddyfile` los regenera el instalador
(guarda copia de un Caddyfile editado a mano).

### Restaurar una copia

```bash
sudo isup-restore                      # lista las copias disponibles
sudo isup-restore 20261005-033012      # restaura base de datos y archivos (pide confirmación)
sudo isup-restore 20261005-033012 --solo-bd
```

`isup-restore` verifica la integridad de la copia, hace una copia previa del estado actual, detiene el
aula, elimina los archivos auxiliares `-wal/-shm` de la base anterior (imprescindible) y vuelve a
arrancar. Para restaurar en un VPS nuevo: instala con el mismo comando del Paso 3, copia los archivos
de `/var/backups/isup` (y `isup-env-*` a `/etc/isup/isup.env` si quieres conservar las sesiones)
y ejecuta `isup-restore`.

Recomendación: descarga las copias a otro lugar (tu computadora o un almacenamiento en la nube)
al menos una vez por semana, por ejemplo con `scp -r root@IP:/var/backups/isup .`; el snapshot de
Hostinger no reemplaza este respaldo. Añade un monitor externo gratuito (UptimeRobot, Better Stack)
sobre `https://tepsup.com/api/health` cada 5 minutos para enterarte si el VPS entero se cae.

## Seguridad incluida

- HTTPS automático (Let's Encrypt, con ZeroSSL de respaldo) y redirección de HTTP a HTTPS y de `www`
  al dominio principal mediante Caddy.
- El aula solo escucha en `127.0.0.1`; Caddy es la única puerta de entrada (puertos 80 y 443) y la IP real
  del visitante solo se acepta desde ese proxy local.
- Firewall `ufw` con SSH (el puerto configurado), 80 y 443; `fail2ban` bloquea la fuerza bruta por SSH
  y contra el formulario de ingreso del aula (20 rechazos en 10 minutos → 30 minutos de bloqueo).
- Servicio con usuario sin privilegios y endurecimiento de systemd (sistema de solo lectura salvo
  `/var/lib/isup`, sin dispositivos, sin capacidades, filtro de llamadas al sistema).
- Secreto de sesión aleatorio de 48 bytes (el servidor se niega a arrancar en producción sin él),
  contraseñas con bcrypt, bloqueo tras 5 intentos fallidos, sesiones anteriores invalidadas al cambiar
  o restablecer la contraseña, cabeceras de seguridad (CSP sin scripts inline, HSTS, nosniff).
- Datos personales: registro de accesos de Caddy con retención de 30 días; el aula audita accesos,
  notas, actas y consentimientos (Ley N.° 29733).
- Limitación conocida: los archivos subidos (`/uploads/<uuid>`) se sirven por enlace no adivinable pero
  sin autenticación; no compartas enlaces de entregas fuera del aula.
- Recomendado: en hPanel añade una **clave SSH** y desactiva el acceso por contraseña a root.

## Correo electrónico (informativo)

El aula **no envía correos** (las contraseñas temporales se muestran en pantalla), así que no hay que
configurar nada de correo para ponerla en producción. El registro TXT `_dmarc` que ya existe en GoDaddy
no afecta al aula; solo importa si algún día se envía correo "desde" @tepsup.com, y entonces habrá que
añadir SPF y DKIM del proveedor de correo que se contrate.

## Problemas frecuentes

- **"Este sitio no es seguro" o no carga tras instalar**: el DNS aún no propagó. Comprueba en
  https://dnschecker.org que el nombre muestra la IP del VPS; cuando lo haga ejecuta
  `sudo systemctl reload caddy` y revisa `journalctl -u caddy -n 50` (tabla del Paso 3b).
- **Ejecuté el instalador antes de cambiar el DNS (o el DNS tardó mucho)**: cuando dnschecker.org ya
  muestre la IP del VPS, `sudo systemctl restart caddy` y espera 1–2 minutos. Si el registro muestra
  `too many failed authorizations recently`, Let's Encrypt bloquea el dominio una hora por los
  intentos fallidos: espera 60 minutos y repite. No hace falta reinstalar.
- **Página en blanco o error 502**: `systemctl status isup` y `journalctl -u isup -n 50`. Suele
  resolverse con `sudo systemctl restart isup` (la autocomprobación lo hace sola cada 2 minutos).
- **Olvidé la contraseña de administración (o una cuenta quedó bloqueada)**:
  `sudo isup-reset-password admin@tepsup.com` (luego cámbiala desde Mi perfil).
- **El instalador se detuvo en "Paquetes base"**: el VPS recién creado estaba instalando
  actualizaciones automáticas; espera unos minutos y vuelve a ejecutar el comando.
- **Quiero cambiar de dominio (p. ej. de aula.tepsup.com a tepsup.com)**: crea el registro A del nuevo
  nombre y vuelve a ejecutar el instalador con él (sin `BRANCH=` conserva la rama desplegada); el
  Caddyfile se regenera solo con el nuevo nombre y configuración y datos se mantienen.
- **Una actualización salió mal**: `sudo isup-update --ref <commit anterior>`; si cambió la base de
  datos, `sudo isup-restore` con la copia previa que hizo la actualización.
