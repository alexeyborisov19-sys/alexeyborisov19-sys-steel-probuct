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

const services = [
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
    service: "Мессенджеры и онлайн-чаты",
    status: "Не подключены к форме",
    data: "Автоматическая передача отсутствует",
    condition: "Контакт через мессенджер возможен по инициативе пользователя. Рекламные сообщения требуют отдельного согласия.",
  },
  {
    service: "Иностранные облака и ИИ-сервисы",
    status: "Не подключены к заявкам",
    data: "Данные заявок и чертежи автоматически не передаются",
    condition: "Любое подключение требует предварительной оценки трансграничной передачи и, когда применимо, отдельного уведомления Роскомнадзора.",
  },
] as const;

export default function ServicesPage() {
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
