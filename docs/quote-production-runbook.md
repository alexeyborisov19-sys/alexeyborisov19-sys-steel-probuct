# Production runbook: форма заявки

Документ фиксирует проверенный порядок выпуска формы `/api/quote`. Он не
публикует сайт автоматически и не содержит значений секретов.

## Подтверждённая первопричина инцидента

Production-запрос сначала успешно создавал JSON-запись заявки, затем переходил
к журналу согласий. В production отсутствовали `CONSENT_AUDIT_SALT` и
`IP_HASH_SALT`, поэтому хеширование контакта завершалось исключением. Общий
обработчик возвращал клиенту HTTP 500 до вызова SMTP. Поэтому наблюдение
«почта отправляет» в более ранней версии не противоречит инциденту: текущая
ошибка возникала раньше почтовой доставки и была вызвана конфигурацией аудита.

До исправления подтверждены:

- HTTP 500 с обезличенным сообщением;
- появление JSON заявки в закрытом хранилище;
- отсутствие записи consent audit;
- отсутствие вызова SMTP;
- серверное событие `quote/internal_error`.

## Новое согласованное поведение

- Запись заявки создаётся до необязательной почтовой доставки.
- Успешно сохранённая заявка не теряется при временной ошибке SMTP: API
  возвращает 202 и код `SMTP_DELIVERY_DEFERRED`.
- Ответ всегда содержит `requestId`; тот же идентификатор попадает в
  обезличенные серверные события.
- Ошибка обязательной конфигурации возвращает 503 `CONFIGURATION_ERROR` и
  должна быть обнаружена командой `npm run env:check` до сборки.
- Ошибка первичного сохранения возвращает 500 `STORAGE_ERROR`; ложное
  подтверждение клиенту не показывается.
- Заблокированный антивирусом файл остаётся только в закрытом карантине,
  заявка не создаётся, API возвращает 422 `UPLOAD_REJECTED`.
- В логах нет имени, телефона, e-mail, текста заявки, имён или содержимого
  файлов, значений environment и stack trace ответа.

## Обязательные environment variables

Значения хранятся только на production-сервере в `.env.production` с правами
`0600`. В Git заносятся только имена:

```text
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_YM_COUNTER_ID
NEXT_PUBLIC_YM_WEBVISOR
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
SMTP_ENVELOPE_FROM
QUOTE_RECIPIENT
QUOTE_STORAGE_PATH
ASSISTANT_LEAD_STORAGE_PATH
UPLOAD_QUARANTINE_PATH
CONSENT_AUDIT_STORAGE_PATH
LEAD_RETENTION_DAYS
CONSENT_AUDIT_RETENTION_DAYS
IP_HASH_SALT
CONSENT_AUDIT_SALT
TRUST_NGINX_PROXY
CLAMAV_ENABLED
CLAMAV_COMMAND
```

`NEXT_PUBLIC_YM_COUNTER_ID` должен быть `111263638`. Обе соли должны быть
разными случайными строками длиной не менее 32 символов. Их нельзя вставлять в
командную строку, чат, GitHub Actions log или репозиторий.

## Подготовка сервера

Проверить пользователя PM2 и рабочий каталог:

```bash
sudo -iu nodejs pm2 describe steelprodukt
sudo -iu nodejs pm2 env 0 | sed -n '/NODE_ENV/p;/PORT/p'
```

Не печатать `.env.production`. Открыть его локальным редактором на сервере,
добавить обязательные ключи и установить права:

```bash
chown nodejs:nodejs /var/www/html/.env.production
chmod 0600 /var/www/html/.env.production
```

Создать защищённые каталоги без удаления существующих заявок. Production
workflow выполняет это через `deploy/prepare-production.sh`: скрипт также
создаёт закрытую резервную копию environment и Nginx, добавляет только
отсутствующие production-настройки, генерирует salts непосредственно на
сервере и копирует прежние записи и вложения из `.data` без их удаления и
без перезаписи уже перенесённых файлов.

Для ручного запуска:

```bash
cd /var/www/html
sudo bash deploy/prepare-production.sh /var/www/html nodejs
find /var/lib/steelprodukt -maxdepth 1 -type d -exec stat -c '%a %U:%G %n' {} \;
df -h /var/lib/steelprodukt
df -i /var/lib/steelprodukt
```

