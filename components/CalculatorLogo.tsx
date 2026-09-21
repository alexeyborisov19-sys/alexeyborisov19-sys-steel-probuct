import Image from 'next/image';

/** Approved original brand artwork; keep its native proportions and colours. */
export function CalculatorLogo({className = ''}: {className?:string}) {
  return <Image src="/logo/steel-product.png" alt="Сталь Продукт" width={1851} height={402} unoptimized className={`h-auto w-44 max-w-full object-contain ${className}`} />;
}
