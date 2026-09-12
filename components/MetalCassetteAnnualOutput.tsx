type MetalCassetteAnnualOutputProps = {
  className?: string;
};

export function MetalCassetteAnnualOutput({ className = "" }: MetalCassetteAnnualOutputProps) {
  return (
    <div className={`overflow-hidden border border-steel-orange/35 bg-[linear-gradient(115deg,rgba(224,86,36,.13),rgba(17,21,25,.98)_48%)] ${className}`}>
      <div className="grid lg:grid-cols-[.78fr_1.22fr] lg:items-stretch">
        <div className="flex flex-col justify-center border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Производственный масштаб</p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            ≈60 000 <span className="text-xl text-white/55 sm:text-2xl">м²/год</span>
          </p>
          <p className="mt-3 text-xs uppercase tracking-[.08em] text-white/40">фасадных металлокассет</p>
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <h2 className="text-xl font-semibold uppercase leading-tight sm:text-2xl">Серийное производство для крупных объектов</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62">
            Около 60&nbsp;000 м² металлокассет в год — ориентир текущего масштаба этого производственного направления «Сталь Продукт». Объём складывается из серийных партий для жилых, медицинских, образовательных и других строительных объектов, где особенно важны повторяемость геометрии, стабильность покрытия и управляемая комплектация большого количества позиций.
          </p>
          <p className="mt-3 max-w-3xl text-xs leading-6 text-white/42">
            Показатель отражает ориентировочный годовой выпуск направления и не является обещанием фиксированной доступной мощности для отдельного заказа: срок конкретной партии зависит от номенклатуры, размеров, покрытия и текущей производственной загрузки.
          </p>
        </div>
      </div>
    </div>
  );
}
