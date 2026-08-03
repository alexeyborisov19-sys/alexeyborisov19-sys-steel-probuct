# Публикация сайта на Beget

Фактический production-механизм — GitHub Actions workflow
`.github/workflows/deploy-beget.yml`, который запускается при push в `main` или
вручную через `workflow_dispatch`. Ветки и draft Pull Request production не
публикуют. До merge обязательны проверки и ручное подтверждение владельца.

## Что потребуется

- VPS Beget с готовым приложением **Node.js**;
- домен `steelprodukt.ru`, направленный на IP VPS;
- исходники проекта в одной папке;
- доступ в SSH-терминал VPS.

## Первичная публикация

1. Создайте VPS с приложением Node.js. В этой сборке уже есть Node.js, Nginx и PM2.
2. Укажите для домена A-записи `@` и `www` на IP VPS.
3. Рабочий каталог действующего приложения — `/var/www/html`.
4. Создайте на сервере файл `/var/www/html/.env.production` по образцу
   `.env.example`. Значения секретов остаются только на сервере.
5. Откройте SSH-терминал Beget и выполните:

   ```bash
   cd /var/www/html
   sudo bash deploy/prepare-storage.sh nodejs
   npm ci
   npm run env:check
   npm run build
   pm2 startOrReload ecosystem.config.cjs --env production --update-env
   pm2 save
   ```

6. Настройте Nginx как reverse proxy на `127.0.0.1:3000` по файлу
   `deploy/nginx/steelprodukt.conf`; лимит запроса согласован с приложением и
   равен 11 МБ.
7. После проверки домена включите HTTPS через Certbot.

## Как обновлять сайт позже

Штатное обновление выполняется после проверенного Pull Request и merge в
`main`. Workflow не синхронизирует `.env.production`, `.data`, `node_modules`
и `.next`. Для аварийного ручного обновления используются те же проверки:

```bash
cd /var/www/html
npm ci
npm run env:check
npm run build
pm2 startOrReload ecosystem.config.cjs --env production --update-env
pm2 save
```

Полный порядок, проверка формы и rollback описаны в
`docs/quote-production-runbook.md`.
