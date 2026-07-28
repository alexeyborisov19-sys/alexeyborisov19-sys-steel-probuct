import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/LegalDocument";
import { legalLinks, legalOperator } from "@/lib/legal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Сервисы обработки данных",
  description: "Информационные системы, аналитика, CRM и мессенджеры сайта Сталь Продукт.",
  path: legalLinks.services,
});

function getServices() {
  const yandexAiEnabled = process.env.YANDEX_AI_ENABLED === "true"
    && Boolean(process.env.YANDEX_AI_API_KEY)
    && Boolean(process.env.YANDEX_AI_FOLDER_ID);
  const telegramEnabled = process.env.ASSISTANT_TELEGRAM_ENABLED === "true"
    && Boolean(process.env.TELEGRAM_BOT_TOKEN)
    && Boolean(process.env.TELEGRAM_LEADS_CHAT_ID);

  return [
  {
    service: "Сайт и сервер",
    status: "Используется",
    data: "Данные формы, технические журналы, журнал согласий",
    condition: "Первичная база и журнал согласий должны размещаться на сервере в Российской Федерации; доступ ограничивается уполномоченными лицами.",
  },
  {
    service: "Корпоративная электронная почта",
    status: "Используется после настройки",
    data: "Имя, контакты, сообщение и приложенные пользователем файлы",
    condition: "Поставщик подключается только после проверки договора, места хранения данных, SPF/DKIM/DMARC и мер конфиденциальности.",
  },
  {
    service: "Яндекс Метрика",
    status: "Только после согласия",
    data: "Сетевые и браузерные идентификаторы, страницы и события посещения",
    condition: "До выбора «Разрешить аналитику» код Метрики не загружается. Вебвизор по умолчанию отключён.",
  },
  {
    service: "CRM",
    status: "Не подключена к форме",
    data: "Автоматическая передача отсутствует",
    condition: "Подключение возможно только после проверки локализации, договора поручения обработки, сроков хранения и прав доступа.",
  },
  {
    service: "ИИ-инженер: локальная база знаний",
    status: "Используется",
    data: "Текст технического диалога без приложенных файлов",
    condition: "Базовые ответы формируются на сервере сайта. Контакты и чертежи собираются отдельной формой и не передаются в модуль ответов.",
  },
  {
    service: "Yandex AI для ИИ-инженера",
    status: yandexAiEnabled ? "Включён администратором" : "Не включён",
    data: "Текст технического диалога; телефон и e-mail автоматически заменяются служебными обозначениями",
    condition: "Работает только при явном серверном флаге YANDEX_AI_ENABLED=true. Файлы и поля защищённой формы в запрос к модели не включаются.",
  },
  {
    service: "Telegram: уведомления о заявках ИИ-инженера",
    status: telegramEnabled ? "Включён администратором" : "Не включён",
    data: telegramEnabled ? "Имя, контакт, техническая сводка и приложенные файлы" : "Автоматическая передача отсутствует",
    condition: "Работает только при явном серверном флаге ASSISTANT_TELEGRAM_ENABLED=true и после правовой проверки канала, локализации, состава данных и договорных условий.",
  },
  {
    service: "Иностранные облака и ИИ-сервисы",
    status: "Не подключены к заявкам",
    data: "Данные заявок и чертежи автоматически не передаются",
    condition: "Любое подключение требует предварительной оценки трансграничной передачи и, когда применимо, отдельного уведомления Роскомнадзора.",
  },
] as const;
}

export default function ServicesPage() {
  const services = getServices();
  return <LegalDocument title="Сервисы обработки данных" description="Прозрачный перечень категорий систем, связанных с работой сайта и заявок.">
    <p className="legal-document__date">Актуально на {legalOperator.policyVersion}</p>
    <p>Страница отражает состояние интеграций сайта. Перед подключением нового сервиса Оператор обновляет внутренний реестр, проверяет место нахождения баз данных, договорные условия, объём передаваемых сведений и необходимость уведомлений Роскомнадзора.</p>

    <div className="mt-7 overflow-x-auto border-y border-white/10">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-[.08em] text-white/45">
            <th className="px-3 py-4">Система</th>
            <th className="px-3 py-4">Статус</th>
            <th className="px-3 py-4">Данные</th>
            <th className="px-3 py-4">Условие использования</th>
          </tr>
        </thead>
        <tbody>
          {services.map((item) => <tr key={item.service} className="border-b border-white/8 align-top">
            <td className="px-3 py-4 font-semibold text-white">{item.service}</td>
            <td className="px-3 py-4 text-steel-orange">{item.status}</td>
            <td className="px-3 py-4">{item.data}</td>
            <td className="px-3 py-4">{item.condition}</td>
          </tr>)}
        </tbody>
      </table>
    </div>

    <h2>Передача по поручению</h2>
    <p>Если поставщик получает доступ к персональным данным, договор должен определять перечень данных, операции, цели, конфиденциальность, требования безопасности, локализацию, порядок удаления и подтверждение принятых мер.</p>
    <h2>Трансграничная передача</h2>
    <p>Форма сайта не должна направлять данные за пределы Российской Федерации автоматически. Если бизнес-процесс потребует иностранного сервиса, Оператор до начала передачи проводит правовую и техническую оценку и выполняет требования статьи 12 Федерального закона № 152-ФЗ.</p>
    <h2>Связанные документы</h2>
    <p>Подробности приведены в <Link href={legalLinks.privacy}>политике обработки персональных данных</Link>, <Link href={legalLinks.cookies}>политике cookies</Link> и <Link href={legalLinks.personalDataConsent}>согласии для формы заявки</Link>.</p>
  </LegalDocument>;
}
