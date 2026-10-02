#!/usr/bin/env bash
# One-time setup of a FRESH Ubuntu 22.04 / 24.04 server for Moamenoon Cars.
#
#   1. Copy the whole project folder to the server (see deploy/DEPLOY-AR.md), for example into /root/moamenoon-src
#   2. Run as root, from inside that folder:
#        DOMAIN=your-domain.com EMAIL=you@gmail.com bash deploy/setup-server.sh
#
# It installs Node.js 22, nginx, PM2 and a firewall, copies the app to /var/www/moamenoon, starts it and (if the domain
# already points to this server) gets a free HTTPS certificate. Safe to run again: it never deletes your data/ folder.
set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN=your-domain.com}"
EMAIL="${EMAIL:?Set EMAIL=you@example.com (used by LetsEncrypt for certificate expiry notices)}"
APP_USER=moamenoon
APP_DIR=/var/www/moamenoon
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then echo "Run as root (sudo -i)."; exit 1; fi

echo "==> 1/8 system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg sudo ufw nginx rsync unattended-upgrades certbot python3-certbot-nginx cron

echo "==> 2/8 Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v
npm i -g pm2 >/dev/null

echo "==> 3/8 swap file (protects small servers from running out of memory while processing photos)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 4/8 app user and files"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"
rsync -a --delete --exclude 'node_modules' --exclude 'data' --exclude '.env' --exclude '.git' --exclude '*.zip' "$SRC_DIR"/ "$APP_DIR"/
mkdir -p "$APP_DIR/data"
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  # production settings (edit /var/www/moamenoon/.env afterwards to add ADMIN_PASSWORD and SMTP_PASS)
  {
    echo ""
    echo "NODE_ENV=production"
    echo "SITE_URL=https://$DOMAIN"
    echo "DATA_DIR=$APP_DIR/data"
    echo "PORT=3000"
    echo "TRUST_PROXY=1"
  } >> "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "   created $APP_DIR/.env - IMPORTANT: open it and set ADMIN_PASSWORD and SMTP_PASS, then run: pm2 reload moamenoon"
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --omit=dev --no-audit --no-fund

echo "==> 5/8 nginx"
mkdir -p /etc/nginx/snippets
cp "$APP_DIR/deploy/nginx-proxy.conf" /etc/nginx/snippets/moamenoon-proxy.conf
sed "s/YOUR-DOMAIN.com/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/moamenoon
ln -sf /etc/nginx/sites-available/moamenoon /etc/nginx/sites-enabled/moamenoon
rm -f /etc/nginx/sites-enabled/default
# nginx must be allowed to read the photos
chmod o+x /var/www "$APP_DIR" "$APP_DIR/data" 2>/dev/null || true
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> 6/8 firewall (only SSH + web ports are open)"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable

echo "==> 7/8 start the site with PM2 (auto-restarts, starts after a reboot)"
sudo -u "$APP_USER" pm2 startOrReload "$APP_DIR/deploy/ecosystem.config.js" --update-env
sudo -u "$APP_USER" pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null
sleep 3
curl -fsS http://127.0.0.1:3000/api/health && echo "  <- the app is answering"

echo "==> 8/8 daily backups (03:30) + HTTPS"
install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/moamenoon-backup
mkdir -p /var/backups/moamenoon && chown "$APP_USER":"$APP_USER" /var/backups/moamenoon
echo "30 3 * * * $APP_USER /usr/local/bin/moamenoon-backup >> /var/backups/moamenoon/backup.log 2>&1" > /etc/cron.d/moamenoon-backup

if getent hosts "$DOMAIN" >/dev/null && certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect; then
  echo "   HTTPS is on."
else
  echo "   HTTPS was NOT set up (the domain probably does not point to this server yet)."
  echo "   When it does, run:  certbot --nginx -d $DOMAIN -d www.$DOMAIN -m $EMAIL --agree-tos --redirect"
fi

echo
echo "Done. Next: nano $APP_DIR/.env  (set ADMIN_PASSWORD + SMTP_PASS)  then:  sudo -u $APP_USER pm2 reload moamenoon"
