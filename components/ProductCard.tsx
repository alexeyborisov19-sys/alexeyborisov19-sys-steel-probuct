import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
  return <article className="group flex h-full flex-col overflow-hidden border border-white/12 bg-[#111519] transition hover:border-steel-orange">
    <div className="relative flex h-52 items-center justify-center overflow-hidden border-b border-white/10 bg-[#f4f4f1] p-3">
      <Image
        src={product.technicalImage}
        alt={`Чертёж изделия «${product.title}»`}
        fill
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
        className="object-contain p-3 transition duration-500 group-hover:scale-[1.025]"
      />
    </div>
    <div className="flex flex-1 flex-col p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">{product.category}</p>
      <h3 className="mt-3 text-lg font-semibold uppercase leading-tight">{product.title}</h3>
      {product.badge && <p className="mt-2 text-xs text-white/48">{product.badge}</p>}
      <p className="mt-4 text-sm leading-relaxed text-white/62">{product.lead}</p>
      <Link href={`/products/${product.slug}`} className="mt-auto pt-6 text-xs font-bold uppercase text-steel-orange">Смотреть изделие&nbsp; →</Link>
    </div>
  </article>;
}
