# Runbook production-миграции административной системы ПДн

Этот runbook подготавливает SQLite и пользователей, но не включает internal UI.
Все команды выполняются вручную в согласованное окно. Значения секретов не
выводятся и не копируются в отчёт.

## Предварительные условия

1. Зафиксировать commit выпуска и предыдущий рабочий commit.
2. Проверить публичную форму и ИИ-инженера до начала.
3. Убедиться, что `/var/www/html/.env.production` имеет режим `0600`, владелец
   `nodejs`, а сохранённое значение `PD_ADMIN_ENABLED=false`.
4. Проверить наличие всех `PD_*` по именам командой `npm run env:check`; значения
   не печатать.
5. Проверить свободное место и inode: `df -h /var/lib/steelprodukt` и
   `df -i /var/lib/steelprodukt`.
6. Проверить `node --version`, `pm2 describe steelprodukt`, loopback через
   `ss -lntp | grep ':3000'` и внешний отказ TCP/3000.

Любое несоответствие — условие остановки. Откат: не продолжать и сохранить
`PD_ADMIN_ENABLED=false`.

## Контрольная backup

Запустить установленную backup-команду, получить новый зашифрованный архив и
проверить его SHA-256 и обратное чтение. Не распаковывать поверх production.
Если проверка не прошла, миграцию не начинать.

## Каталоги

От root проверить без удаления содержимого:

```bash
install -d -m 0700 -o nodejs -g nodejs /var/lib/steelprodukt/admin /var/lib/steelprodukt/exports
stat -c '%a %U:%G %n' /var/lib/steelprodukt/admin /var/lib/steelprodukt/exports
```

Ожидается `700 nodejs:nodejs`. Rollback: каталоги не удалять; internal остаётся
выключенным.

## Миграции при выключенном кабинете

Сохранённый environment остаётся `PD_ADMIN_ENABLED=false`. Для CLI используется
только временное значение в отдельном процессе, поэтому PM2 и internal-маршруты
не включаются:

```bash
sudo -iu nodejs bash -lc '
  set -a
  . /var/www/html/.env.production
  set +a
  export PD_ADMIN_ENABLED=true
  cd /var/www/html
  npm run pd:migrate:status
  npm run pd:migrate
  npm run pd:migrate:status
  npm run pd:integrity-check
  npm run pd:audit-verify
'
```

Ожидается: pending `0`, SQLite integrity `ok`, foreign keys включены, audit chain
валидна. При ошибке остановиться, сохранить проблемную SQLite и журналы, не
перезапускать PM2 и перейти к rollback.

## Индексация

Сначала выполнить только dry-run в том же защищённом CLI-environment:

```bash
npm run pd:sync-index -- --dry-run
```

Сверить только количества и коды findings, не содержимое заявок. Ошибка,
необъяснимый orphan, symlink или повреждённый JSON — условие остановки. После
письменного подтверждения ответственного выполнить incremental sync и повторить
`pd:integrity-check`/`pd:audit-verify`.

## Первый администратор

Только после успешной проверки запустить интерактивно от `nodejs`:

```bash
npm run pd:create-admin
```

Пароль вводится скрыто и не передаётся аргументом. Учётная запись обязана
сменить временный пароль. Создание остальных ролей выполняется персонально.

## Проверка до включения

1. Убедиться, что сохранённый `PD_ADMIN_ENABLED=false`.
2. Проверить `/internal/personal-data` и internal API: ожидается 404.
3. Проверить публичный сайт, форму без файла и с PDF, SMTP и ИИ-инженера.
4. Выполнить fixture-приёмку в изолированном контуре.
5. Отдельно принять решение о включении. Этот runbook сам систему не включает.