Полный набор проверок, временный локальный запуск для `seo:audit` и безопасный
перезапуск PM2 выполняются отдельным скриптом:

```bash
sudo -iu nodejs bash /var/www/html/deploy/build-and-restart.sh /var/www/html
```

PM2 перезапускается только после успешного завершения всех предыдущих команд.

Ожидается `0700 nodejs:nodejs` для каталогов. Создаваемые приложением файлы
должны иметь `0600` и не должны находиться внутри `public`.

## Nginx

Сверить активный virtual host с `deploy/nginx/steelprodukt.conf`. Для формы
важны:

- `client_max_body_size 11m`;
- proxy на `127.0.0.1:3000`;
- `Host`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`;
- `proxy_request_buffering on`;
- таймаут чтения 60 секунд;
- отсутствие публичного доступа к порту Node.js.

После ручной установки конфигурации:

```bash
nginx -t
systemctl reload nginx
```

## Проверка и выпуск

До merge и на сервере выполнять:

```bash
cd /var/www/html
npm ci
npm run env:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run seo:audit
sudo -iu nodejs bash -lc 'cd /var/www/html && pm2 startOrReload ecosystem.config.cjs --env production --update-env && pm2 save'
```

Если `env:check`, тесты или build не прошли, процесс не перезапускать.

## Post-deploy проверка формы

1. Отправить через браузер согласованную тестовую заявку без файла.
2. Убедиться в 200 или 202 и записать показанный `requestId`.
3. Повторить с заранее подготовленным безопасным небольшим PDF.
4. Проверить только наличие файлов и права, не выводя содержимое:

```bash
find /var/lib/steelprodukt/quote-leads -maxdepth 1 -type f -printf '%m %u:%g %f\n' | tail
find /var/lib/steelprodukt/consent-audit -maxdepth 1 -type f -printf '%m %u:%g %f\n' | tail
find /var/lib/steelprodukt/quarantine -maxdepth 2 -type f -printf '%m %u:%g %f\n' | tail
```

5. Проверить обезличенные PM2-события по `requestId`.
6. Подтвердить получение почтового уведомления либо допустимый статус 202
   `SMTP_DELIVERY_DEFERRED`. В обоих случаях JSON заявки должен существовать.

## Яндекс Метрика — ручная проверка после выпуска

Codex не меняет цели в кабинете автоматически.

1. Переименовать первую ошибочно созданную цель в «Начало заполнения формы».
2. Установить идентификатор `quote_form_started`.
3. Выбрать условие «Равно», а не «Содержит».
4. Оставить отдельные цели `quote_file_attached`, `quote_request_submit` и
   `quote_request_success`.
5. Через Debugger/Network подтвердить, что `tag.js` не запрашивается до
   согласия и запрашивается после него.
6. Проверить события `quote_form_started`, `quote_file_attached`,
   `quote_request_submit`, `quote_request_success`, `quote_request_error`.
7. Убедиться, что параметры не содержат имя, компанию, телефон, e-mail, текст
   сообщения, имя или содержимое файла.

## Поисковые кабинеты после выпуска

SEO-тексты и canonical origin `https://www.steelprodukt.ru` не менялись.
После релиза формы через IndexNow отправляется только изменённая индексируемая
страница:

```bash
npm run indexnow:submit -- /contacts
```

В Яндекс Вебмастере проверить `/contacts`; API не отправлять на переобход.

В Google Search Console вручную:

- подтвердить свойство `https://www.steelprodukt.ru`;
- отправить `/sitemap.xml`;
- проверить `/`, `/production`,
  `/production/lazernaya-rezka-metalla`, `/products`, `/articles`, `/contacts`.

Наличие URL в кабинете или публичной выдаче не объявлять до фактического
подтверждения сервиса.

## Rollback

Перед выпуском сохранить номер предыдущего commit и резервную копию Nginx.
При регрессии:

1. развернуть предыдущий проверенный commit тем же GitHub Actions workflow или
   теми же ручными командами;
2. выполнить `npm ci && npm run build`;
3. выполнить PM2 `startOrReload` с `--update-env`;
4. восстановить предыдущий Nginx virtual host только если менялся Nginx;
5. не удалять `/var/lib/steelprodukt` и не откатывать/перезаписывать
   `.env.production`;
6. проверить существующие JSON-заявки по количеству и правам, не читая их в
   общий лог.
