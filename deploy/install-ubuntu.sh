#!/usr/bin/env bash
# =============================================================================
#  ISUP Aula Virtual · instalador para producción en Ubuntu 24.04 LTS (VPS)
#
#  Uso (como root, en el servidor recién creado):
#     curl -fsSL https://raw.githubusercontent.com/infosiragpt-ops/ITSUP/<rama>/deploy/install-ubuntu.sh \
#       | BRANCH=<rama> bash -s -- tepsup.com admin@tepsup.com
#
#  Argumentos:  1) dominio principal (el DNS debe apuntar a este servidor)
#               2) correo de la cuenta de administración inicial (también recibe avisos de certificados)
#  Variables opcionales:
#     BRANCH        rama a desplegar. En la primera instalación es obligatoria si main aún no tiene deploy/;
#                   al volver a ejecutar el instalador se conserva la rama ya desplegada.
#     REF           commit o etiqueta exacta a desplegar (fija la versión)
#     REPO          repositorio git (por defecto el oficial)
#     INSTITUTION   nombre completo de la institución · SHORT  siglas (p. ej. TEPSUP)
#     ACME_EMAIL    contacto para la cuenta de certificados (por defecto el correo de administración)
#     WWW=0         no servir también www.<dominio> (se recuerda en isup.env para las reinstalaciones)
#     WAIT_DNS=300  segundos máximos de espera a que el dominio apunte a este servidor antes de pedir el certificado
#     ACME_STAGING=1  usar el entorno de pruebas de Let's Encrypt (certificado no válido; solo para ensayos)
#     SKIP_SERVICES=1 solo instalar, sin systemd/ufw/Caddy (pruebas en contenedores)
#
#  Qué hace: Node.js 22 LTS, Caddy (HTTPS automático con Let's Encrypt), usuario de servicio sin
#  privilegios, código en /opt/isup, datos en /var/lib/isup, servicio systemd endurecido con reinicio
#  automático y autocomprobación, firewall (SSH/80/443), fail2ban (SSH y formulario de ingreso),
#  copia de seguridad diaria verificada en /var/backups/isup (14 días) y utilidades isup-update,
#  isup-backup, isup-restore e isup-reset-password.
#  Es idempotente: volver a ejecutarlo actualiza el código y conserva datos y configuración. Instala además el
#  despliegue automático (isup-autoupdate.timer): cada 5 minutos aplica los commits nuevos de la rama desplegada.
# =============================================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

