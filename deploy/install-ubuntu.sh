#!/usr/bin/env bash
# =============================================================================
#  ISUP Aula Virtual · instalador para producción en Ubuntu 24.04 LTS (VPS)
#
#  Uso (como root, en el servidor recién creado):
#     curl -fsSL https://raw.githubusercontent.com/infosiragpt-ops/ITSUP/main/deploy/install-ubuntu.sh \
#       | bash -s -- tepsup.com admin@tepsup.com
#
#  Argumentos:  1) dominio principal (el DNS debe apuntar a este servidor)
#               2) correo de la cuenta de administración inicial (también recibe avisos de certificados)
#  Variables opcionales: BRANCH (rama a desplegar, por defecto main), REPO, INSTITUTION, SHORT, WWW=0 (sin www.),
#                        SKIP_SERVICES=1 (solo instalar, sin systemd/ufw: para pruebas en contenedores)
#
#  Qué hace: Node.js 22 LTS, Caddy (HTTPS automático con Let's Encrypt), usuario de servicio sin
#  privilegios, código en /opt/isup, datos en /var/lib/isup, servicio systemd con reinicio automático,
#  firewall (22/80/443), fail2ban, copia de seguridad diaria en /var/backups/isup (14 días).
#  Es idempotente: volver a ejecutarlo actualiza el código y conserva datos y configuración.
# =============================================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

DOMAIN="${1:-${DOMAIN:-}}"
ADMIN_EMAIL="${2:-${ADMIN_EMAIL:-}}"
REPO="${REPO:-https://github.com/infosiragpt-ops/ITSUP.git}"
BRANCH="${BRANCH:-main}"
INSTITUTION="${INSTITUTION:-Instituto Superior Universitario Privado}"
SHORT="${SHORT:-ISUP}"
WWW="${WWW:-1}"

APP_DIR=/opt/isup
ENV_DIR=/etc/isup
DATA_DIR=/var/lib/isup
BACKUP_DIR=/var/backups/isup
SVC_USER=isup
PORT=3000

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }
# SKIP_SERVICES=1: entorno sin systemd (contenedor de pruebas). Se instala todo pero no se activan servicios ni firewall.
SKIP_SERVICES="${SKIP_SERVICES:-0}"
svc() { if [ "$SKIP_SERVICES" = "1" ]; then echo "   (omitido sin systemd: $*)"; else "$@"; fi; }

