# Puesta en producción · VPS Hostinger (Ubuntu 24.04) + dominio en GoDaddy

Guía paso a paso para dejar el Aula Virtual funcionando en **https://tepsup.com** con certificado
HTTPS, arranque automático, firewall, autocomprobación y copias de seguridad diarias verificadas.
Tiempo estimado: 20 minutos, más la propagación del DNS.

## Antes de empezar

- VPS en Hostinger con **Ubuntu 24.04 LTS** (plan KVM 2 recomendado) y su contraseña de root.
- Acceso al panel de GoDaddy del dominio **tepsup.com**.
- Un correo para la cuenta de administración (por ejemplo `admin@tepsup.com`; no necesita existir
  como buzón para ingresar al aula, pero sí para los avisos de certificados).

## Paso 1 · Obtener la IP del VPS (Hostinger)

1. Entra a **hPanel → VPS → tu servidor**.
2. Copia la **dirección IPv4** (algo como `187.xx.xx.xx`).
3. Si el VPS tiene también **IPv6**, anótala: o la añades como registro AAAA en GoDaddy o no creas
   ningún AAAA (un AAAA que apunte a otro sitio impide emitir el certificado).
4. **hPanel → VPS → Firewall**: si activas un grupo de reglas, permite TCP 22, 80 y 443. Por defecto
   está desactivado y no hace falta tocarlo (el VPS trae su propio firewall `ufw`).

## Paso 2 · Apuntar el dominio al VPS (GoDaddy)

En **GoDaddy → Dominios → tepsup.com → DNS → Registros DNS**:

| Acción | Tipo | Nombre | Datos | TTL |
|---|---|---|---|---|
| **Editar** el registro existente | A | `@` | la IP del VPS (sustituye "WebsiteBuilder Site") | 600 segundos |
| **Mantener** | CNAME | `www` | `tepsup.com.` | 1 hora |

No toques los registros NS, SOA, `_domainconnect` ni el TXT `_dmarc`. No crees registros AAAA salvo
que sean la IPv6 del propio VPS.

> Al cambiar el registro A, el sitio del "Website Builder" de GoDaddy dejará de mostrarse en
> tepsup.com y en su lugar aparecerá el aula virtual. Si en ese sitio hay contenido que quieras
> conservar, cópialo antes.

La propagación suele tardar entre 5 y 30 minutos. Puedes comprobarla en https://dnschecker.org
buscando `tepsup.com` (tipo A): debe mostrar la IP del VPS. El instalador también espera hasta
5 minutos a que el dominio apunte al servidor antes de pedir el certificado.

## Paso 3 · Instalar el aula (un solo comando)

Abre una terminal en el servidor: en hPanel, **VPS → Terminal del navegador** (o desde tu
computadora `ssh root@IP-DEL-VPS`). Pega este comando y pulsa Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/infosiragpt-ops/ITSUP/claude/eager-cannon-kh8czm/deploy/install-ubuntu.sh | BRANCH=claude/eager-cannon-kh8czm bash -s -- tepsup.com admin@tepsup.com
```

Cuando el PR esté fusionado a `main`, el mismo comando funciona con `main` en los dos sitios. El
instalador se niega a desplegar una rama que no incluya el modo producción (carpeta `deploy/`), así
que nunca publicará la versión de demostración por error.

Para que el nombre de la institución aparezca ya configurado, añade variables delante de `bash`:

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

## Paso 4 · Primer ingreso y configuración

1. Entra en `https://tepsup.com/login` con la cuenta de administración.
2. **Mi perfil → Cambiar contraseña** (esto invalida la contraseña inicial y borra el archivo que la guardaba).
3. **Gestión académica → Configuración**: nombre de la institución, código, resolución de
   licenciamiento, dirección, director(a), secretaría académica y correo de protección de datos.
4. **Gestión académica → Periodos**: revisa las fechas del periodo activo.
5. **Programas de estudio**, **Cursos y matrícula** y **Usuarios**: carga la oferta real. Al crear un
   usuario sin contraseña, el sistema genera una temporal que se muestra una sola vez.

En producción no se cargan datos de demostración ni se muestran los botones de acceso rápido.

## Operación diaria

| Tarea | Cómo |
|---|---|
| Ver estado | `systemctl status isup caddy` |
| Ver registro del aula | `journalctl -u isup -f` |
| Actualizar a la última versión | `sudo isup-update` (hace copia previa, descarga, compila y reinicia) |
| Volver a una versión anterior | `sudo isup-update --ref <commit>` (el commit anterior lo imprime isup-update) |
| Copia de seguridad manual | `sudo isup-backup` |
| Restaurar una copia | `sudo isup-restore` (lista las copias) → `sudo isup-restore AAAAMMDD-HHMMSS` |
| Contraseña olvidada o cuenta bloqueada | `sudo isup-reset-password correo@dominio` (muestra una contraseña nueva una sola vez) |
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

- HTTPS automático (Let's Encrypt) y redirección de HTTP a HTTPS y de `www` al dominio principal mediante Caddy.
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

## Problemas frecuentes

- **"Este sitio no es seguro" o no carga tras instalar**: el DNS aún no propagó. Comprueba en
  https://dnschecker.org que `tepsup.com` muestra la IP del VPS; cuando lo haga ejecuta
  `sudo systemctl reload caddy` y revisa `journalctl -u caddy -n 50`. Caddy reintenta la emisión del
  certificado automáticamente.
- **Página en blanco o error 502**: `systemctl status isup` y `journalctl -u isup -n 50`. Suele
  resolverse con `sudo systemctl restart isup` (la autocomprobación lo hace sola cada 2 minutos).
- **Olvidé la contraseña de administración (o una cuenta quedó bloqueada)**:
  `sudo isup-reset-password admin@tepsup.com` (luego cámbiala desde Mi perfil).
- **El instalador se detuvo en "Paquetes base"**: el VPS recién creado estaba instalando
  actualizaciones automáticas; espera unos minutos y vuelve a ejecutar el comando.
- **Quiero usar otro dominio o añadir `aula.tepsup.com`**: crea el registro A y vuelve a ejecutar el
  instalador con el nuevo dominio (sin `BRANCH=` conserva la rama desplegada); configuración y datos
  se mantienen.
- **Una actualización salió mal**: `sudo isup-update --ref <commit anterior>`; si cambió la base de
  datos, `sudo isup-restore` con la copia previa que hizo la actualización.
