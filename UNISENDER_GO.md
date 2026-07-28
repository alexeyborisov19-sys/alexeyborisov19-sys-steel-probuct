# Подключение заявок к Unisender Go

Форма «Получить расчёт» уже готова отправлять заявки на адрес `info@steelprodukt.ru` и поддерживает PDF, DXF, DWG, STEP, изображения, документы и архивы. Для совместимости с UniSender Go лимит составляет 10 МБ на письмо и 7 МБ на один файл.

## Что уже проверено

- домен `steelprodukt.ru` содержит SPF-запись UniSender;
- DKIM-запись `gokey._domainkey.steelprodukt.ru` опубликована;
- DMARC направлен на UniSender;
- форма использует защищённое SMTP-подключение и не хранит ключи в исходном коде.

## Единственные секретные параметры

В UniSender Go в разделе SMTP/API нужны:

- `user_id` или `project_id`;
- API-ключ пользователя или проекта.

Их нельзя добавлять в GitHub и не следует присылать в чат. Их нужно поместить только на VPS в `/var/www/html/.env.production`:

```env
SMTP_HOST=smtp.go2.unisender.ru
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ваш_user_id_или_project_id
SMTP_PASSWORD=ваш_API_ключ
SMTP_FROM=info@steelprodukt.ru
SMTP_ENVELOPE_FROM=info@steelprodukt.ru
QUOTE_RECIPIENT=info@steelprodukt.ru
```

## Обязательная проверка домена

В UniSender должен быть подтверждён домен `steelprodukt.ru` для транзакционной
отправки. Видимый отправитель и Return-Path должны использовать домен
`steelprodukt.ru` или его поддомен, а DKIM-подпись — быть от имени
`steelprodukt.ru`. Иначе Mail.ru может отклонить письмо, даже если форма сайта
заполнена корректно.

После сохранения файла сайт перезапускается:

```bash
cd /var/www/html
npm run build
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
```

## Проверка

Отправьте заявку через страницу «Получить расчёт» с тестовым адресом и небольшим PDF. Успешная форма подтвердит отправку, а письмо придёт на `info@steelprodukt.ru`.

> На бесплатном тарифе UniSender Go разрешает отправку только на адреса подтверждённых доменов. Для заявок от любых клиентов потребуется активировать подходящий тариф. Это ограничение сервиса, не сайта.
