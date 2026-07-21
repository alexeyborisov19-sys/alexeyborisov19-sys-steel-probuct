# Ручная публикация сайта на Beget

Для сайта не настраивается автодеплой, GitHub Actions и доступ по API. Сайт публикуется вручную один раз. Будущие изменения можно выкладывать отдельными версиями только по вашему решению.

## Что потребуется

- VPS Beget с готовым приложением **Node.js**;
- домен `steelprodukt.ru`, направленный на IP VPS;
- исходники проекта в одной папке;
- доступ в SSH-терминал VPS.

## Первичная публикация

1. Создайте VPS с приложением Node.js. В этой сборке уже есть Node.js, Nginx и PM2.
2. Укажите для домена A-записи `@` и `www` на IP VPS.
3. Загрузите папку проекта на сервер в `/var/www/steel-probuct` через файловый менеджер Beget или SFTP. Не загружайте `node_modules` и `.next`.
4. Создайте на сервере файл `/var/www/steel-probuct/.env.production` по образцу `.env.example` и внесите настройки почты для формы заявок.
5. Откройте SSH-терминал Beget и выполните:

   ```bash
   cd /var/www/steel-probuct
   npm install
   npm run build
   pm2 startOrReload ecosystem.config.cjs --env production
   pm2 save
   ```

6. Настройте Nginx как reverse proxy на `127.0.0.1:3000` и задайте `client_max_body_size 30m;` для чертежей.
7. После проверки домена включите HTTPS через Certbot.

## Как обновлять сайт позже

Когда потребуется новая версия, я подготовлю полный архив с изменёнными исходниками. Его нужно будет вручную заменить в папке `/var/www/steel-probuct`, не затрагивая `.env.production`, а затем выполнить четыре команды:

```bash
cd /var/www/steel-probuct
npm install
npm run build
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
```

Никаких автоматических обновлений, ключей GitHub или фоновых публикаций не будет.
