#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-/var/www/html}"
APP_USER="${2:-nodejs}"
APP_GROUP="$(id -gn "$APP_USER")"
ENV_FILE="$APP_PATH/.env.production"
BACKUP_ROOT="/var/backups/steelprodukt"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

if [ "$(id -u)" -ne 0 ]; then
  echo "Production preparation must run as root."
  exit 1
fi

# Remove only the temporary key label used during this maintenance session.
# Existing deployment and administrator keys are left untouched.
if [ -f /root/.ssh/authorized_keys ]; then
  sed -i '/codex-production-deploy-20260803/d' /root/.ssh/authorized_keys
  chmod 0600 /root/.ssh/authorized_keys
fi
rm -f /tmp/codex-key.hex /tmp/codex-punct

test -d "$APP_PATH"
test -f "$APP_PATH/package.json"
test -f "$ENV_FILE" || {
  echo "Production environment file is missing: $ENV_FILE"
  exit 1
}

install -d -m 0700 -o root -g root "$BACKUP_ROOT" "$BACKUP_DIR"
install -m 0600 -o root -g root "$ENV_FILE" "$BACKUP_DIR/env.production.before"

environment_value() {
  local key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
    }
    END { print value }
  ' "$ENV_FILE"
}

unquote_value() {
  local value="$1"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value#\"}"
    value="${value%\"}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value#\'}"
    value="${value%\'}"
  fi
  printf '%s' "$value"
}