main() {
DOMAIN="${1:-${DOMAIN:-}}"
ADMIN_EMAIL="${2:-${ADMIN_EMAIL:-}}"
ACME_EMAIL="${ACME_EMAIL:-}"
REPO="${REPO:-https://github.com/infosiragpt-ops/ITSUP.git}"
BRANCH="${BRANCH:-}"
REF="${REF:-}"
INSTITUTION="${INSTITUTION:-Instituto Superior Universitario Privado}"
SHORT="${SHORT:-ISUP}"
WWW="${WWW:-}"
WAIT_DNS="${WAIT_DNS:-300}"
ACME_STAGING="${ACME_STAGING:-0}"
SKIP_SERVICES="${SKIP_SERVICES:-0}"

APP_DIR=/opt/isup
ENV_DIR=/etc/isup
ENV_FILE="$ENV_DIR/isup.env"
FIRST_RUN=1; [ ! -f "$ENV_FILE" ] || FIRST_RUN=0
DATA_DIR=/var/lib/isup
BACKUP_DIR=/var/backups/isup
NPM_CACHE=/var/cache/isup-npm
SVC_USER=isup
PORT=3000
CADDY_LOG=/var/log/caddy/isup-access.log

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m   ⚠ %s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }
# Todo git/npm se ejecuta como el usuario de servicio (git rechaza repositorios de otro dueño: "dubious ownership")
as_isup() { runuser -u "$SVC_USER" -- env HOME="$APP_DIR" npm_config_cache="$NPM_CACHE" "$@"; }
# Valor entre comillas válido para systemd (EnvironmentFile=) y para bash (source)
q() { printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\$/\\$/g' -e 's/`/\\`/g')"; }
APT="apt-get -o DPkg::Lock::Timeout=600"
# Descarga una clave de firma de repositorio y la convierte a binario (error claro si no hay salida a internet)
fetch_key() {
  local tmp; tmp="$(mktemp)"
  curl -fsSL --max-time 60 "$1" -o "$tmp" && gpg --dearmor --yes -o "$2" "$tmp" 2>/dev/null \
    || { rm -f "$tmp"; die "No se pudo descargar la clave del repositorio de $3 ($1). Revisa la salida a internet del VPS y vuelve a intentarlo."; }
  rm -f "$tmp"
}
wait_apt() {
  local t=0
  while command -v fuser >/dev/null 2>&1 && fuser /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock >/dev/null 2>&1; do
    [ "$t" -eq 0 ] && echo "   esperando a que terminen las actualizaciones automáticas del sistema…"
    sleep 5; t=$((t + 5)); [ "$t" -lt 900 ] || die "apt lleva 15 minutos ocupado (unattended-upgrades). Vuelve a intentarlo en unos minutos."
  done
}

[ "$(id -u)" -eq 0 ] || die "Ejecuta este instalador como root (en Hostinger: usuario root del VPS)."
grep -qi ubuntu /etc/os-release || die "Este instalador está pensado para Ubuntu 24.04 LTS."
# Un solo despliegue a la vez (comparte el cerrojo con isup-update / isup-autoupdate)
mkdir -p /run/lock; exec 9>/run/lock/isup-update.lock
flock -n 9 || die "Ya hay una instalación o actualización en curso; inténtalo en unos minutos."
# WWW: si no se indica, se usa lo guardado en una instalación anterior; por defecto se sirve también www.
if [ -z "$WWW" ] && [ -f "$ENV_FILE" ]; then WWW="$(grep -E '^ISUP_WWW=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)"; fi
WWW="${WWW:-1}"
[ -n "$DOMAIN" ] || die "Indica el dominio. Ejemplo: bash install-ubuntu.sh tepsup.com admin@tepsup.com"
[ -n "$ADMIN_EMAIL" ] || die "Indica el correo de la cuenta de administración. Ejemplo: bash install-ubuntu.sh tepsup.com admin@tepsup.com"
DOMAIN="${DOMAIN,,}"; ADMIN_EMAIL="${ADMIN_EMAIL,,}"
[[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || die "Dominio inválido: $DOMAIN (usa solo el nombre, sin https://)"
[[ "$ADMIN_EMAIL" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "Correo inválido: $ADMIN_EMAIL"
ACME_EMAIL="${ACME_EMAIL:-$ADMIN_EMAIL}"; ACME_EMAIL="${ACME_EMAIL,,}"
[[ "$ACME_EMAIL" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "ACME_EMAIL inválido: $ACME_EMAIL"
[ -z "$REF" ] || [[ "$REF" =~ ^[A-Za-z0-9._/-]+$ ]] || die "REF inválido: $REF"

bold "1/8 · Paquetes base"
wait_apt
$APT update -qq
$APT install -y -qq ca-certificates curl git gnupg sudo psmisc ufw fail2ban python3-systemd sqlite3 openssl >/dev/null

bold "2/8 · Node.js 22 LTS"
node_ok() { command -v node >/dev/null 2>&1 && node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)'; }
if ! node_ok; then
  install -d -m 0755 /usr/share/keyrings
  fetch_key https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key /usr/share/keyrings/nodesource.gpg "NodeSource"
  echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  wait_apt; $APT update -qq
  $APT install -y -qq nodejs >/dev/null
  node_ok || die "No se pudo instalar Node.js 22.13 o superior."
fi
NODE_BIN="$(command -v node)"
echo "   Node $(node -v) · npm $(npm -v) ($NODE_BIN)"

bold "3/8 · Caddy (servidor web con HTTPS automático)"
if ! command -v caddy >/dev/null 2>&1; then
  install -d -m 0755 /usr/share/keyrings
  fetch_key https://dl.cloudsmith.io/public/caddy/stable/gpg.key /usr/share/keyrings/caddy-stable-archive-keyring.gpg "Caddy"
  curl -fsSL --max-time 60 https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list \
    || die "No se pudo descargar la lista de paquetes de Caddy (dl.cloudsmith.io). Revisa la salida a internet del VPS y vuelve a intentarlo."
  wait_apt; $APT update -qq
  $APT install -y -qq caddy >/dev/null
fi
echo "   $(caddy version | head -1)"

bold "4/8 · Usuario de servicio, carpetas y código"
id -u "$SVC_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SVC_USER"
install -d -m 0750 -o "$SVC_USER" -g "$SVC_USER" "$DATA_DIR" "$DATA_DIR/uploads" "$NPM_CACHE"
install -d -m 0750 -o root -g "$SVC_USER" "$BACKUP_DIR" "$ENV_DIR"
# root también puede consultar el repositorio (p. ej. journalctl, soporte) sin el aviso de git
git config --system --get-all safe.directory 2>/dev/null | grep -qx "$APP_DIR" || git config --system --add safe.directory "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  chown -R "$SVC_USER:$SVC_USER" "$APP_DIR"
  if [ -z "$BRANCH" ]; then
    BRANCH="$(as_isup git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)"
    [ "$BRANCH" != HEAD ] || die "El código está en un commit fijo (REF). Indica la rama: BRANCH=<rama> bash install-ubuntu.sh …"
  fi
  as_isup git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
else
  BRANCH="${BRANCH:-main}"
  rm -rf "$APP_DIR"
  install -d -m 0755 -o "$SVC_USER" -g "$SVC_USER" "$APP_DIR"
  as_isup git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
# La rama debe traer el modo producción (sin datos de demostración ni contraseñas públicas)
as_isup git -C "$APP_DIR" cat-file -e "origin/$BRANCH:deploy/install-ubuntu.sh" 2>/dev/null \
  && as_isup git -C "$APP_DIR" grep -q 'export function seedMinimal' "origin/$BRANCH" -- server/seed.js \
  || die "La rama '$BRANCH' no incluye el modo producción (carpeta deploy/). Usa BRANCH=claude/eager-cannon-kh8czm o fusiona primero el PR a main."
# Cambios locales (p. ej. package-lock.json reescrito por npm) se descartan antes de cambiar de versión
as_isup git -C "$APP_DIR" reset --quiet --hard
if [ -n "$REF" ]; then
  as_isup git -C "$APP_DIR" fetch --quiet origin
  as_isup git -C "$APP_DIR" checkout --quiet --detach "$REF"
else
  as_isup git -C "$APP_DIR" checkout --quiet "$BRANCH"
  as_isup git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
fi
echo "   Código en $APP_DIR (${REF:+commit $REF, }rama $BRANCH, $(as_isup git -C "$APP_DIR" rev-parse --short HEAD))"

bold "5/8 · Dependencias e interfaz (puede tardar 1–3 minutos)"
# Se compila en client/dist.next y se intercambia al final: el sitio en marcha no se queda sin interfaz
as_isup bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund --loglevel=error \
  && VITE_DEMO_MODE=false npm run build --silent -- --outDir dist.next \
  && npm prune --omit=dev --no-audit --no-fund --loglevel=error"
as_isup bash -c "cd '$APP_DIR/client' && rm -rf dist.prev && { [ ! -d dist ] || mv dist dist.prev; } && mv dist.next dist"

bold "6/8 · Configuración del servicio"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
# Configuración de ISUP Aula Virtual (generada por deploy/install-ubuntu.sh). No compartir.
# Si cambias JWT_SECRET, todas las sesiones abiertas se cierran (útil ante un incidente).
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT
TRUST_PROXY=1
DATA_DIR=$DATA_DIR
JWT_SECRET=$(openssl rand -hex 48)
SESSION_HOURS=24
ISUP_SEED=minimal
ISUP_ADMIN_EMAIL=$(q "$ADMIN_EMAIL")
ISUP_INSTITUTION=$(q "$INSTITUTION")
ISUP_SHORT=$(q "$SHORT")
ISUP_WWW=$WWW
PUBLIC_URL=https://$DOMAIN
EOF
  chmod 0640 "$ENV_FILE"; chown root:"$SVC_USER" "$ENV_FILE"
  echo "   Secretos generados en $ENV_FILE"
else
  grep -q '^ISUP_WWW=' "$ENV_FILE" || echo "ISUP_WWW=$WWW" >> "$ENV_FILE"
  echo "   Se conserva la configuración existente ($ENV_FILE)"
fi

# Personalizaciones del servicio: usar `systemctl edit isup` (drop-in), este archivo se regenera en cada ejecución
cat > /etc/systemd/system/isup.service <<EOF
[Unit]
Description=ISUP Aula Virtual
Documentation=file://$APP_DIR/DESPLIEGUE.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=TZ=America/Lima
Environment=NODE_OPTIONS=--disable-warning=ExperimentalWarning
ExecStart=$NODE_BIN $APP_DIR/server/index.js
Restart=always
RestartSec=3
TimeoutStopSec=10
SyslogIdentifier=isup
UMask=0027
LimitNOFILE=65536
# Endurecimiento (systemd-analyze security isup)
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictSUIDSGID=true
RestrictNamespaces=true
RestrictRealtime=true
LockPersonality=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM

[Install]
WantedBy=multi-user.target
EOF

# Autocomprobación cada 2 minutos: si el aula no responde, se reinicia (complemento de Restart=always)
cat > /etc/systemd/system/isup-health.service <<EOF
[Unit]
Description=Autocomprobación de ISUP Aula Virtual
After=isup.service

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'curl -fsS --max-time 10 http://127.0.0.1:$PORT/api/health >/dev/null || { logger -t isup-health "el aula no responde: reiniciando isup"; systemctl restart isup.service; }'
EOF
cat > /etc/systemd/system/isup-health.timer <<'EOF'
[Unit]
Description=Autocomprobación periódica de ISUP Aula Virtual

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
AccuracySec=30s

[Install]
WantedBy=timers.target
EOF

# Caddy: HTTPS automático, www → dominio principal, registro de accesos 30 días (contiene IP: dato personal)
CF=/etc/caddy/Caddyfile
if [ -f "$CF" ] && ! grep -q 'generado por deploy/install-ubuntu.sh' "$CF" && grep -vqE '^\s*(#|$)' "$CF" && ! grep -q 'root \* /usr/share/caddy' "$CF"; then
  cp -a "$CF" "$CF.bak-$(date +%Y%m%d%H%M%S)"
  warn "Había un Caddyfile personalizado; se guardó una copia en $CF.bak-*"
fi
GLOBAL_BLOCK="{
	email $ACME_EMAIL
}"
[ "$ACME_STAGING" = "1" ] && GLOBAL_BLOCK="{
	email $ACME_EMAIL
	acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}"
WWW_BLOCK=""
if [ "$WWW" = "1" ] && [[ "$DOMAIN" != www.* ]]; then
  WWW_BLOCK="www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
"
fi
cat > "$CF" <<EOF
# ISUP Aula Virtual · generado por deploy/install-ubuntu.sh (se regenera al reinstalar)
$GLOBAL_BLOCK

$DOMAIN {
	encode zstd gzip
	request_body {
		max_size 30MB
	}
	header {
		-Server
		Strict-Transport-Security "max-age=31536000"
	}
	reverse_proxy 127.0.0.1:$PORT
	log {
		output file $CADDY_LOG {
			roll_size 20MiB
			roll_keep 10
			roll_keep_for 720h
		}
		format json {
			time_format rfc3339
		}
	}
}

$WWW_BLOCK
EOF
sed -i '/^$/N;/^\n$/D' "$CF"
# El archivo de registro debe pertenecer a caddy antes de validar (una validación como root lo crearía de root y Caddy no arrancaría)
install -d -m 0755 -o caddy -g caddy /var/log/caddy
[ -e "$CADDY_LOG" ] || install -o caddy -g caddy -m 0640 /dev/null "$CADDY_LOG"
chown -R caddy:caddy /var/log/caddy
out="$(runuser -u caddy -- env HOME=/var/lib/caddy caddy validate --config "$CF" 2>&1)" || die "El Caddyfile generado no es válido: $out"

# Copia de seguridad diaria verificada (03:30 hora de Lima), restauración, actualización y utilidades
install -m 0755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/isup-backup
install -m 0755 "$APP_DIR/deploy/restore.sh" /usr/local/bin/isup-restore
install -m 0755 "$APP_DIR/deploy/update.sh" /usr/local/bin/isup-update
install -m 0755 "$APP_DIR/deploy/reset-password.sh" /usr/local/bin/isup-reset-password
install -m 0755 "$APP_DIR/deploy/import-programs.sh" /usr/local/bin/isup-carreras
install -m 0755 "$APP_DIR/deploy/autoupdate.sh" /usr/local/bin/isup-autoupdate
# Despliegue automático: cada 5 minutos aplica los commits nuevos de la rama desplegada (con vuelta atrás si falla)
cat > /etc/systemd/system/isup-autoupdate.service <<'EOF'
[Unit]
Description=Despliegue automático de ISUP Aula Virtual
After=network-online.target isup.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/isup-autoupdate
EOF
cat > /etc/systemd/system/isup-autoupdate.timer <<'EOF'
[Unit]
Description=Despliegue automático periódico de ISUP Aula Virtual

[Timer]
OnBootSec=3min
OnUnitActiveSec=5min
RandomizedDelaySec=30s
AccuracySec=30s

[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/isup-backup.service <<EOF
[Unit]
Description=Copia de seguridad de ISUP Aula Virtual

[Service]
Type=oneshot
Environment=DATA_DIR=$DATA_DIR
Environment=BACKUP_DIR=$BACKUP_DIR
Environment=SVC_USER=$SVC_USER
ExecStart=/usr/local/bin/isup-backup
EOF
cat > /etc/systemd/system/isup-backup.timer <<'EOF'
[Unit]
Description=Copia de seguridad diaria de ISUP Aula Virtual

[Timer]
OnCalendar=*-*-* 03:30:00 America/Lima
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
EOF

# fail2ban: SSH (backend systemd) y fuerza bruta contra el formulario de ingreso (registro de Caddy)
cat > /etc/fail2ban/jail.d/isup.local <<EOF
[DEFAULT]
backend = systemd

[sshd]
enabled = true
maxretry = 5
bantime = 1h

[isup-login]
enabled = true
backend = auto
filter = isup-login
logpath = $CADDY_LOG
maxretry = 20
findtime = 10m
bantime = 30m
port = http,https
EOF
cat > /etc/fail2ban/filter.d/isup-login.conf <<'EOF'
# Intentos de ingreso rechazados por ISUP Aula Virtual (registro JSON de Caddy con time_format rfc3339)
[Definition]
failregex = ^.*"client_ip":"<HOST>".*"uri":"/api/auth/login".*"status":(401|423|429)\b
datepattern = "ts":"%%Y-%%m-%%dT%%H:%%M:%%S(?:\.[0-9]+)?%%z"
EOF
if ! out="$(fail2ban-client -t 2>&1)"; then
  rm -f /etc/fail2ban/jail.d/isup.local /etc/fail2ban/filter.d/isup-login.conf
  warn "La configuración de fail2ban no pasó la prueba y se dejó la de fábrica: $(echo "$out" | tail -3)"
fi

bold "7/8 · Firewall y protección de acceso"
if [ "$SKIP_SERVICES" = "1" ]; then
  echo "   (omitido sin systemd: ufw y fail2ban)"
else
  SSH_PORTS="$(sshd -T 2>/dev/null | awk '$1=="port"{print $2}' | sort -u | xargs)"
  for p in ${SSH_PORTS:-22}; do ufw allow "$p/tcp" >/dev/null; done
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  systemctl enable fail2ban >/dev/null 2>&1 || true
  if systemctl restart fail2ban 2>/dev/null && sleep 2 && fail2ban-client status sshd >/dev/null 2>&1; then
    echo "   ufw: SSH (${SSH_PORTS:-22}), 80 y 443 abiertos · fail2ban activo (SSH e ingreso al aula)"
  else
    echo "   ufw: SSH (${SSH_PORTS:-22}), 80 y 443 abiertos"
    warn "fail2ban no arrancó: revisa journalctl -u fail2ban -n 30"
  fi
fi

bold "8/8 · Arranque"
if [ "$SKIP_SERVICES" = "1" ]; then
  # Arranque manual para comprobar que la aplicación levanta con la configuración generada
  as_isup bash -c "cd '$APP_DIR'; set -a; . '$ENV_FILE'; set +a; nohup node server/index.js > /tmp/isup-test.log 2>&1 & echo \$! > /tmp/isup-test.pid" 9>&-
else
  systemctl daemon-reload
  systemctl enable isup.service isup-backup.timer isup-health.timer isup-autoupdate.timer >/dev/null
  systemctl restart isup.service 9>&-
  systemctl start isup-backup.timer isup-health.timer isup-autoupdate.timer 9>&-
fi

for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  if [ "$SKIP_SERVICES" = "1" ]; then cat /tmp/isup-test.log; else journalctl -u isup -n 30 --no-pager; fi
  die "El servicio no respondió. Revisa el registro anterior (journalctl -u isup)."
fi
# Tareas posteriores al despliegue (catálogo de carreras, etc.), idempotentes
if [ -f "$APP_DIR/deploy/post-update.sh" ]; then
  bash "$APP_DIR/deploy/post-update.sh" || die "Las tareas posteriores al despliegue fallaron (ver arriba)."
fi
if [ "$SKIP_SERVICES" = "1" ]; then kill "$(cat /tmp/isup-test.pid)" 2>/dev/null || true; fi

# DNS: esperar (hasta WAIT_DNS s) a que el dominio apunte aquí antes de pedir el certificado, para no agotar
# el límite de Let's Encrypt (5 validaciones fallidas por hora) si se reinstala varias veces.
IP="$(curl -fsS -4 --max-time 10 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
resolve4() { resolvectl flush-caches >/dev/null 2>&1 || true; getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1{print $1}'; }
RESOLVED="$(resolve4 "$DOMAIN" || true)"
if [ "$FIRST_RUN" = 1 ] && [ "$SKIP_SERVICES" != "1" ] && [ -n "$IP" ] && [ "$RESOLVED" != "$IP" ] && [ "$WAIT_DNS" -gt 0 ] 2>/dev/null; then
  printf '   El dominio %s aún no apunta a este servidor (%s). Esperando la propagación del DNS hasta %s s' "$DOMAIN" "$IP" "$WAIT_DNS"
  t=0
  while [ "$t" -lt "$WAIT_DNS" ]; do
    sleep 15; t=$((t + 15)); printf '.'
    RESOLVED="$(resolve4 "$DOMAIN" || true)"
    [ "$RESOLVED" = "$IP" ] && break
  done
  echo
fi
RESOLVED6="$(getent ahostsv6 "$DOMAIN" 2>/dev/null | awk 'NR==1 && $1 !~ /^::ffff:/ {print $1}' || true)"
RESOLVED_WWW=""
if [ "$WWW" = "1" ] && [[ "$DOMAIN" != www.* ]]; then RESOLVED_WWW="$(resolve4 "www.$DOMAIN" || true)"; fi

if [ "$SKIP_SERVICES" != "1" ]; then
  systemctl enable caddy >/dev/null 2>&1 || true
  if ! systemctl reload caddy 2>/dev/null 9>&-; then
    systemctl restart caddy 9>&- || { journalctl -u caddy -n 30 --no-pager; die "Caddy no pudo cargar la configuración (ver registro anterior)."; }
  fi
fi

printf '\n\033[32m✔ ISUP Aula Virtual instalada y en ejecución.\033[0m\n\n'
echo "   Sitio:            https://$DOMAIN$([ "$WWW" = "1" ] && [[ "$DOMAIN" != www.* ]] && echo "  (www.$DOMAIN redirige aquí)")"
echo "   Ingreso:          https://$DOMAIN/login"
if [ -f "$DATA_DIR/ADMIN_INICIAL.txt" ]; then
  echo "   Administración:   $(grep -i '^Correo' "$DATA_DIR/ADMIN_INICIAL.txt" | awk '{print $2}')"
  if [ "${ISUP_HIDE_PASSWORD:-0}" = 1 ]; then
    echo "   Contraseña:       (inicial, sin cambiar: ver $DATA_DIR/ADMIN_INICIAL.txt)"
  else
    echo "   Contraseña:       $(grep -i '^Contraseña' "$DATA_DIR/ADMIN_INICIAL.txt" | awk '{print $2}')  ← cámbiala en Mi perfil en el primer ingreso"
    echo "                     (queda en $DATA_DIR/ADMIN_INICIAL.txt hasta que la cambies; después se borra sola)"
  fi
fi
echo "   Datos:            $DATA_DIR  ·  copias diarias verificadas en $BACKUP_DIR (03:30 hora de Lima)"
echo "   Utilidades:       isup-update · isup-backup · isup-restore · isup-reset-password correo · isup-carreras"
echo "   Despliegue auto.: cada 5 min se aplican los commits nuevos de la rama $BRANCH (estado: isup-autoupdate --estado)"
echo "   Estado:           systemctl status isup caddy  ·  journalctl -u isup -f"
if [ -n "$RESOLVED6" ]; then
  warn "$DOMAIN tiene un registro AAAA ($RESOLVED6): debe ser la IPv6 de este VPS o eliminarse; si no, Let's Encrypt fallará."
fi
if [ -n "$RESOLVED" ] && [ -n "$IP" ] && [ "$RESOLVED" != "$IP" ]; then
  printf '\n\033[33m⚠ El dominio %s resuelve a %s pero este servidor es %s (comprobado con el DNS del propio servidor; confirma en https://dnschecker.org).\n   Actualiza el registro A en tu proveedor de DNS (GoDaddy) y, cuando propague, ejecuta: sudo systemctl reload caddy\n   Caddy emitirá el certificado HTTPS automáticamente (comprueba con: journalctl -u caddy -n 20).\033[0m\n' "$DOMAIN" "$RESOLVED" "$IP"
elif [ -z "$RESOLVED" ]; then
  printf '\n\033[33m⚠ El dominio %s todavía no resuelve. Crea el registro A → %s en GoDaddy; cuando propague ejecuta: sudo systemctl reload caddy\033[0m\n' "$DOMAIN" "$IP"
fi
if [ "$WWW" = "1" ] && [[ "$DOMAIN" != www.* ]] && [ -n "$IP" ] && [ "$RESOLVED_WWW" != "$IP" ]; then
  warn "www.$DOMAIN no apunta a este servidor (resuelve a \"${RESOLVED_WWW:-nada}\"). En GoDaddy debe existir CNAME www → $DOMAIN. (o instala con WWW=0)."
fi
echo
}

main "$@"
