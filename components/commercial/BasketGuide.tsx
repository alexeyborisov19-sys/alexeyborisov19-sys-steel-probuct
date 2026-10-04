import Image from "next/image";
const guidance = [
  {
    title: "Начните с того, что известно",
    text: "Знаете класс кондиционера? Выберите его как ориентир. Есть чертёж корзины? Сразу введите её наружные размеры. Точные размеры оборудования уточняются на следующем шаге.",
  },
  {
    title: "Корпус — ещё не вся установка",
    text: "Учитывайте клапаны, трубки и опоры. Для точного подбора измерьте всю установку и укажите зазоры из инструкции кондиционера. Неизвестные данные оставьте пустыми.",
  },
  {
    title: "Рисунок влияет и на резку, и на воздух",
    text: "Диаметр — размер отверстия. Шаг — расстояние между центрами. Поле — свободная полоса от края панели. Переднюю и боковые панели можно настроить отдельно.",
  },
  {
    title: "Проверьте задание перед отправкой",
    text: "Сверьте размеры, количество, рисунок и цвет. Сохраните позицию в спецификацию. Для нескольких корзин повторите подбор; общий файл задания скачивается ниже.",
  },
];
export function BasketGuide({ step }: { step: number }) {
  const g = guidance[step];
  return (
    <aside className="mb-5" aria-label="Подсказка по подбору">
      <p className="text-xs font-bold uppercase tracking-widest text-[#9a3b00]">
        Сталь Продукт · помощь в подборе
      </p>
      <h3 className="mt-2 text-xl font-semibold">{g.title}</h3>
      <p className="mt-3 text-sm leading-6">{g.text}</p>
      {step === 1 && (
        <svg
          viewBox="0 0 440 230"
          role="img"
          aria-label="Схема сбоку: несущая стена, слой фасада, отступ, блок и передняя панель"
          className="mt-5 w-full"
        >
          <rect x="28" y="25" width="32" height="155" fill="#46505a" />
          <rect x="60" y="25" width="60" height="155" fill="#c7ccc9" />
          <path
            d="M65 180H360V166H120"
            fill="none"
            stroke="#b84b00"
            strokeWidth="6"
          />
          <rect
            x="175"
            y="60"
            width="140"
            height="102"
            rx="5"
            fill="#fff"
            stroke="#34404a"
            strokeWidth="2"
          />
          <circle
            cx="245"
            cy="110"
            r="33"
            fill="none"
            stroke="#68757d"
            strokeWidth="2"
          />
          <path
            d="M355 48V162"
            stroke="#34404a"
            strokeWidth="7"
            strokeDasharray="5 5"
          />
          <path
            d="M122 42H173M177 42H313M317 42H353"
            stroke="#b84b00"
            strokeWidth="2"
          />
          <g fontSize="12" fill="#25292c" textAnchor="middle">
            <text x="43" y="200">
              Стена
            </text>
            <text x="95" y="219">
              Фасад
            </text>
            <text x="145" y="30">
              Отступ
            </text>
            <text x="245" y="30">
              Блок
            </text>
            <text x="361" y="200">
              Панель
            </text>
          </g>
        </svg>
      )}
      {step === 2 && (
        <svg
          viewBox="0 0 440 215"
          role="img"
          aria-label="Перфорация: диаметр отверстия, шаг между центрами, поле от края"
          className="mt-5 w-full"
        >
          <rect
            x="40"
            y="35"
            width="350"
            height="135"
            fill="#fff"
            stroke="#68757d"
          />
          {[100, 180, 260, 340].map((x) => (
            <g key={x}>
              <circle cx={x} cy="85" r="19" fill="#46505a" />
              <circle cx={x} cy="137" r="19" fill="#46505a" />
            </g>
          ))}
          <path
            d="M100 55V18M180 55V18M100 23H180M81 85H119M40 185H81"
            stroke="#b84b00"
            strokeWidth="2"
          />
          <g fontSize="13" fill="#25292c">
            <text x="116" y="15">
              Шаг
            </text>
            <text x="43" y="207">
              Поле
            </text>
            <text x="225" y="207">
              Диаметр — поперёк отверстия
            </text>
          </g>
        </svg>
      )}
      {step === 0 && (
        <details className="mt-4 border-t border-black/20 pt-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Как выглядит корзина на фасаде
          </summary>
          <figure className="mt-3">
            <Image
              src="/images/web/climate-ac-basket-r01.jpg"
              alt="Пример оформления перфорированной корзины на фасаде"
              width={960}
              height={540}
              sizes="(max-width: 1024px) 90vw, 480px"
              className="h-auto w-full"
            />
            <figcaption className="mt-2 text-xs">
              Иллюстрация внешнего вида. Конструкция подбирается по вашему
              заданию.
            </figcaption>
          </figure>
        </details>
      )}
      {step === 3 && (
        <details className="mt-4 border-t border-black/20 pt-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Что проверяет инженер
          </summary>
          <Image
            src="/images/real-production/engineering-department.jpg"
            alt="Инженерно-конструкторский центр Сталь Продукт"
            width={960}
            height={640}
            sizes="(max-width: 1024px) 90vw, 480px"
            className="mt-3 h-auto w-full"
          />
          <p className="mt-3 text-sm leading-6">
            Внутренние размеры, сервисный доступ, воздухообмен, крепления,
            нагрузку и комплект деталей. После этого подтверждаются исполнение и
            стоимость.
          </p>
        </details>
      )}
      <p className="mt-3 text-xs text-[#526069]">
        Схемы условные, без масштаба. Это пояснения к вводу, не монтажные
        чертежи.
      </p>
    </aside>
  );
}
