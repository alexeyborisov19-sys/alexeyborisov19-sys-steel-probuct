# Запуск переиндексации в Яндексе

> Сейчас изменения подготовлены только локально. До публикации новую карту сайта и переобход в Яндекс Вебмастере не запускать.

## Что уже подготовлено в коде

- основной адрес сайта: `https://www.steelprodukt.ru`;
- единый canonical для каждой индексируемой страницы;
- `robots.txt` с отдельной секцией Yandex, `Host` и ссылкой на sitemap;
- `sitemap.xml` со всеми индексируемыми страницами, актуальными `lastmod`, приоритетами и частотой обновления;
- отдельная карта изображений `sitemap-images.xml` с фотографиями производства, продукции и отраслевых решений;
- уникальные title и description;
- микроразметка Organization, WebSite, WebPage, BreadcrumbList, ItemList, Service, Product, FAQPage и Article;
- отдельные SEO-кластеры для 16 типов объектов, 9 видов фасадной продукции и 6 производственных операций;
- полный индексируемый перечень продукции внутри каждой отрасли без генерации пустых страниц-дублей;
- двусторонняя перелинковка «продукция ↔ решения для объектов»;
- 301-редиректы со старых релевантных адресов;
- ответ 410 Gone для окончательно удалённых страниц прежнего сайта;
- внутренние ссылки из статей на коммерческие разделы.

## Действия сразу после публикации

1. Проверить:
   - `https://www.steelprodukt.ru/robots.txt`;
   - `https://www.steelprodukt.ru/sitemap.xml`;
   - `https://www.steelprodukt.ru/sitemap-images.xml`;
   - canonical на главной, странице производства, карточке продукта и статье.
2. В Яндекс Вебмастере открыть **Индексирование → Файлы Sitemap**.
3. Добавить два адреса:
   - `https://www.steelprodukt.ru/sitemap.xml`;
   - `https://www.steelprodukt.ru/sitemap-images.xml`.
4. Убедиться, что подтверждена именно версия `https://www.steelprodukt.ru`.
5. Открыть **Индексирование → Переобход страниц** и отправлять URL партиями в указанном ниже порядке.

## Очередь на первоочередной переобход

1. `https://www.steelprodukt.ru/`
2. `https://www.steelprodukt.ru/production`
3. `https://www.steelprodukt.ru/products`
4. `https://www.steelprodukt.ru/products/metallokassety`
5. `https://www.steelprodukt.ru/calculator-metallokassety`
6. `https://www.steelprodukt.ru/solutions`
7. `https://www.steelprodukt.ru/solutions/climate`
8. `https://www.steelprodukt.ru/solutions/industry`
9. `https://www.steelprodukt.ru/solutions/engineering`
10. `https://www.steelprodukt.ru/solutions/custom`
11. `https://www.steelprodukt.ru/industries`
12. `https://www.steelprodukt.ru/articles`
13. `https://www.steelprodukt.ru/contacts`

Следующей партией отправить шесть страниц производственных операций, затем 16 отраслевых страниц и девять карточек фасадной продукции.

Остальные URL Яндекс получит из sitemap. После основных страниц следует отправлять посадочные страницы отраслей, карточки продукции и новые статьи — в пределах доступного в Вебмастере дневного лимита.

## Контроль после запуска

- через 3–7 дней проверить **Индексирование → Страницы в поиске**;
- отслеживать ошибки sitemap, дубли и исключённые страницы;
- старые релевантные URL должны перейти в статус перенаправленных;
- окончательно удалённые старые URL должны постепенно исчезнуть после ответа 410;
- не менять даты `lastmod`, если содержимое страницы фактически не обновлялось;
- новые статьи связывать минимум с двумя коммерческими страницами сайта.

## Локальная техническая проверка

После сборки и запуска сайта:

```bash
npm run seo:audit
```

Проверка охватывает все URL из sitemap, title, description, canonical, robots, отсутствие noindex, дубли, JSON-LD и коммерческую перелинковку статей.
