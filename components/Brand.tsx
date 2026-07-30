export function Brand() {
  return <div className="flex min-w-max items-center gap-3">
    <img src="/logo/steel-product.png" alt="СП Сталь Продукт" width={1851} height={402} loading="eager" decoding="async" className="h-9 w-auto max-w-[170px] object-contain" />
    <span className="hidden border-l border-white/20 pl-3 text-[8px] font-semibold uppercase leading-[1.35] tracking-[.055em] text-white/60 sm:block">Инженерные решения<br />из листового металла</span>
  </div>;
}
