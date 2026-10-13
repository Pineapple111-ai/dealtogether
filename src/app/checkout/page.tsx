import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCampaignDetail } from "@/lib/queries/campaign-detail";
import { computeQuote, decodeSelection } from "@/lib/pricing";
import { needsInstallation } from "@/lib/checkout-schema";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import OrderSummary from "@/components/checkout/OrderSummary";

export const metadata: Metadata = { title: "주문서 작성", robots: { index: false } };

type Props = { searchParams: Promise<{ c?: string; s?: string }> };

export default function CheckoutPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-site animate-pulse px-6 pt-10" />}>
      <CheckoutLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckoutLoader({ searchParams }: Props) {
  const { c, s } = await searchParams;
  if (!c || !s) return <Invalid />;

  const detail = await getCampaignDetail(c);
  const sel = decodeSelection(s);
  if (!detail || !sel) return <Invalid slug={c} />;

  const { ok, errors, quote } = computeQuote(detail, sel);
  if (!ok) return <Invalid slug={c} errors={errors} />;

  const includedTypes = detail.items
    .filter((i) => quote.lines.some((l) => l.packageItemId === i.id))
    .map((i) => i.productType);

  return (
    <CheckoutForm
      endpoint="/api/orders"
      payload={{ campaignSlug: c, selection: s }}
      total={quote.grandTotal}
      showInstallation={needsInstallation(includedTypes)}
      summary={
        <OrderSummary
          brand={detail.campaign.package.brand.name}
          caption={detail.campaign.name}
          title={detail.campaign.package.name}
          lines={quote.lines.map((l) => ({
            key: l.packageItemId,
            title: l.itemLabel,
            optional: l.isOptional,
            quantity: l.quantity,
            model: `${l.modelName} (${l.modelCode})`,
            detail: [
              Object.entries(l.attributes).map(([k, v]) => `${k} ${v}`).join(", "),
              l.addons.map((a) => a.label).join(", "),
            ].filter(Boolean).join(" · "),
          }))}
          rows={[
            [`공동구매가 × ${quote.quantity}`, quote.basePrice],
            ["옵션 추가 금액", quote.optionTotal],
            ["선택 구성품", quote.optionalItemTotal],
            ["설치·부가 옵션", quote.installationFee],
            ["배송비", quote.shippingFee],
          ]}
          total={quote.grandTotal}
          quoteRequired={quote.quoteRequired}
        />
      }
    />
  );
}

function Invalid({ slug, errors }: { slug?: string; errors?: string[] }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-xl font-bold">주문을 진행할 수 없습니다</h1>
      {errors?.length ? (
        <ul className="mt-4 space-y-1 text-sm text-coral">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-sub">선택 정보가 없거나 만료되었습니다. 상품 페이지에서 다시 선택해주세요.</p>
      )}
      <Link href={slug ? `/campaigns/${slug}` : "/campaigns"} className="mt-8 inline-block rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white">
        상품 페이지로 돌아가기
      </Link>
    </div>
  );
}