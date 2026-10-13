import { won } from "@/lib/format";

export type SummaryLine = {
  key: string;
  title: string;
  optional?: boolean;
  quantity: number;
  model: string;
  detail: string;
};

export default function OrderSummary({
  brand,
  caption,
  title,
  lines,
  rows,
  discount = 0,
  discountLabel = "할인",
  total,
  quoteRequired = false,
}: {
  brand: string;
  caption?: string;
  title: string;
  lines: SummaryLine[];
  rows: [string, number][];
  discount?: number;
  discountLabel?: string;
  total: number;
  quoteRequired?: boolean;
}) {
  return (
    <>
      <section className="rounded-xl border border-line bg-white p-5">
        <p className="text-[13px] font-bold text-sub">{brand}</p>
        {caption && <p className="mt-0.5 text-xs text-sub">{caption}</p>}
        <h2 className="mt-1 text-lg font-bold">{title}</h2>
        <ul className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
          {lines.map((l) => (
            <li key={l.key}>
              <p className="font-semibold">
                {l.title}
                {l.optional && <span className="ml-1 text-xs font-normal text-sub">(선택)</span>}
                <span className="tabular ml-1 font-normal text-sub">× {l.quantity}</span>
              </p>
              <p className="text-[13px] text-sub">{l.model}</p>
              {l.detail && <p className="text-[13px] text-sub">{l.detail}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <dl className="tabular space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-sub">{k}</dt>
              <dd>{v > 0 ? won(v) : k === "배송비" ? "무료" : "0원"}</dd>
            </div>
          ))}
          {discount > 0 && (
            <div className="flex justify-between font-semibold text-coral">
              <dt>{discountLabel}</dt>
              <dd>-{won(discount)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-bold">최종 결제 예정금액</span>
          <span className="tabular text-2xl font-extrabold text-navy">{won(total)}</span>
        </div>
        {quoteRequired && <p className="mt-3 text-xs text-sub">현장 견적 옵션이 포함되어 설치 시 추가 비용이 발생할 수 있습니다.</p>}
      </section>
    </>
  );
}