[ "$(id -u)" -eq 0 ] || die "Ejecuta este instalador como root (en Hostinger: usuario root del VPS)."
grep -qi ubuntu /etc/os-release || die "Este instalador está pensado para Ubuntu 24.04 LTS."
[ -n "$DOMAIN" ] || die "Indica el dominio. Ejemplo: bash install-ubuntu.sh tepsup.com admin@tepsup.com"
[ -n "$ADMIN_EMAIL" ] || die "Indica el correo de la cuenta de administración. Ejemplo: bash install-ubuntu.sh tepsup.com admin@tepsup.com"
[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "Dominio inválido: $DOMAIN (usa solo el nombre, sin https://)"
[[ "$ADMIN_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$ ]] || die "Correo inválido: $ADMIN_EMAIL"

bold "1/8 · Paquetes base"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git gnupg ufw fail2ban sqlite3 openssl >/dev/null

bold "2/8 · Node.js 22 LTS"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "   Node $(node -v) · npm $(npm -v)"

bold "3/8 · Caddy (servidor web con HTTPS automático)"
if ! command -v caddy >/dev/null 2>&1; then
  install -d -m 0755 /usr/share/keyrings
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
echo "   $(caddy version | head -1)"

bold "4/8 · Usuario de servicio, carpetas y código"
id -u "$SVC_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SVC_USER"
install -d -m 0750 -o "$SVC_USER" -g "$SVC_USER" "$DATA_DIR" "$DATA_DIR/uploads"
install -d -m 0750 -o root -g "$SVC_USER" "$BACKUP_DIR"
install -d -m 0750 -o root -g "$SVC_USER" "$ENV_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet "$BRANCH"
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
chown -R "$SVC_USER:$SVC_USER" "$APP_DIR"
echo "   Código en $APP_DIR (rama $BRANCH, $(git -C "$APP_DIR" rev-parse --short HEAD))"

bold "5/8 · Dependencias e interfaz (puede tardar 1–3 minutos)"
sudo -u "$SVC_USER" -H bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund --loglevel=error && VITE_DEMO_MODE=false npm run build --silent && npm prune --omit=dev --no-audit --no-fund --loglevel=error"

bold "6/8 · Configuración del servicio"
ENV_FILE="$ENV_DIR/isup.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
# Configuración de ISUP Aula Virtual (generada por deploy/install-ubuntu.sh). No compartir.
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT
TRUST_PROXY=1
DATA_DIR=$DATA_DIR
JWT_SECRET=$(openssl rand -hex 48)
SESSION_HOURS=24
ISUP_SEED=minimal
ISUP_ADMIN_EMAIL=$ADMIN_EMAIL
ISUP_INSTITUTION=$INSTITUTION
ISUP_SHORT=$SHORT
PUBLIC_URL=https://$DOMAIN
EOF
  chmod 0640 "$ENV_FILE"; chown root:"$SVC_USER" "$ENV_FILE"
  echo "   Secretos generados en $ENV_FILE"
else
  echo "   Se conserva la configuración existente ($ENV_FILE)"
fi

cat > /etc/systemd/system/isup.service <<EOF
[Unit]
Description=ISUP Aula Virtual
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $APP_DIR/server/index.js
Restart=always
RestartSec=3
# Endurecimiento
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

HOSTS="$DOMAIN"
[ "$WWW" = "1" ] && [[ "$DOMAIN" != www.* ]] && HOSTS="$DOMAIN, www.$DOMAIN"
cat > /etc/caddy/Caddyfile <<EOF
# ISUP Aula Virtual · generado por deploy/install-ubuntu.sh
{
	email $ADMIN_EMAIL
}

$HOSTS {
	encode zstd gzip
	request_body {
		max_size 30MB
	}
	header {
		-Server
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
	}
	reverse_proxy 127.0.0.1:$PORT
	log {
		output file /var/log/caddy/isup-access.log {
			roll_size 20MiB
			roll_keep 10
		}
	}
}
EOF
caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || die "El Caddyfile generado no es válido (revisa /etc/caddy/Caddyfile)."

# Copia de seguridad diaria (base de datos + archivos subidos), 14 días de retención
install -m 0755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/isup-backup
cat > /etc/systemd/system/isup-backup.service <<EOF
[Unit]
Description=Copia de seguridad de ISUP Aula Virtual

[Service]
Type=oneshot
Environment=DATA_DIR=$DATA_DIR
Environment=BACKUP_DIR=$BACKUP_DIR
ExecStart=/usr/local/bin/isup-backup
EOF
cat > /etc/systemd/system/isup-backup.timer <<EOF
[Unit]
Description=Copia de seguridad diaria de ISUP Aula Virtual

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
EOF
install -m 0755 "$APP_DIR/deploy/update.sh" /usr/local/bin/isup-update

bold "7/8 · Firewall y protección de acceso"
if [ "$SKIP_SERVICES" = "1" ]; then
  echo "   (omitido sin systemd: ufw y fail2ban)"
else
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  systemctl enable --now fail2ban >/dev/null 2>&1 || true
  echo "   ufw: 22, 80 y 443 abiertos · fail2ban activo (protege SSH)"
fi

bold "8/8 · Arranque"
if [ "$SKIP_SERVICES" = "1" ]; then
  # Arranque manual para comprobar que la aplicación levanta con la configuración generada
  sudo -u "$SVC_USER" -H bash -c "cd '$APP_DIR' && set -a && . '$ENV_FILE' && set +a && nohup node server/index.js > /tmp/isup-test.log 2>&1 & echo \$! > /tmp/isup-test.pid"
else
  systemctl daemon-reload
  systemctl enable --now isup.service >/dev/null
  systemctl restart isup.service
  systemctl enable --now isup-backup.timer >/dev/null
  systemctl enable caddy >/dev/null 2>&1 || true
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
fi

for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  if [ "$SKIP_SERVICES" = "1" ]; then cat /tmp/isup-test.log; else journalctl -u isup -n 30 --no-pager; fi
  die "El servicio no respondió. Revisa el registro anterior (journalctl -u isup)."
fi
if [ "$SKIP_SERVICES" = "1" ]; then kill "$(cat /tmp/isup-test.pid)" 2>/dev/null || true; fi

IP="$(curl -fsS -4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"

printf '\n\033[32m✔ ISUP Aula Virtual instalada y en ejecución.\033[0m\n\n'
echo "   Sitio:            https://$DOMAIN  (y https://www.$DOMAIN)"
echo "   Ingreso:          https://$DOMAIN/login"
if [ -f "$DATA_DIR/ADMIN_INICIAL.txt" ]; then
  echo "   Administración:   $(grep -i '^Correo' "$DATA_DIR/ADMIN_INICIAL.txt" | awk '{print $2}')"
  echo "   Contraseña:       $(grep -i '^Contraseña' "$DATA_DIR/ADMIN_INICIAL.txt" | awk '{print $2}')  ← cámbiala en Mi perfil y borra $DATA_DIR/ADMIN_INICIAL.txt"
fi
echo "   Datos:            $DATA_DIR  ·  copias diarias en $BACKUP_DIR"
echo "   Actualizar:       sudo isup-update        ·  Estado: systemctl status isup caddy"
if [ -n "$RESOLVED" ] && [ -n "$IP" ] && [ "$RESOLVED" != "$IP" ]; then
  printf '\n\033[33m⚠ El dominio %s resuelve a %s pero este servidor es %s.\n   Actualiza el registro A en tu proveedor de DNS (GoDaddy) y espera unos minutos: Caddy emitirá el certificado HTTPS automáticamente.\033[0m\n' "$DOMAIN" "$RESOLVED" "$IP"
elif [ -z "$RESOLVED" ]; then
  printf '\n\033[33m⚠ El dominio %s todavía no resuelve. Crea el registro A → %s en GoDaddy; el HTTPS se activará solo cuando propague.\033[0m\n' "$DOMAIN" "$IP"
fi
echo
