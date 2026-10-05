# Puesta en producción · VPS Hostinger (Ubuntu 24.04) + dominio en GoDaddy

Guía paso a paso para dejar el Aula Virtual funcionando en **https://tepsup.com** con certificado
HTTPS, arranque automático, firewall y copias de seguridad diarias. Tiempo estimado: 20 minutos,
más la propagación del DNS.

## Antes de empezar

- VPS en Hostinger con **Ubuntu 24.04 LTS** (plan KVM 2 recomendado) y su contraseña de root.
- Acceso al panel de GoDaddy del dominio **tepsup.com**.
- Un correo para la cuenta de administración (por ejemplo `admin@tepsup.com`; no necesita existir
  como buzón para ingresar al aula, pero sí para los avisos de certificados).

## Paso 1 · Obtener la IP del VPS (Hostinger)

1. Entra a **hPanel → VPS → tu servidor**.
2. Copia la **dirección IPv4** (algo como `187.xx.xx.xx`).

## Paso 2 · Apuntar el dominio al VPS (GoDaddy)

En **GoDaddy → Dominios → tepsup.com → DNS → Registros DNS**:

| Acción | Tipo | Nombre | Datos | TTL |
|---|---|---|---|---|
| **Editar** el registro existente | A | `@` | la IP del VPS (sustituye "WebsiteBuilder Site") | 600 segundos |
| **Mantener** | CNAME | `www` | `tepsup.com.` | 1 hora |

No toques los registros NS, SOA, `_domainconnect` ni el TXT `_dmarc`.

> Al cambiar el registro A, el sitio del "Website Builder" de GoDaddy dejará de mostrarse en
> tepsup.com y en su lugar aparecerá el aula virtual. Si en ese sitio hay contenido que quieras
> conservar, cópialo antes.

La propagación suele tardar entre 5 y 30 minutos. Puedes comprobarla en https://dnschecker.org
buscando `tepsup.com` (tipo A): debe mostrar la IP del VPS.

## Paso 3 · Instalar el aula (un solo comando)

Abre una terminal en el servidor: en hPanel, **VPS → Terminal del navegador** (o desde tu
computadora `ssh root@IP-DEL-VPS`). Pega este comando y pulsa Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/infosiragpt-ops/ITSUP/main/deploy/install-ubuntu.sh | bash -s -- tepsup.com admin@tepsup.com
```

Si todavía no se ha fusionado el PR a `main`, usa la rama de trabajo:

```bash
curl -fsSL https://raw.githubusercontent.com/infosiragpt-ops/ITSUP/claude/eager-cannon-kh8czm/deploy/install-ubuntu.sh | BRANCH=claude/eager-cannon-kh8czm bash -s -- tepsup.com admin@tepsup.com
```

Para que el nombre de la institución aparezca ya configurado, añade variables delante de `bash`:
`INSTITUTION="Instituto Tecnológico ..." SHORT="TEPSUP" bash -s -- ...`

El instalador tarda unos minutos y al final muestra:

- la dirección del aula (`https://tepsup.com/login`),
- el **correo y la contraseña de la cuenta de administración** (guárdalos; también quedan en
  `/var/lib/isup/ADMIN_INICIAL.txt`, que debes borrar después del primer ingreso),
- un aviso si el dominio aún no apunta al servidor (el HTTPS se activa solo cuando el DNS propague).

## Paso 4 · Primer ingreso y configuración

1. Entra en `https://tepsup.com/login` con la cuenta de administración.
2. **Mi perfil → Cambiar contraseña.**
3. **Gestión académica → Configuración**: nombre de la institución, código, resolución de
   licenciamiento, dirección, director(a), secretaría académica y correo de protección de datos.
4. **Gestión académica → Periodos**: revisa las fechas del periodo activo.
5. **Programas de estudio**, **Cursos y matrícula** y **Usuarios**: carga la oferta real. Al crear un
   usuario sin contraseña, el sistema genera una temporal que se muestra una sola vez.
6. En el servidor, borra el archivo de la contraseña inicial: `rm /var/lib/isup/ADMIN_INICIAL.txt`.

En producción no se cargan datos de demostración ni se muestran los botones de acceso rápido.

## Operación diaria

| Tarea | Cómo |
|---|---|
| Ver estado | `systemctl status isup caddy` |
| Ver registro del aula | `journalctl -u isup -f` |
| Actualizar a la última versión | `sudo isup-update` (hace copia previa, descarga, compila y reinicia) |
| Copia de seguridad manual | `sudo isup-backup` |
| Dónde están los datos | `/var/lib/isup` (base de datos `isup.db` y carpeta `uploads/`) |
| Copias automáticas | `/var/backups/isup`, cada día a las 03:30, 14 días de retención |
| Configuración y secretos | `/etc/isup/isup.env` (no compartir) |
| Reiniciar | `sudo systemctl restart isup` |

### Restaurar una copia

```bash
sudo systemctl stop isup
sudo -u isup bash -c 'gunzip -c /var/backups/isup/isup-AAAAMMDD-HHMMSS.db.gz > /var/lib/isup/isup.db'
sudo -u isup tar -xzf /var/backups/isup/uploads-AAAAMMDD-HHMMSS.tar.gz -C /var/lib/isup
sudo systemctl start isup
```

Recomendación: descarga las copias a otro lugar (tu computadora o un almacenamiento en la nube)
al menos una vez por semana; el snapshot de Hostinger no reemplaza este respaldo.

## Seguridad incluida

- HTTPS automático (Let's Encrypt) y redirección de HTTP a HTTPS mediante Caddy.
- El aula solo escucha en `127.0.0.1`; Caddy es la única puerta de entrada (puertos 80 y 443).
- Firewall `ufw` con 22, 80 y 443; `fail2ban` bloquea intentos de fuerza bruta por SSH.
- Servicio con usuario sin privilegios y endurecimiento de systemd (sistema de solo lectura salvo `/var/lib/isup`).
- Secreto de sesión aleatorio de 48 bytes, contraseñas con bcrypt, bloqueo tras 5 intentos fallidos.
- Recomendado: en hPanel añade una **clave SSH** y desactiva el acceso por contraseña a root.

## Problemas frecuentes

- **"Este sitio no es seguro" o no carga tras instalar**: el DNS aún no propagó. Espera y revisa
  `journalctl -u caddy -n 50`. Caddy reintenta la emisión del certificado automáticamente.
- **Página en blanco o error 502**: `systemctl status isup` y `journalctl -u isup -n 50`. Suele
  resolverse con `sudo systemctl restart isup`.
- **Olvidé la contraseña de administración (o una cuenta quedó bloqueada)**: en el servidor ejecuta
  `cd /opt/isup && sudo -u isup DATA_DIR=/var/lib/isup node server/tools/reset-password.mjs admin@tepsup.com`
  (muestra una contraseña nueva una sola vez; luego cámbiala desde Mi perfil).
- **Quiero usar otro dominio o añadir `aula.tepsup.com`**: crea el registro A y vuelve a ejecutar el
  instalador con el nuevo dominio; conserva la configuración y los datos.
