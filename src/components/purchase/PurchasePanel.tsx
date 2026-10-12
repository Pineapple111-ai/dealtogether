"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ChevronDown } from "lucide-react";
import ItemSelector from "./ItemSelector";
import Countdown from "@/components/campaign/Countdown";
import { won, formatDate } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/campaign";
import {
  computeQuote,
  defaultSelection,
  encodeSelection,
  maxPurchasable,
  type CampaignDetail,
  type ItemSelection,
} from "@/lib/pricing";

export default function PurchasePanel({ detail }: { detail: CampaignDetail }) {
  const router = useRouter();
  const c = detail.campaign;
  const [sel, setSel] = useState(() => defaultSelection(detail));
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);

  const { ok, errors, quote } = useMemo(() => computeQuote(detail, sel), [detail, sel]);
  const maxQty = maxPurchasable(detail);

  const setItem = (id: string, v: ItemSelection) => setSel((s) => ({ ...s, items: { ...s.items, [id]: v } }));
  const setQty = (n: number) => setSel((s) => ({ ...s, quantity: Math.min(Math.max(n, 1), Math.max(maxQty, 1)) }));

  const buy = () => {
    setTried(true);
    if (!ok) {
      document.getElementById("purchase-errors")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setPending(true);
    router.push(`/checkout?c=${encodeURIComponent(c.slug)}&s=${encodeSelection(sel)}`);
  };

  const buttonLabel = c.isPurchasable ? (pending ? "이동 중..." : "구매하기") : STATUS_LABEL[c.status];

  const rows: [string, number][] = [
    [`공동구매가 × ${quote.quantity}`, quote.basePrice],
    ["옵션 추가 금액", quote.optionTotal],
    ["선택 구성품", quote.optionalItemTotal],
    ["설치·부가 옵션", quote.installationFee],
    ["배송비", quote.shippingFee],
  ];

  return (
    <div className="space-y-6">
      {/* 상품 정보 */}
      <div>
        <p className="text-sm font-bold" style={{ color: c.package.brand.theme_color ?? "#102a43" }}>
          {c.package.brand.name}
        </p>
        <p className="mt-1 text-[13px] text-sub">{c.name}</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight md:text-[28px]">
          {c.package.name}
        </h1>
        {detail.productCode && <p className="mt-1 text-xs text-sub">상품코드 {detail.productCode}</p>}
        {c.package.summary && <p className="mt-3 text-[15px] text-ink/80">{c.package.summary}</p>}

        <div className="mt-5">
          {c.discountRate > 0 && (
            <p className="tabular text-sm text-sub">
              정상가 <span className="line-through">{won(c.listPrice)}</span>
            </p>
          )}
          <p className="tabular mt-0.5 flex items-baseline gap-2">
            {c.discountRate > 0 && <span className="text-[28px] font-extrabold text-coral">{c.discountRate}%</span>}
            <span className="text-[28px] font-extrabold">{won(c.campaignPrice)}</span>
            <span className="text-sm text-sub">공동구매가</span>
          </p>
        </div>
      </div>

      {/* 공동구매 현황 */}
      <div className="rounded-xl bg-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-bold">
            {c.status === "scheduled" ? "공동구매 시작까지" : "공동구매 마감까지"}
          </span>
          {c.isPurchasable || c.status === "scheduled" ? (
            <Countdown
              endAt={c.status === "scheduled" ? c.startAt : c.endAt}
              serverNow={detail.serverNow}
              variant="boxes"
            />
          ) : (
            <span className="font-bold text-sub">{STATUS_LABEL[c.status]}</span>
          )}
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-sm">
            <span className="tabular">
              현재 <b className="text-navy">{c.participants}명</b> / 목표 {c.targetParticipants}명
            </span>
            <span className="tabular font-bold text-navy">{c.progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-navy" style={{ width: `${c.progress}%` }} />
          </div>
        </div>

        <dl className="tabular mt-4 grid grid-cols-2 gap-y-1.5 text-[13px]">
          <dt className="text-sub">모집 기간</dt>
          <dd className="text-right">
            {formatDate(c.startAt, false)} ~ {formatDate(c.endAt, false)}
          </dd>
          <dt className="text-sub">총 판매 수량</dt>
          <dd className="text-right">{c.maxQuantity}세트</dd>
          <dt className="text-sub">잔여 수량</dt>
          <dd className="text-right font-semibold">{c.remaining}세트</dd>
          <dt className="text-sub">1인 구매 한도</dt>
          <dd className="text-right">{detail.perUserLimit}세트</dd>
        </dl>
        <p className="mt-3 text-xs text-sub">참여 인원은 결제 확인이 완료된 주문 기준으로 집계됩니다.</p>
      </div>

      {/* 구성품 선택 */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold">구성품 선택</h2>
        {detail.items.map((item) => (
          <ItemSelector
            key={item.id}
            item={item}
            value={sel.items[item.id]}
            need={item.quantity * quote.quantity}
            onChange={(v) => setItem(item.id, v)}
          />
        ))}
      </div>

      {/* 수량 */}
      <div className="flex items-center justify-between rounded-xl border border-line p-5">
        <div>
          <p className="font-bold">수량</p>
          <p className="text-xs text-sub">최대 {Math.max(maxQty, 0)}세트</p>
        </div>
        <div className="flex items-center rounded-lg border border-line">
          <button
            type="button"
            aria-label="수량 감소"
            onClick={() => setQty(sel.quantity - 1)}
            disabled={sel.quantity <= 1}
            className="grid h-11 w-11 place-items-center disabled:opacity-30"
          >
            <Minus size={16} />
          </button>
          <span className="tabular w-10 text-center font-bold">{sel.quantity}</span>
          <button
            type="button"
            aria-label="수량 증가"
            onClick={() => setQty(sel.quantity + 1)}
            disabled={sel.quantity >= maxQty}
            className="grid h-11 w-11 place-items-center disabled:opacity-30"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 선택한 패키지 구성 보기 */}
      <details className="group rounded-xl border border-line" open>
        <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-bold">
          선택한 패키지 구성 보기
          <ChevronDown size={18} className="transition-transform group-open:rotate-180" />
        </summary>
        <ul className="space-y-4 border-t border-line p-5 text-sm">
          {quote.lines.map((l) => (
            <li key={l.packageItemId}>
              <p className="font-bold">
                {l.itemLabel}
                {l.isOptional && <span className="ml-1 text-xs font-normal text-sub">(선택)</span>}
                <span className="tabular ml-1 font-normal text-sub">× {l.quantity}</span>
              </p>
              <p className="mt-0.5 text-sub">
                {l.modelName} ({l.modelCode})
              </p>
              <p className="text-sub">
                {Object.entries(l.attributes)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(", ")}
              </p>
              {l.addons.length > 0 && (
                <p className="text-sub">{l.addons.map((a) => `${a.group}: ${a.label}`).join(", ")}</p>
              )}
            </li>
          ))}
        </ul>
      </details>

      {/* 금액 */}
      <div className="rounded-xl border border-line p-5">
        <dl className="tabular space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-sub">{k}</dt>
              <dd>{v > 0 ? won(v) : k === "배송비" ? "무료" : "0원"}</dd>
            </div>
          ))}
          {quote.listTotal > quote.basePrice && (
            <div className="flex justify-between text-coral">
              <dt>정상가 대비 할인</dt>
              <dd>-{won(quote.listTotal - quote.basePrice)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-bold">최종 결제 예정금액</span>
          <span className="tabular text-2xl font-extrabold text-navy">{won(quote.grandTotal)}</span>
        </div>
        {quote.quoteRequired && (
          <p className="mt-3 text-xs text-sub">현장 견적 옵션이 포함되어 있어 설치 현장에서 추가 비용이 발생할 수 있습니다.</p>
        )}
        <p className="mt-2 text-xs text-sub">최종 금액은 주문 생성 시 서버에서 다시 확인됩니다.</p>
      </div>

      {tried && errors.length > 0 && (
        <ul id="purchase-errors" className="space-y-1 rounded-xl bg-coral/10 p-4 text-sm font-semibold text-coral">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={buy}
        disabled={!c.isPurchasable || pending}
        className="hidden w-full rounded-xl bg-navy py-4 text-base font-bold text-white transition-colors hover:bg-navy-700 disabled:bg-sub lg:block"
      >
        {buttonLabel}
      </button>

      {/* 모바일 하단 고정 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-sub">최종 결제 예정금액</p>
            <p className="tabular truncate text-lg font-extrabold text-navy">{won(quote.grandTotal)}</p>
          </div>
          <button
            type="button"
            onClick={buy}
            disabled={!c.isPurchasable || pending}
            className="h-12 shrink-0 rounded-xl bg-navy px-8 font-bold text-white disabled:bg-sub"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}