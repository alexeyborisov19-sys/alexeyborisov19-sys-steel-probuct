# Yandex promotion setup

1. В Webmaster добавить сайт и подтвердить право владения метатегом. Записать значение в переменную окружения NEXT_PUBLIC_YANDEX_VERIFICATION.
2. В структуре сайта добавить sitemap: https://www.steelprodukt.ru/sitemap.xml.
3. В Yandex Metrica создать счётчик и указать NEXT_PUBLIC_YM_COUNTER_ID.
4. Создать JS-цели с идентификаторами:
   - ym-open-leadform
   - quote_form_started
   - quote_file_attached
   - quote_request_submit
   - ym-submit-leadform
   - quote_request_success
   - catalog_download
   - quote_files_cta_click
   - ym-show-contacts
   - email_click
5. Для Директа и РСЯ использовать как основную конверсию ym-submit-leadform только после успешной отправки заявки.
6. Директ и РСЯ требуют отдельного согласованного бюджета.
