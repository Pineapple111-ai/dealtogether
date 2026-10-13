import Link from "next/link";
import { won } from "@/lib/format";
import { STORE_CATEGORY_LABEL } from "@/lib/store";
import type { StoreProduct } from "@/lib/queries/store";

export default function StoreProductCard({ p }: { p: StoreProduct }) {
  const multiPrice = new Set(p.skus.map((s) => s.salePrice)).size > 1;
  return (
    <Link
      href={`/store/${p.id}`}
      className={`group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-navy/40 ${p.inStock ? "" : "opacity-60"}`}
    >
      <div className="relative aspect-square bg-soft">
        {p.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumbnail} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-end p-5">
            <span className="text-sm font-semibold" style={{ color: p.brand.theme_color ?? "#102a43" }}>
              {STORE_CATEGORY_LABEL[p.category]} · {p.productType}
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {p.bundleEligible && <span className="rounded-full bg-navy px-2.5 py-1 text-[11px] font-bold text-white">세트 할인</span>}
          {!p.inStock && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-sub">품절</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[13px] font-bold" style={{ color: p.brand.theme_color ?? "#102a43" }}>{p.brand.name}</p>
        <h3 className="mt-1 line-clamp-2 font-bold leading-snug">{p.name}</h3>
        {p.summary && <p className="mt-1 line-clamp-1 text-sm text-sub">{p.summary}</p>}
        <div className="mt-auto pt-3">
          {p.minListPrice > p.minPrice && <p className="tabular text-xs text-sub line-through">{won(p.minListPrice)}</p>}
          <p className="tabular flex items-baseline gap-1.5">
            {p.minListPrice > p.minPrice && (
              <span className="font-extrabold text-coral">
                {Math.floor(((p.minListPrice - p.minPrice) / p.minListPrice) * 100)}%
              </span>
            )}
            <span className="text-lg font-extrabold">{won(p.minPrice)}</span>
            {multiPrice && <span className="text-xs text-sub">~</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}