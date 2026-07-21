export function Brand() {
  return <div className="flex min-w-max items-center gap-3">
    <img src="/logo/steel-product.png" alt="СП Сталь Продукт" className="h-8 w-auto max-w-[152px] object-contain sm:h-9 sm:max-w-[175px]" />
    <span className="hidden border-l border-white/20 pl-3 text-[8px] font-medium uppercase leading-[1.25] tracking-wide text-white/65 sm:block">Инженерные решения<br />из листового металла</span>
  </div>;
}
