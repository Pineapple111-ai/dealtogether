"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart, clearCart } from "@/lib/cart";
import { needsInstallation } from "@/lib/checkout-schema";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import OrderSummary from "@/components/checkout/OrderSummary";
import type { StoreQuote } from "@/lib/store-pricing";

export default function CartCheckoutPage() {
  const items = useCart();
  const [quote, setQuote] = useState<StoreQuote | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (items === null || quote) return;
    if (items.length === 0) {
      setError("장바구니가 비어 있습니다.");
      return;
    }
    fetch("/api/store/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) setError(json.message ?? "주문 정보를 불러오지 못했습니다.");
        else if (!json.ok) setError("주문할 수 없는 상품이 있습니다. 장바구니를 확인해주세요.");
        else setQuote(json);
      })
      .catch(() => setError("네트워크 오류가 발생했습니다."));
  }, [items, quote]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-bold">주문을 진행할 수 없습니다</h1>
        <p className="mt-3 text-sm text-sub">{error}</p>
        <Link href="/cart" className="mt-8 inline-block rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white">장바구니로 돌아가기</Link>
      </div>
    );
  }
  if (!quote || !items) return <div className="mx-auto h-96 max-w-site animate-pulse px-6 pt-10" />;

  const brands = [...new Set(quote.lines.map((l) => l.brand))].join(" · ");

  return (
    <CheckoutForm
      endpoint="/api/store/orders"
      payload={{ items }}
      total={quote.grandTotal}
      showInstallation={needsInstallation(quote.lines.map((l) => l.productType))}
      onSuccess={clearCart}
      summary={
        <OrderSummary
          brand={brands}
          caption="가전 쇼핑"
          title={`상품 ${quote.lines.length}건`}
          lines={quote.lines.map((l) => ({
            key: l.cartId,
            title: l.productName,
            quantity: l.quantity,
            model: `${l.modelName} (${l.modelCode})`,
            detail: [Object.values(l.attributes).join(" · "), l.addons.map((a) => a.label).join(", ")].filter(Boolean).join(" · "),
          }))}
          rows={[
            ["상품 금액", quote.goodsTotal],
            ["설치·부가 옵션", quote.addonTotal],
            ["배송비", quote.shippingFee],
          ]}
          discount={quote.discount}
          discountLabel={`세트 할인 ${quote.rate}%`}
          total={quote.grandTotal}
          quoteRequired={quote.quoteRequired}
        />
      }
    />
  );
}