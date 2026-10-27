"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, X } from "lucide-react";
import { useCart, updateCartQty, removeFromCart, MAX_QTY } from "@/lib/cart";
import { won } from "@/lib/format";
import { STORE_CATEGORY_LABEL } from "@/lib/store";
import type { StoreQuote } from "@/lib/store-pricing";
import Image from "next/image";
import { canOptimize } from "@/lib/images";

export default function CartPage() {
  const router = useRouter();
  const items = useCart();
  const [quote, setQuote] = useState<StoreQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  // 장바구니가 바뀔 때마다 서버 견적
  useEffect(() => {
    if (items === null) return;
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/store/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const json = await res.json();
        if (id !== reqId.current) return;
        if (!res.ok) setError(json.message ?? "견적을 불러오지 못했습니다.");
        else {
          setQuote(json);
          setError("");
        }
      } catch {
        if (id === reqId.current) setError("네트워크 오류가 발생했습니다.");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [items]);

  if (items === null) return <div className="mx-auto h-96 max-w-5xl" />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold">장바구니가 비어 있습니다</h1>
        <p className="mt-2 text-sm text-sub">원하는 가전을 골라 담으면 세트 할인이 자동으로 적용됩니다.</p>
        <Link href="/store" className="mt-8 inline-block rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white">
          가전 쇼핑하기
        </Link>
      </div>
    );
  }

  const lineMap = new Map(quote?.lines.map((l) => [l.cartId, l]));
  const hasError = quote?.lines.some((l) => l.error);

  return (
    <div className="mx-auto max-w-site px-4 pb-28 pt-8 md:px-6 lg:pb-0">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-[28px]">장바구니</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
        <ul className="space-y-3">
          {items.map((it) => {
            const l = lineMap.get(it.id);
            return (
              <li key={it.id} className={`flex gap-4 rounded-xl border p-4 ${l?.error ? "border-coral/50 bg-coral/5" : "border-line"}`}>
                <Link href={`/store/${it.productId}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-soft">
                  {l?.thumbnail && (
                    <Image src={l.thumbnail} alt="" width={96} height={96} sizes="96px" className="h-full w-full object-cover" unoptimized={!canOptimize(l.thumbnail)} />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-sub">
                        {l?.brand}
                        {l?.category && ` · ${STORE_CATEGORY_LABEL[l.category]}`}
                        {l?.bundleEligible && <span className="ml-1.5 text-navy">세트 할인</span>}
                      </p>
                      <Link href={`/store/${it.productId}`} className="line-clamp-1 font-bold hover:underline">
                        {l?.productName ?? "불러오는 중..."}
                      </Link>
                      {l && !l.error && (
                        <p className="mt-0.5 text-[13px] text-sub">
                          {l.modelName} · {Object.values(l.attributes).join(" · ")}
                          {l.addons.length > 0 && ` · ${l.addons.map((a) => a.label).join(", ")}`}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => removeFromCart(it.id)} aria-label="삭제" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sub hover:bg-soft">
                      <X size={16} />
                    </button>
                  </div>

                  {l?.error && <p className="mt-2 text-sm font-semibold text-coral">{l.error}</p>}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-lg border border-line bg-white">
                      <button type="button" aria-label="수량 감소" onClick={() => updateCartQty(it.id, it.quantity - 1)} disabled={it.quantity <= 1} className="grid h-9 w-9 place-items-center disabled:opacity-30">
                        <Minus size={14} />
                      </button>
                      <span className="tabular w-8 text-center text-sm font-bold">{it.quantity}</span>
                      <button type="button" aria-label="수량 증가" onClick={() => updateCartQty(it.id, it.quantity + 1)} disabled={it.quantity >= MAX_QTY} className="grid h-9 w-9 place-items-center disabled:opacity-30">
                        <Plus size={14} />
                      </button>
                    </div>
                    {l && !l.error && (
                      <div className="text-right">
                        {l.addonUnit > 0 && <p className="tabular text-xs text-sub">설치·옵션 +{won(l.addonUnit * l.quantity)}</p>}
                        <p className="tabular font-extrabold">{won(l.lineTotal)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          <Link href="/store" className="block py-3 text-center text-sm font-semibold text-navy">+ 상품 더 담기</Link>
        </ul>

        <aside>
          <div className="space-y-4 lg:sticky lg:top-28">
            {quote && quote.hints.length > 0 && (
              <div className="rounded-xl bg-navy/5 p-4 text-sm font-semibold text-navy">
                {quote.hints.map((h) => <p key={h}>{h}</p>)}
              </div>
            )}

            <section className={`rounded-xl border border-line bg-white p-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {quote ? (
                <>
                  <dl className="tabular space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-sub">상품 금액</dt><dd>{won(quote.goodsTotal)}</dd></div>
                    <div className="flex justify-between"><dt className="text-sub">설치·부가 옵션</dt><dd>{won(quote.addonTotal)}</dd></div>
                    <div className="flex justify-between"><dt className="text-sub">배송비</dt><dd>무료</dd></div>
                  </dl>

                  <div className="mt-4 rounded-lg bg-soft p-3 text-sm">
                    <div className="flex justify-between font-bold">
                      <span>세트 할인 {quote.rate > 0 && `${quote.rate}%`}</span>
                      <span className="tabular text-coral">{quote.discount > 0 ? `-${won(quote.discount)}` : "0원"}</span>
                    </div>
                    {quote.appliedRules.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-xs text-sub">
                        {quote.appliedRules.map((r) => <li key={r.name}>{r.name} {r.rate}%</li>)}
                        {quote.rawRate > quote.rate && <li>합계 {quote.rawRate}% → 최대 {quote.maxRate}% 적용</li>}
                        <li>할인 대상 상품 금액 {won(quote.eligibleAmount)} 기준</li>
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-sub">세트 할인 대상 상품을 함께 담으면 할인이 적용됩니다.</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                    <span className="font-bold">결제 예정금액</span>
                    <span className="tabular text-2xl font-extrabold text-navy">{won(quote.grandTotal)}</span>
                  </div>
                  {quote.quoteRequired && <p className="mt-2 text-xs text-sub">현장 견적 옵션이 포함되어 설치 시 추가 비용이 발생할 수 있습니다.</p>}
                </>
              ) : (
                <div className="h-48 animate-pulse rounded-lg bg-soft" />
              )}

              {error && <p className="mt-3 text-sm font-semibold text-coral">{error}</p>}
              {hasError && <p className="mt-3 text-sm font-semibold text-coral">주문할 수 없는 상품을 삭제하거나 수정해주세요.</p>}

              <button
                type="button"
                onClick={() => router.push("/cart/checkout")}
                disabled={!quote?.ok || loading}
                className="mt-5 hidden h-14 w-full rounded-xl bg-navy font-bold text-white hover:bg-navy-700 disabled:bg-sub lg:block"
              >
                주문하기
              </button>
            </section>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-sub">결제 예정금액{quote && quote.discount > 0 && ` (세트 할인 -${won(quote.discount)})`}</p>
            <p className="tabular truncate text-lg font-extrabold text-navy">{quote ? won(quote.grandTotal) : "-"}</p>
          </div>
          <button type="button" onClick={() => router.push("/cart/checkout")} disabled={!quote?.ok || loading} className="h-12 shrink-0 rounded-xl bg-navy px-8 font-bold text-white disabled:bg-sub">
            주문하기
          </button>
        </div>
      </div>
    </div>
  );
}