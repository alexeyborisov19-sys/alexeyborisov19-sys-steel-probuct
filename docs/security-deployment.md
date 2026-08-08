# Безопасное развёртывание

Этот документ — пример для проверенного Nginx reverse proxy. Он не публикует
сайт и не меняет конфигурацию сервера автоматически.

## Обязательная схема

- Публично доступны только Nginx-порты `80/443`.
- Node.js/PM2 слушает `127.0.0.1:3000`, а не внешний интерфейс.
- `TRUST_NGINX_PROXY=true` задаётся только при выполнении предыдущего условия.
- Nginx перезаписывает `X-Real-IP`; клиентский `X-Forwarded-For` не используется
  приложением для ограничений.
- Заявки и карантин находятся вне `public` на российском сервере с правами
  каталогов `0700` и файлов `0600`.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name steelprodukt.ru www.steelprodukt.ru;
    return 301 https://www.steelprodukt.ru$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name steelprodukt.ru;
    return 301 https://www.steelprodukt.ru$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.steelprodukt.ru;

    # Пути к сертификатам задаются средствами панели/Certbot.
    ssl_certificate     /etc/letsencrypt/live/www.steelprodukt.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.steelprodukt.ru/privkey.pem;

    client_max_body_size 11m;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_request_buffering on;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

HSTS добавляется только на HTTPS-виртуальном хосте. Production-сборка уже
отправляет блокирующий CSP. После подключения любого нового внешнего ресурса
нужно проверить Яндекс Метрику после согласия, формы, изображения и
ИИ-инженера; разрешайте только точный origin, без `*` и `unsafe-eval`.

## Переменные хранения

```text
TRUST_NGINX_PROXY=true
IP_HASH_SALT=<случайная локальная строка>
UPLOAD_QUARANTINE_PATH=/var/lib/steelprodukt/quarantine
ASSISTANT_LEAD_STORAGE_PATH=/var/lib/steelprodukt/assistant-leads
QUOTE_STORAGE_PATH=/var/lib/steelprodukt/quote-leads
CONSENT_AUDIT_STORAGE_PATH=/var/lib/steelprodukt/consent-audit
LEAD_RETENTION_DAYS=90
CONSENT_AUDIT_RETENTION_DAYS=1095
CONSENT_AUDIT_SALT=<отдельная случайная локальная строка>
CLAMAV_ENABLED=false
```

Если `CLAMAV_ENABLED=true`, на сервере должен быть доступен `clamscan`.
Архивы не распаковываются приложением. CAD и архивы остаются помеченными как
непроверенные, пока антивирусная проверка не завершилась успешно.

## Ограничения текущего серверного хранилища

Rate limiter и сессии ИИ-инженера сейчас хранятся в памяти одного процесса.
Интерфейсы вынесены отдельно, чтобы позднее подключить Redis. До этого:

- PM2 должен запускать один экземпляр приложения;
- перезапуск процесса обнуляет лимиты и диалоговые сессии;
- горизонтальное масштабирование без общего Redis-хранилища не допускается.

## Локальная проверка секретов

Перед коммитом установите `gitleaks` и выполните:

```bash
npm run secrets:scan
trufflehog git file://. --only-verified
```

Действующий GitHub Actions workflow публикует только `main`; ветка и draft PR
не запускают production-релиз. Если инструмент обнаружит секрет в истории,
сначала его отзывают или меняют. Очистка истории и force push выполняются
только по отдельному решению владельца.

Проверка environment, подготовка каталогов, post-deploy тесты и rollback
описаны в `docs/quote-production-runbook.md`.

Пошаговая проверка фактического firewall, привязки `127.0.0.1:3000` и внешнего
отказа на IP:3000 приведена в `docs/personal-data-stage-2-architecture.md`.
Наличие правильной строки в PM2-конфигурации не является подтверждением
production-состояния: требуются `ss`, локальный и внешний `curl`.
