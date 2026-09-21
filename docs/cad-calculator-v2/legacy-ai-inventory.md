# Найденные реализации ИИ-калькулятора — 21.09.2026

## Действующее основание

Коммит `a617165a2204339d074cad125420be95831490cf`, PR #157, добавил интегрированный quote-engine. Он уже входит в текущую базу `5556806`; переносить этот модуль повторно из старой папки не требуется.

- `lib/server/quote-engine/cad-stage-review.ts`: аудит каждой CAD-позиции; текущий файл побайтово совпадает с версией из #157 (SHA-256 `22fafe58bec8743348a5912096707bd6bcf5a17fcd5b4b96e28c386b2a0c9365`).
- `lib/server/quote-engine/stage-review.ts`: восемь этапов, ограниченный JSON-контракт, программные блокировки нельзя отменить ответом модели.
- `lib/server/quote-engine/model-completion.ts`, `local-completion.ts`: Yandex и локальный Ollama, без автоматического переключения на платный провайдер.
- `lib/server/quote-engine/ai-extraction.ts`: извлечение параметров из диалога.
- `lib/server/instant-quote/run-confidential-calculation.ts`: реальный вызов CAD-аудита; `quoteControl` сохраняется в закрытом производственном отчёте до ответа клиенту.
- `components/EngineeringAssistant.tsx`: прежний диалоговый интерфейс калькулятора. PR #162 переключил launcher на `NavigationAssistant`, но серверный CAD-аудит не удалил.

Наличие кода не доказывает, что модель настроена на рабочем сервере. В этой проверке реальные ключи и платные запросы не использовались.

## Старые локальные копии

Проверены checkout в Documents/Codex от 26.08, 14.09 и 17.09. Их HEAD соответственно `ad159b1`, `e5b56d4`, `2fdb28f`; это не актуальная база нового приложения.

В `/Users/alex/Documents/Codex/2026-09-17/https-www-steelprodukt-ru-online-order/work/steel-produkt` обнаружены незарегистрированные дубли:

- `lib/instant-quote/client-quote-handoff 2.ts` — полностью совпадает с `client-quote-handoff.ts`.
- `tests/client-cad-files.test 2.ts` — полностью совпадает с `client-cad-files.test.ts`.

Уникальных изменений в этих двух дублях нет. Они оставлены без изменений; старые checkout не редактировались. Поиск по именам файлов в Documents/Codex не нашёл отдельного старого HTML с ИИ-калькулятором.

## Использование в новом приложении

Новая `ProductionApplication` использует общий `useCadProject` и существующий серверный pipeline. `ProductionAudit` читает сохранённый `quoteControl`, показывает фактические статусы и привязку к отчёту. Пока серверная панель не соответствует ID текущего расчёта, показывается загрузка, а не аудит предыдущей версии.