extract_email_address() {
  local value
  local candidate
  value="$(unquote_value "$1")"
  case "$value" in
    *"<"*">")
      candidate="${value##*<}"
      candidate="${candidate%%>*}"
      ;;
    *)
      candidate="$value"
      ;;
  esac
  candidate="${candidate#"${candidate%%[![:space:]]*}"}"
  candidate="${candidate%"${candidate##*[![:space:]]}"}"
  if [[ "$candidate" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    printf '%s' "$candidate"
  fi
}

set_environment_value() {
  local key="$1"
  local value="$2"
  local temporary
  temporary="$(mktemp "$APP_PATH/.env.production.tmp.XXXXXX")"
  awk -v key="$key" 'index($0, key "=") != 1 { print }' "$ENV_FILE" > "$temporary"
  printf '%s=%s\n' "$key" "$value" >> "$temporary"
  chown "$APP_USER:$APP_GROUP" "$temporary"
  chmod 0600 "$temporary"
  mv -f "$temporary" "$ENV_FILE"
}

set_default_environment_value() {
  local key="$1"
  local value="$2"
  if [ -z "$(environment_value "$key")" ]; then
    set_environment_value "$key" "$value"
  fi
}

for required_smtp_key in \
  SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASSWORD SMTP_FROM QUOTE_RECIPIENT
do
  if [ -z "$(environment_value "$required_smtp_key")" ]; then
    echo "Required SMTP setting is missing: $required_smtp_key"
    exit 1
  fi
done

smtp_from_email="$(extract_email_address "$(environment_value SMTP_FROM)")"
test -n "$smtp_from_email" || {
  echo "SMTP_FROM does not contain a valid sender address."
  exit 1
}

smtp_envelope_raw="$(unquote_value "$(environment_value SMTP_ENVELOPE_FROM)")"
smtp_envelope_email="$(extract_email_address "$smtp_envelope_raw")"
if [ -z "$smtp_envelope_email" ] || [ "$smtp_envelope_raw" != "$smtp_envelope_email" ]; then
  set_environment_value SMTP_ENVELOPE_FROM "$smtp_from_email"
fi

set_environment_value NEXT_PUBLIC_SITE_URL "https://www.steelprodukt.ru"
set_environment_value NEXT_PUBLIC_YM_COUNTER_ID "111263638"
set_default_environment_value NEXT_PUBLIC_YM_WEBVISOR "false"
set_environment_value QUOTE_STORAGE_PATH "/var/lib/steelprodukt/quote-leads"
set_environment_value ASSISTANT_LEAD_STORAGE_PATH "/var/lib/steelprodukt/assistant-leads"
set_environment_value UPLOAD_QUARANTINE_PATH "/var/lib/steelprodukt/quarantine"
set_environment_value CONSENT_AUDIT_STORAGE_PATH "/var/lib/steelprodukt/consent-audit"
set_default_environment_value LEAD_RETENTION_DAYS "90"
set_default_environment_value CONSENT_AUDIT_RETENTION_DAYS "1095"
set_environment_value TRUST_NGINX_PROXY "true"
set_default_environment_value CLAMAV_ENABLED "false"
set_default_environment_value CLAMAV_COMMAND "clamscan"
set_default_environment_value PD_ADMIN_ENABLED "false"
set_default_environment_value PD_ADMIN_DB_PATH "/var/lib/steelprodukt/admin/personal-data.sqlite"
set_default_environment_value PD_SEARCH_HMAC_KEY_VERSION "1"
set_default_environment_value PD_EXPORT_PATH "/var/lib/steelprodukt/exports"
set_default_environment_value PD_EXPORT_TTL_HOURS "24"
set_default_environment_value PD_SESSION_IDLE_MINUTES "30"
set_default_environment_value PD_SESSION_ABSOLUTE_HOURS "8"
set_default_environment_value PD_STEP_UP_MINUTES "10"
set_default_environment_value PD_MAX_LOGIN_ATTEMPTS "5"
set_default_environment_value PD_LOGIN_LOCK_MINUTES "15"

ip_salt="$(unquote_value "$(environment_value IP_HASH_SALT)")"
consent_salt="$(unquote_value "$(environment_value CONSENT_AUDIT_SALT)")"

if [ "${#ip_salt}" -lt 32 ]; then
  ip_salt="$(openssl rand -hex 32)"
  set_environment_value IP_HASH_SALT "$ip_salt"
fi

if [ "${#consent_salt}" -lt 32 ] || [ "$consent_salt" = "$ip_salt" ]; then
  consent_salt="$(openssl rand -hex 32)"
  set_environment_value CONSENT_AUDIT_SALT "$consent_salt"
fi

chown "$APP_USER:$APP_GROUP" "$ENV_FILE"
chmod 0600 "$ENV_FILE"

bash "$APP_PATH/deploy/prepare-storage.sh" "$APP_USER"

migrate_existing_records() {
  local source="$1"
  local destination="$2"
  if [ ! -d "$source" ]; then
    return
  fi
  find "$source" -maxdepth 1 -type f -exec cp --update=none --preserve=timestamps {} "$destination/" \;
}

migrate_existing_records "$APP_PATH/.data/quote-leads" "/var/lib/steelprodukt/quote-leads"
migrate_existing_records "$APP_PATH/.data/consent-audit" "/var/lib/steelprodukt/consent-audit"
migrate_existing_records "$APP_PATH/.data/assistant-leads" "/var/lib/steelprodukt/assistant-leads"

find /var/lib/steelprodukt -type d -exec chown "$APP_USER:$APP_GROUP" {} + -exec chmod 0700 {} +
find /var/lib/steelprodukt -type f -exec chown "$APP_USER:$APP_GROUP" {} + -exec chmod 0600 {} +

# A failed VNC maintenance attempt created this truncated, non-production vhost.
# Quarantine only that exact known artifact and retain it in the dated backup.
for accidental_nginx_artifact in \
  /etc/nginx/sites-enabled/sToeey \
  /etc/nginx/sites-available/sToeey
do
  if [ -e "$accidental_nginx_artifact" ] || [ -L "$accidental_nginx_artifact" ]; then
    artifact_parent="$(basename "$(dirname "$accidental_nginx_artifact")")"
    artifact_backup="$BACKUP_DIR/nginx-quarantined-${artifact_parent}-sToeey"
    mv -- "$accidental_nginx_artifact" "$artifact_backup"
    chmod 0600 "$artifact_backup" 2>/dev/null || true
  fi
done

nginx_enabled="$(grep -l 'server_name .*steelprodukt\.ru' /etc/nginx/sites-enabled/* 2>/dev/null | head -n 1 || true)"
test -n "$nginx_enabled" || {
  echo "Active steelprodukt.ru Nginx virtual host was not found."
  exit 1
}
nginx_target="$(readlink -f "$nginx_enabled")"
test -f "$nginx_target"
install -m 0600 -o root -g root "$nginx_target" "$BACKUP_DIR/nginx.before.conf"

install -m 0644 -o root -g root "$APP_PATH/deploy/nginx/steelprodukt.conf" "$nginx_target"
if ! nginx -t; then
  install -m 0644 -o root -g root "$BACKUP_DIR/nginx.before.conf" "$nginx_target"
  nginx -t
  echo "New Nginx configuration was rejected and the previous file was restored."
  exit 1
fi
systemctl reload nginx

printf '%s\n' \
  "Production preparation passed." \
  "Backup directory: $BACKUP_DIR" \
  "Environment: present and protected" \
  "Storage: writable by $APP_USER" \
  "Nginx: validated and reloaded"
